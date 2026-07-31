"""
hero.png 를 시차용 레이어로 분해한다.

  0. 하늘   — 원본에서 투명하므로 파일로 뽑지 않는다 (페이지 배경이 비침)
  1. 지면   — 지평선 아래 전체. 로켓/인물에 가려진 부분은 주변 색으로 메운다
  2. 로켓   — 투명 배경 컷아웃
  3. 인물   — 투명 배경 컷아웃

핵심: 마스크를 새로 만들지 않고 **원본 PNG 의 알파 채널을 그대로 쓴다.**
이 그림은 하늘이 투명하고 그려진 부분만 불투명이라, 알파가 곧 작가가 그린
실루엣이다. 임계값으로 다시 따내면 안티에일리어싱이 뭉개지고 윤곽이 두꺼워진다.
직접 만든 마스크는 로켓과 인물을 서로 나눌 때만 보조로 쓴다.
"""

import argparse
import json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SPLIT_X = 841                          # 로켓 / 인물 경계
HORIZON_LO, HORIZON_HI = 1330, 1445    # 지평선이 존재할 수 있는 y 범위
HORIZON_MARGIN = 14                    # 지면 알파를 지평선보다 위로 여유 있게 잡는 폭
SEAM = 0.6                             # 지면과 물체가 만나는 곳의 전이 폭 (px)


def segment(rgba):
    """(알파, 주황마스크, 로켓, 인물) 을 돌려준다."""
    rgb = rgba[..., :3].astype(int)
    alpha = rgba[..., 3].astype(np.float32) / 255.0
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]

    orange = (r > 180) & (r - b > 50) & (r - g > 30)
    solid = alpha > 0                  # 원본 실루엣

    # 지평선 위에서는 solid 가 곧 로켓+인물.
    # 지평선 아래는 전부 불투명하므로 주황이 아닌 것으로 물체를 찾는다.
    fg = ndi.binary_fill_holes(solid & ~orange)

    # 지평선 윤곽선(얇은 가로 획)이 물체와 붙어 한 덩어리가 되는 것을 막는다.
    # 세로로만 침식하면 가로선은 사라지고 안테나 같은 세로 구조는 살아남는다.
    vert = np.ones((9, 1), bool)
    seed = ndi.binary_opening(fg, vert)
    lab, n = ndi.label(seed)
    sizes = ndi.sum(seed, lab, range(1, n + 1))
    seed = lab == (int(np.argmax(sizes)) + 1)
    subject = ndi.binary_dilation(seed, vert) & fg

    xs = np.arange(rgba.shape[1])[None, :]
    return alpha, orange, subject & (xs < SPLIT_X), subject & (xs >= SPLIT_X)


def horizon_curve(orange, subject):
    """열마다 지면이 시작하는 y. 물체에 가려진 열은 양옆에서 보간한다."""
    h, w = orange.shape
    top = np.full(w, np.nan)
    for x in range(w):
        idx = np.where(orange[:, x])[0]
        if len(idx):
            y = idx[0]
            if HORIZON_LO <= y <= HORIZON_HI and not subject[max(y - 8, 0):y + 8, x].any():
                top[x] = y
    ok = ~np.isnan(top)
    top = np.interp(np.arange(w), np.arange(w)[ok], top[ok])
    return ndi.uniform_filter1d(top, 41).astype(int)


def bleed(rgb, valid):
    """투명한 곳의 RGB 를 가장 가까운 불투명 픽셀 색으로 채운다.

    이걸 안 하면 브라우저가 확대·축소할 때 투명부의 색이 가장자리로 번져
    어두운 테두리가 생긴다.
    """
    _, idx = ndi.distance_transform_edt(~valid, return_indices=True)
    return rgb[idx[0], idx[1]]


def smooth_fill(rgb, valid, sigma=25.0):
    """valid 픽셀들의 국소 평균색으로 나머지를 메운다. 가려진 지면 복원용."""
    m = valid.astype(np.float32)
    den = ndi.gaussian_filter(m, sigma) + 1e-6
    out = np.empty(rgb.shape, np.float32)
    for c in range(3):
        out[..., c] = ndi.gaussian_filter(rgb[..., c].astype(np.float32) * m, sigma) / den
    return np.clip(out, 0, 255).astype(np.uint8)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("src")
    p.add_argument("-o", "--outdir", default=".")
    p.add_argument("--width", type=int, default=0, help="출력 가로 크기 (0 = 원본 그대로)")
    args = p.parse_args()

    rgba = np.array(Image.open(args.src).convert("RGBA"))
    h, w, _ = rgba.shape
    rgb = rgba[..., :3]

    alpha, orange, rocket, person = segment(rgba)
    subject = rocket | person
    hz = horizon_curve(orange, subject)
    ys = np.arange(h)[:, None]

    # --- 지면 ---
    # 알파를 지평선보다 위로 여유 있게 열어두고, 실제 경계는 원본 알파가 결정하게 한다.
    below = ys >= (hz - HORIZON_MARGIN)[None, :]
    ground_a = alpha * ndi.gaussian_filter(below.astype(np.float32), SEAM)

    visible = (ys >= hz[None, :]) & ~ndi.binary_dilation(subject, np.ones((7, 7)))
    clean = visible & orange                      # 그림자·윤곽선을 뺀 순수 지면
    ground_rgb = np.where(visible[..., None], rgb, smooth_fill(rgb, clean))

    # --- 컷아웃 ---
    # 원본 알파에 소속 마스크만 곱한다. 부풀리거나 페더를 추가하지 않는다.
    layers = {"ground": (ground_rgb, ground_a)}
    for name, mask in (("rocket", rocket), ("person", person)):
        layers[name] = (rgb, alpha * ndi.gaussian_filter(mask.astype(np.float32), SEAM))

    out_w = args.width or w
    out_h = round(h * out_w / w)
    meta = {"source": [w, h], "output_width": out_w,
            "horizon_pct": round(float(hz.mean()) / h * 100, 2)}

    for i, name in enumerate(["ground", "rocket", "person"], start=1):
        col, a = layers[name]
        col = bleed(col.astype(np.uint8), a > 0.5)

        rgb_im = Image.fromarray(col, "RGB")
        a_im = Image.fromarray((a * 255).round().astype(np.uint8), "L")
        # RGB 와 알파를 따로 리샘플링한다. RGBA 통째로 줄이면 투명부 색이 번진다.
        if (out_w, out_h) != (w, h):
            rgb_im = rgb_im.resize((out_w, out_h), Image.LANCZOS)
            a_im = a_im.resize((out_w, out_h), Image.LANCZOS)
        im = Image.merge("RGBA", (*rgb_im.split(), a_im))

        png = f"{args.outdir}/layer-{i}-{name}.png"
        # optimize=True 는 알파 0 인 픽셀의 RGB 를 0 으로 밀어버린다.
        im.save(png, optimize=False, compress_level=9)

        webp = f"{args.outdir}/layer-{i}-{name}.webp"
        if name == "ground":
            im.save(webp, quality=92, method=6)
        else:
            im.save(webp, lossless=True, method=6)
        print(f"saved {png}, {webp}")

    for name, mask in (("rocket", rocket), ("person", person)):
        yy, xx = np.where(mask)
        meta[name] = {"origin_x_pct": round(float(xx.mean()) / w * 100, 2),
                      "origin_y_pct": round(float(yy.max()) / h * 100, 2)}

    with open(f"{args.outdir}/layers.json", "w") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()

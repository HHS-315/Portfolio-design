# assets/video

WORK 서브페이지 헤더 등에 쓰는 **영상 에셋** 폴더.

## 네이밍 규칙
work-detail.js의 이미지 컨벤션(`<key>-hero`)을 그대로 이어간다. `<key>`는 각
작업의 `data-key`(index.html의 `.wbig__item[data-key]`, work-detail.js의 `WORK_DETAILS`).

```
assets/video/<key>-hero.mp4      # 헤더 메인 영상 (H.264/AAC, 권장)
assets/video/<key>-hero.webm     # (선택) 용량 작은 대체 소스 (VP9/AV1)
```

예) 약봉지 → `data-key="yakbongji"` →
```
assets/video/yakbongji-hero.mp4
assets/video/yakbongji-hero.webm      (선택)
assets/img/work/yakbongji-hero-poster.jpg   # poster (재생 전 정지 프레임)
```

## 가이드
- **용량**: 웹 헤더용은 ~5–15MB 이하로 압축. GitHub는 파일당 100MB 초과를 거부하고
  50MB 초과 시 경고 — 큰 파일은 Git LFS 사용.
- **자동재생**: `<video muted loop playsinline poster="…">` — 모바일 자동재생을
  위해 `muted`는 필수. `poster`로 로딩/재생 전 첫 프레임을 채운다.
- 영상이 없는 작업은 기존대로 이미지(placeholder 포함)로 폴백한다.

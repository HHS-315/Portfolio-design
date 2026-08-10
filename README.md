# 황혜선 — UX/UI · AI 캐릭터 · 바이브코딩 포트폴리오

글리프(문자)로만 그린 **민들레** 위에 얹은 디자이너 **황혜선**의 싱글 페이지
포트폴리오입니다. 다크(#0a0a0a) + 모노스페이스(JetBrains Mono) 무드의 터미널
에디토리얼 톤이며, 담긴 내용은 UX/UI 디자인 · AI 캐릭터·그래픽 · 바이브코딩입니다.

## 배경 레이어

두 개의 고정 캔버스가 겹칩니다(뒤 → 앞): **셰이더 배경** → **민들레 글리프**.

- `assets/js/shader-bg.js` — 21st.dev Shader Builder의 "Neuro Noise"(Paper
  Shaders, Apache-2.0)를 **의존성 없는 순수 JS**로 포팅. `<canvas id="shaderbg">`
  (`z-index:0`)에 WebGL로 그려지며, **검은 배경 + 어두운 회색** 필라멘트로
  리컬러했습니다. 커서 상호작용은 끄고(민들레 hover와 충돌 방지) 느리게만
  흐르며, `prefers-reduced-motion`이면 정지, WebGL이 없으면 조용히 무시됩니다.
  히어로·About처럼 배경이 비치는 섹션에서 보이고, 불투명 섹션은 이를 가립니다.
- 이 사이트는 React/shadcn/TS가 아니라 **정적 단일 HTML**이라, 원본 shadcn용
  `blue-noise.tsx` 컴포넌트 대신 동일 셰이더를 바닐라 JS로 이식했습니다.

## 민들레 — DANDELION (순수 JS 캔버스)

- `assets/js/dandelion.js` — 의존성 없는 순수 JS. `<canvas id="field">`에 흰
  글리프로 민들레(머리·줄기·잎)를 그립니다. 깊이는 **알파(불투명도)로만** 표현.
- 배경 레이어(`#field{position:fixed;inset:0;z-index:0}`)로 깔리고 콘텐츠가 그
  위에 올라갑니다. 섹션에는 가독성용 `.sec--tint` 스크림이 있습니다.
- 스크립트가 **`body`의 `font-family`를 읽어** 글리프를 그리므로, body 폰트를
  모노스페이스로 지정하기만 하면 됩니다(JetBrains Mono → `monospace` 폴백).
- **인트로 시퀀스(최초 1회)**: 글리프가 오프스크린 캔버스에서 추출한 좌표로
  **"PORTFOLIO" 글자**를 이루었다가 → 바깥으로 **흩어진 뒤** → 각자의 최종
  위치(민들레)로 **수렴**합니다(text→scatter→form→live, easeOutCubic + 글리프별
  랜덤 딜레이). 텍스트 폭은 뷰포트 ~76%, 모바일 자동 축소. 리사이즈로 재시작
  되지 않으며, `prefers-reduced-motion`일 땐 인트로를 건너뛰고 바로 민들레.
- 인터랙션: 머리에 커서를 **hover** 하면 홀씨가 흩날리고 몇 초 뒤 중심에서
  다시 자랍니다. 머리를 **클릭**하거나 `#wishInput`에 입력 후 **Enter** 하면
  전체가 한 번에 흩어집니다.
- 스크립트가 있으면 연동되는 선택 요소(없어도 에러 없음):
  `#title`(글자 스크램블 등장) · `#count`/`#total`(홀씨 카운터) · `#wishInput`/`#wishHint`
  · `.reveal`(스크롤 진입 페이드).

## 섹션 구조 (업로드한 dandelion HTML 구조 채택)

- **.bar** — 상단 바(이름 + 내비 + 태그)
- **.hero** — `PORTFOLIO` 타이틀 + 황혜선 · UX/UI · AI 캐릭터 · 바이브코딩 + 홀씨 카운터
- **#about** — 가운데 민들레를 그대로 두고(투명 패널) **좌·우 중앙에 텍스트**를
  배치: 왼쪽은 소개 문구, 오른쪽은 이름·역할·스킬(모바일에선 중앙 정렬로 스택)
- **#work** — 세 가지 전문 분야(01 UX/UI · 02 AI 캐릭터·그래픽 · 03 바이브 코딩) + 작업 목록
- **#process** — 리서치 → 디자인 → 개발 → 전달 4단계 그리드
- **#contact** — `say_hello( )` 입력 + 이메일 + 소셜
- **footer** — 소개 + ASCII 민들레 모티프

## 바로 보기

이 페이지는 **자체 완결형**입니다. CSS는 `<style>`에 인라인, JS는 `dandelion.js`
한 파일뿐이라 빌드 없이 바로 열립니다.

```bash
# 방법 1 — 파일로 바로 열기
open index.html        # macOS (Windows: start index.html / Linux: xdg-open index.html)

# 방법 2 — 로컬 서버
npm start              # → http://localhost:8000 (정적 서버)
```

> JetBrains Mono는 Google Fonts에서 불러옵니다(오프라인/차단 시 시스템
> `monospace`로 자동 폴백 — 민들레는 그대로 그려집니다).

## 구조

```
index.html               # 페이지 마크업 + 인라인 CSS
assets/js/dandelion.js   # 글리프 민들레 캔버스 (순수 JS, 의존성 없음)
assets/fonts/            # self-host Pretendard (미사용 · 보관)
```

> 참고: 이전 우주 테마에서 쓰던 파일(`assets/styles.css`, `assets/js/gsap.min.js`,
> `assets/hero/*`)은 현재 페이지에서 참조하지 않습니다. (`shader-bg.js`는
> 다시 사용 중 — 위 "배경 레이어" 참고.)

## 콘텐츠 교체

`index.html`의 `#work` / `#about` / `#contact`에서 프로젝트 제목·연도·설명,
소개 문구, 연락처(`hello@hyeseon.design`)·소셜 링크를 실제 값으로 교체하세요.

## 디자인 토큰

| 역할 | 값 |
|------|------|
| 배경 | `#0a0a0a` |
| 본문(bone) | `#e9e9e6` |
| 강조(hi) | `#f2f2f0` |
| 보조(dim) | `#7a7a75` |
| 라인(dimmer) | `#333` |

폰트: 본문·글리프는 **JetBrains Mono**(폴백 `monospace`), 히어로 대형 문구와
인트로 **"PORTFOLIO"** 글자꼴은 **Plus Jakarta Sans Bold**(Google Fonts, 폴백
`Helvetica Neue`/`Arial`). 인트로는 오프스크린 캔버스에서 이 폰트로 글자를
그린 뒤 좌표를 추출하므로, 시작 전 최대 0.5초 동안 폰트 로드를 기다립니다.
ABOUT 리드/이름은 **Archivo**(빅 볼드 그로테스크).

# 황혜선 — UX/UI · AI 캐릭터 · 바이브코딩 포트폴리오

글리프(문자)로만 그린 **민들레** 위에 얹은 디자이너 **황혜선**의 싱글 페이지
포트폴리오입니다. 다크(#0a0a0a) + 모노스페이스(JetBrains Mono) 무드의 터미널
에디토리얼 톤이며, 담긴 내용은 UX/UI 디자인 · AI 캐릭터·그래픽 · 바이브코딩입니다.

## 배경 — DANDELION (순수 JS 캔버스)

- `assets/js/dandelion.js` — 의존성 없는 순수 JS. `<canvas id="field">`에 흰
  글리프로 민들레(머리·줄기·잎)를 그립니다. 깊이는 **알파(불투명도)로만** 표현.
- 배경 레이어(`#field{position:fixed;inset:0;z-index:0}`)로 깔리고 콘텐츠가 그
  위에 올라갑니다. 섹션에는 가독성용 `.sec--tint` 스크림이 있습니다.
- 스크립트가 **`body`의 `font-family`를 읽어** 글리프를 그리므로, body 폰트를
  모노스페이스로 지정하기만 하면 됩니다(JetBrains Mono → `monospace` 폴백).
- 인터랙션: 머리에 커서를 **hover** 하면 홀씨가 흩날리고 몇 초 뒤 중심에서
  다시 자랍니다. 머리를 **클릭**하거나 `#wishInput`에 입력 후 **Enter** 하면
  전체가 한 번에 흩어집니다. `prefers-reduced-motion` 존중.
- 스크립트가 있으면 연동되는 선택 요소(없어도 에러 없음):
  `#title`(글자 스크램블 등장) · `#count`/`#total`(홀씨 카운터) · `#wishInput`/`#wishHint`
  · `.reveal`(스크롤 진입 페이드).

## 섹션 구조 (업로드한 dandelion HTML 구조 채택)

- **.bar** — 상단 바(이름 + 내비 + 태그)
- **.hero** — `PORTFOLIO` 타이틀 + 황혜선 · UX/UI · AI 캐릭터 · 바이브코딩 + 홀씨 카운터
- **#about** — 소개, ASCII 프로필 박스, 스킬 칩
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
> `assets/js/shader-bg.js`, `assets/hero/*`)은 현재 페이지에서 참조하지 않습니다.

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

폰트: **JetBrains Mono** (본문·글리프, 폴백 `monospace`)

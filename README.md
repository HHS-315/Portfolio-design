# YUJIN — 디자이너 포트폴리오

UX/UI · AI 그래픽 디자인 · 바이브코딩 작업물을 담은 **미니멀 럭셔리(에디토리얼)**
스타일의 싱글 페이지 포트폴리오입니다. 모든 기기에서 동작하며, GSAP 기반의
절제되고 부드러운 애니메이션이 들어가 있습니다.

## 특징

- **미니멀 럭셔리 디자인** — 오버사이즈 세리프 타이포그래피, 넉넉한 여백,
  헤어라인 구분선, 웜 뉴트럴 팔레트, 절제된 브론즈 악센트
- **정교한 한글 타이포그래피** — 제목은 명조(Noto Serif KR), 본문은 고딕(Noto Sans KR).
  라틴은 Playfair Display + Inter. 한글 폰트는 **로컬에 self-host**하여 기기와 무관하게
  동일한 세리프 렌더링 보장
- **반응형** — 모바일(375px) → 태블릿 → 데스크톱(1440px+) 전 구간 대응
- **부드러운 애니메이션 (GSAP + ScrollTrigger)**
  - 프리로더 로고 리빌 + 프로그레스 바
  - 히어로 라인마스크(줄 단위 밀어올림) 등장
  - 스크롤 리빌, 작업 이미지 시차(parallax), 숫자 카운트업
  - 미니멀 커스텀 커서, 언더라인 호버 (데스크톱)
  - 조용한 세리프 마퀴 스트립
- **작업물 필터** — 전체 / UX·UI / AI 그래픽 / 바이브코딩
- **접근성** — `prefers-reduced-motion` 존중, 키보드 포커스 링, SVG 아이콘(이모지 미사용)
- **자체 완결형** — CDN 의존 없음. CSS/JS/한글 폰트를 로컬에 번들하여 오프라인에서도 열림

## 바로 보기

### 방법 1 — 로컬 서버 (권장)

```bash
npm install     # 최초 1회
npm run dev     # → http://localhost:8000  (Tailwind watch + 정적 서버 동시 실행)
```

`npm run dev`는 CSS 자동 재빌드(`watch:css`)와 정적 서버(`serve`)를 함께 띄웁니다.
HTML의 Tailwind 클래스를 수정하면 CSS가 자동으로 다시 빌드되므로, 브라우저만
새로고침하면 됩니다. 서버만 필요하면 `npm start`(8000 포트 서빙만)를 쓰세요.
종료는 터미널에서 `Ctrl + C`.

### 방법 2 — 서버 없이 파일로 열기

빌드 없이 `index.html`을 브라우저에서 바로 열어도 됩니다. 한글 폰트·CSS·JS는
모두 로컬에 포함돼 있고, Latin 폰트(Playfair/Inter)만 온라인으로 로드됩니다.

```bash
open index.html      # macOS   (Windows: start index.html / Linux: xdg-open index.html)
```

## 스타일만 빌드

`npm run dev` 없이 CSS만 컴파일하려면:

```bash
npm run build:css    # src/input.css → assets/styles.css (압축 1회 빌드)
npm run watch:css    # 자동 재빌드만 (서버 없음)
```

> HTML의 Tailwind 클래스를 수정한 뒤에는 CSS를 다시 빌드해야 합니다.
> `npm run dev` 또는 `watch:css`를 켜두면 자동으로 처리됩니다.

## 구조

```
index.html               # 페이지 마크업 + 인터랙션 스크립트
src/input.css            # Tailwind 지시문 + @font-face + 커스텀 컴포넌트 CSS (소스)
assets/styles.css        # 컴파일된 스타일 (커밋됨 — 열람 시 이 파일 사용)
assets/js/gsap.min.js
assets/js/ScrollTrigger.min.js
assets/fonts/            # self-host 한글 웹폰트 (Noto Serif/Sans KR, Hangul 서브셋)
tailwind.config.js       # 컬러/폰트/섀도우 토큰
```

## 콘텐츠 교체

현재 작업물은 **플레이스홀더**입니다. `index.html` 하단의 `PROJECTS` 배열을 편집해
실제 프로젝트 제목·설명·카테고리·연도·색상을 넣고, 필요하면 톤 타일 대신 이미지를
넣도록 `cardHTML()`을 수정하세요. 연락처(`hello@yujin.design`)와 소셜 링크도
실제 값으로 교체하면 됩니다.

## 디자인 토큰

| 역할 | 컬러 |
|------|------|
| Background (bone) | `#F5F2EC` |
| Surface | `#FBFAF6` |
| Ink (near-black) | `#16130F` |
| Stone (본문 보조) | `#7A736A` |
| Line (헤어라인) | `#E2DBCF` |
| Accent (브론즈) | `#9C7A54` |

폰트: **Playfair Display + Noto Serif KR**(디스플레이) · **Inter + Noto Sans KR**(본문)

# HWANG HYESEON — 디자인 우주 여행 포트폴리오

UX/UI · AI 그래픽 디자인 · 바이브코딩을 **우주 여행** 컨셉으로 풀어낸 싱글 페이지
포트폴리오입니다. 발사 → 세 개의 행성(분야)에 순차 도착 → 교신으로 이어지는
여정형 구조이며, 딥스페이스 다크 무드에 Pretendard 기반의 모던·미니멀 타이포를 얹었습니다.

> **히어로는 실제 이미지**(`assets/img/hero.webp`/`.jpg`)로 채워져 있습니다.
> 나머지 그래픽 자리는 점선 테두리의 **플레이스홀더 슬롯(`.art-slot`)** 으로 비워둔
> 상태입니다(행성 3개, 탐험가 초상, 교신 위성). 슬롯 안 내용을 실제 이미지/SVG로
> 교체하면 됩니다.
>
> 업로드한 이미지는 웹 최적화 권장(예: 폭 2560px, WebP + JPG). 히어로 원본
> 17MB PNG는 118KB WebP/JPG로 최적화해 사용합니다.

## 여정 구조 (섹션)

1. **발사 (Hero)** — 퍼센트 카운터 프리로더(0→100%, 위로 슬라이드) → 히어로 이미지(로켓·인물, 전체 화면). 텍스트 없이 이미지만
2. **좌표 마퀴** — 여정 경유지 흐름 표시
3. **항해 기록 (Stats)** — 미션 숫자 카운트업
4. **세 개의 행성 (Planets)** — 분야별 "행성 도착" 섹션
   - Planet 01 · **AURA** — UX/UI (틸)
   - Planet 02 · **NEBULA** — AI 그래픽 (바이올렛)
   - Planet 03 · **EMBER** — 바이브코딩 (앰버)
   각 행성: 원형 일러스트 슬롯 + 분야 소개 + 해당 작업 목록
5. **항해 일지 (About)** — 탐험가 소개. 초상 일러스트 슬롯
6. **항로 (Process)** — 관측 → 항법 → 착륙 → 교신 4단계
7. **교신 (Contact)** — 위성 신호 슬롯 + 연락 CTA

## 특징

- **스크롤 우주×여명 전환** — 발사(딥스페이스 다크)에서 시작해 스크롤을 따라
  인디고 → 페리윙클로 밝아지고, 마지막 교신 섹션에서 따뜻한 크림(여명)으로 도착.
  배경색·본문색·내비 테마가 함께 전환됩니다 (Sleep Well Creatives 감성 참고)
- **Three.js 별/행성** — 실시간 스타필드 + 회전 와이어프레임 행성, 마우스 시차.
  여명에 가까워지면 별이 서서히 사라짐 (WebGL 미지원 시 CSS 별로 자동 폴백)
- **딥스페이스 무드** — 성운 글로우, 골드 악센트, 행성별 서브 컬러(틸/바이올렛/앰버)
- **Pretendard 단일 서체** — 제목·본문 전부 Pretendard(가변 폰트, Latin + 한글).
  로컬 self-host(가변 woff2 1파일)로 기기 무관 동일 렌더링, 오프라인 지원
- **반응형** — 모바일(375px) → 태블릿 → 데스크톱(1440px+) 전 구간 대응
- **애니메이션 (GSAP + ScrollTrigger)**
  - 퍼센트 카운터 프리로더(0→100%), 히어로 라인마스크 등장
  - 상단 미션 진행 바, 스크롤 리빌
  - **행성 도착 연출** — 스크롤 시 행성 슬롯 확대·페이드 + 시차(parallax)
  - 숫자 카운트업, 골드 커스텀 커서, 언더라인 호버
- **접근성** — `prefers-reduced-motion` 존중, 키보드 포커스 링, SVG 아이콘(이모지 미사용)
- **자체 완결형** — CDN 의존 없음. CSS/JS/한글 폰트를 로컬 번들하여 오프라인에서도 열림

## 그래픽(일러스트) 넣는 법

`index.html`에서 `art-slot` 클래스를 가진 요소가 일러스트 자리입니다. 각 슬롯의
안쪽(아이콘 + 라벨) 대신 실제 이미지를 넣으세요. 예:

```html
<!-- 교체 전: 플레이스홀더 -->
<div class="art-slot planet-slot ..."> ...라벨... </div>

<!-- 교체 후: 실제 이미지 -->
<div class="planet-slot overflow-hidden">
  <img src="./assets/img/planet-aura.png" alt="UX/UI 행성" class="w-full h-full object-cover" />
</div>
```
행성 슬롯은 원형(`planet-slot`)이라 정사각형 이미지를 넣으면 자연스럽습니다.

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
폰트(Pretendard)까지 모두 로컬에 포함되어 온라인 연결 없이도 완전히 렌더링됩니다.

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
assets/fonts/            # self-host Pretendard (가변 woff2, Latin + 한글)
tailwind.config.js       # 컬러/폰트/섀도우 토큰
```

## 콘텐츠 교체

현재 작업물은 **플레이스홀더**입니다. `index.html` 하단의 `PROJECTS` 배열을 편집해
실제 프로젝트 제목·설명·카테고리·연도·색상을 넣고, 필요하면 톤 타일 대신 이미지를
넣도록 `cardHTML()`을 수정하세요. 연락처(`hello@hyeseon.design`)와 소셜 링크도
실제 값으로 교체하면 됩니다.

## 디자인 토큰

| 역할 | 컬러 |
|------|------|
| Space (배경) | `#080B16` |
| Void (딥) | `#05070E` |
| Surface | `#111726` |
| Star (본문) | `#ECE9E2` |
| Stone (보조) | `#878EA6` |
| Gold (악센트) | `#D9B26A` |
| Aura — UX/UI 행성 | `#6FB6B0` |
| Nebula — AI 행성 | `#9B8CE0` |
| Ember — 바이브코딩 행성 | `#E0A15A` |

폰트: **Pretendard** (제목·본문 전부, 가변 폰트)

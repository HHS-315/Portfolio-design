# 황혜선 — UX/UI · AI 캐릭터 · 바이브코딩 포트폴리오

UX/UI 디자인, AI 캐릭터·그래픽, 바이브코딩을 아우르는 디자이너 **황혜선**의 싱글
페이지 포트폴리오입니다. 딥스페이스 다크 무드(전역 WebGL 셰이더 + 낙하 별)에
Pretendard 기반의 모던·미니멀 타이포와 절제된 스크롤 애니메이션을 얹었습니다.
(비주얼은 딥스페이스, 담긴 내용은 일반 디자인 포트폴리오)

> **히어로는 레이어 시차**입니다. 일러스트를 3층(`assets/hero/layer-1-ground.png`,
> `layer-2-rocket.png`, `layer-3-person.png`, 각 3548×1774 동일 프레임)으로 나눠 스크롤 시
> 층마다 다른 속도로 평행이동·확대합니다(인물>로켓>지면). CSS transform만 사용 —
> WebGL·셰이더·깊이맵은 쓰지 않습니다(형태 왜곡 없음). 하늘은 투명이라 뒤 별이 비칩니다.
>
> 세부 명세: `assets/hero/SPEC.md`. 레이어는 원본에서 `assets/hero/make_layers.py`로 생성하며
> transform-origin·수평선 좌표는 `assets/hero/layers.json`에 있습니다.
>
> ⚠️ **선명도**: 레이어 PNG는 원본 3548px·무손실이며, 투명부 RGB를 보존(bleed)해 확대 시
> 가장자리 검은 띠가 생기지 않습니다. **빌드에 이미지 압축/리사이즈 단계는 없습니다**
> (Tailwind는 CSS만 빌드, 정적 서버는 파일을 그대로 서빙). 이 파일들은 절대 재인코딩·축소하지 마세요.

## 섹션 구조

1. **Hero** — 퍼센트 카운터 프리로더(0→100%) → 히어로. 3층 레이어 시차(스크롤 시 이동·확대). 투명 하늘 뒤로 낙하 별이 비침
2. **마퀴** — UX/UI DESIGN · AI CHARACTER · VIBE CODING · PRODUCT DESIGN
3. **Stats** — 숫자 카운트업(프로젝트 / 년차 / 협업 팀 / 전문 분야)
4. **Work** — 세 가지 전문 분야
   - 01 · **UX/UI 디자인** (틸)
   - 02 · **AI 캐릭터 · 그래픽** (바이올렛)
   - 03 · **바이브 코딩** (앰버)
   각 분야: 대표 이미지 슬롯 + 소개 + 작업 목록
5. **About** — 소개. 프로필 사진 슬롯
6. **Process** — 리서치 → 디자인 → 개발 → 전달 4단계
7. **Contact** — "함께 만들어요" CTA + 이메일 + 소셜

## 특징

- **딥스페이스 배경(전 섹션 공통)** — 모든 섹션이 동일한 우주 하늘.
  - WebGL "Mesh drift" 셰이더(`initShaderBackground`, `#shaderBg`, z-index -2)를
    검정·짙은 파랑으로 리컬러해 페이지 전역에 은은한 유동 그라디언트를 깖
    (Sleep Well Creatives 감성 참고). WebGL 미지원 시 정적 #bgLayer로 폴백.
  - 그 위(z-index -1)로 **작은 노란 별이 하늘에서 내려옴**(`initStarfall`,
    `#space3d`): 밝은 노랑 + 살짝 아웃글로우로 반짝이는 느낌, 좌우 흔들림·크기·
    속도 랜덤, 화면 아래로 나가면 위에서 재생성. `prefers-reduced-motion` 시 정지.
- **딥스페이스 무드** — 성운 글로우, 골드 악센트, 분야별 서브 컬러(틸/바이올렛/앰버)
- **Pretendard 단일 서체** — 제목·본문 전부 Pretendard(가변 폰트, Latin + 한글).
  로컬 self-host(가변 woff2 1파일)로 기기 무관 동일 렌더링, 오프라인 지원
- **반응형** — 모바일(375px) → 태블릿 → 데스크톱(1440px+) 전 구간 대응
- **애니메이션 (GSAP + ScrollTrigger)**
  - 퍼센트 카운터 프리로더(0→100%), 히어로 라인마스크 등장
  - 상단 미션 진행 바, 스크롤 리빌
  - **분야 도착 연출** — 스크롤 시 분야 이미지 슬롯 확대·페이드 + 시차(parallax)
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
  <img src="./assets/img/work-uxui.png" alt="UX/UI 작업" class="w-full h-full object-cover" />
</div>
```
분야 이미지 슬롯은 원형(`planet-slot`)이라 정사각형 이미지를 넣으면 자연스럽습니다.

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
| Aura — UX/UI (틸) | `#6FB6B0` |
| Nebula — AI 캐릭터·그래픽 (바이올렛) | `#9B8CE0` |
| Ember — 바이브코딩 (앰버) | `#E0A15A` |

폰트: **Pretendard** (제목·본문 전부, 가변 폰트)

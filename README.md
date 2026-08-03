# 황혜선 — UX/UI · AI 캐릭터 · 바이브코딩 포트폴리오

UX/UI 디자인, AI 캐릭터·그래픽, 바이브코딩을 아우르는 디자이너 **황혜선**의 싱글
페이지 포트폴리오입니다. 따뜻한 화이트(#F4F2EC) 톤에 Pretendard 기반의 모던·
미니멀 타이포와 절제된 스크롤 애니메이션을 얹은 라이트 에디토리얼 무드입니다.

## 섹션 구조

1. **Hero** — 퍼센트 카운터 프리로더(0→100%) → 타이포 히어로.
   "경험을 설계하고, AI로 그리고, 코드로 만듭니다" (라인마스크 등장)
2. **마퀴** — UX/UI DESIGN · AI CHARACTER · VIBE CODING · PRODUCT DESIGN
3. **Stats** — 숫자 카운트업(프로젝트 / 년차 / 협업 팀 / 전문 분야)
4. **Work** — 세 가지 전문 분야
   - 01 · **UX/UI 디자인** (틸) — 리서치·정보구조·인터랙션·디자인 시스템
   - 02 · **AI 캐릭터 · 그래픽** (바이올렛) — 생성형 AI 캐릭터/키비주얼
   - 03 · **바이브 코딩** (앰버) — AI 페어코딩으로 실제 구현
   각 분야: 대표 이미지 슬롯 + 소개 + 작업 목록
5. **About** — 소개, 스킬 태그, 프로필 사진 슬롯
6. **Process** — 리서치 → 디자인 → 개발 → 전달 4단계
7. **Contact** — "함께 만들어요" CTA + 이메일 + 소셜
8. **Footer**

## 특징

- **라이트 에디토리얼 무드** — 따뜻한 화이트 배경, 골드 악센트, 분야별 서브
  컬러(틸/바이올렛/앰버). 큰 타이포 헤드라인 중심의 미니멀 레이아웃
- **Pretendard 단일 서체** — 제목·본문 전부 Pretendard(가변 폰트, Latin + 한글).
  로컬 self-host(가변 woff2 1파일)로 기기 무관 동일 렌더링, 오프라인 지원
- **반응형** — 모바일(375px) → 태블릿 → 데스크톱(1440px+) 전 구간 대응
- **애니메이션 (GSAP + ScrollTrigger)**
  - 퍼센트 카운터 프리로더(0→100%), 라인마스크 등장, 상단 읽기 진행 바
  - 스크롤 리빌, 분야 비주얼 스케일·시차 등장, 숫자 카운트업
  - 커스텀 커서, 언더라인 호버
- **접근성** — `prefers-reduced-motion` 존중, 키보드 포커스 링, SVG 아이콘
- **자체 완결형** — CDN 의존 없음. CSS/JS/한글 폰트를 로컬 번들하여 오프라인에서도 열림

## 이미지 넣는 법

`index.html`에서 `art-slot` 클래스를 가진 요소가 이미지 자리입니다. 각 슬롯의
안쪽(아이콘 + 라벨) 대신 실제 이미지를 넣으세요. 예:

```html
<!-- 교체 전: 플레이스홀더 -->
<div class="art-slot disc-slot ..."> ...라벨... </div>

<!-- 교체 후: 실제 이미지 -->
<div class="disc-slot overflow-hidden rounded-[1.5rem]">
  <img src="./assets/img/work-uxui.png" alt="UX/UI 작업" class="w-full h-full object-cover" />
</div>
```

## 바로 보기

### 방법 1 — 로컬 서버 (권장)

```bash
npm install     # 최초 1회
npm run dev     # → http://localhost:8000  (Tailwind watch + 정적 서버 동시 실행)
```

`npm run dev`는 CSS 자동 재빌드(`watch:css`)와 정적 서버(`serve`)를 함께 띄웁니다.
HTML의 Tailwind 클래스를 수정하면 CSS가 자동으로 다시 빌드되므로, 브라우저만
새로고침하면 됩니다. 서버만 필요하면 `npm start`(8000 포트 서빙만)를 쓰세요.

### 방법 2 — 서버 없이 파일로 열기

빌드 없이 `index.html`을 브라우저에서 바로 열어도 됩니다. 한글 폰트·CSS·JS가
모두 로컬에 포함되어 온라인 연결 없이도 완전히 렌더링됩니다.

```bash
open index.html      # macOS   (Windows: start index.html / Linux: xdg-open index.html)
```

## 스타일만 빌드

```bash
npm run build:css    # src/input.css → assets/styles.css (압축 1회 빌드)
npm run watch:css    # 자동 재빌드만 (서버 없음)
```

> HTML의 Tailwind 클래스를 수정한 뒤에는 CSS를 다시 빌드해야 합니다.

## 구조

```
index.html               # 페이지 마크업 + 인터랙션 스크립트
src/input.css            # Tailwind 지시문 + @font-face + 커스텀 컴포넌트 CSS (소스)
assets/styles.css        # 컴파일된 스타일 (커밋됨 — 열람 시 이 파일 사용)
assets/js/gsap.min.js
assets/js/ScrollTrigger.min.js
assets/fonts/            # self-host Pretendard (가변 woff2, Latin + 한글)
tailwind.config.js       # 컬러/폰트 토큰
```

## 콘텐츠 교체

`index.html`의 Work / About / Contact 섹션에서 프로젝트 제목·설명·연도, 소개
문구, 스킬 태그, 연락처(`hello@hyeseon.design`)·소셜 링크를 실제 값으로 교체하세요.

## 디자인 토큰

| 역할 | 컬러 |
|------|------|
| Paper (배경) | `#F4F2EC` |
| Panel (카드) | `#FBFAF6` |
| Ink (본문) | `#1A1815` |
| Muted (보조) | `#6B655C` |
| Faint (캡션) | `#9A9488` |
| Gold (악센트) | `#A9793A` |
| UX/UI | `#2F7D6B` |
| AI 캐릭터·그래픽 | `#6E52C7` |
| 바이브코딩 | `#C26A24` |

폰트: **Pretendard** (제목·본문 전부, 가변 폰트)

# YUJIN — 디자이너 포트폴리오

UX/UI · AI 그래픽 디자인 · 바이브코딩 작업물을 담은 **네오브루탈리즘** 스타일의
싱글 페이지 포트폴리오입니다. 모든 기기에서 동작하며, GSAP 기반의 고급 애니메이션이
들어가 있습니다.

## 특징

- **네오브루탈리즘 디자인** — 두꺼운 검정 테두리, 하드 오프셋 섀도우, 하이 채도 컬러 블로킹
- **반응형** — 모바일(375px) → 태블릿 → 데스크톱(1440px+) 전 구간 대응
- **고급 애니메이션 (GSAP + ScrollTrigger)**
  - 프리로더 카운터 & 커튼 트랜지션
  - 히어로 라인별 등장, 시차(parallax) 데코 블록
  - 스크롤 리빌 스태거, 숫자 카운트업
  - 커스텀 커서 · 마그네틱 버튼 (데스크톱)
  - 무한 마퀴 스트립
- **작업물 필터** — 전체 / UX·UI / AI 그래픽 / 바이브코딩
- **접근성** — `prefers-reduced-motion` 존중, 키보드 포커스 링, 4.5:1 대비, SVG 아이콘(이모지 미사용)
- **자체 완결형** — CDN 의존 없음. CSS/JS를 로컬에 번들하여 오프라인에서도 열림

## 바로 보기

빌드 없이 `index.html`을 브라우저에서 열면 됩니다. (Google Fonts만 온라인으로 로드)

## 개발 (스타일 수정 시)

Tailwind 클래스를 바꾸면 CSS를 다시 컴파일해야 합니다.

```bash
npm install          # 최초 1회
npm run build:css    # src/input.css → assets/styles.css (압축 빌드)
npm run watch:css    # 개발 중 자동 재빌드
```

> HTML의 클래스를 수정한 뒤에는 반드시 `build:css`를 다시 실행하세요.
> 그렇지 않으면 새 유틸리티 클래스가 `assets/styles.css`에 포함되지 않습니다.

## 구조

```
index.html              # 페이지 마크업 + 인터랙션 스크립트
src/input.css           # Tailwind 지시문 + 커스텀 컴포넌트 CSS (소스)
assets/styles.css       # 컴파일된 스타일 (커밋됨 — 열람 시 이 파일 사용)
assets/js/gsap.min.js
assets/js/ScrollTrigger.min.js
tailwind.config.js      # 컬러/폰트/섀도우 토큰
```

## 콘텐츠 교체

현재 작업물은 **플레이스홀더**입니다. `index.html` 하단의 `PROJECTS` 배열을 편집해
실제 프로젝트 제목·설명·카테고리·색상을 넣고, 필요하면 컬러 타일 대신 이미지를
넣도록 `cardHTML()`을 수정하세요. 연락처(`hello@yujin.design`)와 소셜 링크도
실제 값으로 교체하면 됩니다.

## 디자인 토큰

| 역할 | 컬러 |
|------|------|
| Background | `#F4F1EA` (cream) |
| Ink | `#0A0A0A` |
| Violet (primary) | `#7C3AED` |
| Pink (accent) | `#EC4899` |
| Yellow | `#FFE100` |
| Blue | `#2563EB` |
| Lime | `#B6F400` |

폰트: **Archivo**(디스플레이) + **Space Grotesk**(본문)

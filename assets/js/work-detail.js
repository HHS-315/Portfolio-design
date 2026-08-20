/*
 * WORK detail overlay — clicking a .wbig__item expands it (FLIP) into a full-viewport, in-page
 * detail view. In-page (not a separate document) on purpose: #shaderbg/#field/#blocks/#strip are all
 * position:fixed with scroll-linked state that a page navigation would have to rebuild, and the expand
 * animation has to cross what would otherwise be a page boundary. The overlay lives at <body> level,
 * above every canvas and .shell.
 *
 * Mechanics:
 *  · FLIP — measure the clicked item's rect, map the full-viewport surface onto it (translate+scale,
 *    transform-origin 0 0; NO width/height animation → no layout thrash), then rAF-tween to identity.
 *    rAF, not a CSS transition, mirrors the rest of the site (about-lines / work-list) and stays
 *    fully reversible for close. reduced-motion → jump straight to the open state.
 *  · Background canvases are paused for the duration via a `work:overlay` CustomEvent that shader-bg.js,
 *    dandelion.js and work-transition.js listen for (nothing visible → no wasted frames, no contention).
 *  · Scroll lock preserves the exact scroll position (body:fixed + top:-scrollY), restored on close.
 *  · history.pushState → browser Back closes the overlay; ESC and the close button also close; focus is
 *    trapped inside and returned to the originating item on close; role="dialog" aria-modal.
 *
 * Placeholder images: generated inline as SVG (site tone — cool-grey #ccd2d8 + faint ASCII glyphs +
 * label), no external services. To use real images later, drop files under assets/img/work/ following
 * the path convention noted on WORK_DETAILS below and set `hero`/`shots` to those paths.
 */
(function () {
  "use strict";

  // ---- knobs --------------------------------------------------------------
  var OPEN_MS  = 760;   // expand duration (ms) — a touch longer since the ease-in front-loads slow motion
  var CLOSE_MS = 620;   // contract duration (ms)
  // cubic-bezier evaluator (P0=0,P3=1) → maps eased progress; used for the tween timing.
  function cubicBezier(x1, y1, x2, y2) {
    function bz(t, a, b) { var u = 1 - t; return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t; }
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      var lo = 0, hi = 1, t = x, xt;
      for (var i = 0; i < 24; i++) { xt = bz(t, x1, x2); if (Math.abs(xt - x) < 1e-4) break; if (xt < x) lo = t; else hi = t; t = (lo + hi) / 2; }
      return bz(t, y1, y2);
    };
  }
  var EASE_OPEN  = cubicBezier(0.65, 0, 0.85, 0.2);   // slow start → sharp finish (ease-in): emerges gently, snaps to full
  var EASE_CLOSE = cubicBezier(0.15, 0.8, 0.35, 1);   // reverse of open: quick release, decelerates into the point
  var RADIUS_PX  = 14;   // on-screen corner radius at the smallest scale; interpolates to 0 when full (÷scale corrected)
  // subpage body reveal (sequential curtain-roll mask on scroll):
  var RISE_MS    = 520;  // per-element roll-up duration (ms) — ease-out, 400–600 range
  var RISE_STAGGER = 90; // delay between elements that enter together (ms), top→down, 80–120 range
  // magnetic scroll-snap (JS, chdartmaker-style — eases to the nearest snap point after the scroll stops):
  var SNAP_STOP_MS   = 240;   // idle time after the last scroll before snapping (tell a pause from a real stop)
  var SNAP_RANGE_VH  = 0.10;  // only snap when the stop is within ±10% of the viewport height of a point (near it)
  var SNAP_MS        = 400;   // ease-to-point duration (ms) — a short "catch", not a long pull
  // -------------------------------------------------------------------------

  // ---- content ------------------------------------------------------------
  // One entry per data-key on the list items. Placeholder copy — edit here.
  // Real images later: put files at assets/img/work/<key>-hero.jpg and -01/-02/-03.jpg, then set
  //   hero:"assets/img/work/<key>-hero.jpg", shots:["assets/img/work/<key>-01.jpg", …].
  // Leave hero/shots undefined to keep the generated SVG placeholders.
  var WORK_DETAILS = {
    "yakbongji": {
      en: "Yakbongji", title: "약봉지", sub: "복약 관리 모바일 앱 — 약봉지를 스캔하면 복용 시간을 챙겨주는 서비스",
      lead: "복잡한 복약 정보를 한 장의 약봉지에서 읽어내, 누구나 놓치지 않고 약을 챙길 수 있게 설계한 모바일 경험입니다.",
      paras: [
        "사용자 인터뷰와 관찰을 통해 ‘언제·무엇을·얼마나’를 매번 헷갈리는 지점을 찾아냈고, 약봉지 촬영 한 번으로 복약 스케줄이 자동으로 구성되도록 정보 구조를 다시 짰습니다.",
        "알림·기록·보호자 공유까지 이어지는 흐름을 하나의 디자인 시스템으로 묶어, 화면이 늘어나도 일관된 규칙 안에서 확장되도록 했습니다."
      ],
      caps: ["User Research", "Information Architecture", "Interaction", "Design System"]
    },
    "stac": {
      en: "STAC", title: "STAC", sub: "생성형 AI로 만든 캐릭터·키비주얼 시리즈",
      lead: "하나의 세계관 아래 일관된 캐릭터 셋과 키비주얼을 빠르게 시각화하고, 방향을 정제해 브랜드 아트워크로 발전시켰습니다.",
      paras: [
        "콘셉트 스케치부터 스타일 시트까지 생성형 AI를 파이프라인에 넣어, 수십 개의 방향을 짧은 시간에 실험하고 비교했습니다.",
        "선택된 방향은 색·비율·질감의 규칙을 정리해 재현 가능한 스타일 가이드로 남겨, 이후 제작에서도 톤이 흔들리지 않도록 했습니다."
      ],
      caps: ["Concept", "Character Design", "Style Sheet", "Art Direction"]
    },
    "company-renewal": {
      en: "Company Renewal", title: "회사 웹사이트 리뉴얼", sub: "노후한 코퍼레이트 사이트의 구조·비주얼 전면 개편",
      lead: "오래된 정보 구조와 낡은 비주얼을 걷어내고, 브랜드의 지금을 담은 코퍼레이트 웹사이트로 다시 설계했습니다.",
      paras: [
        "핵심 메시지와 사용자 여정을 먼저 정리해 내비게이션과 페이지 위계를 재구성하고, 불필요한 뎁스를 줄였습니다.",
        "타이포그래피와 여백을 중심으로 한 절제된 비주얼 시스템을 세워, 콘텐츠가 바뀌어도 완성도가 유지되도록 했습니다."
      ],
      caps: ["IA / Structure", "Visual System", "Responsive", "Handoff"]
    },
    "maritime": {
      en: "Maritime Institute", title: "해양수산정책기술연구소 사이트", sub: "연구기관 웹사이트 — 자료 접근성과 신뢰감에 초점",
      lead: "방대한 연구 자료와 정책 정보를 명확한 위계로 정리해, 방문자가 원하는 문서까지 빠르게 도달하도록 설계했습니다.",
      paras: [
        "자료실·발간물·공지의 구조를 재정의하고 검색과 필터 흐름을 다듬어, 목적형 방문자의 경로를 짧게 만들었습니다.",
        "기관의 성격에 맞는 차분한 색과 타이포로 신뢰감을 주면서도, 딱딱하지 않은 균형을 찾았습니다."
      ],
      caps: ["IA / Structure", "Accessibility", "Visual System", "Responsive"]
    },
    "indie-film": {
      en: "Indie Film", title: "가상의 독립 영화 배급 사이트", sub: "코드로 구현한 독립 영화 배급 플랫폼 프로토타입",
      lead: "디자인을 실제 동작하는 웹으로 옮겨, 상영 정보·예매·큐레이션이 이어지는 배급 사이트를 프로토타입으로 만들었습니다.",
      paras: [
        "AI 페어 코딩으로 아이디어를 곧바로 화면으로 검증하며, 스크롤 인터랙션과 전환을 붙여 감상 경험 자체를 설계했습니다.",
        "디자인 토큰과 컴포넌트를 코드로 정리해, 작품이 늘어나도 같은 규칙 위에서 페이지가 찍혀 나오도록 했습니다."
      ],
      caps: ["Prototyping", "Interaction", "Front-end", "Design System"]
    }
  };
  // -------------------------------------------------------------------------

  var reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  var items = [].slice.call(document.querySelectorAll(".wbig__item[data-key]"));
  if (!items.length) return;

  var root = document.documentElement, body = document.body;

  // ---- generative placeholders (abstract "render": gradient-mesh blobs + turbulence grain + blur) ----
  // Network image fetch (Unsplash/Pexels/picsum) is blocked by this environment's egress proxy, so the
  // fallback is generated inline as an SVG data URI — no external services, deterministic per key. A dark
  // base (#14161a) + per-item accent keeps a crisp rectangle edge on the cool-grey (#ccd2d8) WORK page.
  // feTurbulence gives real film-like grain; heavy feGaussianBlur melts the accent blobs into a mesh.
  function esc(s) { return String(s).replace(/[<>&]/g, function (c) { return c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"; }); }
  function svgURI(inner) { return "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">' + inner + "</svg>"); }
  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function tag(t) { return '<text x="70" y="838" font-family="ui-monospace,monospace" font-size="24" letter-spacing="6" fill="rgba(233,233,230,.34)">' + esc(t) + "</text>"; }
  // per-item accent palettes (dark→bright) + a short corner tag
  var ART = {
    "yakbongji":       { cols: ["#123d3a", "#1f8f88", "#39d3c7"], tag: "UX / UI" },       // teal
    "stac":            { cols: ["#2a1740", "#7d43c9", "#c552b4"], tag: "AI · GRAPHIC" },  // violet→magenta
    "company-renewal": { cols: ["#0f2740", "#2f6fc9", "#43b6c9"], tag: "WEB" },           // blue
    "maritime":        { cols: ["#0f2a2a", "#1f7f6a", "#37b083"], tag: "WEB" },           // green-teal
    "indie-film":      { cols: ["#2a1810", "#c05a3a", "#e0a33a"], tag: "CODE · VIBE" }    // amber
  };
  function artwork(seed, cols, tg) {
    var r = rng(seed), blobs = "";
    for (var i = 0; i < 6; i++) {
      var cx = (r() * 1900 - 150) | 0, cy = (r() * 1200 - 150) | 0, rad = (340 + r() * 560) | 0,
          col = cols[(r() * cols.length) | 0], op = (0.5 + r() * 0.4).toFixed(2);
      blobs += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rad + '" fill="' + col + '" opacity="' + op + '"/>';
    }
    var defs = "<defs>" +
      '<filter id="mesh" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="120"/></filter>' +
      '<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="' + (seed % 97) + '" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>' +
      '<radialGradient id="vig" cx="50%" cy="40%" r="78%"><stop offset="52%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.55"/></radialGradient>' +
      "</defs>";
    return defs +
      '<rect width="1600" height="900" fill="#14161a"/>' +
      '<g filter="url(#mesh)">' + blobs + "</g>" +
      '<rect width="1600" height="900" filter="url(#grain)" opacity="0.10"/>' +   // film grain
      '<rect width="1600" height="900" fill="url(#vig)"/>' +                       // vignette for depth
      tag(tg);
  }
  // real image override: drop a file at assets/img/work/<key>.jpg and add it to IMG below; it wins.
  // Recommended: 1600×900 (16:9) or larger, JPG q≈75, < ~300KB, subject safe-framed for cover-crop.
  var IMG = { /* "yakbongji": "assets/img/work/yakbongji.jpg", … */ };
  function imageFor(key) {
    if (IMG[key]) return IMG[key];
    var a = ART[key] || ART["company-renewal"];
    return svgURI(artwork(hash(key), a.cols, a.tag));
  }
  // preload so the expand never flashes (data URIs decode instantly; real JPGs get cached up front).
  function preloadImages() { items.forEach(function (it) { var im = new Image(); im.src = imageFor(it.getAttribute("data-key")); }); }

  // ---- overlay DOM (built once, reused) -----------------------------------
  var overlay = document.createElement("div");
  overlay.id = "workOverlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML =
    '<div class="wd__surface"><div class="wd__hero"></div><div class="wd__scrim"></div></div>' +
    '<div class="wd__content" aria-hidden="true">' +
      '<div class="wd__stage">' +                                                // bounds the sticky title's pin range
        '<div class="wd__hero2"></div>' +
        '<div class="wd__titles"><h2 class="wd__ttl" tabindex="-1"></h2><p class="wd__ttl-sub"></p></div>' + // title + description; both pin & sweep
      '</div>' +
      '<div class="wd__page"><div class="wd__inner">' +
        '<div class="wd__body"><div class="wd__text"></div><aside><ul class="wd__caps"></ul></aside></div>' +
        '<div class="wd__grid"></div>' +
        '<div class="wd__more"></div>' +                                       // "OTHER WORK" list (built per item)
      '</div></div>' +
    '</div>' +
    // logo close-control: the button itself is mix-blend-difference (glyph-shaped inversion of the content
    // behind it), plus a SEPARATE white element on top, JS-clipped to the hero image (crisp white). See CSS.
    '<button class="wd__logo" type="button" aria-label="상세 닫기 — 목록으로">HWANG HYESEON<i class="wd__logo-star">*</i></button>' +
    '<span class="wd__logo-img" aria-hidden="true">HWANG HYESEON<i class="wd__logo-star">*</i></span>';
  body.appendChild(overlay);

  var surface = overlay.querySelector(".wd__surface"),
      hero    = overlay.querySelector(".wd__hero"),
      content = overlay.querySelector(".wd__content"),
      stage   = overlay.querySelector(".wd__stage"),
      hero2   = overlay.querySelector(".wd__hero2"),
      titles  = overlay.querySelector(".wd__titles"),
      pageEl  = overlay.querySelector(".wd__page"),
      elTtl   = overlay.querySelector(".wd__ttl"),
      elSubTtl = overlay.querySelector(".wd__ttl-sub"),
      elText  = overlay.querySelector(".wd__text"),
      elCaps  = overlay.querySelector(".wd__caps"),
      elGrid  = overlay.querySelector(".wd__grid"),
      elMore  = overlay.querySelector(".wd__more"),
      btnLogo = overlay.querySelector(".wd__logo"),
      logoImg = overlay.querySelector(".wd__logo-img");

  var LOGO_HIDDEN = "inset(0 0 100% 0)";   // image clip that shows nothing (logo reads via the blend button)

  function riseInner(text) { return '<span class="wd-rise__i">' + esc(text) + "</span>"; }

  // Snapshot the WORK list's display text once, robust to work-list.js having already wrapped .wbig__en in
  // a 2-copy curtain track (read the first .wr__copy, else the plain text). Used to rebuild the same rows
  // in the subpage "OTHER WORK" list without duplicating markup.
  var LIST = items.map(function (it) {
    var en = it.querySelector(".wbig__en"), copy = en && en.querySelector(".wr__copy");
    var ko = it.querySelector(".wbig__ko");
    return {
      key: it.getAttribute("data-key"),
      big: ((copy ? copy.textContent : (en ? en.textContent : "")) || "").trim(),
      ko:  (ko ? ko.textContent : "").trim()
    };
  });
  // Build the "OTHER WORK" list for the given active key (every row except the current one). Reuses the
  // WORK section's .wbig classes (styling + hover spotlight are shared CSS); rows switch content in place.
  function buildMore(activeK) {
    var rows = LIST.filter(function (e) { return e.key !== activeK; });
    elMore.innerHTML = '<p class="wd__more-label">OTHER WORK</p><div class="wbig">' +
      rows.map(function (e) {
        return '<div class="wbig__item" role="button" tabindex="0" data-key="' + e.key + '">' +
          '<span class="wbig__en">' + esc(e.big) + '</span>' +
          '<span class="wbig__ko">' + esc(e.ko) + '</span></div>';
      }).join("") + "</div>";
    [].slice.call(elMore.querySelectorAll(".wbig__item")).forEach(function (node) {
      var k = node.getAttribute("data-key");
      node.addEventListener("click", function (ev) { switchTo(k, ev, node); });                 // expand from the click point
      node.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); switchTo(k, null, node); } });   // no coords → row centre
      if (window.WorkListCurtain) window.WorkListCurtain(node);   // same hover curtain as the main list
    });
  }

  function populate(key) {
    var d = WORK_DETAILS[key]; if (!d) return;
    var img = imageFor(key);
    // hero title block (Korean title + description) — both carry the white→ink scroll mask (updateMask)
    elTtl.textContent = d.title || d.en || "";
    elSubTtl.textContent = d.sub || "";
    elText.innerHTML = (d.lead ? '<p class="wd__lead wd-rise">' + riseInner(d.lead) + "</p>" : "") +
      (d.paras || []).map(function (p) { return '<p class="wd__p wd-rise">' + riseInner(p) + "</p>"; }).join("");
    elCaps.innerHTML = (d.caps || []).map(function (c) { return '<li class="wd-rise">' + riseInner(c) + "</li>"; }).join("");
    hero.style.backgroundImage = "url('" + img + "')";      // FLIP surface image (the one that expands)
    hero2.style.backgroundImage = "url('" + img + "')";     // subpage hero (same image → seamless hand-off)
    // grid: three deterministic accent variations of the same artwork (real shots override via IMG later)
    var a = ART[key] || ART["company-renewal"];
    elGrid.innerHTML = [0, 1, 2].map(function (i) {
      return '<div class="wd__shot"><img alt="" src="' + (IMG[key + "-" + (i + 1)] || svgURI(artwork(hash(key + i), a.cols, a.tag))) + '"></div>';
    }).join("");
    buildMore(key);   // "OTHER WORK" list (everything but this item)
  }

  // ---- animation (single rAF tween, reversible) ---------------------------
  // Expand from a 0-size POINT at the click coords to the full viewport, keeping the viewport aspect
  // ratio throughout: the surface is fixed inset:0 (viewport-sized) and we UNIFORMLY scale it 0→1 about
  // the click point (transform-origin, set per open). Uniform scale keeps the image proportional — no
  // inverse correction needed. Close reverses the same tween back to the point.
  var ox = 0, oy = 0, p = 0, raf = 0, tFrom = 0, tTo = 0, tStart = 0, tDur = 0, tEase = EASE_OPEN, tDone = null;

  function applyFrame(pr) {
    var s = pr < 0.0001 ? 0.0001 : pr;                 // avoid an exact scale(0) frame
    surface.style.transform = "scale(" + s.toFixed(5) + ")";
    // border-radius rides the scale, so divide by s to keep the ON-SCREEN radius = visR (no ballooning).
    // visR itself eases RADIUS_PX → 0 across the expand, so it's slightly round while small, square when full.
    var visR = (1 - pr) * RADIUS_PX;
    surface.style.borderRadius = (visR / s).toFixed(2) + "px";
    // detail content (title/body/caps/grid) stays hidden this step — reveal is deferred to the next step.
  }
  function tick(now) {
    var e = tDur <= 0 ? 1 : (now - tStart) / tDur; if (e > 1) e = 1;
    p = tFrom + (tTo - tFrom) * tEase(e);
    applyFrame(p);
    if (e < 1) raf = requestAnimationFrame(tick);
    else { raf = 0; p = tTo; if (tDone) { var d = tDone; tDone = null; d(); } }
  }
  function tweenTo(target, dur, ease, done) {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    tFrom = p; tTo = target; tStart = performance.now(); tDur = dur; tEase = ease; tDone = done;
    raf = requestAnimationFrame(tick);
  }

  // ---- scroll lock (position-preserving) ----------------------------------
  var savedScroll = 0;
  // block page scroll on touch, but ALLOW scrolling inside the detail content (its own overflow area).
  function blockTouch(e) { if (content.contains(e.target)) return; e.preventDefault(); }
  function lockScroll() {
    savedScroll = window.scrollY || window.pageYOffset || 0;
    body.style.top = (-savedScroll) + "px";
    body.classList.add("wd-lock");
    document.addEventListener("touchmove", blockTouch, { passive: false });
  }
  function unlockScroll() {
    var y = savedScroll;
    document.removeEventListener("touchmove", blockTouch, { passive: false });
    body.classList.remove("wd-lock");
    body.style.top = "";
    // Restore INSTANTLY: html{scroll-behavior:smooth} would otherwise animate scrollTo(y) from 0 and
    // that animation gets interrupted (by focus()/late history restore) and strands the page at the top.
    var prevSB = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, y);
    // re-assert next frame in case the browser restores the popped entry's own (0) scroll after popstate.
    requestAnimationFrame(function () { window.scrollTo(0, y); root.style.scrollBehavior = prevSB; });
  }

  // ---- focus trap ---------------------------------------------------------
  var lastFocus = null;
  function focusables() {
    return [].slice.call(overlay.querySelectorAll('button,[href],[tabindex]:not([tabindex="-1"])'))
      .filter(function (el) { return el.offsetParent !== null || el === btnLogo; });
  }
  function onKeydown(e) {
    if (e.key === "Escape") { e.preventDefault(); requestClose(); return; }
    if (e.key !== "Tab") return;
    var f = focusables(); if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ---- detail subpage: reveal after expand + scroll mask ------------------
  // The title uses a background-clip:text gradient hard-stopped at --cut. On scroll we move --cut to the
  // image's on-screen bottom edge, so the part of the glyphs still over the image is white and the part
  // below the image boundary (now over the grey page) is ink. The logo flips ink once the hero scrolls past.
  var maskRaf = 0;
  // Set the white→ink mask boundary on one element: --cut = px from the element's top down to the image's
  // on-screen bottom edge (clamped to the element height) → white above it, ink below.
  function setCut(el, imgBottom) {
    var r = el.getBoundingClientRect(), cut = imgBottom - r.top;
    if (cut < 0) cut = 0; else if (cut > r.height) cut = r.height;
    el.style.setProperty("--cut", cut.toFixed(1) + "px");
  }
  function updateMask() {
    if (!isOpen) return;
    var hb = hero2.getBoundingClientRect();
    setCut(elTtl, hb.bottom);       // big Korean title
    setCut(elSubTtl, hb.bottom);    // its description below — same mask
    updateLogoMask(hb);
  }
  // Logo mask: whiten the part of the logo that overlaps any DARK element behind it. For each target we
  // intersect its on-screen rect with the logo box (2D — so a short list title covering only the left of
  // the logo whitens only that part) and clip one pooled white layer to that overlap. Targets:
  //   · hero image (.wd__hero2) — a dark region filling the width from the top down to its bottom edge
  //   · subpage title (.wd__ttl) — big uppercase, cap-top→baseline glyph band
  //   · OTHER WORK list big text (.wbig__en) — the case in the report; glyph band (Korean fills more of
  //     the box than Latin caps → a smaller ascent inset)
  // rAF-throttled via onContentScroll; off-screen targets are skipped before the intersection.
  // The body/title/list inversion is handled per-pixel by the .wd__logo button's own mix-blend-mode (CSS,
  // no JS). All JS does is clip the crisp-white .wd__logo-img element to the hero image's rectangle: the
  // image is full-width, so the clip is a vertical band from the logo top down to the image's bottom edge.
  function updateLogoMask(hb) {
    var b = btnLogo.getBoundingClientRect(), lc = hb.bottom - b.top;
    logoImg.style.clipPath = lc <= 0 ? LOGO_HIDDEN : lc >= b.height ? "inset(0)" : "inset(0 0 " + (b.height - lc).toFixed(1) + "px 0)";
  }
  // Force the image layer fully white — used while the expand surface (a dark new image) covers the screen.
  function logoWhite() { logoImg.style.clipPath = "inset(0)"; }
  function onContentScroll() { if (maskRaf) return; maskRaf = requestAnimationFrame(function () { maskRaf = 0; updateMask(); }); }
  // Position the sticky title at the image's bottom-left and size its pin range.
  //  · marginTop pulls the title UP to overlap the image's bottom edge (visible over the hero at scroll 0),
  //    sitting `gap` px above that edge.
  //  · top is the sticky pin line = the same viewport y, so it's pinned from scroll 0; the image then rides
  //    up behind it and its bottom sweeps the glyphs white→ink (updateMask drives --cut).
  //  · the stage min-height (image + title + gap) is the title's sticky containing block, so the title
  //    RELEASES and scrolls away just after the image has fully passed — no title stranded over the body.
  function layoutTitle() {
    var vh = window.innerHeight;
    var gap = Math.round(Math.min(64, vh * 0.06));     // block bottom sits this far above the image bottom
    var th = titles.offsetHeight || 0;                 // whole block = title + description (so both pin & sweep)
    titles.style.marginTop = -(th + gap) + "px";
    titles.style.top = (vh - th - gap) + "px";
    stage.style.minHeight = (vh + th + gap) + "px";
  }
  // ---- sequential body reveal (curtain-roll mask, one-shot per open) -------
  // Each .wd-rise element rolls its inner block up as it enters the scrollport. The scrollport is
  // .wd__content (position:fixed) — NOT the window — so the IntersectionObserver root MUST be content,
  // or nothing would ever intersect. Elements that enter in the same callback are staggered top→down so
  // a screenful of paragraphs doesn't burst at once. One-shot: unobserve on reveal (no replay on re-entry).
  var revealIO = null;
  function resetReveal() {
    if (revealIO) { revealIO.disconnect(); revealIO = null; }
    var els = content.querySelectorAll(".wd-rise");
    for (var i = 0; i < els.length; i++) { els[i].classList.remove("is-in"); els[i].style.transitionDelay = ""; }
  }
  function setupReveal() {
    resetReveal();
    content.style.setProperty("--wd-rise-dur", RISE_MS + "ms");
    if (reduce || !("IntersectionObserver" in window)) {   // no motion → show everything immediately
      var all = content.querySelectorAll(".wd-rise");
      for (var i = 0; i < all.length; i++) all[i].classList.add("is-in");
      return;
    }
    revealIO = new IntersectionObserver(function (entries) {
      var fresh = [];
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (e.isIntersecting && !e.target.classList.contains("is-in")) fresh.push(e);
      }
      if (!fresh.length) return;
      fresh.sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
      for (var j = 0; j < fresh.length; j++) {
        var el = fresh[j].target;
        el.style.transitionDelay = (j * RISE_STAGGER) + "ms";
        el.classList.add("is-in");
        revealIO.unobserve(el);
      }
    }, { root: content, rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    var targets = content.querySelectorAll(".wd-rise");
    for (var k = 0; k < targets.length; k++) revealIO.observe(targets[k]);
  }

  // ---- magnetic scroll-snap (JS, chdartmaker-style) -----------------------
  // After scrolling STOPS (SNAP_STOP_MS idle), if the rest position is within ±SNAP_RANGE_VH of THE snap
  // point, ease the scroll to it. There is a SINGLE point — the hero→body boundary (page top) — the one
  // transition worth catching. (The "OTHER WORK list start" point was dropped: it sits after the body, so
  // snapping there interrupted reading on the way past.) With the tighter ±10vh gate the snap only bites
  // right at the boundary and never mid-body, so it doesn't fight the title-mask scrub or reading.
  // Disabled on mobile and under reduced-motion.
  var snapTimer = 0, snapRaf = 0, snapping = false;
  function isMobile() { return matchMedia("(max-width:560px)").matches; }
  function snapPoints() {
    return pageEl ? [pageEl.offsetTop] : [];          // hero → body boundary only
  }
  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
  function easeScroll(target, dur) {
    snapping = true;
    var from = content.scrollTop, start = performance.now();
    if (snapRaf) cancelAnimationFrame(snapRaf);
    function step(now) {
      var e = dur <= 0 ? 1 : (now - start) / dur; if (e > 1) e = 1;
      content.scrollTop = from + (target - from) * easeOutCubic(e);
      if (e < 1) snapRaf = requestAnimationFrame(step);
      else { snapRaf = 0; snapping = false; }
    }
    snapRaf = requestAnimationFrame(step);
  }
  function cancelSnap() { if (snapRaf) { cancelAnimationFrame(snapRaf); snapRaf = 0; } snapping = false; }
  function trySnap() {
    if (!isOpen || snapping || reduce || isMobile()) return;
    if (content.getAttribute("aria-hidden") !== "false") return;
    var y = content.scrollTop, vh = content.clientHeight, range = vh * SNAP_RANGE_VH;
    var pts = snapPoints(), best = null, bestD = Infinity;
    for (var i = 0; i < pts.length; i++) { var d = Math.abs(pts[i] - y); if (d < bestD) { bestD = d; best = pts[i]; } }
    if (best == null || bestD > range || bestD < 2) return;
    var max = content.scrollHeight - vh, target = Math.max(0, Math.min(best, max));
    if (Math.abs(target - y) < 2) return;
    easeScroll(target, SNAP_MS);
  }
  function scheduleSnap() { clearTimeout(snapTimer); snapTimer = setTimeout(trySnap, SNAP_STOP_MS); }
  function onSnapScroll() { if (snapping) return; scheduleSnap(); }         // ignore our own programmatic scroll
  // A wheel OR a touch that starts mid-snap cancels it immediately, so the user is never fighting the ease
  // (touchstart matters on touch devices wider than the mobile cutoff, where the snap is still active).
  function onSnapInput() { cancelSnap(); scheduleSnap(); }

  // ---- item switch (FLIP expand, in place) --------------------------------
  // Swap the underlying subpage to a new item (scroll to top, re-arm mask + reveal + snap). History-agnostic
  // — the caller decides push (forward click) vs pop (Back). Used by flipSwap.
  function swapContent(newKey) {
    activeKey = newKey;
    cancelSnap(); clearTimeout(snapTimer);
    content.scrollTop = 0;
    populate(newKey);                                  // rebuilds body + "OTHER WORK" + images
    layoutTitle();
    setupReveal();                                     // re-arm the sequential reveal for the new content
    updateMask();
    overlay.setAttribute("aria-label", (WORK_DETAILS[newKey].title || "Work") + " 상세");
  }
  // The shared FLIP expand used for EVERY item change — clicking a row AND browser Back/Forward. REUSES the
  // main expand (applyFrame/tweenTo/EASE_OPEN, radius correction) exactly as open() does. The subpage is
  // covered by .wd__content (fixed) with .wd__surface display:none, so we: point the surface at the NEW
  // item's image, raise it above the content (z-index 1, still under the logo z-2), scale it 0→1 from the
  // origin, then swap the content underneath and hide the surface — the new hero2 image matches, so the
  // hand-off is seamless (identical to the initial open). `doPush` distinguishes a forward click (push a new
  // history entry) from a Back/Forward nav (history already moved). Calling it again mid-expand (rapid Back)
  // just retargets: tweenTo cancels the in-flight tween, so only the last one's swap runs → ends correct.
  function flipSwap(newKey, oxp, oyp, doPush) {
    cancelSnap(); clearTimeout(snapTimer);
    if (reduce) { if (doPush) pushHist(newKey); swapContent(newKey); return; }   // no expand under reduced-motion
    switching = true;
    ox = oxp; oy = oyp;
    hero.style.backgroundImage = "url('" + imageFor(newKey) + "')";   // the image that expands = the target item's
    surface.style.transformOrigin = ox + "px " + oy + "px";
    p = 0; applyFrame(0);
    surface.style.display = "";
    surface.style.zIndex = "1";                        // above the current content, below the logo
    logoWhite();                                       // the expanding dark image covers the screen → logo white
    tweenTo(1, OPEN_MS, EASE_OPEN, function () {
      if (doPush) pushHist(newKey);
      swapContent(newKey);                             // repopulate underneath now that the surface hides it
      surface.style.display = "none";
      surface.style.zIndex = "";
      updateMask();                                    // recompute the logo for the new (top) position
      switching = false;
    });
  }
  // Forward navigation — clicking an OTHER WORK row: expand from the CLICK point (direct manipulation; the
  // cursor/finger IS the origin). Keyboard activation (no coords) → the row centre.
  function switchTo(newKey, ev, srcEl) {
    if (!isOpen || switching || !WORK_DETAILS[newKey] || newKey === activeKey) return;
    var oxp, oyp;
    if (ev && typeof ev.clientX === "number" && (ev.clientX || ev.clientY)) { oxp = ev.clientX; oyp = ev.clientY; }
    else if (srcEl) { var r = srcEl.getBoundingClientRect(); oxp = r.left + r.width / 2; oyp = r.top + r.height / 2; }
    else { oxp = navOrigin().x; oyp = navOrigin().y; }
    flipSwap(newKey, oxp, oyp, true);
  }
  // Browser Back/Forward (and keyboard activation) have no on-page point, so they expand from the viewport's
  // TOP-LEFT CORNER — a fixed nav anchor, independent of the logo's text width. A tiny inset off the exact
  // (0,0) corner keeps the origin from sitting on the very edge, but it's not tied to any element's size.
  var NAV_ORIGIN = 0;    // expand origin = the exact top-left viewport corner (0,0)
  function navOrigin() { return { x: NAV_ORIGIN, y: NAV_ORIGIN }; }

  function showPage() {
    content.setAttribute("aria-hidden", "false");
    content.scrollTop = 0;
    content.style.setProperty("--wd-content", "1");   // reveal (hero2 == surface image → seamless)
    surface.style.display = "none";                    // the subpage hero now stands in for the FLIP layer
    layoutTitle();
    setupReveal();                                     // arm the sequential body reveal
    content.addEventListener("scroll", onContentScroll, { passive: true });
    content.addEventListener("scroll", onSnapScroll, { passive: true });
    content.addEventListener("wheel", onSnapInput, { passive: true });
    content.addEventListener("touchstart", onSnapInput, { passive: true });
    updateMask();
  }
  function hidePage() {
    content.removeEventListener("scroll", onContentScroll);
    content.removeEventListener("scroll", onSnapScroll);
    content.removeEventListener("wheel", onSnapInput);
    content.removeEventListener("touchstart", onSnapInput);
    cancelSnap(); clearTimeout(snapTimer);
    resetReveal();                                     // clear reveal state so a reopen replays it
    content.setAttribute("aria-hidden", "true");
    content.style.setProperty("--wd-content", "0");
    surface.style.display = "";                         // bring the FLIP layer back for the contract
  }

  // ---- open / close -------------------------------------------------------
  var isOpen = false, activeKey = null, switching = false;
  // History model: each item on screen is ONE history entry (open pushes the first, every FLIP switch
  // pushes another), so the browser Back button steps to the PREVIOUS item, then finally out to WORK —
  // matching the navigational feel of the expand. The depth is stored IN each state (d) so it stays correct
  // across Back AND Forward. The explicit close controls (logo / ESC) pop ALL overlay entries at once.
  var curDepth = 0, closingHist = false;
  function pushHist(key) {
    curDepth += 1;
    try { history.pushState({ wd: key, d: curDepth }, "", "#work/" + key); } catch (e) {}
  }

  function signal(open) { try { window.dispatchEvent(new CustomEvent("work:overlay", { detail: { open: open } })); } catch (e) {} }

  function open(item, ev) {
    if (isOpen) return;
    var key = item.getAttribute("data-key"); if (!WORK_DETAILS[key]) return;
    isOpen = true; activeKey = key; lastFocus = item;
    populate(key);
    // origin point: the exact click coords, or the item centre when opened by keyboard (no coords).
    var r = item.getBoundingClientRect();
    if (ev && typeof ev.clientX === "number" && (ev.clientX || ev.clientY)) { ox = ev.clientX; oy = ev.clientY; }
    else { ox = r.left + r.width / 2; oy = r.top + r.height / 2; }
    surface.style.transformOrigin = ox + "px " + oy + "px";
    p = 0; applyFrame(0);
    overlay.classList.add("is-active");
    overlay.setAttribute("aria-hidden", "false");
    overlay.setAttribute("aria-label", (WORK_DETAILS[key].title || "Work") + " 상세");
    content.setAttribute("aria-hidden", "true");   // content deferred → keep it inert this step
    lockScroll();
    signal(true);
    document.addEventListener("keydown", onKeydown, true);
    // keep the browser from restoring scroll on the back/popstate that closes us (belt-and-braces with the intro script)
    try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch (e) {}
    curDepth = 0; pushHist(key);                    // first overlay history entry (depth 1)
    try { btnLogo.focus({ preventScroll: true }); } catch (e) { btnLogo.focus(); }   // focus into the dialog (logo = close control)
    logoWhite();                                    // white over the expanding dark image (updateMask corrects it in showPage)
    if (reduce) { p = 1; applyFrame(1); showPage(); }
    else tweenTo(1, OPEN_MS, EASE_OPEN, showPage);   // reveal the scrollable subpage once the expand lands
  }

  // Explicit close (logo / ESC): pop EVERY overlay entry in one go so we always land back on WORK,
  // regardless of how many items were browsed. The closingHist flag makes the resulting popstate close
  // rather than treat an intermediate item-state as a Back navigation.
  function requestClose() {
    if (!isOpen) return;
    if (curDepth > 0) { closingHist = true; try { history.go(-curDepth); } catch (e) { closingHist = false; doClose(); } }
    else doClose();
  }
  function doClose() {
    if (!isOpen) return;
    isOpen = false; switching = false; closingHist = false; curDepth = 0;
    hidePage();                                   // hide the subpage + restore the FLIP layer for the contract
    surface.style.zIndex = "";                    // clear any raise left over from a switch
    document.removeEventListener("keydown", onKeydown, true);
    var finish = function () {
      overlay.classList.remove("is-active");
      overlay.setAttribute("aria-hidden", "true");
      unlockScroll();
      signal(false);
      // preventScroll so returning focus to the list item doesn't itself scroll (fights the restore).
      if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { lastFocus.focus(); } }
      lastFocus = null; activeKey = null;
    };
    if (reduce) { p = 0; applyFrame(0); finish(); }
    else tweenTo(0, CLOSE_MS, EASE_CLOSE, finish);
  }

  // Browser Back/Forward: land on a previous/next item → FLIP-expand to it from the logo; land past the
  // overlay → close. NOTE: the close branch (doClose → unlockScroll) still owns the window scroll-restore
  // (scrollRestoration + next-frame re-assert); the item-nav branch only animates content.scrollTop, never
  // the locked window scroll, so the expand can't disturb that restore.
  window.addEventListener("popstate", function (e) {
    if (!isOpen) return;
    if (closingHist) { closingHist = false; doClose(); return; }
    var st = e.state;
    if (st && st.wd && WORK_DETAILS[st.wd]) {
      curDepth = st.d || curDepth;
      if (st.wd !== activeKey) { var o = navOrigin(); flipSwap(st.wd, o.x, o.y, false); }   // no push — history already moved; expand from the top-left corner
    } else {
      doClose();
    }
  });
  btnLogo.addEventListener("click", requestClose);
  // (No backdrop-click-to-close: the full-screen content covers the surface, and on a full-screen
  //  dialog a stray click shouldn't lose the reader's place — ESC / the close button / Back all close.)

  // surface is viewport-sized and scaled uniformly, so a mid-open resize just needs a reapply
  // (the origin stays the click point). No per-dimension recompute.
  window.addEventListener("resize", function () {
    if (!isOpen) return;
    applyFrame(p);
    // once the subpage is revealed, re-measure the title so the pin line / overlap / release point track vh
    if (content.getAttribute("aria-hidden") === "false") { layoutTitle(); updateMask(); }
  }, { passive: true });

  // ---- wire up the list items ---------------------------------------------
  items.forEach(function (item) {
    item.addEventListener("click", function (e) { open(item, e); });
    item.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(item); }   // no coords → item centre
    });
  });

  preloadImages();   // warm the cache so the first expand doesn't flash
})();

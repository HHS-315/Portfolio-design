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
  // -------------------------------------------------------------------------

  // ---- content ------------------------------------------------------------
  // One entry per data-key on the list items. Placeholder copy — edit here.
  // Real images later: put files at assets/img/work/<key>-hero.jpg and -01/-02/-03.jpg, then set
  //   hero:"assets/img/work/<key>-hero.jpg", shots:["assets/img/work/<key>-01.jpg", …].
  // Leave hero/shots undefined to keep the generated SVG placeholders.
  var WORK_DETAILS = {
    "yakbongji": {
      kicker: "UX/UI DESIGN", title: "약봉지", sub: "복약 관리 모바일 앱 — 약봉지를 스캔하면 복용 시간을 챙겨주는 서비스",
      lead: "복잡한 복약 정보를 한 장의 약봉지에서 읽어내, 누구나 놓치지 않고 약을 챙길 수 있게 설계한 모바일 경험입니다.",
      paras: [
        "사용자 인터뷰와 관찰을 통해 ‘언제·무엇을·얼마나’를 매번 헷갈리는 지점을 찾아냈고, 약봉지 촬영 한 번으로 복약 스케줄이 자동으로 구성되도록 정보 구조를 다시 짰습니다.",
        "알림·기록·보호자 공유까지 이어지는 흐름을 하나의 디자인 시스템으로 묶어, 화면이 늘어나도 일관된 규칙 안에서 확장되도록 했습니다."
      ],
      caps: ["User Research", "Information Architecture", "Interaction", "Design System"]
    },
    "stac": {
      kicker: "AI GRAPHIC", title: "STAC", sub: "생성형 AI로 만든 캐릭터·키비주얼 시리즈",
      lead: "하나의 세계관 아래 일관된 캐릭터 셋과 키비주얼을 빠르게 시각화하고, 방향을 정제해 브랜드 아트워크로 발전시켰습니다.",
      paras: [
        "콘셉트 스케치부터 스타일 시트까지 생성형 AI를 파이프라인에 넣어, 수십 개의 방향을 짧은 시간에 실험하고 비교했습니다.",
        "선택된 방향은 색·비율·질감의 규칙을 정리해 재현 가능한 스타일 가이드로 남겨, 이후 제작에서도 톤이 흔들리지 않도록 했습니다."
      ],
      caps: ["Concept", "Character Design", "Style Sheet", "Art Direction"]
    },
    "company-renewal": {
      kicker: "WEBSITE DESIGN", title: "회사 웹사이트 리뉴얼", sub: "노후한 코퍼레이트 사이트의 구조·비주얼 전면 개편",
      lead: "오래된 정보 구조와 낡은 비주얼을 걷어내고, 브랜드의 지금을 담은 코퍼레이트 웹사이트로 다시 설계했습니다.",
      paras: [
        "핵심 메시지와 사용자 여정을 먼저 정리해 내비게이션과 페이지 위계를 재구성하고, 불필요한 뎁스를 줄였습니다.",
        "타이포그래피와 여백을 중심으로 한 절제된 비주얼 시스템을 세워, 콘텐츠가 바뀌어도 완성도가 유지되도록 했습니다."
      ],
      caps: ["IA / Structure", "Visual System", "Responsive", "Handoff"]
    },
    "maritime": {
      kicker: "WEBSITE DESIGN", title: "해양수산정책기술연구소 사이트", sub: "연구기관 웹사이트 — 자료 접근성과 신뢰감에 초점",
      lead: "방대한 연구 자료와 정책 정보를 명확한 위계로 정리해, 방문자가 원하는 문서까지 빠르게 도달하도록 설계했습니다.",
      paras: [
        "자료실·발간물·공지의 구조를 재정의하고 검색과 필터 흐름을 다듬어, 목적형 방문자의 경로를 짧게 만들었습니다.",
        "기관의 성격에 맞는 차분한 색과 타이포로 신뢰감을 주면서도, 딱딱하지 않은 균형을 찾았습니다."
      ],
      caps: ["IA / Structure", "Accessibility", "Visual System", "Responsive"]
    },
    "indie-film": {
      kicker: "VIBE CODING", title: "가상의 독립 영화 배급 사이트", sub: "코드로 구현한 독립 영화 배급 플랫폼 프로토타입",
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
    '<div class="wd__content" aria-hidden="true"><div class="wd__inner">' +
      '<p class="wd__kicker"></p>' +
      '<h2 class="wd__title" tabindex="-1"></h2>' +
      '<p class="wd__sub"></p>' +
      '<div class="wd__body"><div class="wd__text"></div>' +
        '<aside><ul class="wd__caps"></ul></aside></div>' +
      '<div class="wd__grid"></div>' +
    '</div></div>' +
    '<button class="wd__logo" type="button" aria-label="상세 닫기 — 목록으로">HWANG HYESEON<span aria-hidden="true">*</span></button>';
  body.appendChild(overlay);

  var surface = overlay.querySelector(".wd__surface"),
      hero    = overlay.querySelector(".wd__hero"),
      content = overlay.querySelector(".wd__content"),
      elKick  = overlay.querySelector(".wd__kicker"),
      elTitle = overlay.querySelector(".wd__title"),
      elSub   = overlay.querySelector(".wd__sub"),
      elText  = overlay.querySelector(".wd__text"),
      elCaps  = overlay.querySelector(".wd__caps"),
      elGrid  = overlay.querySelector(".wd__grid"),
      btnLogo = overlay.querySelector(".wd__logo");

  // This step only fills the expanding image. The detail content (title/body/caps/grid) is deferred —
  // it stays hidden; text fields are still populated so the next step can just reveal them.
  function populate(key) {
    var d = WORK_DETAILS[key]; if (!d) return;
    elKick.textContent = d.kicker || "";
    elTitle.textContent = d.title || "";
    elSub.textContent = d.sub || "";
    elText.innerHTML = (d.lead ? '<p class="wd__lead">' + esc(d.lead) + "</p>" : "") +
      (d.paras || []).map(function (p) { return '<p class="wd__p">' + esc(p) + "</p>"; }).join("");
    elCaps.innerHTML = (d.caps || []).map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("");
    hero.style.backgroundImage = "url('" + imageFor(key) + "')";   // the image that expands to fill the screen
    elGrid.innerHTML = "";
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
  function blockTouch(e) { e.preventDefault(); }
  function lockScroll() {
    savedScroll = window.scrollY || window.pageYOffset || 0;
    body.style.top = (-savedScroll) + "px";
    body.classList.add("wd-lock");
    document.addEventListener("touchmove", blockTouch, { passive: false });
  }
  function unlockScroll() {
    body.classList.remove("wd-lock");
    body.style.top = "";
    document.removeEventListener("touchmove", blockTouch, { passive: false });
    window.scrollTo(0, savedScroll);
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

  // ---- open / close -------------------------------------------------------
  var isOpen = false, activeKey = null;

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
    try { history.pushState({ wd: key }, "", "#work/" + key); } catch (e) {}
    btnLogo.focus();   // move focus into the dialog at once (the logo is the close control)
    if (reduce) { p = 1; applyFrame(1); }
    else tweenTo(1, OPEN_MS, EASE_OPEN);
  }

  // Close is always routed through history.back() → the popstate handler runs doClose(),
  // so browser-Back and our own controls share one path (and the pushed state is popped).
  function requestClose() {
    if (!isOpen) return;
    try { history.back(); } catch (e) { doClose(); }
  }
  function doClose() {
    if (!isOpen) return;
    isOpen = false;
    content.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", onKeydown, true);
    var finish = function () {
      overlay.classList.remove("is-active");
      overlay.setAttribute("aria-hidden", "true");
      unlockScroll();
      signal(false);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      lastFocus = null; activeKey = null;
    };
    if (reduce) { p = 0; applyFrame(0); finish(); }
    else tweenTo(0, CLOSE_MS, EASE_CLOSE, finish);
  }

  window.addEventListener("popstate", function () { if (isOpen) doClose(); });
  btnLogo.addEventListener("click", requestClose);
  // (No backdrop-click-to-close: the full-screen content covers the surface, and on a full-screen
  //  dialog a stray click shouldn't lose the reader's place — ESC / the close button / Back all close.)

  // surface is viewport-sized and scaled uniformly, so a mid-open resize just needs a reapply
  // (the origin stays the click point). No per-dimension recompute.
  window.addEventListener("resize", function () { if (isOpen) applyFrame(p); }, { passive: true });

  // ---- wire up the list items ---------------------------------------------
  items.forEach(function (item) {
    item.addEventListener("click", function (e) { open(item, e); });
    item.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(item); }   // no coords → item centre
    });
  });

  preloadImages();   // warm the cache so the first expand doesn't flash
})();

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
  var OPEN_MS  = 720;   // expand duration (ms), 600–800
  var CLOSE_MS = 560;   // contract duration (ms)
  var EASE = function (x) { return 1 - Math.pow(1 - x, 4); };   // easeOutQuart
  var CONTENT_IN = 0.55;   // content starts fading in once the expand passes this progress
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

  // ---- placeholder mockups (deterministic; site tone, abstract shapes+type, no photos, no ext URLs) ----
  // Each item maps to a KIND that picks the mockup style. Real images later: drop a file at
  // assets/img/work/<key>.jpg and set IMG[<key>] to that path — it wins over the generated SVG.
  function esc(s) { return String(s).replace(/[<>&]/g, function (c) { return c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"; }); }
  function svgURI(inner) { return "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">' + inner + "</svg>"); }
  var GLYPHS = "01/\\<>{}()=+-*#$%&|;:.x?!^~";
  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function glyphs(seed, n, amax) { var r = rng(seed), g = "";
    for (var i = 0; i < (n || 60); i++) { var x = (r() * 1600) | 0, y = (20 + r() * 860) | 0, c = GLYPHS[(r() * GLYPHS.length) | 0],
      fs = (14 + (r() * 20 | 0)), a = (0.04 + r() * (amax || 0.1)).toFixed(2);
      g += '<text x="' + x + '" y="' + y + '" font-family="monospace" font-size="' + fs + '" fill="rgba(20,20,20,' + a + ')">' + esc(c) + '</text>'; }
    return g; }
  function label(t) { return '<text x="70" y="840" font-family="ui-monospace,monospace" font-size="26" letter-spacing="6" fill="rgba(20,20,20,.5)">' + esc(t) + '</text>'; }
  var BG = '<rect width="1600" height="900" fill="#ccd2d8"/>';
  function mockApp(seed) { var x = 660, y = 150, w = 280, h = 600, rows = "";        // mobile app screen
    for (var i = 0; i < 5; i++) rows += '<rect x="' + (x + 26) + '" y="' + (y + 150 + i * 72) + '" width="228" height="52" rx="10" fill="rgba(20,20,20,.07)"/>';
    return BG + glyphs(seed, 44) +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="34" fill="#eef1f3" stroke="rgba(20,20,20,.6)" stroke-width="2"/>' +
      '<rect x="' + (x + 26) + '" y="' + (y + 40) + '" width="150" height="26" rx="8" fill="rgba(20,20,20,.55)"/>' +
      '<rect x="' + (x + 26) + '" y="' + (y + 82) + '" width="228" height="52" rx="12" fill="rgba(20,20,20,.16)"/>' + rows +
      '<rect x="' + (x + 26) + '" y="' + (y + h - 70) + '" width="228" height="44" rx="12" fill="rgba(20,20,20,.5)"/>' + label("UX / UI · APP"); }
  function mockAI(seed) { return BG + glyphs(seed, 70, 0.14) +                        // abstract graphic / character
      '<circle cx="560" cy="430" r="240" fill="rgba(20,20,20,.10)"/>' +
      '<circle cx="900" cy="380" r="180" fill="rgba(20,20,20,.16)"/>' +
      '<circle cx="1040" cy="560" r="120" fill="rgba(20,20,20,.22)"/>' +
      '<path d="M540 640 L760 260 L980 640 Z" fill="none" stroke="rgba(20,20,20,.5)" stroke-width="2"/>' +
      '<circle cx="760" cy="430" r="8" fill="rgba(20,20,20,.7)"/>' + label("AI · GRAPHIC"); }
  function mockWeb(seed) { var x = 230, y = 150, w = 1140, h = 600;                   // browser window
    return BG + glyphs(seed, 40) +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="16" fill="#eef1f3" stroke="rgba(20,20,20,.55)" stroke-width="2"/>' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="56" fill="rgba(20,20,20,.08)"/>' +
      '<circle cx="' + (x + 30) + '" cy="' + (y + 28) + '" r="7" fill="rgba(20,20,20,.4)"/><circle cx="' + (x + 54) + '" cy="' + (y + 28) + '" r="7" fill="rgba(20,20,20,.28)"/><circle cx="' + (x + 78) + '" cy="' + (y + 28) + '" r="7" fill="rgba(20,20,20,.18)"/>' +
      '<rect x="' + (x + 120) + '" y="' + (y + 16) + '" width="500" height="24" rx="12" fill="rgba(20,20,20,.12)"/>' +
      '<rect x="' + (x + 40) + '" y="' + (y + 96) + '" width="' + (w - 80) + '" height="200" rx="10" fill="rgba(20,20,20,.14)"/>' +
      '<rect x="' + (x + 40) + '" y="' + (y + 320) + '" width="330" height="230" rx="10" fill="rgba(20,20,20,.08)"/>' +
      '<rect x="' + (x + 405) + '" y="' + (y + 320) + '" width="330" height="230" rx="10" fill="rgba(20,20,20,.08)"/>' +
      '<rect x="' + (x + 770) + '" y="' + (y + 320) + '" width="330" height="230" rx="10" fill="rgba(20,20,20,.08)"/>' + label("WEB"); }
  function mockCode(seed) { var x = 230, y = 150, w = 1140, h = 600, r = rng(seed), lines = "";   // code editor
    for (var i = 0; i < 14; i++) { var ly = y + 70 + i * 36, indent = (r() * 3 | 0) * 28, lw = 120 + r() * ((w - 260) - indent);
      lines += '<rect x="' + (x + 70) + '" y="' + (ly - 4) + '" width="18" height="18" fill="rgba(20,20,20,.14)"/>' +
               '<rect x="' + (x + 110 + indent) + '" y="' + (ly - 14) + '" width="' + lw + '" height="16" rx="6" fill="rgba(20,20,20,' + (0.12 + r() * 0.16).toFixed(2) + ')"/>'; }
    return BG + glyphs(seed, 36) +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="14" fill="#e7eaed" stroke="rgba(20,20,20,.5)" stroke-width="2"/>' +
      '<rect x="' + x + '" y="' + y + '" width="60" height="' + h + '" fill="rgba(20,20,20,.06)"/>' + lines + label("CODE · VIBE"); }
  var MOCK = { app: mockApp, ai: mockAI, web: mockWeb, code: mockCode };
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  var KIND = { "yakbongji": "app", "stac": "ai", "company-renewal": "web", "maritime": "web", "indie-film": "code" };
  var IMG  = { /* "yakbongji":"assets/img/work/yakbongji.jpg", … real images override the SVG */ };
  function imageFor(key) { return IMG[key] || svgURI((MOCK[KIND[key]] || mockWeb)(hash(key))); }

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
    '<button class="wd__close" type="button" aria-label="상세 닫기">' +
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>' +
    '</button>';
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
      btnClose= overlay.querySelector(".wd__close");

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
  var ox = 0, oy = 0, p = 0, raf = 0, tFrom = 0, tTo = 0, tStart = 0, tDur = 0, tDone = null;
  var RADIUS = 22;   // corner radius mid-expand (px in element space; visually small, converges to 0 when full)

  function applyFrame(pr) {
    var s = pr < 0.0001 ? 0.0001 : pr;                 // avoid an exact scale(0) frame
    surface.style.transform = "scale(" + s.toFixed(5) + ")";
    surface.style.borderRadius = ((1 - pr) * RADIUS).toFixed(1) + "px";
    // detail content (title/body/caps/grid) stays hidden this step — reveal is deferred to the next step.
  }
  function tick(now) {
    var e = tDur <= 0 ? 1 : (now - tStart) / tDur; if (e > 1) e = 1;
    p = tFrom + (tTo - tFrom) * EASE(e);
    applyFrame(p);
    if (e < 1) raf = requestAnimationFrame(tick);
    else { raf = 0; p = tTo; if (tDone) { var d = tDone; tDone = null; d(); } }
  }
  function tweenTo(target, dur, done) {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    tFrom = p; tTo = target; tStart = performance.now(); tDur = dur; tDone = done;
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
      .filter(function (el) { return el.offsetParent !== null || el === btnClose; });
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
    btnClose.focus();   // move focus into the dialog at once (don't wait out the expand)
    if (reduce) { p = 1; applyFrame(1); }
    else tweenTo(1, OPEN_MS);
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
    else tweenTo(0, CLOSE_MS, finish);
  }

  window.addEventListener("popstate", function () { if (isOpen) doClose(); });
  btnClose.addEventListener("click", requestClose);
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
})();

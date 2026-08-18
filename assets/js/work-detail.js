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

  // ---- placeholder image (deterministic per key) --------------------------
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function esc(s) { return String(s).replace(/[<>&]/g, function (c) { return c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"; }); }
  var GLYPHS = "01/\\<>{}()=+-*#$%&|;:.x?!^~";
  function placeholder(label, seed) {
    var rnd = mulberry(seed), g = "";
    for (var i = 0; i < 64; i++) {
      var x = (rnd() * 100).toFixed(1), y = (6 + rnd() * 92).toFixed(1),
          c = GLYPHS[(rnd() * GLYPHS.length) | 0], fs = (7 + (rnd() * 9 | 0)),
          a = (0.05 + rnd() * 0.12).toFixed(2);
      g += '<text x="' + x + '%" y="' + y + '%" font-family="monospace" font-size="' + fs + '" fill="rgba(20,20,20,' + a + ')">' + esc(c) + '</text>';
    }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">' +
      '<rect width="400" height="300" fill="#ccd2d8"/>' + g +
      '<text x="50%" y="53%" text-anchor="middle" font-family="Pretendard,system-ui,sans-serif" font-weight="700" font-size="18" fill="rgba(20,20,20,.5)">' + esc(label) + '</text></svg>';
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

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

  function populate(key) {
    var d = WORK_DETAILS[key]; if (!d) return;
    elKick.textContent = d.kicker || "";
    elTitle.textContent = d.title || "";
    elSub.textContent = d.sub || "";
    elText.innerHTML = (d.lead ? '<p class="wd__lead">' + esc(d.lead) + "</p>" : "") +
      (d.paras || []).map(function (p) { return '<p class="wd__p">' + esc(p) + "</p>"; }).join("");
    elCaps.innerHTML = (d.caps || []).map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("");
    hero.style.backgroundImage = "url('" + (d.hero || placeholder(d.title, hash(key))) + "')";
    var shots = d.shots || [placeholder(d.title + " 01", hash(key + "1")), placeholder(d.title + " 02", hash(key + "2")), placeholder(d.title + " 03", hash(key + "3"))];
    elGrid.innerHTML = shots.map(function (src) { return '<div class="wd__shot"><img alt="" src="' + src + '"></div>'; }).join("");
  }

  // ---- animation (single rAF tween, reversible) ---------------------------
  var startRect = null, vw = 0, vh = 0, p = 0, raf = 0, tFrom = 0, tTo = 0, tStart = 0, tDur = 0, tDone = null;

  function applyFrame(pr) {
    var sx = startRect.width / vw, sy = startRect.height / vh;
    surface.style.transform = "translate(" + (startRect.left * (1 - pr)).toFixed(2) + "px," +
      (startRect.top * (1 - pr)).toFixed(2) + "px) scale(" +
      (sx + (1 - sx) * pr).toFixed(4) + "," + (sy + (1 - sy) * pr).toFixed(4) + ")";
    var c = (pr - CONTENT_IN) / (1 - CONTENT_IN); if (c < 0) c = 0; else if (c > 1) c = 1;
    content.style.setProperty("--wd-content", c.toFixed(3));
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

  function open(item) {
    if (isOpen) return;
    var key = item.getAttribute("data-key"); if (!WORK_DETAILS[key]) return;
    isOpen = true; activeKey = key; lastFocus = item;
    populate(key);
    startRect = item.getBoundingClientRect();
    vw = window.innerWidth; vh = window.innerHeight;
    p = 0; applyFrame(0);
    overlay.classList.add("is-active");
    overlay.setAttribute("aria-hidden", "false");
    overlay.setAttribute("aria-label", (WORK_DETAILS[key].title || "Work") + " 상세");
    content.setAttribute("aria-hidden", "false");
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

  // keep vw/vh honest if the viewport changes mid-open (rotate/resize)
  window.addEventListener("resize", function () {
    if (!isOpen) return;
    vw = window.innerWidth; vh = window.innerHeight;
    if (startRect && activeKey) { var el = document.querySelector('.wbig__item[data-key="' + activeKey + '"]'); if (el) startRect = el.getBoundingClientRect(); }
    applyFrame(p);
  }, { passive: true });

  // ---- wire up the list items ---------------------------------------------
  items.forEach(function (item) {
    item.addEventListener("click", function () { open(item); });
    item.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(item); }
    });
  });
})();

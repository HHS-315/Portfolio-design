/*
 * Full-screen glass-toggle MENU overlay.
 *  · The .bar's work/about/contact links were replaced by a single body-level glass toggle (#navToggle);
 *    clicking it opens #navOverlay, whose background is a block grid that STACKS up from the bottom exactly
 *    like the WORK section, over which an ABOUT-typography list fades in. Closing retracts the blocks down.
 *  · Reuses window.WorkTransition.grid (a read-only export from work-transition.js) so the menu cells match
 *    the WORK cells without duplicating the constants. Draws to its OWN #navBlocks canvas — never the shared
 *    #blocks (whose pure-function-of-scroll reversibility must not be disturbed by a time-based tween).
 *  · Theme is chosen ONCE at open from the real #blocks pixel coverage (not --work-reveal, which drops to 0
 *    while the grid is still standing): coverage >= 0.5 → bright backdrop → DARK menu (--bg/--bone); else
 *    LIGHT menu (--work-cell/--work-ink). The .bar keeps its mix-blend-mode:difference and auto-inverts.
 *  · Scroll-lock / focus-trap / restore copy work-detail.js. It is mutually exclusive with the WORK subpage
 *    (#workOverlay) and disabled during the intro lock. Pauses the background canvases via the shared
 *    "work:overlay" event (self-signalled so our own toggle-hide listener ignores it). One-shot rAF tweens
 *    only — no permanent loop.
 */
(function () {
  "use strict";
  var toggle = document.getElementById("navToggle");
  var overlay = document.getElementById("navOverlay");
  var canvas = document.getElementById("navBlocks");
  if (!toggle || !overlay || !canvas) return;
  var list = overlay.querySelector(".nav__list");
  var links = [].slice.call(overlay.querySelectorAll(".nav__link"));
  var root = document.documentElement, body = document.body;
  var ctx = canvas.getContext("2d");
  var reduce = matchMedia("(prefers-reduced-motion:reduce)");

  var G = (window.WorkTransition && window.WorkTransition.grid) ||
    { COLS_DESKTOP: 16, COLS_MID: 12, COLS_MOBILE: 7, COL_BP: 1000, COL_MID_BP: 640, JIT_ROWS: 1.6, TH_TOP: 0.94, CELL_RISE: 0.045, ALPHA_START: 0.3 };

  var OPEN_MS = 540, CLOSE_MS = 460;                 // block fill / retract durations (WORK-detail tone)
  var TEXT_IN_AT = 0.66;                             // list fades in once the fill passes this progress
  var TEXT_OUT_MS = 150;                             // list fades out before the retract begins (close)

  // ---- grid (same algorithm/geometry as work-transition.js) ----------------
  var W = 0, H = 0, DPR = 1, cols = 0, colW = 0, rows = 0, thresh = [];
  function snap(v) { return Math.round(v * DPR) / DPR; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(x) { return 1 - Math.pow(1 - x, 3); }

  function build() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cols = W >= G.COL_BP ? G.COLS_DESKTOP : W >= G.COL_MID_BP ? G.COLS_MID : G.COLS_MOBILE;
    colW = W / cols; rows = Math.ceil(H / colW);
    thresh = new Array(cols * rows); var maxTh = 0, c, r;
    for (c = 0; c < cols; c++) {                     // seed ONCE (deterministic), monotonic up each column
      var prev = -1e9;
      for (r = 0; r < rows; r++) {
        var th = r + (Math.random() * 2 - 1) * G.JIT_ROWS; if (th < prev) th = prev; prev = th;
        thresh[c * rows + r] = th; if (th > maxTh) maxTh = th;
      }
    }
    var k = G.TH_TOP / (maxTh || 1);
    for (var i = 0; i < thresh.length; i++) thresh[i] *= k;
    for (c = 0; c < cols; c++) {                     // enforce >= CELL_RISE spacing so lower cells fully land
      var base = c * rows;
      for (r = 1; r < rows; r++) { var mn = thresh[base + r - 1] + G.CELL_RISE * 1.05; if (thresh[base + r] < mn) thresh[base + r] = mn; }
    }
  }

  function draw(p) {                                  // p 0..1 : cells appear bottom-up as p crosses their th
    if (!cols) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = (getComputedStyle(overlay).getPropertyValue("--nav-bg") || "#ccd2d8").trim();
    for (var c = 0; c < cols; c++) {
      var x0 = snap(c * colW), x1 = snap((c + 1) * colW), cw = x1 - x0, base = c * rows;
      for (var r = 0; r < rows; r++) {
        var th = thresh[base + r];
        if (p <= th) break;                           // thresholds rise up the column
        var a = G.ALPHA_START + (1 - G.ALPHA_START) * ease(clamp01((p - th) / G.CELL_RISE));
        var y0 = snap(H - (r + 1) * colW), y1 = snap(H - r * colW);
        if (a < 1) ctx.globalAlpha = a > 1 ? 1 : a;
        ctx.fillRect(x0, y0, cw, y1 - y0);
        if (a < 1) ctx.globalAlpha = 1;
      }
    }
  }

  // ---- one-shot tween (work-detail tweenTo pattern; stops when done) --------
  var raf = 0;
  function tween(from, to, ms, onUpd, onDone) {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (reduce.matches || ms <= 0) { onUpd(to); if (onDone) onDone(); return; }
    var t0 = 0;
    function step(now) {
      if (!t0) t0 = now;
      var k = clamp01((now - t0) / ms);
      onUpd(from + (to - from) * k);
      if (k < 1) { raf = requestAnimationFrame(step); } else { raf = 0; if (onDone) onDone(); }
    }
    raf = requestAnimationFrame(step);
  }

  // ---- theme (sample #blocks coverage ONCE) --------------------------------
  function pickTheme() {
    var cov = 0;
    try {
      var b = document.getElementById("blocks"), x = b.getContext("2d");
      var d = x.getImageData(0, 0, b.width, b.height).data, N = 40, lit = 0, tot = 0;
      for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) {
        var px = Math.floor((i + 0.5) / N * b.width), py = Math.floor((j + 0.5) / N * b.height);
        if (d[(py * b.width + px) * 4 + 3] > 128) lit++; tot++;
      }
      cov = lit / tot;
    } catch (e) { cov = 0; }
    overlay.classList.toggle("nav--dark", cov >= 0.5);   // bright backdrop → dark menu
    return cov;
  }

  // ---- scroll lock (position-preserving, copied from work-detail.js) -------
  var savedScroll = 0;
  function blockTouch(e) { e.preventDefault(); }
  function lockScroll() {
    savedScroll = window.scrollY || window.pageYOffset || 0;
    body.style.top = (-savedScroll) + "px";
    body.classList.add("nav-lock");
    document.addEventListener("touchmove", blockTouch, { passive: false });
  }
  function unlockScroll() {
    var y = savedScroll;
    document.removeEventListener("touchmove", blockTouch, { passive: false });
    body.classList.remove("nav-lock");
    body.style.top = "";
    var prevSB = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, y);
    requestAnimationFrame(function () { window.scrollTo(0, y); root.style.scrollBehavior = prevSB; });
  }

  // ---- background-canvas pause (reuse the shared event; self-signal so our own listener ignores it) ----
  var selfSignal = false;
  function signalBg(open) { selfSignal = true; try { window.dispatchEvent(new CustomEvent("work:overlay", { detail: { open: open } })); } catch (e) {} selfSignal = false; }
  window.addEventListener("work:overlay", function (e) {
    if (selfSignal) return;                            // our own dispatch → ignore
    var open = !!(e.detail && e.detail.open);
    body.classList.toggle("nav-suppress", open);       // WORK subpage open → hide our toggle
    if (open && menuOpen) forceClose();                // subpage opened while menu up → close (mutual exclusion)
  });

  // ---- focus trap ----------------------------------------------------------
  var lastFocus = null;
  function focusables() { return [toggle].concat(links).filter(function (el) { return el && el.offsetParent !== null; }); }
  function onKeydown(e) {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab") return;
    var f = focusables(); if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ---- open / close --------------------------------------------------------
  var menuOpen = false;
  function setText(v) { overlay.style.setProperty("--nav-text", v); }
  function canOpen() {
    if (menuOpen) return false;
    if (root.classList.contains("intro-lock")) return false;
    var wo = document.getElementById("workOverlay");
    if (wo && wo.classList.contains("is-active")) return false;   // WORK subpage open
    if (body.classList.contains("nav-suppress")) return false;
    return true;
  }

  function open() {
    if (!canOpen()) return;
    menuOpen = true;
    lastFocus = document.activeElement;
    pickTheme();
    build();
    setText(0); draw(0);
    lockScroll();
    root.classList.add("nav-open");
    toggle.classList.add("is-active");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "메뉴 닫기");
    overlay.setAttribute("aria-hidden", "false");
    document.addEventListener("keydown", onKeydown);
    signalBg(true);
    var textShown = false;
    tween(0, 1, OPEN_MS, function (p) {
      draw(p);
      if (!textShown && p >= TEXT_IN_AT) { textShown = true; setText(1); }
    }, function () { setText(1); });
    // focus the first link (fallback: toggle) once open
    (links[0] || toggle).focus();
  }

  function finishClose() {
    root.classList.remove("nav-open");
    overlay.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", onKeydown);
    signalBg(false);
    unlockScroll();
    ctx.clearRect(0, 0, W, H);
    menuOpen = false;
  }

  function close(afterRestore) {
    if (!menuOpen) { if (afterRestore) afterRestore(); return; }
    toggle.classList.remove("is-active");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "메뉴 열기");
    setText(0);                                        // list fades out FIRST (CSS opacity transition)
    var startRetract = function () {
      tween(1, 0, CLOSE_MS, function (p) { draw(p); }, function () {
        finishClose();
        if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
        if (!lastFocus) toggle.focus();
        if (afterRestore) requestAnimationFrame(afterRestore);   // navigate AFTER unlock+resume
      });
    };
    if (reduce.matches) startRetract();
    else setTimeout(startRetract, TEXT_OUT_MS);
  }

  function forceClose() {                              // immediate close (no animation) for mutual-exclusion races
    if (!menuOpen) return;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    toggle.classList.remove("is-active");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "메뉴 열기");
    setText(0);
    finishClose();
  }

  // ---- wiring --------------------------------------------------------------
  toggle.addEventListener("click", function () { menuOpen ? close() : open(); });
  links.forEach(function (a) {
    a.addEventListener("click", function (e) {
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) !== "#") return;
      e.preventDefault();
      close(function () {                              // close → unlock+restore → THEN scroll to target
        var el = document.querySelector(href);
        if (el) el.scrollIntoView();                   // native smooth + .sec scroll-margin-top
      });
    });
  });
  window.addEventListener("resize", function () { if (menuOpen) { build(); draw(1); } });   // rebuild only while open
})();

/*
 * ABOUT → WORK transition: a grid of square cells STACKS up from the bottom, one
 * cell at a time, to fill the screen (runrobrun-style — discrete blocks, not a bar
 * graph). Fully SCROLL-LINKED (no continuous rAF): cells stack/unstack with the wheel
 * and hold when you stop. Owns the master progress dandelion.js reads to drop the
 * flower (window.WorkTransition.progress()), and drives the WORK text colour
 * (light→dark as the light cells fill behind it — CSS var --work-ink).
 *
 * Layer: draws on #blocks (behind the flower #field, below section text).
 * prefers-reduced-motion → no animation, snapped final state.
 */
(function () {
  "use strict";

  // ---- knobs --------------------------------------------------------------
  var DEBUG = false;                       // overlay: T / blockP / cells
  var T_START = 0.95, T_END = 0.15;        // work.top/vh from START→END maps master T 0→1
  var BLOCK_T_START = 0.12;                // cells begin appearing at this T. Lowered from 0.30 so the fill
                                           // spreads over more scroll (~25% slower / more gradual). Only
                                           // affects the blocks — the flower reads progress() directly.
  var COLS_DESKTOP = 16, COLS_MID = 12, COLS_MOBILE = 7;  // square cells → cell size = W / cols (smaller cells)
  var COL_BP = 1000, COL_MID_BP = 640;
  // single opaque grey-white cell colour — shared with the WORK detail page via the --work-cell CSS var
  // (subtle cool cast: B>R, no yellow). Falls back to the literal if the var isn't set.
  var BLOCK_COLOR = (getComputedStyle(document.documentElement).getPropertyValue("--work-cell") || "").trim() || "#ccd2d8";
  // Per-CELL appearance order (not per-column): each cell gets a threshold = its row height + a random
  // jitter of ±JIT_ROWS rows, kept monotonic up each column (so a cell never appears before the one below
  // it — no floating cells). bp crossing a cell's threshold makes it grow in (height 0→cell, fully opaque).
  // Result: cells pop in scattered across the grid instead of columns rising as one bar.
  var JIT_ROWS = 1.6;                      // per-cell appearance scatter, in rows (±)
  var TH_TOP = 0.94;                        // the last cell appears by this bp → whole screen full by bp=1
  var CELL_RISE = 0.045;                    // bp span over which a landing cell fades in
  var ALPHA_START = 0.3;                    // a landing cell appears at this opacity, then fades to 1.
                                            // Size stays a FULL SQUARE the whole time — only alpha animates —
                                            // so a translucent cell is never a flat rectangle. Settled = opaque.
  // WORK text FADES IN (opacity) once the cells have filled behind it, instead of colour-interpolating
  // (the old light→dark ink muddied the text mid-transition where its value matched the background).
  // --work-ink is a fixed dark now; this sets --work-reveal 0→1 which drives the text/rule opacity.
  var REVEAL_START = 0.65, REVEAL_END = 0.85;   // bpFill range over which --work-reveal goes 0→1
  // WORK → CONTACT: once the grid is full, entering #contact makes the cells FALL AWAY from the BOTTOM up,
  // as if the dark background pushes up from below. A second progress (T2) drives this, off #contact's rect.
  // Each cell's fall-start = its OWN appear-threshold (th): the bottom cells (smallest th) leave FIRST and the
  // top cells leave last — the reverse of the earlier top-first version. Scattered the same way, fully
  // reversible (scroll back up → the bottom cells refill first). Revealing bottom-first also means the dark
  // area and #contact's dark scrim coincide at the bottom, so no light cell shows through the scrim as grey.
  var CELL_FALL = 0.06;                         // bpFall span over which a leaving cell fades 1→0
  // WORK text fades out EARLY — before the blocks under it clear — so a dark-on-dark flash never happens
  // (the top cells, where the WORK text sits, are the LAST to fall, so the text must be gone well before then).
  var REVEAL_FALL_START = 0.04, REVEAL_FALL_END = 0.30;  // bpFall range over which --work-reveal fades back 1→0
  // --contact-reveal rises 0→1 as the blocks CLEAR (bpFall up) → the CONTACT ambient field (work-ascii.js)
  // fades in with the reveal of the dark background. Starts almost immediately (bottom clears first).
  var CONTACT_REVEAL_START = 0.02, CONTACT_REVEAL_END = 0.25;
  // CONTACT text×strip inversion (index.html: html.strip-invert #strip{z-index:5;mix-blend-mode:difference}).
  // #strip is a FIXED thin row pinned to the viewport bottom (lit from bp 0; it does NOT move or "form late"),
  // so .wish__lead's two lines ("LET'S MAKE" / "SOMETHING GOOD.") each sweep DOWN through that one row at a
  // DIFFERENT bpFall as the block rises — the top line first, the bottom line later. The threshold must clear the
  // EARLIER (top) line's start, or that line crosses with the blend still off and only the second line inverts.
  // Measured by COUNTING lit #strip pixels INSIDE each line's Range rect via getImageData on a slow scroll
  // (per-line canvas pixel count — the only reliable method; rect/landY estimates and min/max lit-y bands both
  // mislead). DENSE overlap = the thousands-of-pixels window where the letter STROKES sit on the row (the ~10–30
  // baseline counts before/after are antialiasing, not real overlap):
  //     1920×1080:  LINE1 0.37–0.50   LINE2 0.51–0.64
  //     1440×900:   LINE1 0.34–0.50   LINE2 0.52–0.67
  //     375×667:    LINE1 0.44–0.50   LINE2 0.53–0.59
  // Earliest top-line start ≈ 0.34 (1440; true start bounded to 0.318–0.34 between samples). The old 0.46 sat at
  // the END of every LINE1 window, so the top line crossed 0.34→0.46 with the blend OFF and only LINE2 (0.51+)
  // inverted — exactly the "one line only" symptom. 0.31 turns on BELOW the earliest top-line start (covers LINE1
  // from its true start on all three viewports) while staying above the binding floor REVEAL_FALL_END 0.30, where
  // --work-reveal reaches 0: the raised z5 strip therefore can't cover the (now fully-faded, opacity-0) WORK list
  // text, and WORK's dark-glyph-on-light-cell strip is long gone anyway (STRIP_CONTACT_END 0.07 already whitened
  // it to bone). The window (0.30, 0.318] is narrow, so 0.31 is deliberate. No pop: at turn-on the strip is bone
  // over the dark bg = |233−10|=223 ≈ unchanged everywhere except the thin sliver where LINE1 is just entering at
  // the screen bottom. Single threshold, held on afterwards. Pure function of bpFall → fully reversible on scroll-up.
  var STRIP_INVERT_ON = 0.31;
  // -------------------------------------------------------------------------

  var reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  var canvas = document.getElementById("blocks"); if (!canvas) return;
  var ctx = canvas.getContext("2d"); if (!ctx) return;
  var work = document.getElementById("work"); if (!work) return;
  var contact = document.getElementById("contact");   // WORK → CONTACT fall reference (optional)
  var root = document.documentElement;

  var W = 0, H = 0, DPR = 1, cols = 0, colW = 0, rows = 0, thresh = [];   // thresh[c*rows+r] = bp at which the cell appears
  function ease(x) { return 1 - Math.pow(1 - x, 3); }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  // map a section's on-screen position to 0→1 as its top rises from T_START·vh to T_END·vh
  function sectionT(el) {
    if (!el) return 0;
    var r = el.getBoundingClientRect(), vh = H || window.innerHeight;
    return clamp01((T_START - r.top / vh) / (T_START - T_END));
  }
  // master progress T1 (ABOUT→WORK) — read by dandelion.js too
  function progress() { return sectionT(work); }
  function blockProgress() {                            // bpFill: cells stack UP as WORK enters
    var T = progress();
    if (reduce) return T >= 0.5 ? 1 : 0;              // reduced motion → snap, no gradual stack
    return clamp01((T - BLOCK_T_START) / (1 - BLOCK_T_START));
  }
  // T2 (WORK→CONTACT) → bpFall: cells fall AWAY as CONTACT enters (same shaping as the fill)
  function fallProgress() {
    var T = sectionT(contact);
    if (reduce) return T >= 0.5 ? 1 : 0;
    return clamp01((T - BLOCK_T_START) / (1 - BLOCK_T_START));
  }

  function build() {
    cols = W >= COL_BP ? COLS_DESKTOP : W >= COL_MID_BP ? COLS_MID : COLS_MOBILE;
    colW = W / cols;                        // square cell edge
    rows = Math.ceil(H / colW);             // cells needed to fill the viewport vertically
    // per-cell appearance thresholds (seeded ONCE here → deterministic + reversible). Base = row height,
    // + a ±JIT_ROWS jitter to scatter the order, made monotonic up each column so nothing floats.
    thresh = new Array(cols * rows);
    var maxTh = 0;
    for (var c = 0; c < cols; c++) {
      var prev = -1;
      for (var r = 0; r < rows; r++) {
        var th = r + (Math.random() * 2 - 1) * JIT_ROWS;
        if (th <= prev) th = prev + 0.06;   // keep bottom→up within the column (a cell never precedes the one below)
        prev = th;
        thresh[c * rows + r] = th;
        if (th > maxTh) maxTh = th;
      }
    }
    var k = TH_TOP / (maxTh || 1);          // normalize row-units → bp thresholds in [0, TH_TOP]
    for (var i = 0; i < thresh.length; i++) thresh[i] *= k;
    // guarantee ≥ CELL_RISE between a cell and the one below it, so the lower cell fully LANDS
    // (turns opaque) before the upper one starts rising — never two translucent cells stacked,
    // and never a translucent strip floating over a gap. (Plenty of headroom below bp=1.)
    for (var c2 = 0; c2 < cols; c2++) {
      var b = c2 * rows;
      for (var r2 = 1; r2 < rows; r2++) {
        var mn = thresh[b + r2 - 1] + CELL_RISE * 1.05;
        if (thresh[b + r2] < mn) thresh[b + r2] = mn;
      }
    }
  }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    build();
  }

  // Snap a CSS-px coordinate to the DEVICE-pixel grid (ctx is DPR-scaled). Adjacent cells share an edge
  // (cell c's right = snap((c+1)·colW) = cell c+1's left), so with snapped, non-overlapping rects there is
  // NO sub-pixel seam AT ANY ALPHA — which is why the old +1 overlap (opaque-only) is gone: it left a gap
  // under translucent landing cells that showed the dark background as a grid line (the reported issue).
  function snap(v) { return Math.round(v * DPR) / DPR; }

  function draw() {
    var _tp = window.HeroPerf ? HeroPerf.t() : 0;   // perf HUD (2D CPU time)
    ctx.clearRect(0, 0, W, H);
    var bpFill = blockProgress();           // cells stacking up (ABOUT→WORK)
    var bpFall = fallProgress();            // cells falling away (WORK→CONTACT)
    updateReveal(bpFill, bpFall);
    if (bpFill <= 0.0001) { updateDbg(bpFill, bpFall); if (window.HeroPerf) HeroPerf.add("blocks", _tp); return; }
    ctx.fillStyle = BLOCK_COLOR;
    for (var c = 0; c < cols; c++) {
      var x0 = snap(c * colW), x1 = snap((c + 1) * colW), cw = x1 - x0, base = c * rows;
      for (var r = 0; r < rows; r++) {
        var th = thresh[base + r];
        if (bpFill <= th) break;             // thresholds rise up the column → this & everything above aren't up yet
        // fade IN as it lands (ALPHA_START→1). A full square the whole time (no flat-rectangle look).
        var aIn = ALPHA_START + (1 - ALPHA_START) * ease(clamp01((bpFill - th) / CELL_RISE));
        // fade OUT as CONTACT enters: the cell leaves when bpFall passes its fall-start (BOTTOM-first).
        // fall-start = th DIRECTLY — bottom cells (smallest th) leave first, top cells (largest th) leave last,
        // so the grid clears from the bottom up. Clamp into [0, 1−CELL_FALL]: ≥0 so no cell is already gone at
        // bpFall=0, and ≤1−CELL_FALL so EVERY cell — the TOP row included (its th can exceed TH_TOP after the
        // CELL_RISE spacing pass) — finishes its fade by bpFall=1 and the grid fully clears.
        var fs = th < 0 ? 0 : th > 1 - CELL_FALL ? 1 - CELL_FALL : th;
        var aOut = 1 - clamp01((bpFall - fs) / CELL_FALL);
        var a = aIn * aOut;
        if (a <= 0.004) continue;            // already fallen away (don't break — lower cells still stand)
        var y0 = snap(H - (r + 1) * colW), y1 = snap(H - r * colW);
        if (a < 1) ctx.globalAlpha = a;
        ctx.fillRect(x0, y0, cw, y1 - y0);
        if (a < 1) ctx.globalAlpha = 1;
      }
    }
    updateDbg(bpFill, bpFall);
    if (window.HeroPerf) HeroPerf.add("blocks", _tp);
  }

  // WORK text/rule reveal: opacity 0→1 as the cells fill behind them (fixed dark ink, no colour muddle).
  // Fully reversible — bp is scroll-linked, so scrolling back up fades the text out symmetrically.
  var lastReveal = -1, lastContactReveal = -1, lastInvert = false;
  function updateReveal(bpFill, bpFall) {
    var vIn = clamp01((bpFill - REVEAL_START) / (REVEAL_END - REVEAL_START));
    var vOut = clamp01((bpFall - REVEAL_FALL_START) / (REVEAL_FALL_END - REVEAL_FALL_START));
    var v = vIn * (1 - vOut);               // fades in with the fill, back out as the cells fall away
    if (Math.abs(v - lastReveal) >= 0.004) { lastReveal = v; root.style.setProperty("--work-reveal", v.toFixed(3)); }
    // CONTACT ambient field opacity — rises as the blocks clear (bpFall). Set in the SAME pass (no new listener);
    // guarded separately so it still updates while --work-reveal sits at 0 through the CONTACT range.
    var cv = clamp01((bpFall - CONTACT_REVEAL_START) / (CONTACT_REVEAL_END - CONTACT_REVEAL_START));
    if (Math.abs(cv - lastContactReveal) >= 0.004) { lastContactReveal = cv; root.style.setProperty("--contact-reveal", cv.toFixed(3)); }
    // text×strip inversion: lift + difference-blend #strip only deep in CONTACT (same pass, no new listener).
    var inv = bpFall >= STRIP_INVERT_ON;
    if (inv !== lastInvert) { lastInvert = inv; root.classList.toggle("strip-invert", inv); }
  }

  var dbg = null;
  function updateDbg(bpFill, bpFall) {
    if (!dbg) return;
    dbg.textContent = "T1=" + progress().toFixed(3) + " fill=" + bpFill.toFixed(3) +
      "\nT2=" + sectionT(contact).toFixed(3) + " fall=" + bpFall.toFixed(3) +
      "\ncols=" + cols + " rows=" + rows;
  }
  if (DEBUG) {
    dbg = document.createElement("div");
    dbg.style.cssText = "position:fixed;right:8px;bottom:8px;z-index:99999;font:11px/1.5 ui-monospace,monospace;color:#9cf;background:rgba(0,0,0,.72);padding:6px 9px;white-space:pre;pointer-events:none;border:1px solid #368";
    document.body.appendChild(dbg);
  }

  // scroll-driven: redraw on scroll (rAF-throttled) — no continuous loop
  var raf = 0, overlayOpen = false;
  function schedule() { if (overlayOpen) return; if (raf === 0) raf = requestAnimationFrame(function () { raf = 0; draw(); }); }

  // progress → dandelion.js (flower) / work-ascii.js (WORK field). fall/fallProgress → bpFall, read by
  // dandelion.js (strip colour) and work-ascii.js (CONTACT field). Two names for the one value.
  window.WorkTransition = { progress: progress, fall: fallProgress, fallProgress: fallProgress };

  resize();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", function () { if (!overlayOpen) { resize(); draw(); } });
  // WORK detail overlay open → this #blocks pass is idle (scroll is locked anyway); resume + redraw on close.
  window.addEventListener("work:overlay", function (e) { overlayOpen = !!(e.detail && e.detail.open); if (!overlayOpen) draw(); });
  draw();   // initial state
})();

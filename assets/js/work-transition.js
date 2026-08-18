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
  var REVEAL_START = 0.65, REVEAL_END = 0.85;   // bp range over which --work-reveal goes 0→1
  // -------------------------------------------------------------------------

  var reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  var canvas = document.getElementById("blocks"); if (!canvas) return;
  var ctx = canvas.getContext("2d"); if (!ctx) return;
  var work = document.getElementById("work"); if (!work) return;
  var root = document.documentElement;

  var W = 0, H = 0, DPR = 1, cols = 0, colW = 0, rows = 0, thresh = [];   // thresh[c*rows+r] = bp at which the cell appears
  function ease(x) { return 1 - Math.pow(1 - x, 3); }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  // master progress (read by dandelion.js too)
  function progress() {
    var r = work.getBoundingClientRect(), vh = H || window.innerHeight;
    var t = (T_START - r.top / vh) / (T_START - T_END);
    return clamp01(t);
  }
  function blockProgress() {
    var T = progress();
    if (reduce) return T >= 0.5 ? 1 : 0;              // reduced motion → snap, no gradual stack
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

  function draw() {
    var _tp = window.HeroPerf ? HeroPerf.t() : 0;   // perf HUD (2D CPU time)
    ctx.clearRect(0, 0, W, H);
    var bp = blockProgress();
    updateReveal(bp);                       // keep the text fade in step even before/after the stack
    if (bp <= 0.0001) { updateDbg(bp); if (window.HeroPerf) HeroPerf.add("blocks", _tp); return; }
    ctx.fillStyle = BLOCK_COLOR;
    for (var c = 0; c < cols; c++) {
      var x = c * colW, base = c * rows;
      for (var r = 0; r < rows; r++) {
        var th = thresh[base + r];
        if (bp <= th) break;                 // thresholds rise up the column → this & everything above aren't up yet
        // ALPHA ONLY — the cell is a full square from the start; it just fades ALPHA_START→1 as it lands.
        // (Fading a full square avoids the flat-rectangle look a growing height gave at low opacity.)
        var a = ALPHA_START + (1 - ALPHA_START) * ease(clamp01((bp - th) / CELL_RISE));
        // overlap the +1 seam-filler ONLY once the cell is opaque — a translucent cell drawn +1 over its
        // neighbour would double up and read as a grid line. Opaque overlap is invisible (same colour).
        var o = a >= 0.999 ? 1 : 0;
        if (a < 1) ctx.globalAlpha = a;
        ctx.fillRect(x, H - (r + 1) * colW, colW + o, colW + o);
        if (a < 1) ctx.globalAlpha = 1;
      }
    }
    updateDbg(bp);
    if (window.HeroPerf) HeroPerf.add("blocks", _tp);
  }

  // WORK text/rule reveal: opacity 0→1 as the cells fill behind them (fixed dark ink, no colour muddle).
  // Fully reversible — bp is scroll-linked, so scrolling back up fades the text out symmetrically.
  var lastReveal = -1;
  function updateReveal(bp) {
    var v = clamp01((bp - REVEAL_START) / (REVEAL_END - REVEAL_START));
    if (Math.abs(v - lastReveal) < 0.004) return; lastReveal = v;
    root.style.setProperty("--work-reveal", v.toFixed(3));
  }

  var dbg = null;
  function updateDbg(bp) {
    if (!dbg) return;
    dbg.textContent = "T=" + progress().toFixed(3) + "\nblockP=" + bp.toFixed(3) + "\ncols=" + cols + " rows=" + rows;
  }
  if (DEBUG) {
    dbg = document.createElement("div");
    dbg.style.cssText = "position:fixed;right:8px;bottom:8px;z-index:99999;font:11px/1.5 ui-monospace,monospace;color:#9cf;background:rgba(0,0,0,.72);padding:6px 9px;white-space:pre;pointer-events:none;border:1px solid #368";
    document.body.appendChild(dbg);
  }

  // scroll-driven: redraw on scroll (rAF-throttled) — no continuous loop
  var raf = 0, overlayOpen = false;
  function schedule() { if (overlayOpen) return; if (raf === 0) raf = requestAnimationFrame(function () { raf = 0; draw(); }); }

  window.WorkTransition = { progress: progress };   // expose for dandelion.js

  resize();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", function () { if (!overlayOpen) { resize(); draw(); } });
  // WORK detail overlay open → this #blocks pass is idle (scroll is locked anyway); resume + redraw on close.
  window.addEventListener("work:overlay", function (e) { overlayOpen = !!(e.detail && e.detail.open); if (!overlayOpen) draw(); });
  draw();   // initial state
})();

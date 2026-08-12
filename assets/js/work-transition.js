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
  var BLOCK_T_START = 0.30;                // cells begin stacking at this T (after the flower starts falling)
  var COLS_DESKTOP = 10, COLS_MID = 8, COLS_MOBILE = 5;   // square cells → cell size = W / cols
  var COL_BP = 1000, COL_MID_BP = 640;
  var COL_DELAY_MAX = 0.42;                // per-column fill-START stagger. Every column still reaches the top
                                           // by bp=1 (full screen); the stepped silhouette comes from the
                                           // different fill SPEEDS, not from a height cap.
  var BLOCK_COLOR = "#cecec8";             // single opaque grey-white — same for every cell, no borders/gaps
  // (the landing cell GROWS up in place — height 0→cell, fully opaque — so there's no alpha fade
  //  and never a translucent cell letting the shader through.)
  // WORK text ink interpolates light→dark as the light cells fill behind it (replaces the old dark scrim)
  var INK_LIGHT = [233, 233, 230], INK_DARK = [20, 20, 20];
  var INK_START = 0.30, INK_FULL = 0.72;   // bp range over which the ink darkens
  // -------------------------------------------------------------------------

  var reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  var canvas = document.getElementById("blocks"); if (!canvas) return;
  var ctx = canvas.getContext("2d"); if (!ctx) return;
  var work = document.getElementById("work"); if (!work) return;
  var root = document.documentElement;

  var W = 0, H = 0, DPR = 1, cols = 0, colW = 0, rows = 0, columns = [];
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
    columns = [];
    for (var c = 0; c < cols; c++) columns.push({ delay: Math.random() * COL_DELAY_MAX });
  }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    build();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var bp = blockProgress();
    updateInk(bp);                          // keep the text ink in step even before/after the stack
    if (bp <= 0.0001) { updateDbg(bp); return; }
    ctx.fillStyle = BLOCK_COLOR;
    var cw = colW + 1;                       // +1 so neighbouring cells overlap → seamless, no grid lines
    for (var c = 0; c < cols; c++) {
      var lp = clamp01((bp - columns[c].delay) / (1 - columns[c].delay));
      var stacked = lp * rows;               // continuous cell count for this column
      var full = Math.floor(stacked);        // DISCRETE filled cells — stacked bottom → up
      var x = c * colW;
      for (var r = 0; r < full; r++) ctx.fillRect(x, H - (r + 1) * colW, cw, cw);
      // the next cell "lands" by GROWING up in place: height 0 → cell, anchored at its slot's bottom
      // (which is the top of the stack). Fully opaque — no alpha, so nothing ever goes translucent —
      // and it abuts the cell below (+1 overlap) so there's no seam. Pure function of bp → reversible.
      var frac = stacked - full;
      if (full < rows && frac > 0.002) {
        var h = ease(frac) * colW;
        ctx.fillRect(x, H - full * colW - h, cw, h + 1);
      }
    }
    updateDbg(bp);
  }

  // WORK text ink: light on the dark hero side → dark once the light cells fill behind it.
  var lastInk = -1;
  function updateInk(bp) {
    var it = clamp01((bp - INK_START) / (INK_FULL - INK_START));
    if (Math.abs(it - lastInk) < 0.004) return; lastInk = it;
    var r = Math.round(INK_LIGHT[0] + (INK_DARK[0] - INK_LIGHT[0]) * it);
    var g = Math.round(INK_LIGHT[1] + (INK_DARK[1] - INK_LIGHT[1]) * it);
    var b = Math.round(INK_LIGHT[2] + (INK_DARK[2] - INK_LIGHT[2]) * it);
    root.style.setProperty("--work-ink", "rgb(" + r + "," + g + "," + b + ")");
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
  var raf = 0;
  function schedule() { if (raf === 0) raf = requestAnimationFrame(function () { raf = 0; draw(); }); }

  window.WorkTransition = { progress: progress };   // expose for dandelion.js

  resize();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", function () { resize(); draw(); });
  draw();   // initial state
})();

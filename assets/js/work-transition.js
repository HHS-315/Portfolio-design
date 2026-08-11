/*
 * ABOUT → WORK transition: rising gray-white block skyline (runrobrun-style).
 * Fully SCROLL-LINKED (no continuous rAF): the blocks rise/fall with the wheel
 * and hold their state when you stop. Also owns the master transition progress
 * that dandelion.js reads to drop the flower (window.WorkTransition.progress()).
 *
 * Layer: draws on #blocks (z above the flower, below section text). The blocks
 * persist as a backdrop once WORK is passed (kept through PROCESS/CONTACT).
 * prefers-reduced-motion → no animation, snapped final state.
 */
(function () {
  "use strict";

  // ---- knobs --------------------------------------------------------------
  var DEBUG = false;              // overlay: T / blockP / fallP
  var T_START = 0.95, T_END = 0.15;   // work.top/vh from START→END maps master T 0→1
  var BLOCK_T_START = 0.30;       // blocks begin rising at this T (after the flower has started falling)
  var MAXH_FRAC = 0.55;          // tallest column = this fraction of viewport height
  var COL_MINFRAC = 0.34;        // shortest column = this fraction of the max
  var COLS_DESKTOP = 14, COLS_MID = 10, COLS_MOBILE = 7;
  var COL_BP = 1000, COL_MID_BP = 640;
  var COLORS = ["rgba(206,206,202,0.86)", "rgba(158,158,155,0.72)", "rgba(112,112,110,0.55)"];
  var CHIP_COLOR = "rgba(230,230,226,1)";
  var CHIPS_DESKTOP = 52, CHIPS_MOBILE = 24;
  var CHIP_MIN = 6, CHIP_MAX = 16;
  // -------------------------------------------------------------------------

  var reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  var canvas = document.getElementById("blocks"); if (!canvas) return;
  var ctx = canvas.getContext("2d"); if (!ctx) return;
  var work = document.getElementById("work"); if (!work) return;

  var W = 0, H = 0, DPR = 1, cols = 0, colW = 0, columns = [], chips = [];
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
    if (reduce) return T >= 0.5 ? 1 : 0;          // reduced motion → snap, no gradual rise
    return clamp01((T - BLOCK_T_START) / (1 - BLOCK_T_START));
  }

  function build() {
    cols = W >= COL_BP ? COLS_DESKTOP : W >= COL_MID_BP ? COLS_MID : COLS_MOBILE;
    colW = W / cols;
    columns = [];
    for (var c = 0; c < cols; c++) {
      columns.push({
        frac: COL_MINFRAC + Math.random() * (1 - COL_MINFRAC),  // stepped skyline height
        delay: Math.random() * 0.18,                            // slight per-column stagger
        col: COLORS[(Math.random() * COLORS.length) | 0],
      });
    }
    var n = W >= COL_MID_BP ? CHIPS_DESKTOP : CHIPS_MOBILE;
    chips = [];
    for (var i = 0; i < n; i++) {
      chips.push({
        x: Math.random(), y: 0.24 + Math.random() * 0.5,        // normalized position
        s: CHIP_MIN + Math.random() * (CHIP_MAX - CHIP_MIN),
        rot: Math.random() * 6.2832, spin: (Math.random() * 2 - 1) * 3,
        drift: Math.random() * 6.2832, appear: Math.random() * 0.5,
      });
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
    ctx.clearRect(0, 0, W, H);
    var bp = blockProgress();
    if (bp <= 0.0001) { updateDbg(bp); return; }   // before the transition → nothing
    var maxH = H * MAXH_FRAC;
    // columns rising into a stepped skyline
    for (var c = 0; c < cols; c++) {
      var col = columns[c];
      var lp = clamp01((bp - col.delay) / (1 - col.delay));
      var h = col.frac * maxH * ease(lp);
      if (h <= 0.5) continue;
      ctx.fillStyle = col.col;
      ctx.fillRect(c * colW, H - h, colW + 1, h);
    }
    // dark scrim baked over the blocks (fades in with them) so WORK text stays
    // legible over the light columns — minimal during the flower's fall
    var g = ctx.createLinearGradient(0, 0, 0, H * 0.80);
    g.addColorStop(0, "rgba(9,9,9," + (0.64 * bp).toFixed(3) + ")");
    g.addColorStop(1, "rgba(9,9,9,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // small squares fluttering up as the blocks rise
    ctx.fillStyle = CHIP_COLOR;
    for (var i = 0; i < chips.length; i++) {
      var ch = chips[i];
      if (bp <= ch.appear) continue;
      var cp = clamp01((bp - ch.appear) / (1 - ch.appear));
      var x = ch.x * W + Math.sin(ch.drift + cp * 6) * 30;
      var y = ch.y * H - cp * 90 + Math.cos(ch.drift + cp * 5) * 16;
      var ang = ch.rot + cp * ch.spin;
      ctx.globalAlpha = Math.min(1, cp * 2.5) * 0.72;
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillRect(-ch.s / 2, -ch.s / 2, ch.s, ch.s); ctx.restore();
    }
    ctx.globalAlpha = 1;
    updateDbg(bp);
  }

  var dbg = null;
  function updateDbg(bp) {
    if (!dbg) return;
    var T = progress();
    dbg.textContent = "T=" + T.toFixed(3) + "\nblockP=" + bp.toFixed(3) + "\nfallP=" + clamp01(T / 0.7).toFixed(3);
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

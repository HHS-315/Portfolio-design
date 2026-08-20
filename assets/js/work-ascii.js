/*
 * WORK section header — the word "WORK" rendered the SAME way as the intro "PORTFOLIO":
 * the letterforms (hero font, heavy) are rasterised to a grid and every filled cell becomes a
 * random ASCII glyph from the SAME `CODE` set as the dandelion, churning (swapping) and shimmering
 * in alpha — i.e. the "blink". Colour follows --work-ink so it darkens with the section as the light
 * cells fill behind it. Animates only while the header is on screen; static under reduced-motion.
 */
(function () {
  "use strict";
  var host = document.getElementById("workAscii"); if (!host) return;
  var reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;

  // same character set the dandelion uses for its code glyphs
  var CODE = ['0','1','/','\\','<','>','{','}','(',')','=','+','-','*','#','$','%','&','|',';',':','.','x','?','!','^','~'];
  var pick = function (a) { return a[(Math.random() * a.length) | 0]; };

  var root = document.documentElement;
  var HERO = (getComputedStyle(root).getPropertyValue("--hero-font") || "'Plus Jakarta Sans',sans-serif").trim();
  var MONO = (getComputedStyle(root).getPropertyValue("--mono") || "monospace").trim();

  var cv = document.createElement("canvas"); cv.setAttribute("aria-hidden", "true");
  cv.style.display = "block"; host.appendChild(cv);
  var ctx = cv.getContext("2d");

  // ambient scatter field — a separate viewport-fixed canvas (see FIELD_* knobs). Created below, only when the
  // WORK section exists AND FIELD_ON is true; drawn in the same loop as the header. When OFF, fx stays null and
  // buildField()/drawField()/keepOut() all early-return on their `if (!fx)` guard — so NOTHING runs, including
  // keepOut()'s per-frame getBoundingClientRect() reflow. The field is fully inert, not merely hidden.
  var section = document.getElementById("work");
  var fx = null, fctx = null, FW = 0, FH = 0, fcells = [], fieldFS = 12;   // fieldFS recomputed per build (responsive)

  // ---- knobs --------------------------------------------------------------
  // Matched to the intro (dandelion.js extractText): glyph = FS 6–9px, step = glyph×0.7 (~1.43× overlap).
  var CELL_RATIO  = 0.10;   // glyph size = letterform size × this, then clamped to [CELL_MIN, CELL_MAX].
                            // Kept SMALL (near the floor): a small glyph + step 0.7 gives the intro's dense,
                            // clean fill. Bigger glyphs at this word size read as sparse OR (with tight step) mushy.
  var CELL_MIN    = 6, CELL_MAX = 7;   // intro glyph size is FS ≈ 6–9px — WORK stays at the small end
  var STEP_RATIO  = 0.70;   // grid step = glyph × this. INTRO = 0.7 (~1.43× overlap). was 0.44 (~2.3× → mushy)
  var CHURN_MIN   = 280, CHURN_MAX = 1150;   // per-glyph swap period (ms) — matches the calm live flower
  var SHIM_SPEED  = 0.006, SHIM_AMP = 0.16, SHIM_BASE = 0.62;   // alpha shimmer (the blink). INTRO ≈ 0.4–1 base +
                                                               // 0.10 shimmer; was 0.84 base → too opaque, muddy
  // ---- ambient scatter field (empty space around the WORK list) -----------
  // Sparse dark glyphs churning/shimmering in the blank areas around the list (right margin, top/bottom),
  // reference: artefakt.mov. Drawn on a viewport-fixed canvas (#work-fx, z3 — above the white cells, below
  // the list text) inside THIS file's existing rAF loop (no new loop). Colour = same --work-ink but very low
  // alpha; the element's opacity is bound to --work-reveal (CSS) so it appears/disappears WITH the cells.
  var FIELD_ON       = false; // MASTER SWITCH. false → the #work-fx canvas is never created; buildField /
                              // drawField / keepOut never run (fully inert, no reflow), while the .work-fx CSS
                              // and perf-hud "workfx" row stay in place. Flip to true to bring the field back —
                              // every sizing/alpha/churn knob below is preserved for that.
  var FIELD_GLYPHS   = 46;    // total scattered glyphs on screen (sparse — reference is a few dozen)
  var FIELD_CLUSTERS = 7;     // loose clusters they group into (not fully random)
  var FIELD_CLUSTER_R= 64;    // cluster radius (px) glyphs scatter within their seed
  // glyph size — MIRRORS dandelion.js's bottom-strip size so the ambient field reads at the SAME scale.
  // dandelion.js is out of scope, so we recompute its formula here — keep these in sync with it:
  //   FS = clamp(W/170, 6, 9), ×STRIP_SCALE_MOB(1.22) on mobile (W≤640). 1440→8.47px (was a fixed 12).
  var FIELD_FS_DIV = 170, FIELD_FS_MIN = 6, FIELD_FS_MAX = 9;   // == dandelion.js FS = clamp(W/170, 6, 9)
  var FIELD_MOB_BP = 640, FIELD_MOB_SCALE = 1.22;              // == dandelion.js STRIP_SCALE_MOB on W≤640
  var FIELD_GAP_RATIO = 1.1;   // tooClose reject radius = fieldFS × this — narrows WITH the glyph so clusters
                               // stay proportionally spaced as the size drops; tune cluster spacing here alone.
  var FIELD_MARGIN   = 12;     // viewport-edge keep-out (px) — ABSOLUTE (was = FIELD_FS) so it holds at 12.
  var FIELD_PAD      = 16;    // keep-out padding (px) around each list-text / header rect
  var FIELD_ALPHA_BASE = 0.24, FIELD_ALPHA_AMP = 0.09;   // low alpha (0.15–0.33 range) — subtle on the white bg
  var FIELD_CHURN_MIN  = 900, FIELD_CHURN_MAX = 2600;    // per-glyph swap period (ms) — SLOWER than the header
  var FIELD_SHIM_SPEED = 0.0026;                         // alpha shimmer speed — gentler than the header
  var FIELD_ALPHA_MAX  = 0.35;
  // -------------------------------------------------------------------------

  // create the ambient-field canvas ONLY when enabled (see FIELD_ON). Placed after the knobs so the flag is set.
  if (section && FIELD_ON) {
    fx = document.createElement("canvas"); fx.className = "work-fx"; fx.setAttribute("aria-hidden", "true");
    document.body.appendChild(fx);
    fctx = fx.getContext("2d");
  }

  var DPR = 1, cells = [], cellFS = 10, tw = 0, th = 0;

  // Fixed dark ink now — the header no longer colour-shifts; it FADES IN via the .work-ascii element's
  // opacity (bound to --work-reveal, set by work-transition.js). Read the token once for the value.
  var INK = (getComputedStyle(root).getPropertyValue("--work-ink") || "#141414").trim() || "#141414";

  function build() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    var LFS = parseFloat(getComputedStyle(host).fontSize) || 54;   // letterform size (CSS-driven, responsive)
    cellFS = Math.max(CELL_MIN, Math.min(CELL_MAX, LFS * CELL_RATIO));   // glyph 6–9px (intro range)
    var step = Math.max(3, cellFS * STEP_RATIO);

    // rasterise "WORK" in the hero font (heavy) and sample a grid of the filled pixels
    var off = document.createElement("canvas"), o = off.getContext("2d");
    o.font = "800 " + LFS + "px " + HERO;
    var word = "WORK";
    tw = Math.ceil(o.measureText(word).width) + 6;
    th = Math.ceil(LFS * 1.16) + 6;
    off.width = tw; off.height = th; o = off.getContext("2d");
    o.font = "800 " + LFS + "px " + HERO; o.textAlign = "center"; o.textBaseline = "middle"; o.fillStyle = "#fff";
    o.fillText(word, tw / 2, th / 2);
    var img = o.getImageData(0, 0, tw, th).data;

    cells = [];
    for (var y = step / 2; y < th; y += step) {
      var row = (y | 0) * tw;
      for (var x = step / 2; x < tw; x += step) {
        if (img[(row + (x | 0)) * 4 + 3] > 128) cells.push({ x: x, y: y, ch: pick(CODE), swapAt: 0, ph: Math.random() * 6.283 });
      }
    }

    if (window.console) console.log("[work-ascii] cells:", cells.length, "cellFS:", cellFS.toFixed(1), "step:", step.toFixed(1));
    cv.style.width = tw + "px"; cv.style.height = th + "px";
    cv.width = Math.round(tw * DPR); cv.height = Math.round(th * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = cellFS.toFixed(1) + "px " + MONO;

    buildField();
  }

  // tightest on-screen rect of an element's TEXT (not its full-width box) — so glyphs may use the empty
  // right margin of each list row, not just the gaps. Uses a Range over the visible copy; falls back to the
  // element box. Returns viewport coords.
  function textRect(el) {
    var t = el.querySelector(".wr__copy:not(.wr__copy--dup)") || el;   // work-list.js wraps .wbig__en in a 2-copy track
    try { var rg = document.createRange(); rg.selectNodeContents(t); var r = rg.getBoundingClientRect(); if (r && r.width) return r; } catch (e) {}
    return el.getBoundingClientRect();
  }

  // Live keep-out rects (viewport coords, padded): the nav bar, the header word, and each list row's TEXT
  // (tight, so the right margin stays usable). Recomputed on demand because they move as the list scrolls.
  var bar = document.querySelector(".bar");
  function keepOut() {
    var ex = [];
    function add(r) { if (r && r.width && r.height) ex.push({ x: r.left - FIELD_PAD, y: r.top - FIELD_PAD, w: r.width + FIELD_PAD * 2, h: r.height + FIELD_PAD * 2 }); }
    if (bar) add(bar.getBoundingClientRect());
    add(host.getBoundingClientRect());
    [].forEach.call(section.querySelectorAll(".wbig__en,.wbig__ko"), function (el) { add(textRect(el)); });
    return ex;
  }
  function hits(ex, x, y) { for (var i = 0; i < ex.length; i++) { var r = ex[i]; if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true; } return false; }

  // Lay out the scatter glyphs (viewport space) in a few loose clusters, biased into the empty bands (right
  // margin / top / bottom) and rejected out of the keep-out rects. Recomputed on resize.
  function buildField() {
    if (!fx) return;
    FW = window.innerWidth; FH = window.innerHeight;
    // responsive glyph size = dandelion.js strip size: clamp(W/170, 6, 9) × mobile bump. Recomputed per build.
    fieldFS = Math.max(FIELD_FS_MIN, Math.min(FIELD_FS_MAX, FW / FIELD_FS_DIV)) * (FW <= FIELD_MOB_BP ? FIELD_MOB_SCALE : 1);
    fx.width = Math.round(FW * DPR); fx.height = Math.round(FH * DPR);
    fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fctx.textAlign = "center"; fctx.textBaseline = "middle";
    fctx.font = fieldFS.toFixed(1) + "px " + MONO;

    var ex = keepOut();
    function blocked(x, y) { return hits(ex, x, y); }
    var gap = fieldFS * FIELD_GAP_RATIO, gap2 = gap * gap;   // min glyph spacing (narrows with fieldFS)
    function tooClose(x, y) { for (var i = 0; i < fcells.length; i++) { var dx = fcells[i].x - x, dy = fcells[i].y - y; if (dx * dx + dy * dy < gap2) return true; } return false; }

    // cluster seeds — weighted toward the right margin, then top/bottom bands (where the left-aligned list
    // leaves the most room). A few glyphs scatter within FIELD_CLUSTER_R of each seed.
    function seed() {
      var band = Math.random();
      if (band < 0.55) return { x: FW * (0.60 + Math.random() * 0.36), y: FH * (0.10 + Math.random() * 0.80) }; // right margin
      if (band < 0.78) return { x: FW * (0.06 + Math.random() * 0.88), y: FH * (0.04 + Math.random() * 0.12) };  // top band
      return { x: FW * (0.06 + Math.random() * 0.88), y: FH * (0.82 + Math.random() * 0.14) };                   // bottom band
    }
    fcells = [];
    var margin = FIELD_MARGIN, per = Math.max(2, Math.round(FIELD_GLYPHS / FIELD_CLUSTERS)), guard = 0;
    for (var ci = 0; ci < FIELD_CLUSTERS && fcells.length < FIELD_GLYPHS; ci++) {
      var s = seed();
      for (var k = 0; k < per * 4 && fcells.length < FIELD_GLYPHS; k++) {
        if (guard++ > FIELD_GLYPHS * 60) break;
        var gx = s.x + (Math.random() * 2 - 1) * FIELD_CLUSTER_R, gy = s.y + (Math.random() * 2 - 1) * FIELD_CLUSTER_R;
        if (gx < margin || gx > FW - margin || gy < margin || gy > FH - margin) continue;
        if (blocked(gx, gy) || tooClose(gx, gy)) continue;
        fcells.push({ x: gx, y: gy, ch: pick(CODE), swapAt: 0, ph: Math.random() * 6.283 });
      }
    }
  }

  // Draw the scatter field. Glyphs are viewport-fixed; the list scrolls, so re-test each glyph against the
  // CURRENT text rects and skip any the list has scrolled over (keeps them out of the words while moving).
  function drawField(t) {
    if (!fx || !fcells.length) return;
    var _tp = window.HeroPerf ? HeroPerf.t() : 0;
    fctx.clearRect(0, 0, FW, FH);
    var live = keepOut();   // rects move as the list scrolls — re-test each glyph against the CURRENT rects
    fctx.fillStyle = INK;
    for (var i = 0; i < fcells.length; i++) {
      var c = fcells[i];
      if (hits(live, c.x, c.y)) continue;
      if (!reduce && t > c.swapAt) { c.ch = pick(CODE); c.swapAt = t + FIELD_CHURN_MIN + Math.random() * (FIELD_CHURN_MAX - FIELD_CHURN_MIN); }
      var a = reduce ? FIELD_ALPHA_BASE : FIELD_ALPHA_BASE + Math.sin(t * FIELD_SHIM_SPEED + c.ph) * FIELD_ALPHA_AMP;
      if (a < 0.02) continue; if (a > FIELD_ALPHA_MAX) a = FIELD_ALPHA_MAX;
      fctx.globalAlpha = a;
      fctx.fillText(c.ch, c.x, c.y);
    }
    fctx.globalAlpha = 1;
    if (window.HeroPerf) HeroPerf.add("workfx", _tp);
  }

  function draw(t) {
    ctx.clearRect(0, 0, tw, th);
    ctx.fillStyle = INK;
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      if (!reduce && t > c.swapAt) { c.ch = pick(CODE); c.swapAt = t + CHURN_MIN + Math.random() * (CHURN_MAX - CHURN_MIN); }
      var a = reduce ? 0.9 : SHIM_BASE + Math.sin(t * SHIM_SPEED + c.ph) * SHIM_AMP;
      if (a < 0.06) continue; if (a > 1) a = 1;
      ctx.globalAlpha = a;
      ctx.fillText(c.ch, c.x, c.y);
    }
    ctx.globalAlpha = 1;
  }

  var raf = 0, onScreen = false, visible = document.visibilityState === "visible";
  function paint(t) { draw(t); drawField(t); }   // header + ambient field share this file's single loop
  function frame(t) { raf = 0; if (!onScreen || !visible) return; paint(t); if (!reduce) raf = requestAnimationFrame(frame); }
  function kick() { if (!raf && onScreen && visible && !reduce) raf = requestAnimationFrame(frame); }

  build();
  paint(performance.now());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { build(); paint(performance.now()); kick(); });

  // observe the whole WORK section (not just the header): it runs tall, so the ambient field keeps
  // animating through the full-white plateau after the header has scrolled off the top.
  new IntersectionObserver(function (es) {
    onScreen = es[0] ? es[0].isIntersecting : true;
    if (onScreen) { if (reduce) paint(performance.now()); else kick(); }
    else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }).observe(section || host);
  document.addEventListener("visibilitychange", function () {
    visible = document.visibilityState === "visible";
    if (visible) kick(); else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  });
  addEventListener("resize", function () { build(); paint(performance.now()); kick(); }, { passive: true });
  // (ink is fixed now; the fade lives in CSS via --work-reveal on .work-ascii, so no scroll-colour redraw.)
})();

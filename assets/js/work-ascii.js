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

  // ---- knobs --------------------------------------------------------------
  // Overlap ratio matched to the intro (step = glyph×0.7 ≈ 1.43×); glyph size at the TOP of the intro
  // 6–9px range so the fill has body (small floor read too faint/thin).
  var CELL_RATIO  = 0.13;   // glyph size = letterform size × this, then clamped to [CELL_MIN, CELL_MAX]
  var CELL_MIN    = 6, CELL_MAX = 9;   // intro glyph size is FS ≈ 6–9px — sit near the top (≈8–9px desktop)
  var STEP_RATIO  = 0.70;   // grid step = glyph × this. INTRO = 0.7 (~1.43× overlap) — bigger glyph → bigger step, no mush
  var CHURN_MIN   = 280, CHURN_MAX = 1150;   // per-glyph swap period (ms) — matches the calm live flower
  var SHIM_SPEED  = 0.006, SHIM_AMP = 0.12, SHIM_BASE = 0.80;   // alpha shimmer (the blink) → 0.68–0.92. Solid now
                                                               // that overlap is only 1.43× (0.84 was muddy at 2.3×)
  var FONT_WEIGHT = "600";  // heavier mono glyphs → more stroke density (rounds to the nearest loaded JetBrains
                            // Mono weight, 500/700; harmless if unsupported)
  // -------------------------------------------------------------------------

  var DPR = 1, cells = [], cellFS = 10, tw = 0, th = 0;

  function inkColor() {
    var c = getComputedStyle(root).getPropertyValue("--work-ink").trim();
    return c || "#e9e9e6";
  }

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
    ctx.font = FONT_WEIGHT + " " + cellFS.toFixed(1) + "px " + MONO;
  }

  function draw(t) {
    ctx.clearRect(0, 0, tw, th);
    ctx.fillStyle = inkColor();
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
  function frame(t) { raf = 0; if (!onScreen || !visible) return; draw(t); if (!reduce) raf = requestAnimationFrame(frame); }
  function kick() { if (!raf && onScreen && visible && !reduce) raf = requestAnimationFrame(frame); }

  build();
  draw(performance.now());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { build(); draw(performance.now()); kick(); });

  new IntersectionObserver(function (es) {
    onScreen = es[0] ? es[0].isIntersecting : true;
    if (onScreen) { if (reduce) draw(performance.now()); else kick(); }
    else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }).observe(host);
  document.addEventListener("visibilitychange", function () {
    visible = document.visibilityState === "visible";
    if (visible) kick(); else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  });
  addEventListener("resize", function () { build(); draw(performance.now()); kick(); }, { passive: true });
  // --work-ink shifts light→dark on scroll: the rAF loop reads it each frame; when it's not looping
  // (reduced-motion, or before the loop kicks) keep the colour in step on scroll too.
  addEventListener("scroll", function () { if (!raf) draw(performance.now()); }, { passive: true });
})();

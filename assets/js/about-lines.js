/*
 * ABOUT line glitch — as each couplet row scrolls into view, its left & right
 * lines do one short glyph-scramble, then settle. Replays every time the section
 * re-enters the viewport. Single rAF (only active rows compute); no setInterval.
 * Kept separate from dandelion.js's one-shot `.reveal` observer on purpose.
 */
(function () {
  "use strict";

  // ---- timing knobs -------------------------------------------------------
  var THRESHOLD   = 0.3;   // fraction of #about visible before it fires
  var ROW_STAGGER = 120;   // ms between groups (rows on desktop, lines on mobile)
  var DUR_MIN     = 250;   // ms per-char scramble duration (min)
  var DUR_MAX     = 400;   // ms per-char scramble duration (max)
  var CHAR_DELAY  = 120;   // ms max random per-char start delay
  var GLYPHS      = "!<>-_\\/[]{}=+*^?#$";
  // -------------------------------------------------------------------------

  var reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  var grid = document.querySelector(".about__grid");
  if (!grid) return;
  var lineEls = [].slice.call(grid.querySelectorAll(".about__line"));
  if (!lineEls.length) return;

  function pick() { return GLYPHS[(Math.random() * GLYPHS.length) | 0]; }

  var lines = lineEls.map(function (el) {
    var span = el.querySelector("span") || el;
    var text = (el.getAttribute("aria-label") || span.textContent || "").toString();
    return {
      el: el, span: span, text: text,
      side: el.getAttribute("data-side") || "l",
      row: parseInt(el.getAttribute("data-row") || "1", 10),
      chars: null, startAt: 0, active: false,
    };
  });

  function setFinal(l) { l.span.textContent = l.text; l.el.style.opacity = ""; l.active = false; }

  // Reduced motion: never scramble — leave the final words in place.
  if (reduce) { lines.forEach(setFinal); return; }

  var playing = false, raf = 0, t0 = 0;

  // Desktop: left+right of the same row fire together (3 groups).
  // Mobile:  L1..L3 then R1..R3 (6 groups).
  function staggerIndex(l, wide) {
    if (wide) return l.row - 1;
    return (l.side === "r" ? 3 : 0) + (l.row - 1);
  }

  function play() {
    var wide = matchMedia("(min-width:821px)").matches;
    t0 = 0;
    lines.forEach(function (l) {
      l.startAt = staggerIndex(l, wide) * ROW_STAGGER;   // relative to first frame
      l.chars = [];
      for (var i = 0; i < l.text.length; i++) {
        var c = l.text.charAt(i), sp = (c === " ");      // never scramble spaces
        l.chars.push({
          ch: c, sp: sp,
          d: sp ? 0 : Math.random() * CHAR_DELAY,
          u: sp ? 0 : DUR_MIN + Math.random() * (DUR_MAX - DUR_MIN),
        });
      }
      l.active = true;
    });
    if (raf === 0) raf = requestAnimationFrame(frame);
  }

  function reset() {
    if (raf !== 0) { cancelAnimationFrame(raf); raf = 0; }
    lines.forEach(setFinal);
    playing = false;
  }

  function frame(now) {
    raf = 0;
    if (t0 === 0) t0 = now;
    var elapsed = now - t0, stillActive = false;
    for (var k = 0; k < lines.length; k++) {
      var l = lines[k];
      if (!l.active) continue;
      var lt = elapsed - l.startAt;
      if (lt < 0) { stillActive = true; continue; }      // waiting its turn
      var done = true, out = "";
      for (var i = 0; i < l.chars.length; i++) {
        var ch = l.chars[i];
        if (ch.sp) { out += " "; continue; }
        if (lt < ch.d) out += ch.ch;                     // not started → final
        else if (lt < ch.d + ch.u) { out += pick(); done = false; }  // scrambling
        else out += ch.ch;                               // settled
      }
      l.span.textContent = out;
      if (done) setFinal(l);
      else { l.el.style.opacity = (0.55 + Math.random() * 0.45).toFixed(2); stillActive = true; }
    }
    if (stillActive) raf = requestAnimationFrame(frame);
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { if (!playing) { playing = true; play(); } }
      else reset();                                      // leave → reset so it replays
    });
  }, { threshold: THRESHOLD });
  io.observe(grid);
})();

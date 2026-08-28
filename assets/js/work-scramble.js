/*
 * WORK header DECODE-IN — the big "WORK" title runs a scramble→reveal once, when the WORK section settles.
 *
 * Ported from a React "SpecialText" component (motion/react useInView) to dependency-free vanilla JS — no
 * React, no motion: IntersectionObserver stands in for useInView, setInterval for the tick loop. The two-phase
 * algorithm and the RANDOM char set are kept from the source so the look matches:
 *   phase 1 — type in random code glyphs left→right;
 *   phase 2 — resolve to the real letters left→right, a "_"/random cursor riding the reveal frontier.
 *
 * Target is the monospace .work-ascii__t (index.html) so the scramble holds a FIXED width (no reflow) — the
 * source relies on font-mono for the same reason. The glyph-mosaic canvas that used to draw "WORK" is turned
 * off in work-ascii.js (HEADER_ON=false); its two ambient scatter fields are unchanged.
 *
 * Gated on --work-reveal (the header's own fade-in, set by work-transition.js) so the decode isn't spent while
 * the header is still transparent behind the rising cells. reduced-motion or no IntersectionObserver → skip,
 * show the plain word. #workAscii keeps role="img" aria-label="Work", so the churn never reaches assistive tech.
 */
(function () {
  "use strict";

  var el = document.querySelector(".work-ascii__t");
  if (!el) return;

  // ---- knobs --------------------------------------------------------------
  var RANDOM = "_!X$0-+*#";   // same vocabulary as the source (and the site's ASCII motif)
  var SPEED = 55;             // ms per step — a touch slower than the source's 20 so the big 4-letter header reads
  var REVEAL_MIN = 0.6;       // start only once the header has faded in to at least this --work-reveal
  var POLL_MS = 100, POLL_MAX = 60;   // reveal-gate poll (fallback: start anyway after POLL_MAX ticks)
  // -------------------------------------------------------------------------

  var reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  var root = document.documentElement;
  var text = (el.textContent || "WORK").trim() || "WORK";

  function rnd(prev) { var c; do { c = RANDOM[(Math.random() * RANDOM.length) | 0]; } while (c === prev); return c; }
  function rep(s, n) { var o = ""; for (var i = 0; i < n; i++) o += s; return o; }

  function animate() {
    var phase = 1, step = 0, timer = null;
    el.textContent = rep(" ", text.length);
    function tick() {
      if (phase === 1) {
        var max = text.length * 2, len = Math.min(step + 1, text.length), out = "", prev;
        for (var i = 0; i < len; i++) { var ch = rnd(prev); out += ch; prev = ch; }
        for (var j = len; j < text.length; j++) out += " ";
        el.textContent = out;
        if (step < max - 1) step++; else { phase = 2; step = 0; }
      } else {
        var rev = Math.floor(step / 2), o2 = "";
        for (var k = 0; k < rev && k < text.length; k++) o2 += text[k];
        if (rev < text.length) o2 += (step % 2 === 0) ? "_" : rnd();
        for (var m = o2.length; m < text.length; m++) o2 += rnd();
        el.textContent = o2;
        if (step < text.length * 2 - 1) step++;
        else { el.textContent = text; clearInterval(timer); return; }
      }
    }
    timer = setInterval(tick, SPEED);
  }

  if (reduce || !("IntersectionObserver" in window)) { el.textContent = text; return; }

  function ready() {
    var v = parseFloat(root.style.getPropertyValue("--work-reveal") || getComputedStyle(root).getPropertyValue("--work-reveal"));
    return isNaN(v) ? true : v >= REVEAL_MIN;   // if the var isn't driven, don't hang — just play
  }
  function startWhenReady() {
    if (ready()) { animate(); return; }
    var n = 0, poll = setInterval(function () { if (ready() || ++n >= POLL_MAX) { clearInterval(poll); animate(); } }, POLL_MS);
  }

  el.textContent = rep(" ", text.length);   // blank until it decodes (the header is opacity:0 here anyway)

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      startWhenReady();
    });
  }, { threshold: 0.6 });
  io.observe(el);
})();

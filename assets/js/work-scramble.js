/*
 * WORK list title DECODE-IN — a scramble→reveal that plays once on each big category title (.wbig__en)
 * when it scrolls into the settled WORK section.
 *
 * Ported from a React "SpecialText" component (motion/react useInView) to dependency-free vanilla JS —
 * no React, no motion: IntersectionObserver stands in for useInView, setInterval for the tick loop. The
 * two-phase algorithm and the RANDOM char set are kept byte-for-byte with the source so the look matches:
 *   phase 1 — type in random code glyphs left→right (rest padded with NBSP);
 *   phase 2 — resolve to the real characters left→right, a "_"/random cursor riding the reveal frontier.
 *
 * Coexists with the hover curtain (work-list.js): when a row is wired, its title lives as two identical
 * .wr__copy copies inside .wr__track — we animate BOTH in lockstep so they stay identical and the roll is
 * unaffected. Otherwise (touch / reduced-motion, no curtain) the .wbig__en text is animated directly.
 *
 * Gated on --work-reveal (the list's own fade-in, set by work-transition.js) so the decode isn't spent
 * while the list is still transparent behind the rising cells. reduced-motion or no IntersectionObserver →
 * skip entirely, leave the plain final text. aria-label pins each row's accessible name to the final text
 * so the rapid textContent churn never reaches assistive tech.
 */
(function () {
  "use strict";

  // ---- knobs (SPEED matches the source component) -------------------------
  var RANDOM = "_!X$0-+*#";   // same vocabulary as the source (and the site's ASCII motif)
  var SPEED = 20;             // ms per animation step
  var REVEAL_MIN = 0.6;       // start only once the list has faded in to at least this --work-reveal
  var POLL_MS = 100, POLL_MAX = 60;   // reveal-gate poll (fallback: start anyway after POLL_MAX ticks)
  // -------------------------------------------------------------------------

  var reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  var root = document.documentElement;

  function rnd(prev) { var c; do { c = RANDOM[(Math.random() * RANDOM.length) | 0]; } while (c === prev); return c; }

  // The text holder(s) for a title: both curtain copies if wired, else the element itself.
  function targetsOf(en) {
    var copies = en.querySelectorAll(".wr__copy");
    return copies.length ? [].slice.call(copies) : [en];
  }
  function setText(targets, s) { for (var i = 0; i < targets.length; i++) targets[i].textContent = s; }

  function animate(en, text) {
    var targets = targetsOf(en);       // re-read in case the curtain wired after capture
    if (!text) return;
    var phase = 1, step = 0, timer = null;
    setText(targets, repeat(" ", text.length));   // reserve the slot, blank
    function tick() {
      if (phase === 1) {
        var maxSteps = text.length * 2;
        var len = Math.min(step + 1, text.length), out = "", prev;
        for (var i = 0; i < len; i++) { var ch = rnd(prev); out += ch; prev = ch; }
        for (var j = len; j < text.length; j++) out += " ";
        setText(targets, out);
        if (step < maxSteps - 1) step++; else { phase = 2; step = 0; }
      } else {
        var revealed = Math.floor(step / 2), out2 = "";
        for (var k = 0; k < revealed && k < text.length; k++) out2 += text[k];
        if (revealed < text.length) out2 += (step % 2 === 0) ? "_" : rnd();
        for (var m = out2.length; m < text.length; m++) out2 += rnd();
        setText(targets, out2);
        if (step < text.length * 2 - 1) step++;
        else { setText(targets, text); clearInterval(timer); return; }
      }
    }
    timer = setInterval(tick, SPEED);
  }

  function repeat(s, n) { var o = ""; for (var i = 0; i < n; i++) o += s; return o; }
  function revealReady() {
    var v = parseFloat(root.style.getPropertyValue("--work-reveal") || getComputedStyle(root).getPropertyValue("--work-reveal"));
    return isNaN(v) ? true : v >= REVEAL_MIN;   // if the var isn't driven, don't hang — just play
  }
  // Start when the list has faded in; poll briefly if the row entered view mid-transition.
  function startWhenReady(en, text) {
    if (revealReady()) { animate(en, text); return; }
    var n = 0, poll = setInterval(function () {
      if (revealReady() || ++n >= POLL_MAX) { clearInterval(poll); animate(en, text); }
    }, POLL_MS);
  }

  var items = [].slice.call(document.querySelectorAll(".wbig__en"));
  if (!items.length) return;

  // Capture the final text NOW (work-list.js has already run, so curtain copies already hold it) and pin the
  // accessible name so the churn never reaches screen readers.
  var finals = items.map(function (en) {
    var t = targetsOf(en)[0].textContent;
    var row = en.closest(".wbig__item"); if (row && !row.getAttribute("aria-label")) row.setAttribute("aria-label", t);
    return t;
  });

  if (reduce || !("IntersectionObserver" in window)) return;   // reduced-motion / legacy → leave plain text

  // Blank the titles up front so the final text never flashes before it decodes (the list is opacity:0 here).
  items.forEach(function (en, i) { setText(targetsOf(en), repeat(" ", finals[i].length)); });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      startWhenReady(e.target, finals[items.indexOf(e.target)]);
    });
  }, { threshold: 0.55 });
  items.forEach(function (en) { io.observe(en); });
})();

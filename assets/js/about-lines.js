/*
 * ABOUT line blind-flicker — runrobrun-style. Each .about__line is an
 * overflow:hidden mask; its <span> only slides on translateY (the letters
 * never change). As #about scrolls through the viewport, each row flicks in
 * at its own scroll-progress point: span snaps -100% / 0 / +100% a few times
 * (instant, no transition), then eases to 0. Scrolling back up re-arms it.
 * Single rAF; scroll listener is passive + rAF-throttled.
 * prefers-reduced-motion → no motion, final text fixed in place.
 */
(function () {
  "use strict";

  // ---- knobs (scroll-progress triggers + flicker timing) ------------------
  var ROW_TRIGGERS    = [0.15, 0.28, 0.41];               // desktop: rows 1/2/3 (L+R together)
  var MOBILE_TRIGGERS = [0.14, 0.22, 0.30, 0.38, 0.46, 0.54]; // mobile: L1,L2,L3,R1,R2,R3
  var RESET_MARGIN    = 0.02;   // progress must drop this far below a trigger to re-arm
  var FLICK_REPS_MIN  = 2;      // blind repetitions (each = -100 → 0 → +100 → 0)
  var FLICK_REPS_MAX  = 3;
  var STEP_MIN        = 60;     // ms held per snap
  var STEP_MAX        = 90;
  var SETTLE_MS       = 120;    // final ease-out into place
  // -------------------------------------------------------------------------

  var reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  var about = document.getElementById("about");
  var grid = document.querySelector(".about__grid");
  if (!about || !grid) return;
  var lineEls = [].slice.call(grid.querySelectorAll(".about__line"));
  if (!lineEls.length) return;

  var lines = lineEls.map(function (el) {
    return {
      el: el, span: el.querySelector("span") || el,
      side: el.getAttribute("data-side") || "l",
      row: parseInt(el.getAttribute("data-row") || "1", 10),
      played: false, phase: "idle",           // idle | flick | settle | done
      steps: null, stepIdx: 0, stepStart: 0, stepDur: 0, settleStart: 0,
    };
  });

  function setY(l, pct) { l.span.style.transform = "translateY(" + pct + "%)"; }

  // Reduced motion: park every line at its final position, no listeners.
  if (reduce) { lines.forEach(function (l) { l.span.style.transform = ""; }); return; }

  // Rest state before a line has fired: hidden above the mask.
  lines.forEach(function (l) { l.span.style.transition = "none"; setY(l, -100); });

  function triggerFor(l, wide) {
    if (wide) return ROW_TRIGGERS[l.row - 1];
    return MOBILE_TRIGGERS[(l.side === "r" ? 3 : 0) + (l.row - 1)];
  }

  function startFlick(l, now) {
    var reps = FLICK_REPS_MIN + Math.round(Math.random() * (FLICK_REPS_MAX - FLICK_REPS_MIN));
    var seq = [];
    for (var r = 0; r < reps; r++) seq.push(-100, 0, 100, 0);
    seq.pop();                                 // end on +100, then ease to 0 for a smooth arrival
    l.steps = seq; l.stepIdx = 0;
    l.span.style.transition = "none";
    setY(l, seq[0]);
    l.stepStart = now; l.stepDur = STEP_MIN + Math.random() * (STEP_MAX - STEP_MIN);
    l.phase = "flick";
  }

  function rearm(l) {                           // scrolled back before its trigger → hide + reset
    l.played = false; l.phase = "idle";
    l.span.style.transition = "none"; setY(l, -100);
  }

  function progress() {
    var r = about.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var p = (vh - r.top) / (vh + r.height);    // 0: top at viewport bottom · 1: bottom at top
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }

  var raf = 0, needsEval = true;

  function kick() { if (raf === 0) raf = requestAnimationFrame(frame); }

  function frame(now) {
    raf = 0;
    if (needsEval) {
      needsEval = false;
      var wide = matchMedia("(min-width:821px)").matches;
      var p = progress();
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i], T = triggerFor(l, wide);
        if (!l.played && p >= T) { l.played = true; startFlick(l, now); }
        else if (l.played && p < T - RESET_MARGIN) { rearm(l); }
      }
    }

    var active = false;
    for (var k = 0; k < lines.length; k++) {
      var ln = lines[k];
      if (ln.phase === "flick") {
        if (now - ln.stepStart >= ln.stepDur) {
          ln.stepIdx++;
          if (ln.stepIdx < ln.steps.length) {
            setY(ln, ln.steps[ln.stepIdx]);
            ln.stepStart = now; ln.stepDur = STEP_MIN + Math.random() * (STEP_MAX - STEP_MIN);
          } else {
            ln.span.style.transition = "transform " + SETTLE_MS + "ms ease-out";
            setY(ln, 0);
            ln.settleStart = now; ln.phase = "settle";
          }
        }
        active = true;
      } else if (ln.phase === "settle") {
        if (now - ln.settleStart >= SETTLE_MS) { ln.span.style.transition = "none"; ln.phase = "done"; }
        else active = true;
      }
    }
    if (active) raf = requestAnimationFrame(frame);
  }

  function onScroll() { needsEval = true; kick(); }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();                                   // initial evaluation
})();

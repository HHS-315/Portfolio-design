/*
 * ABOUT line curtain-roll — SCROLL-LINKED. Each .about__line <span> is a roll
 * track holding two identical stacked copies. The track's translateY is mapped
 * directly to scroll progress: turn the wheel and the curtain follows in real
 * time; stop and it stops. No triggers, no transition-delay, no cooldown, no
 * direction logic — scrolling back up just reverses the mapping.
 *
 * Each row owns an overlapping progress window (row1 earlier, row3 later) so
 * they cascade. The raw progress is lerp-smoothed so a jumpy wheel doesn't jump
 * the curtain. rAF runs only while something is still easing toward its target
 * (and is re-kicked on scroll); transforms are written only when they actually
 * change (>= MIN_DELTA), and are translate3d for the compositor.
 */
(function () {
  "use strict";

  // ---- knobs --------------------------------------------------------------
  // progress window [start, end] over which each row rolls 0 → 100%
  var RANGES_DESKTOP = [[0.20, 0.40], [0.26, 0.46], [0.32, 0.52]];              // row1, row2, row3
  var RANGES_MOBILE  = [[0.16, 0.34], [0.22, 0.40], [0.28, 0.46],              // L1, L2, L3
                        [0.34, 0.52], [0.40, 0.58], [0.46, 0.64]];             // R1, R2, R3
  var LERP       = 0.12;    // smoothing toward the scroll-derived target (0.1–0.15)
  var MIN_DELTA  = 0.001;   // skip the transform write if the offset moved < 0.1% of a copy
  var SETTLE_EPS = 0.0005;  // treat as arrived (snap + allow rAF to stop) below this
  // -------------------------------------------------------------------------

  var reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  var about = document.getElementById("about");
  var grid = document.querySelector(".about__grid");
  if (!about || !grid) return;
  var lineEls = [].slice.call(grid.querySelectorAll(".about__line"));
  if (!lineEls.length) return;

  var lines = lineEls.map(function (el) {
    return {
      el: el, roll: null,
      side: el.getAttribute("data-side") || "l",
      row: parseInt(el.getAttribute("data-row") || "1", 10),
      text: (el.getAttribute("aria-label") || (el.textContent || "").trim()),
      cur: 0, applied: -1,
    };
  });

  // Reduced motion: leave the single (already-visible) copy, no listeners.
  if (reduce) return;

  // Build the two-copy roll track inside each line's existing <span>.
  lines.forEach(function (l) {
    var span = l.el.querySelector("span");
    if (!span) return;
    span.className = "about__roll";
    span.setAttribute("aria-hidden", "true");   // both copies hidden; aria-label carries the word
    span.textContent = "";
    var a = document.createElement("span"); a.className = "about__copy"; a.textContent = l.text;
    var d = document.createElement("span"); d.className = "about__copy about__copy--dup"; d.textContent = l.text; d.setAttribute("aria-hidden", "true");
    span.appendChild(a); span.appendChild(d);
    l.roll = span;
  });

  function rangeIndex(l, wide) { return wide ? (l.row - 1) : ((l.side === "r" ? 3 : 0) + (l.row - 1)); }

  function progress() {
    var r = about.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var p = (vh - r.top) / (vh + r.height);
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }

  var raf = 0;

  function frame() {
    raf = 0;
    var p = progress();
    var wide = matchMedia("(min-width:821px)").matches;
    var ranges = wide ? RANGES_DESKTOP : RANGES_MOBILE;
    var moving = false;
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (!l.roll) continue;
      var rg = ranges[rangeIndex(l, wide)];
      var target = (p - rg[0]) / (rg[1] - rg[0]);
      if (target < 0) target = 0; else if (target > 1) target = 1;
      var diff = target - l.cur;
      if (Math.abs(diff) > SETTLE_EPS) { l.cur += diff * LERP; moving = true; }
      else l.cur = target;
      if (Math.abs(l.cur - l.applied) >= MIN_DELTA) {
        l.roll.style.transform = "translate3d(0," + (-(l.cur * 100)).toFixed(3) + "%,0)";
        l.applied = l.cur;
      }
    }
    if (moving) raf = requestAnimationFrame(frame);
  }

  function kick() { if (raf === 0) raf = requestAnimationFrame(frame); }

  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", kick);
  kick();   // initial paint (parks every track at its current scroll position)
})();

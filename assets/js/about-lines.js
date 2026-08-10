/*
 * ABOUT line curtain-roll — SCROLL-LINKED. Each .about__line <span> is a roll
 * track holding two identical stacked copies. The track's translateY is mapped
 * directly to scroll progress: the curtain follows the wheel in real time and
 * stops where you stop. Scrolling back up just reverses the mapping.
 *
 * Progress is measured from the TEXT itself (.about__grid), not the 100svh
 * section — so the rows roll while the words are actually on screen. Each row
 * owns a short progress window (spread apart) so row1 → row2 → row3 read as a
 * clear sequence instead of moving together. Raw progress is lerp-smoothed so a
 * jumpy wheel doesn't jump the curtain. rAF runs only while easing toward a
 * target (re-kicked on scroll); transforms write translate3d and only when they
 * actually change (>= MIN_DELTA).
 */
(function () {
  "use strict";

  // ---- knobs --------------------------------------------------------------
  var DEBUG = false;         // true → show live progress + per-row targets in a corner

  // progress window [start,end] over which each row rolls 0→100%. Windows are
  // short and spaced so the rows fire in clear succession (20% overlap).
  var RANGES_DESKTOP = [[0.18, 0.32], [0.28, 0.42], [0.38, 0.52]];   // row1, row2, row3
  // alt (fully separated, no overlap): [[0.18,0.30],[0.30,0.42],[0.42,0.54]]

  // mobile is a vertical stack — rows are far apart on screen, so windows are
  // wider and span more of the scroll.
  var RANGES_MOBILE  = [[0.10, 0.24], [0.20, 0.34], [0.30, 0.44],    // L1, L2, L3
                        [0.42, 0.56], [0.52, 0.66], [0.62, 0.76]];   // R1, R2, R3

  var LERP       = 0.20;    // smoothing toward the scroll-derived target (0.18–0.22)
  var MIN_DELTA  = 0.001;   // skip the transform write if the offset moved < 0.1% of a copy
  var SETTLE_EPS = 0.0005;  // treat as arrived (snap + let rAF stop) below this
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
      cur: 0, applied: -1, target: 0,
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

  var dbg = null;
  if (DEBUG) {
    dbg = document.createElement("div");
    dbg.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:99999;font:11px/1.5 ui-monospace,monospace;color:#5f5;background:rgba(0,0,0,.72);padding:6px 9px;white-space:pre;pointer-events:none;border:1px solid #2a2";
    document.body.appendChild(dbg);
  }

  function rangeIndex(l, wide) { return wide ? (l.row - 1) : ((l.side === "r" ? 3 : 0) + (l.row - 1)); }

  // Progress from the text block, not the section: 0 when the grid's top touches
  // the viewport bottom, 1 when its bottom clears the viewport top.
  function progress() {
    var r = grid.getBoundingClientRect();
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
      l.target = target;
      var diff = target - l.cur;
      if (Math.abs(diff) > SETTLE_EPS) { l.cur += diff * LERP; moving = true; }
      else l.cur = target;
      if (Math.abs(l.cur - l.applied) >= MIN_DELTA) {
        l.roll.style.transform = "translate3d(0," + (-(l.cur * 100)).toFixed(3) + "%,0)";
        l.applied = l.cur;
      }
    }
    if (dbg) {
      var s = "p=" + p.toFixed(3);
      for (var k = 0; k < lines.length; k++) s += "\n" + (lines[k].side + lines[k].row) + " t=" + lines[k].target.toFixed(2);
      dbg.textContent = s;
    }
    if (moving) raf = requestAnimationFrame(frame);
  }

  function kick() { if (raf === 0) raf = requestAnimationFrame(frame); }

  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", kick);
  kick();   // initial paint (parks every track at its current scroll position)
})();

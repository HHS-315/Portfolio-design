/*
 * ABOUT line curtain-roll. Each .about__line is an overflow:hidden mask whose
 * <span> becomes a roll track holding TWO identical copies stacked vertically.
 * A roll = translateY the track by exactly one copy height. Because the copies
 * are identical the mask is never empty (no blink) and the end frame looks the
 * same as the start — the word just "rolls" like a curtain.
 *
 * Motion is 100% compositor-driven: we set `transition` + a target transform
 * ONCE and let CSS interpolate (the dandelion + shader already own rAF, so
 * per-frame JS transforms would stutter). rAF here is used ONLY to read scroll
 * progress and decide when to trigger. transitionend cleans up, with a timeout
 * fallback in case the event is missed.
 */
(function () {
  "use strict";

  // ---- knobs --------------------------------------------------------------
  var TRIGGERS_DESKTOP = [0.30, 0.40, 0.50];                    // progress at which rows 1/2/3 roll
  var TRIGGERS_MOBILE  = [0.20, 0.28, 0.36, 0.44, 0.52, 0.60];  // L1,L2,L3,R1,R2,R3
  var DURATION = 620;                                           // ms, one continuous ease
  var EASING   = "cubic-bezier(0.22, 1, 0.36, 1)";
  var STAGGER  = 75;                                            // ms between rows (via transition-delay)
  var COOLDOWN = 200;                                           // ms lock-out after a roll finishes
  var END_BUFFER = 140;                                         // ms added to the transitionend timeout fallback
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
      dir: null, animating: false, cooldownUntil: 0, timer: 0, onEnd: null,
    };
  });

  // Reduced motion: leave the single (already-visible) copy as-is, no listeners.
  if (reduce) return;

  var nowMs = (window.performance && performance.now)
    ? function () { return performance.now(); }
    : function () { return Date.now(); };

  // Build the two-copy roll track inside each line's existing <span>.
  lines.forEach(function (l) {
    var span = l.el.querySelector("span");
    if (!span) return;
    span.className = "about__roll";
    span.setAttribute("aria-hidden", "true");   // both copies hidden from SR; aria-label carries the word
    span.textContent = "";
    var a = document.createElement("span"); a.className = "about__copy"; a.textContent = l.text;
    var d = document.createElement("span"); d.className = "about__copy about__copy--dup"; d.textContent = l.text; d.setAttribute("aria-hidden", "true");
    span.appendChild(a); span.appendChild(d);
    l.roll = span;
    l.onEnd = function () { finish(l); };
  });

  function staggerIndex(l, wide) {
    if (wide) return l.row - 1;                        // L+R of a row share the delay → fire together
    return (l.side === "r" ? 3 : 0) + (l.row - 1);     // mobile: L1..L3 then R1..R3
  }
  function triggerFor(l, wide) {
    return wide ? TRIGGERS_DESKTOP[l.row - 1]
                : TRIGGERS_MOBILE[(l.side === "r" ? 3 : 0) + (l.row - 1)];
  }

  function finish(l) {
    if (!l.animating) return;
    l.animating = false;
    l.cooldownUntil = nowMs() + COOLDOWN;
    if (l.timer) { clearTimeout(l.timer); l.timer = 0; }
    l.roll.style.transition = "none";                 // park; next roll re-sets its own transition
  }

  // A roll leaves the track showing the same word, just advanced by one copy.
  // down: copy enters from the top (start -100% → 0). up: enters from the
  // bottom (start 0 → -100%). Start is committed with transition:none, then a
  // single forced reflow lets the eased transition to the end value take over.
  function roll(l, dir, wide) {
    l.animating = true; l.dir = dir;
    var startPct = dir === "down" ? -100 : 0;
    var endPct   = dir === "down" ? 0 : -100;
    var delay = staggerIndex(l, wide) * STAGGER;
    var r = l.roll;
    r.style.transition = "none";
    r.style.transform = "translate3d(0," + startPct + "%,0)";
    void r.offsetHeight;                              // one sync flush so the start sticks
    r.style.transition = "transform " + DURATION + "ms " + EASING + " " + delay + "ms";
    r.style.transform = "translate3d(0," + endPct + "%,0)";
    if (l.onEnd) r.addEventListener("transitionend", l.onEnd, { once: true });
    if (l.timer) clearTimeout(l.timer);
    l.timer = setTimeout(function () { finish(l); }, DURATION + delay + END_BUFFER);
  }

  var raf = 0, needsEval = true, lastY = window.scrollY || window.pageYOffset || 0, lastDir = "down";

  function progress() {
    var rct = about.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var p = (vh - rct.top) / (vh + rct.height);
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }

  function evaluate() {
    var y = window.scrollY || window.pageYOffset || 0;
    var dir = y > lastY ? "down" : y < lastY ? "up" : lastDir;
    lastY = y; lastDir = dir;
    var p = progress(), wide = matchMedia("(min-width:821px)").matches, t = nowMs();
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (l.animating || t < l.cooldownUntil) continue;
      var T = triggerFor(l, wide);
      // Fire once per direction change: down-roll as the row scrolls past T
      // going down, up-roll as it scrolls back past T going up.
      if (dir === "down" && p >= T && l.dir !== "down") roll(l, "down", wide);
      else if (dir === "up" && p <= T && l.dir !== "up") roll(l, "up", wide);
    }
  }

  function frame() { raf = 0; if (needsEval) { needsEval = false; evaluate(); } }
  function kick() { if (raf === 0) raf = requestAnimationFrame(frame); }
  function onScroll() { needsEval = true; kick(); }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();
})();

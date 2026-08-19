/*
 * WORK list hover mask — a one-shot curtain roll on each big English category (.wbig__en) when the
 * cursor enters its row. Reuses the ABOUT curtain technique (about-lines.js): the word is rebuilt as a
 * two-copy vertical track inside an overflow:hidden mask, and on hover the track slides up exactly one
 * line so the identical second copy rolls into view — a single "flip". Driven by rAF (like about-lines),
 * not a CSS keyframe, so it is robust and testable. The colour spotlight (hovered = ink, rest = grey) is
 * pure CSS and untouched here; this only adds the mask flash.
 *
 * English only (the small Korean subtitle is left plain — cleaner). Plays ONCE per hover-enter and is
 * LOCKED while rolling, so a held hover never repeats and a fast sweep across rows can't stack rolls.
 * prefers-reduced-motion / touch (no hover) → no mask at all, colour change only.
 *
 * `wire(item)` is exposed as window.WorkListCurtain so dynamically-built lists (the work-detail subpage's
 * "OTHER WORK" list) get the identical hover curtain without duplicating this logic.
 */
(function () {
  "use strict";

  // ---- knobs --------------------------------------------------------------
  var MASK_MS = 480;   // curtain-roll duration (ms), 400–600
  // -------------------------------------------------------------------------

  var reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  var hoverable = matchMedia("(hover:hover)").matches;

  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

  // Wire one .wbig__item: rebuild its .wbig__en as a 2-copy track and roll it once per hover-enter.
  // No-op under reduced-motion / touch, or if the item is missing/already wired (idempotent).
  function wire(item) {
    if (reduce || !hoverable) return;
    var en = item.querySelector(".wbig__en");
    if (!en || en.querySelector(".wr__track")) return;
    var text = en.textContent;

    var track = document.createElement("span"); track.className = "wr__track";
    var a = document.createElement("span"); a.className = "wr__copy"; a.textContent = text;
    var d = document.createElement("span"); d.className = "wr__copy wr__copy--dup"; d.textContent = text;
    d.setAttribute("aria-hidden", "true");
    en.textContent = ""; track.appendChild(a); track.appendChild(d); en.appendChild(track);

    var rolling = false, start = 0;
    function step(now) {
      var p = (now - start) / MASK_MS;
      if (p >= 1) {                                          // done → reset to copy A (identical to the dup, no flicker)
        track.style.transform = "translate3d(0,0,0)";
        rolling = false;
        return;
      }
      track.style.transform = "translate3d(0," + (-easeInOut(p) * 100).toFixed(2) + "%,0)";
      requestAnimationFrame(step);
    }
    // one play per hover-enter; the `rolling` lock ignores re-entries until the roll finishes.
    item.addEventListener("pointerenter", function () {
      if (rolling) return;
      rolling = true; start = performance.now();
      requestAnimationFrame(step);
    });
  }

  window.WorkListCurtain = wire;   // reusable for dynamically-added lists (e.g. the work-detail subpage)

  [].slice.call(document.querySelectorAll(".wbig__item")).forEach(wire);
})();

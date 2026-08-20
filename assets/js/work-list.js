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
  // cursor-trailing "Click" chip (glassmorphism pill) shown while hovering a WORK list row:
  var CHIP_TEXT   = "Click";
  var CHIP_OFF_X  = 12, CHIP_OFF_Y = 12;   // offset from the cursor (bottom-right)
  var CHIP_LERP   = 0.2;                    // follow easing (0–1 per frame; higher = snappier)
  var CHIP_EDGE   = 8;                      // min gap from the viewport edge (flips side if it would clip)
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

  // ---- "Click" chip that trails the cursor over the WORK list -------------
  // A dark glass pill (CSS: .work-chip / .work-chip__i) that fades in near the cursor when it enters a
  // .wbig__item and lerps after it. pointer-events:none (never steals its own hover). Touch → skipped;
  // reduced-motion → no follow easing, snap to the offset. Delegated on the .wbig container so moving
  // between rows never flickers (leave/enter of individual items don't toggle it).
  (function chip() {
    if (!hoverable) return;                          // touch: no cursor to trail
    if (!document.querySelector(".wbig")) return;

    var wrap = document.createElement("div"); wrap.className = "work-chip";
    var inner = document.createElement("span"); inner.className = "work-chip__i"; inner.textContent = CHIP_TEXT;
    wrap.appendChild(inner); document.body.appendChild(wrap);

    var tx = 0, ty = 0, cx = 0, cy = 0, on = false, raf = 0;
    function place(px, py) {
      var w = wrap.offsetWidth, h = wrap.offsetHeight;                 // measured (chip is tiny)
      var x = px + CHIP_OFF_X, y = py + CHIP_OFF_Y;
      if (x + w > innerWidth  - CHIP_EDGE) x = px - CHIP_OFF_X - w;     // flip left near the right edge
      if (y + h > innerHeight - CHIP_EDGE) y = py - CHIP_OFF_Y - h;     // flip up near the bottom edge
      if (x < CHIP_EDGE) x = CHIP_EDGE; if (y < CHIP_EDGE) y = CHIP_EDGE;
      wrap.style.transform = "translate3d(" + x + "px," + y + "px,0)";
    }
    function loop() {
      raf = 0;
      cx += (tx - cx) * CHIP_LERP; cy += (ty - cy) * CHIP_LERP;
      place(cx, cy);
      if (on && (Math.abs(tx - cx) > 0.4 || Math.abs(ty - cy) > 0.4)) raf = requestAnimationFrame(loop);
    }
    function show() { if (on) return; on = true; cx = tx; cy = ty; place(cx, cy); wrap.classList.add("is-on"); }
    function hide() { if (!on) return; on = false; wrap.classList.remove("is-on"); }
    // Hover is derived from a DOCUMENT-level move (not .wbig's enter/leave): the chip is pointer-events:none,
    // so e.target is always the real element under the cursor — .closest(".wbig") is truthy anywhere over the
    // list (rows AND the gaps between them → no flicker) and null elsewhere. This also sidesteps the spurious
    // pointerleave the moving fixed/backdrop-filter chip would otherwise trigger on .wbig.
    document.addEventListener("pointermove", function (e) {
      var over = e.target && e.target.closest && e.target.closest(".wbig");
      if (!over) { hide(); return; }
      tx = e.clientX; ty = e.clientY;
      show();
      if (reduce) { cx = tx; cy = ty; place(cx, cy); }
      else if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
  })();
})();

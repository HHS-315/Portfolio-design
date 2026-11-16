/*
 * SQUARE CURSOR — a small white square that follows the pointer and difference-blends
 * against whatever is under it, so it inverts the colours below (강한 색반전, most visible
 * over images). Replaces the native crosshair site-wide. Modelled on editorial cursors
 * (viki-studio.com): a constant small square that eases toward the pointer and grows a
 * little over clickable things.
 *
 * Mechanics:
 *  · One #cursorsq <div>, position:fixed, mix-blend-mode:difference, pointer-events:none.
 *    z62 keeps it ABOVE the halftone trail (61) but BELOW the glass toggle(63)/Click chip(70)
 *    — those backdrop-filter pills must never be inverted (same rule the halftone obeys).
 *  · The native cursor is hidden (html.sqcur{cursor:none}) only here, only on hover devices.
 *  · pointermove sets a target; rAF eases the square toward it (slight lag, like the ref).
 *  · Fades out when the pointer leaves the window / on blur, back in on re-entry.
 *  · Constant size everywhere — it never grows or shrinks over any element.
 *  · Skipped entirely on touch (no hover) and prefers-reduced-motion, where CSS also hides it.
 */
(function () {
  "use strict";

  if (!matchMedia("(hover:hover)").matches) return;                 // touch: no cursor to show
  if (matchMedia("(prefers-reduced-motion:reduce)").matches) return; // respect reduced motion

  var root = document.documentElement;
  var sq = document.getElementById("cursorsq");
  if (!sq) { sq = document.createElement("div"); sq.id = "cursorsq"; sq.setAttribute("aria-hidden", "true"); document.body.appendChild(sq); }

  root.classList.add("sqcur");   // hides the native cursor via CSS (hover devices only)

  var tx = -100, ty = -100;   // target (pointer)
  var cx = -100, cy = -100;   // current (eased)
  var FOLLOW = 0.28;          // ease factor toward the pointer (higher = snappier)
  var raf = 0, moved = false;

  function frame() {
    raf = 0;
    cx += (tx - cx) * FOLLOW;
    cy += (ty - cy) * FOLLOW;
    sq.style.transform = "translate3d(" + cx.toFixed(2) + "px," + cy.toFixed(2) + "px,0)";
    // keep easing until it has essentially caught up
    if (Math.abs(tx - cx) > 0.15 || Math.abs(ty - cy) > 0.15) raf = requestAnimationFrame(frame);
  }
  function kick() { if (raf === 0) raf = requestAnimationFrame(frame); }

  window.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    tx = e.clientX; ty = e.clientY;
    if (!moved) {                     // first real move: snap in place, then reveal
      cx = tx; cy = ty; moved = true;
      sq.style.transform = "translate3d(" + cx + "px," + cy + "px,0)";
    }
    sq.classList.add("on");
    kick();
  }, { passive: true });

  // hide when the pointer leaves the window / tab loses focus
  function hide() { sq.classList.remove("on"); }
  document.addEventListener("mouseleave", hide);
  window.addEventListener("blur", hide);
  window.addEventListener("mouseenter", function () { sq.classList.add("on"); });
})();

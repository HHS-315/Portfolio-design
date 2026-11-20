/*
 * WORK gallery pixel reveal — each 16:9 gallery cell is covered by a grid of square tiles in the
 * WORK block colour (--work-cell), mirroring work-transition.js's stacking-cell look. As the gallery
 * scrolls into view the tiles scatter UP and fade out (bottom rows first, with per-tile jitter),
 * uncovering the image; scrolling back DOWN re-covers it. Fully scroll-linked (no timed animation),
 * so it reverses cleanly with the wheel — same principle as the section's block fill.
 *
 * 16:9 is locked, so a fixed 12×7 tile grid stays square at every size (no per-size rebuild).
 */
(function () {
  "use strict";

  if (matchMedia("(prefers-reduced-motion:reduce)").matches) return;   // reduced motion → plain images

  var COLS = 12, ROWS = 7;         // 12/7 ≈ 16/9 → square tiles
  var TILE_SPAN = 0.26;            // scroll-progress width over which one tile fades out
  var JITTER = 0.14;               // per-tile random scatter added to its threshold
  var RISE_PX = 16;                // how far a tile lifts as it clears

  var cells = [].slice.call(document.querySelectorAll(".work-gallery__cell"));
  if (!cells.length) return;

  var built = [];   // { el, img, tiles:[{node,th,applied}] }

  cells.forEach(function (cell) {
    var img = cell.querySelector("img");
    var play = cell.querySelector(".work-gallery__play");
    var mos = document.createElement("div");
    mos.className = "work-gallery__mosaic";
    mos.setAttribute("aria-hidden", "true");
    var frag = document.createDocumentFragment();
    var tiles = [];
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var t = document.createElement("div");
        t.className = "work-gallery__px";
        // +0.6px overlap kills seams between tiles
        t.style.cssText =
          "left:" + (c * 100 / COLS) + "%;top:" + (r * 100 / ROWS) + "%;" +
          "width:calc(100%/" + COLS + " + 0.6px);height:calc(100%/" + ROWS + " + 0.6px)";
        // bottom rows clear FIRST (th small at the bottom), scattered by jitter, kept in 0..~0.75
        var rowNorm = r / (ROWS - 1);                 // 0 top … 1 bottom
        var th = (1 - rowNorm) * 0.6 + Math.random() * JITTER;
        tiles.push({ node: t, th: th, applied: -1 });
        frag.appendChild(t);
      }
    }
    mos.appendChild(frag);
    cell.insertBefore(mos, play || null);             // above the img, below the play icon
    built.push({ el: cell, tiles: tiles });
  });

  // progress 0→1 as the cell travels from the bottom of the viewport toward the middle
  function cellProgress(el) {
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var center = r.top + r.height / 2;
    var p = (vh - center) / (vh * 0.5);               // 0 at bottom edge, 1 at vertical middle
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }

  var raf = 0;
  function frame() {
    raf = 0;
    for (var i = 0; i < built.length; i++) {
      var b = built[i];
      var r = b.el.getBoundingClientRect();
      var vh = window.innerHeight;
      if (r.bottom < -40 || r.top > vh + 40) continue;   // offscreen → skip writes
      var p = cellProgress(b.el);
      for (var j = 0; j < b.tiles.length; j++) {
        var tl = b.tiles[j];
        var lp = (p - tl.th) / TILE_SPAN;               // this tile's local 0→1 clear amount
        lp = lp < 0 ? 0 : lp > 1 ? 1 : lp;
        if (Math.abs(lp - tl.applied) < 0.004) continue;
        tl.applied = lp;
        tl.node.style.opacity = (1 - lp).toFixed(3);
        tl.node.style.transform = "translate3d(0," + (-(lp * RISE_PX)).toFixed(2) + "px,0)";
      }
    }
  }
  function kick() { if (raf === 0) raf = requestAnimationFrame(frame); }

  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", kick);
  kick();   // initial paint (covers / reveals per current scroll position)
})();

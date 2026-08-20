/*
 * HERO PERF HUD — a DEBUG overlay that times each hero render layer per frame.
 * OFF by default; enable with ?perf=1 in the URL (or set HeroPerf.on=true in the console
 * and reload the interactions). When off, the only cost is HeroPerf.t() returning 0.
 *
 * Layers report into HeroPerf.add(layer, t0) around their draw. IMPORTANT: performance.now()
 * measures MAIN-THREAD (CPU) time only. That is the real cost for the 2D-canvas layers
 * (#field flower, #strip, #blocks — rasterised on the CPU), but for the WebGL layers
 * (shader-bg, hero-refract) it captures only JS command SUBMISSION, not GPU execution
 * (which is asynchronous). So treat the WebGL ms as "submit" and read FPS as the true
 * end-to-end signal for GPU-bound cost. (Real GPU timing needs EXT_disjoint_timer_query.)
 */
(function () {
  "use strict";
  var HP = window.HeroPerf = {
    on: /[?&]perf=1/.test(location.search),
    _acc: {}, _fr: {}, _meta: {},
    t: function () { return this.on ? performance.now() : 0; },
    add: function (layer, t0) {
      if (!this.on || !t0) return;
      var d = performance.now() - t0;
      this._acc[layer] = (this._acc[layer] || 0) + d;
      this._fr[layer] = (this._fr[layer] || 0) + 1;
    },
    set: function (k, v) { this._meta[k] = v; }
  };
  if (!HP.on) return;   // zero HUD overhead unless ?perf=1

  var el = document.createElement("div");
  el.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:99999;font:11px/1.5 ui-monospace,monospace;" +
    "color:#8fe6d0;background:rgba(0,0,0,.80);padding:9px 11px;white-space:pre;pointer-events:none;" +
    "border:1px solid #2a6;border-radius:5px;min-width:250px";
  var attach = function () { document.body ? document.body.appendChild(el) : addEventListener("DOMContentLoaded", attach); };
  attach();

  var LAYERS = [
    ["shader",  "shaderbg   GPU submit"],
    ["field",   "flower     2D CPU   "],
    ["strip",   "strip      2D CPU   "],
    ["blocks",  "blocks     2D CPU   "],
    ["workfx",  "work-fx    2D CPU   "],
    ["refract", "refract    GPU submit"]
  ];
  var frames = 0, lastT = performance.now();
  function loop() { frames++; requestAnimationFrame(loop); }
  requestAnimationFrame(loop);

  setInterval(function () {
    var now = performance.now(), dt = now - lastT, fps = frames / (dt / 1000);
    frames = 0; lastT = now;
    var lines = ["HERO PERF   FPS " + fps.toFixed(1) + "   glyphs " + (HP._meta.glyphs != null ? HP._meta.glyphs : "?")];
    var cpu = 0;
    LAYERS.forEach(function (L) {
      var f = HP._fr[L[0]] || 0, ms = f ? HP._acc[L[0]] / f : 0;
      if (L[0] === "field" || L[0] === "strip" || L[0] === "blocks" || L[0] === "workfx") cpu += ms;
      lines.push("  " + L[1] + "  " + ms.toFixed(2).padStart(6) + " ms" + (f ? "" : "  (idle)"));
    });
    lines.push("  ----------------------------------");
    lines.push("  2D main-thread total   " + cpu.toFixed(2).padStart(6) + " ms/frame");
    lines.push("  WebGL ms = submit only; watch FPS");
    el.textContent = lines.join("\n");
    HP._acc = {}; HP._fr = {};
  }, 500);
})();

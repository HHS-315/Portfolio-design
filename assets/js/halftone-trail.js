/*
 * HALFTONE CURSOR TRAIL — a WebGL halftone-dot trail that follows the pointer, ported to dependency-free
 * vanilla JS for this static site (original: a React/Tailwind component). One fixed full-viewport canvas
 * (#halftone) with mix-blend-mode:difference (set in CSS) so the sparse dots auto-INVERT against whatever is
 * under them — the "색반전" — reading on the dark hero AND the light WORK cells alike, the same trick as .bar.
 *
 *  · Two-pass GPU sim: pass 1 accumulates a decaying trail into a ping-pong 512² FBO around the pointer
 *    (elongated along the motion direction by velocity); pass 2 renders that density field as halftone dots
 *    whose radius grows with density. Both fragment shaders are copied verbatim from the source component.
 *  · The canvas sits at z61 — ABOVE the menu(55) and WORK subpage(60) overlays so the trail shows over them,
 *    but BELOW the toggle(63) and Click chip(70) glass pills (a difference layer over them would wreck the
 *    backdrop-filter glass). See the #halftone CSS note.
 *  · Base dot COLOUR is chosen by the LOCAL background darkness (JS): over a DARK backdrop it uses the HERO
 *    shader palette; over a LIGHT backdrop it uses the MENU shader palette (assets/js/nav-menu.js FX_LIGHT).
 *    Detection is per-context: the WORK subpage is a real DOM overlay (dark cover + light .wd__page article),
 *    so its bg is sampled straight from the DOM under the cursor (bgLumaAt); on the main page the WORK cells
 *    are canvas-painted, so the --work-reveal / nav-open signals are used instead. Colour is lerped so opening
 *    an overlay cross-fades. Because the canvas is composited with difference, on dark backdrops the dots come
 *    out AS the hero colour (|c−~0| = c), and on light backdrops they invert to a dark, menu-tinted dot.
 *  · Dot SIZE / INK: full-size dots (cellSize 10, shader radius 0.47 → 9.4px, 0.69 peak coverage) for presence —
 *    the smaller 5/0.32 build read too faint. Text relief is opacity-only: 0.6, so difference over light --bone
 *    text resolves to ~153 (was 100 at opacity 1.0 — less "carving") while staying strong (~78) over dark bg.
 *  · Perf: no permanent loop. The rAF self-pauses IDLE_MS after the last pointer move (by then the trail has
 *    decayed below the dot threshold) and resumes on the next move; also pauses when the tab is hidden.
 *  · Guarded off on touch (no cursor) and prefers-reduced-motion (both also hide #halftone in CSS), and a
 *    no-op if WebGL is unavailable — the page just keeps its normal background.
 */
(function () {
  "use strict";
  var canvas = document.getElementById("halftone");
  if (!canvas) return;
  if (!matchMedia("(hover:hover)").matches) return;              // touch: no cursor to trail
  if (matchMedia("(prefers-reduced-motion:reduce)").matches) return;

  // ---- palettes (match the two background shaders) -------------------------
  // Dark backdrop → HERO shader tone (neutral grey filament, a touch brighter than the shader's 0.46 so the
  // trail reads as its own mark). Light backdrop → the deepest MENU FX_LIGHT stop (#9fa6ae, cool grey).
  var HERO_RGB = [0.52, 0.52, 0.55];
  var MENU_RGB = [0.624, 0.651, 0.682];

  var VERT_SHADER =
    "attribute vec2 position;varying vec2 vUv;" +
    "void main(){vUv=position*0.5+0.5;gl_Position=vec4(position,0.0,1.0);}";

  var TRAIL_FRAG = [
    "precision mediump float;",
    "uniform sampler2D uPrevTrail;uniform vec2 uMouse;uniform vec2 uMouseDir;",
    "uniform float uVelocity;uniform float uDecay;uniform float uBrushSize;uniform float uAspect;uniform float uReveal;",
    "varying vec2 vUv;",
    "void main(){",
    "  float prev=texture2D(uPrevTrail,vUv).r*uDecay;",
    "  vec2 delta=vUv-uMouse; delta.x*=uAspect;",
    "  vec2 dir=length(uMouseDir)>0.001?uMouseDir:vec2(0.0,1.0);",
    "  float along=dot(delta,dir);",
    "  float perp=length(delta-along*dir);",
    "  float elongation=1.0+uVelocity*2.0;",
    "  float blobDist=sqrt(along*along/elongation+perp*perp);",
    "  float blob=exp(-blobDist*blobDist/(uBrushSize*uBrushSize))*uReveal;",
    "  gl_FragColor=vec4(min(prev+blob,1.0),0.0,0.0,1.0);",
    "}"
  ].join("\n");

  var HALFTONE_FRAG = [
    "#extension GL_OES_standard_derivatives : enable",
    "precision highp float;",
    "uniform sampler2D uTrailTexture;uniform vec2 uResolution;uniform float uCellSize;uniform vec3 uColor;uniform float uOpacity;",
    "varying vec2 vUv;",
    "void main(){",
    "  vec2 pixel=vUv*uResolution;",
    "  vec2 cellCoord=floor(pixel/uCellSize);",
    "  vec2 cellCenter=(cellCoord+0.5)*uCellSize;",
    "  vec2 cellCenterUv=cellCenter/uResolution;",
    "  float density=texture2D(uTrailTexture,cellCenterUv).r;",
    "  float dist=length(fract(pixel/uCellSize)-0.5);",
    "  float radius=density*0.47;",   /* original coverage (peak π·0.47²=0.69) — the earlier 0.32 read too faint; text relief comes from opacity instead */
    "  float aa=fwidth(dist);",
    "  float inDot=1.0-smoothstep(radius-aa,radius,dist);",
    "  float alpha=inDot*smoothstep(0.05,0.2,density);",
    "  gl_FragColor=vec4(uColor,alpha*uOpacity);",
    "}"
  ].join("\n");

  function lerp(a, b, t) { return a + (b - a) * t; }

  function compileShader(gl, src, type) {
    var s = gl.createShader(type); if (!s) return null;
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
    return s;
  }
  function linkProgram(gl, vsSrc, fsSrc) {
    var vs = compileShader(gl, vsSrc, gl.VERTEX_SHADER), fs = compileShader(gl, fsSrc, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return null;
    var p = gl.createProgram(); if (!p) return null;
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { gl.deleteProgram(p); return null; }
    return p;
  }
  function createFBO(gl, w, h) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return { fb: fb, texture: texture };
  }

  // ---- config (source defaults, tuned) ----
  // Dot size/coverage kept at the ORIGINAL (cellSize 10, shader radius 0.47 → 9.4px dots, 0.69 peak coverage):
  //   shrinking them (5 / 0.32) read "too faint", so presence comes from the full-size dots. The text relief is
  //   done with OPACITY ONLY — 1.0→0.6: difference over --bone text(233) resolves to (1−α)·233+α·|233−133| = 153
  //   (was 100, clearly less "carve") while the dark bg(10) stays 78 — strong. hoverSelector is deliberately
  //   UNCHANGED: adding .wish__lead etc. would slam the trail down to hoverOpacity 0.2 whenever it crosses the big
  //   statements — an abrupt "the trail died on the headline" glitch.
  var CFG = { decay: 0.965, brushSize: 0.045, hoverBrushSize: 0.012, opacity: 0.6, hoverOpacity: 0.2, speedScale: 38.0, cellSize: 10, hoverSelector: "a,button,[data-hover],.nav__link,.wbig__item,#flowerTip" };
  var IDLE_MS = 1800;   // self-pause this long after the last pointer move (trail has decayed below the dot threshold by then)

  var gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });
  if (!gl) return;                                     // graceful no-op
  gl.getExtension("OES_standard_derivatives");

  var trailProgram = linkProgram(gl, VERT_SHADER, TRAIL_FRAG);
  var halftoneProgram = linkProgram(gl, VERT_SHADER, HALFTONE_FRAG);
  if (!trailProgram || !halftoneProgram) return;

  var tPos = gl.getAttribLocation(trailProgram, "position");
  var tPrev = gl.getUniformLocation(trailProgram, "uPrevTrail");
  var tMouse = gl.getUniformLocation(trailProgram, "uMouse");
  var tDir = gl.getUniformLocation(trailProgram, "uMouseDir");
  var tVel = gl.getUniformLocation(trailProgram, "uVelocity");
  var tDecay = gl.getUniformLocation(trailProgram, "uDecay");
  var tBrush = gl.getUniformLocation(trailProgram, "uBrushSize");
  var tAspect = gl.getUniformLocation(trailProgram, "uAspect");
  var tReveal = gl.getUniformLocation(trailProgram, "uReveal");

  var hPos = gl.getAttribLocation(halftoneProgram, "position");
  var hTrail = gl.getUniformLocation(halftoneProgram, "uTrailTexture");
  var hRes = gl.getUniformLocation(halftoneProgram, "uResolution");
  var hCell = gl.getUniformLocation(halftoneProgram, "uCellSize");
  var hColor = gl.getUniformLocation(halftoneProgram, "uColor");
  var hOpacity = gl.getUniformLocation(halftoneProgram, "uOpacity");

  var fboA = createFBO(gl, 512, 512), fboB = createFBO(gl, 512, 512);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboA.fb); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboB.fb); gl.clear(gl.COLOR_BUFFER_BIT);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

  // ---- state ----
  var width = 0, height = 0;
  var mouseX = 0.5, mouseY = 0.5, prevX = 0.5, prevY = 0.5, dirX = 0, dirY = 1, velocity = 0;
  var hovering = false, reveal = 0, currentBrush = CFG.brushSize, currentOpacity = CFG.opacity;
  var colorRGB = HERO_RGB.slice(), targetRGB = HERO_RGB.slice();
  var raf = 0, running = false, lastMove = 0, visible = document.visibilityState === "visible";
  var root = document.documentElement;

  function resize() {
    width = window.innerWidth; height = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
  }

  // Local background darkness → which shader palette the dots take.
  //  · WORK subpage open (#workOverlay.is-active): a real DOM overlay = a DARK cover (.wd__surface #0e0e0e /
  //    .wd__hero2 #14161a) at the top and a LIGHT article (.wd__page var(--work-cell) #ccd2d8) below it, so
  //    --work-reveal (frozen at 1 from the WORK section behind it) is meaningless here. The article is the ONLY
  //    light region, so we key on whether the cursor Y is inside .wd__page's live rect — robust against the
  //    fixed full-viewport .wd__surface backdrop that would otherwise fool an elementFromPoint hit test.
  //  · Menu open: the overlay COVERS the WORK cells, so its OWN theme decides, not --work-reveal — a DARK menu
  //    (nav-dark, opened over filled WORK blocks where --work-reveal is ~1) must still be HERO, so the menu
  //    branch is checked BEFORE the --work-reveal fallback (which would otherwise wrongly report MENU there).
  //  · Main page: the WORK white cells are painted on a CANVAS (no DOM bg to sample), so use --work-reveal.
  var wo = document.getElementById("workOverlay");
  function pickTarget(x, y) {
    var light;
    if (wo && wo.classList.contains("is-active")) {
      var pg = wo.querySelector(".wd__page"), r = pg && pg.getBoundingClientRect();
      light = !!(r && y >= r.top && y < r.bottom);          // over the light article → MENU, else dark cover → HERO
    } else if (root.classList.contains("nav-open")) {
      light = !root.classList.contains("nav-dark");         // menu theme (covers the cells): light menu → MENU, dark → HERO
    } else {
      light = (parseFloat(getComputedStyle(root).getPropertyValue("--work-reveal")) || 0) > 0.5;
    }
    targetRGB = light ? MENU_RGB : HERO_RGB;               // lerped toward in draw() so overlay opens cross-fade
  }

  function onPointerMove(e) {
    prevX = mouseX; prevY = mouseY;
    mouseX = e.clientX / (width || 1);
    mouseY = 1.0 - e.clientY / (height || 1);
    var aspect = width / height || 1;
    var dx = (mouseX - prevX) * aspect, dy = mouseY - prevY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    velocity = Math.min(CFG.speedScale * dist, 1.0);
    if (dist > 1e-4) { dirX = dx / dist; dirY = dy / dist; }
    var el = document.elementFromPoint(e.clientX, e.clientY);
    hovering = !!(el && el.closest && el.closest(CFG.hoverSelector));
    pickTarget(e.clientX, e.clientY);
    lastMove = performance.now();
    resume();
  }

  function draw() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    reveal = lerp(reveal, 1.0, 0.04);
    currentBrush = lerp(currentBrush, hovering ? CFG.hoverBrushSize : CFG.brushSize, 0.08);
    currentOpacity = lerp(currentOpacity, hovering ? CFG.hoverOpacity : CFG.opacity, 0.08);
    for (var i = 0; i < 3; i++) colorRGB[i] = lerp(colorRGB[i], targetRGB[i], 0.05);
    velocity *= 0.9;

    // Pass 1: trail update → FBO B
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboB.fb);
    gl.viewport(0, 0, 512, 512);
    gl.useProgram(trailProgram);
    gl.enableVertexAttribArray(tPos);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.vertexAttribPointer(tPos, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fboA.texture);
    gl.uniform1i(tPrev, 0);
    gl.uniform2f(tMouse, mouseX, mouseY);
    gl.uniform2f(tDir, dirX, dirY);
    gl.uniform1f(tVel, velocity);
    gl.uniform1f(tDecay, CFG.decay);
    gl.uniform1f(tBrush, currentBrush);
    gl.uniform1f(tAspect, width / height || 1);
    gl.uniform1f(tReveal, reveal);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    var tmp = fboA; fboA = fboB; fboB = tmp;           // ping-pong

    // Pass 2: halftone → screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(halftoneProgram);
    gl.enableVertexAttribArray(hPos);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.vertexAttribPointer(hPos, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fboA.texture);
    gl.uniform1i(hTrail, 0);
    gl.uniform2f(hRes, canvas.width, canvas.height);
    gl.uniform1f(hCell, CFG.cellSize);
    gl.uniform3f(hColor, colorRGB[0], colorRGB[1], colorRGB[2]);
    gl.uniform1f(hOpacity, currentOpacity);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function tick() {
    raf = 0;
    if (!visible) { running = false; return; }
    var _t = window.HeroPerf ? HeroPerf.t() : 0;
    draw();
    if (window.HeroPerf) HeroPerf.add("halftone", _t);
    if (performance.now() - lastMove > IDLE_MS) { running = false; return; }   // idle → self-pause (trail already faded)
    raf = requestAnimationFrame(tick);
  }
  function resume() {
    if (running || !visible) return;
    running = true;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("visibilitychange", function () {
    visible = document.visibilityState === "visible";
    if (visible) { lastMove = performance.now(); resume(); }
    else if (raf) { cancelAnimationFrame(raf); raf = 0; running = false; }
  });
  // one warm-up frame so the FBOs/first paint are ready; it self-pauses immediately (lastMove stays 0).
  raf = requestAnimationFrame(tick);
})();

/*
 * HERO TAGLINE REFRACTION — a cursor-following glass lens over the two hero
 * taglines (#heroQuote "Every great idea" / #heroQuote2 "starts as a seed.").
 *
 * Architecture (see the proposal): ONE full-viewport transparent canvas
 * (#refract, pointer-events:none, z-index 4) with ONE WebGL context that draws
 * TWO small quads — one per tagline, each positioned over its <p>'s bounding
 * box. Only the two text boxes are shaded, so fill cost ≈ two tiny canvases
 * while using a single context (total WebGL contexts on the page: 2).
 *
 * The cursor is read from a WINDOW-level pointermove (never from the overlay,
 * which stays pointer-events:none) — exactly like shader-bg.js and dandelion.js,
 * so the flower's hover-detach is untouched.
 *
 * Each tagline's text is rasterised to a texture with offscreen fillText (the
 * same idiom as dandelion.js extractText), reproducing the computed font. The
 * real <p> stays in the DOM for a11y and becomes color:transparent only once
 * the effect is live (class .refract-active); if WebGL / hover is unavailable
 * the class is never added, so the <p> renders normally (automatic fallback).
 *
 * Gated on dandelion:introdone (taglines hidden during the intro), paused off
 * screen (IntersectionObserver) / when hidden (visibilitychange), and disabled
 * on touch / reduced-motion. rAF idles when the cursor is away — the last
 * (undistorted) frame stays on the canvas, so static text costs nothing.
 */
(function () {
  "use strict";

  // ---- knobs ---------------------------------------------------------------
  var DEBUG            = false;  // draw the cursor radius ring (tuning aid)
  var REFRACT_RADIUS   = 160;    // px — lens radius in screen space
  var REFRACT_STRENGTH = 0.34;   // max UV pull, as a fraction of the radius (bulge amount)
  var REFRACT_DECAY    = 1.7;    // falloff exponent: higher = distortion hugs the centre tighter
  // Refraction is ACHROMATIC now (no R/G/B split). Instead the lensed area gets a soft white
  // outglow + a light haze, so the edges bloom rather than fringe with colour.
  var GLOW_STRENGTH    = 0.55;   // how much the blurred-alpha halo is added around the text (0 = off)
  var GLOW_RADIUS      = 7;      // px — spread of the outglow blur taps
  var HAZE_AMOUNT      = 0.22;   // how much the core text alpha dims where refraction is strong (0 = crisp)
  var FOLLOW_LERP      = 14;     // cursor-follow speed (exp/sec) — higher = snappier
  var PRESENCE_FADE    = 9;      // fade-in/out speed of the effect when the cursor enters/leaves (exp/sec)
  var HOVER_MARGIN     = 0.4;    // activate when the cursor is within (radius × this extra) of the box
  var TEX_PAD_MULT     = 1.5;    // texture padding = (radius × strength) × this, so the lens never samples
                                 // past the texture edge (CLAMP_TO_EDGE stretch = the square-clip artifact)
  var SETTLE_EPS       = 0.0015; // below this, motion is "settled" → stop the rAF loop
  // -------------------------------------------------------------------------
  var TEX_PAD = REFRACT_RADIUS * REFRACT_STRENGTH * TEX_PAD_MULT;   // px of transparent margin on every side

  var mqReduce = matchMedia("(prefers-reduced-motion:reduce)");
  var mqTouch  = matchMedia("(hover:none),(pointer:coarse)");
  if (mqReduce.matches || mqTouch.matches) return;   // no hover / reduced motion → DOM text as-is

  var canvas = document.getElementById("refract");
  if (!canvas) return;
  // The two hero taglines PLUS the CONTACT closing statement (#wishLead) get the glass lens. #wishLead is special:
  // its texture is rasterised with a PER-WORD alpha (a scroll-driven white "fill", Magic-UI style) — see
  // buildTexture's isWish branch and the tick() re-raster — so it keeps the WebGL lens AND fills word-by-word.
  var els = [document.getElementById("heroQuote"), document.getElementById("heroQuote2"), document.getElementById("wishLead")].filter(Boolean);
  if (!els.length) return;

  var gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: true });
  if (!gl) return;   // no WebGL → DOM text stays visible (fallback)

  // ---- shaders ------------------------------------------------------------
  var VERT =
    "attribute vec2 a_uv;" +
    "uniform vec2 u_clipMin;" +          // clip-space corner for uv(0,0) = box bottom-left
    "uniform vec2 u_clipMax;" +          // clip-space corner for uv(1,1) = box top-right
    "varying vec2 v_uv;" +
    "void main(){ v_uv=a_uv; gl_Position=vec4(mix(u_clipMin,u_clipMax,a_uv),0.0,1.0); }";

  var FRAG =
    "precision mediump float;" +
    "varying vec2 v_uv;" +
    "uniform sampler2D u_tex;" +
    "uniform vec2 u_rectSize;" +         // PADDED box size in px
    "uniform vec2 u_cursor;" +           // cursor in padded-box-local px, y-UP
    "uniform float u_radius;" +
    "uniform float u_strength;" +
    "uniform float u_decay;" +
    "uniform float u_glowStrength;" +
    "uniform float u_glowRadius;" +
    "uniform float u_haze;" +
    "uniform float u_presence;" +        // 0 (away) → 1 (hovering)
    "uniform vec3 u_color;" +
    "void main(){" +
    "  vec2 fragPx = v_uv * u_rectSize;" +
    "  float d = distance(fragPx, u_cursor);" +
    "  float f = 1.0 - smoothstep(0.0, u_radius, d);" +   // 1 at cursor → 0 at radius
    "  f = pow(f, u_decay) * u_presence;" +
    // bulge lens: pull each sample a fraction (f·strength) toward the cursor. The pull is
    // proportional to (cursor − fragment), so it vanishes AT the centre (no swirl/pinch) and
    // smoothly magnifies the surrounding text — a clean 'seen through glass' refraction.
    "  vec2 duv = ((u_cursor - fragPx) * (f * u_strength)) / u_rectSize;" +
    "  float a0 = texture2D(u_tex, v_uv + duv).a;" +       // sharp text, ALL channels same point → achromatic
    // outglow: a cheap two-ring blur of the alpha around the (displaced) sample point, gated by f so it
    // only blooms inside the lens. Sampling the neighbourhood spreads the glyph's coverage outward → a soft
    // white halo on the edges (the core stays sharp because a0 is added separately below).
    "  vec2 gr = vec2(u_glowRadius) / u_rectSize;" +
    "  float glow = 0.0;" +
    "  for (int i = 0; i < 8; i++) {" +
    "    float ang = float(i) * 0.7853981634;" +           // 2π/8
    "    vec2 dir = vec2(cos(ang), sin(ang));" +
    "    glow += texture2D(u_tex, v_uv + duv + dir*gr).a;" +
    "    glow += texture2D(u_tex, v_uv + duv + dir*gr*0.5).a;" +
    "  }" +
    "  glow = (glow * 0.0625) * f * u_glowStrength;" +      // /16 taps
    "  float aCore = a0 * (1.0 - u_haze * f);" +            // haze: dim the core a touch where the lens is strong
    "  float a = clamp(aCore + glow, 0.0, 1.0);" +
    "  gl_FragColor = vec4(u_color * a, a);" +              // premultiplied, achromatic (col channels ≤ a)
    "}";

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    return s;
  }
  var prog = gl.createProgram();
  var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;   // shader failed → fallback
  gl.deleteShader(vs); gl.deleteShader(fs);
  gl.useProgram(prog);

  var quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  var aUV = gl.getAttribLocation(prog, "a_uv");
  gl.enableVertexAttribArray(aUV);
  gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);

  var U = {};
  ["u_clipMin", "u_clipMax", "u_tex", "u_rectSize", "u_cursor", "u_radius",
   "u_strength", "u_decay", "u_glowStrength", "u_glowRadius", "u_haze", "u_presence", "u_color"].forEach(function (n) {
    U[n] = gl.getUniformLocation(prog, n);
  });
  gl.uniform1i(U.u_tex, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   // premultiplied-alpha compositing
  gl.clearColor(0, 0, 0, 0);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);   // texture upright vs the y-up quad
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

  // ---- per-tagline state ---------------------------------------------------
  var DPR = 1, W = 0, H = 0;
  function parseColor(str) {
    var m = /rgba?\(([^)]+)\)/.exec(str);
    if (!m) return [0.95, 0.95, 0.94];
    var p = m[1].split(",");
    return [(+p[0]) / 255, (+p[1]) / 255, (+p[2]) / 255];
  }

  var quotes = els.map(function (el) {
    return {
      el: el, tex: gl.createTexture(), rect: null, size: [1, 1],
      // capture the REAL text colour ONCE here — buildTexture runs after we add
      // .refract-active (color:transparent), so reading it later would give black.
      color: parseColor(getComputedStyle(el).color),
      isWish: el.id === "wishLead",   // gets the per-word scroll fill
      reveal: 1,                      // 0..1 scroll progress of the word fill (only used when isWish; tick() drives it)
      tCur: [0, 0], cur: [0, 0],   // cursor target / smoothed (box-local px, y-up)
      tPres: 0, pres: 0            // presence target / smoothed
    };
  });

  // Rasterise a tagline to its texture, faithfully reproducing the computed font.
  // Rebuilt on resize + document.fonts.ready (so glyph metrics are correct once the
  // web font loads). Word-wraps to the box width and honours text-align, matching
  // how the <p> lays out — so the lens text sits exactly where the DOM text was.
  function buildTexture(q) {
    var el = q.el, cs = getComputedStyle(el), rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return false;
    // The texture is PADDED by TEX_PAD on every side (transparent margin). The lens pushes the sampled
    // UV outward near the box edges; without the pad it would read past the texture and CLAMP_TO_EDGE
    // would stretch the edge pixels into a straight bar (the "square-clipped end letters"). The pad's
    // transparent border means an out-of-glyph read clamps to nothing → the edges just fade out.
    var PAD = TEX_PAD;
    q.rect = rect;                                   // <p> box (hover detection / placement anchor)
    q.size = [rect.width + 2 * PAD, rect.height + 2 * PAD];   // PADDED size (shader/quad work in this)

    var fsz = parseFloat(cs.fontSize) || 48;
    var lh = parseFloat(cs.lineHeight); if (!lh) lh = fsz * 1.15;
    var o = document.createElement("canvas");
    o.width = Math.max(1, Math.ceil(q.size[0] * DPR));
    o.height = Math.max(1, Math.ceil(q.size[1] * DPR));
    var c = o.getContext("2d");
    c.scale(DPR, DPR);
    c.font = cs.fontStyle + " " + cs.fontWeight + " " + fsz + "px " + cs.fontFamily;
    if ("letterSpacing" in c) { try { c.letterSpacing = cs.letterSpacing; } catch (e) {} }
    c.fillStyle = "#fff";                 // WHITE text → texture .a is coverage; colour comes from u_color
    c.textBaseline = "top";
    var alignRight = cs.textAlign === "right" || cs.textAlign === "end";
    var alignCenter = cs.textAlign === "center";
    c.textAlign = alignRight ? "right" : alignCenter ? "center" : "left";

    // Honor HARD <br> breaks first (textContent drops them, fusing the two lines into one word), then word-wrap
    // each segment to the box width. Split on ordinary whitespace only — NOT the non-breaking space ( ). The CONTACT statement uses an
    // nbsp to keep "작은 것에서부터." on one line (with word-break:keep-all), so treating the nbsp as part of a
    // single "word" reproduces the DOM's two-line wrap instead of breaking there.
    var rawSegs = el.innerHTML.split(/<br\s*\/?>/i).map(function (h) {
      var d = document.createElement("div"); d.innerHTML = h; var tt = d.textContent || "";
      return (cs.textTransform === "uppercase" ? tt.toUpperCase() : tt).trim();
    });
    var lines = [];
    for (var si = 0; si < rawSegs.length; si++) {
      var words = rawSegs[si].split(/[ \t\r\n]+/).filter(Boolean), cur = "";
      for (var i = 0; i < words.length; i++) {
        var test = cur ? cur + " " + words[i] : words[i];
        if (cur && c.measureText(test).width > rect.width) { lines.push(cur); cur = words[i]; }
        else cur = test;
      }
      if (cur) lines.push(cur);
    }

    // draw offset by PAD so the text sits inside the transparent margin
    var yPad = (lh - fsz) / 2;             // centre each line within its line-box (approx DOM leading)
    if (q.isWish) {
      // PER-WORD white fill: word k of N ramps its alpha 0.22→1 as the scroll progress q.reveal crosses
      // [k/N, (k+1)/N]. fillStyle stays white; the per-word alpha is baked into the texture, so the lens shows
      // faint words filling to full white left-to-right as you scroll into CONTACT. Centre each line manually
      // (textAlign left + measured half-gap) so the words keep the DOM's centred layout.
      var total = 0, li2; for (li2 = 0; li2 < lines.length; li2++) total += lines[li2].split(" ").length;
      var gw = 0; c.textAlign = "left";
      for (li2 = 0; li2 < lines.length; li2++) {
        var ws = lines[li2].split(" ");
        var wx = PAD + (rect.width - c.measureText(lines[li2]).width) / 2;
        var yy = PAD + li2 * lh + yPad;
        for (var wi = 0; wi < ws.length; wi++) {
          var tt = q.reveal * total - gw;
          c.globalAlpha = 0.22 + 0.78 * (tt < 0 ? 0 : tt > 1 ? 1 : tt);
          c.fillText(ws[wi], wx, yy);
          wx += c.measureText(ws[wi] + " ").width;
          gw++;
        }
      }
      c.globalAlpha = 1;
    } else {
      var x = PAD + (alignRight ? rect.width : alignCenter ? rect.width / 2 : 0);
      for (var li = 0; li < lines.length; li++) c.fillText(lines[li], x, PAD + li * lh + yPad);
    }

    gl.bindTexture(gl.TEXTURE_2D, q.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, o);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return true;
  }

  // Refresh only the on-screen positions (cheap — no re-raster). Called on scroll,
  // where the boxes move but keep their size.
  function refreshRects() {
    for (var i = 0; i < quotes.length; i++) quotes[i].rect = quotes[i].el.getBoundingClientRect();
  }

  function sizeCanvas() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function rebuild() {
    sizeCanvas();
    for (var i = 0; i < quotes.length; i++) buildTexture(quotes[i]);
    schedule();
  }

  // ---- cursor (window-level, like shader-bg / dandelion) -------------------
  function onMove(e) {
    var px = e.clientX, py = e.clientY;
    for (var i = 0; i < quotes.length; i++) {
      var q = quotes[i], r = q.rect; if (!r) continue;
      var inside = px >= r.left - REFRACT_RADIUS * HOVER_MARGIN && px <= r.right + REFRACT_RADIUS * HOVER_MARGIN &&
                   py >= r.top - REFRACT_RADIUS * HOVER_MARGIN && py <= r.bottom + REFRACT_RADIUS * HOVER_MARGIN;
      if (inside) {
        q.tCur[0] = (px - r.left) + TEX_PAD;                 // to PADDED-box-local px
        q.tCur[1] = q.size[1] - ((py - r.top) + TEX_PAD);    // …y-up (q.size[1] = padded height)
        if (q.pres < 0.001) { q.cur[0] = q.tCur[0]; q.cur[1] = q.tCur[1]; }  // no snap-in from a stale spot
        q.tPres = 1;
      } else q.tPres = 0;
    }
    if (DEBUG) moveDbg(px, py);
    schedule();
  }
  function onLeave() { for (var i = 0; i < quotes.length; i++) quotes[i].tPres = 0; schedule(); }

  // ---- render loop (idles when settled) ------------------------------------
  var raf = 0, lastNow = null, running = false, visible = true, inView = true;
  function schedule() { if (running && visible && inView && raf === 0) raf = requestAnimationFrame(tick); }

  function tick(now) {
    raf = 0;
    if (!running || !visible || !inView) { lastNow = null; return; }
    var dt = lastNow === null ? 0 : Math.min((now - lastNow) / 1000, 0.05);
    lastNow = now;
    var followK = 1 - Math.exp(-FOLLOW_LERP * dt);
    var presK = 1 - Math.exp(-PRESENCE_FADE * dt);

    var _tp = window.HeroPerf ? HeroPerf.t() : 0;   // perf HUD (submit time only — GPU work is async)
    gl.clear(gl.COLOR_BUFFER_BIT);
    var moving = false;
    for (var i = 0; i < quotes.length; i++) {
      var q = quotes[i], r = q.rect; if (!r) continue;
      // #wishLead: scroll-driven word fill. progress 0 when the statement sits low (entering from the bottom),
      // reaching 1 by the time its top is ~mid-viewport — which happens just BEFORE it settles centred at the
      // page bottom, so the LAST word (GOOD.) is fully white at rest. (0.72 left it at ~0.83 → GOOD stuck ~0.47.)
      // Re-raster the (small) texture only when progress shifts enough; on scroll the loop already ticks.
      if (q.isWish) {
        var prog = (H - r.top) / (0.50 * H); prog = prog < 0 ? 0 : prog > 1 ? 1 : prog;
        if (Math.abs(prog - q.reveal) > 0.012) { q.reveal = prog; buildTexture(q); moving = true; }
      }
      q.cur[0] += (q.tCur[0] - q.cur[0]) * followK;
      q.cur[1] += (q.tCur[1] - q.cur[1]) * followK;
      q.pres += (q.tPres - q.pres) * presK;
      if (Math.abs(q.tPres - q.pres) > SETTLE_EPS ||
          (q.pres > SETTLE_EPS && (Math.abs(q.tCur[0] - q.cur[0]) > 0.5 || Math.abs(q.tCur[1] - q.cur[1]) > 0.5))) moving = true;

      // PADDED box → clip space. The quad is expanded by TEX_PAD on every side so uv 0..1 spans the
      // padded texture; uv(0,0)=bottom-left=(left-pad,bottom+pad), uv(1,1)=top-right=(right+pad,top-pad).
      gl.uniform2f(U.u_clipMin, ((r.left - TEX_PAD) / W) * 2 - 1, 1 - ((r.bottom + TEX_PAD) / H) * 2);
      gl.uniform2f(U.u_clipMax, ((r.right + TEX_PAD) / W) * 2 - 1, 1 - ((r.top - TEX_PAD) / H) * 2);
      gl.uniform2f(U.u_rectSize, q.size[0], q.size[1]);
      gl.uniform2f(U.u_cursor, q.cur[0], q.cur[1]);
      gl.uniform1f(U.u_radius, REFRACT_RADIUS);
      gl.uniform1f(U.u_strength, REFRACT_STRENGTH);
      gl.uniform1f(U.u_decay, REFRACT_DECAY);
      gl.uniform1f(U.u_glowStrength, GLOW_STRENGTH);
      gl.uniform1f(U.u_glowRadius, GLOW_RADIUS);
      gl.uniform1f(U.u_haze, HAZE_AMOUNT);
      gl.uniform1f(U.u_presence, q.pres);
      gl.uniform3f(U.u_color, q.color[0], q.color[1], q.color[2]);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, q.tex);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    if (window.HeroPerf) HeroPerf.add("refract", _tp);
    if (moving) schedule(); else lastNow = null;   // settled → hold the last frame, idle
  }

  // ---- DEBUG cursor ring ---------------------------------------------------
  var dbgEl = null;
  function moveDbg(px, py) {
    if (!dbgEl) {
      dbgEl = document.createElement("div");
      dbgEl.style.cssText = "position:fixed;left:0;top:0;z-index:99998;pointer-events:none;border:1px solid rgba(120,200,255,.7);border-radius:50%;" +
        "width:" + (REFRACT_RADIUS * 2) + "px;height:" + (REFRACT_RADIUS * 2) + "px;margin:-" + REFRACT_RADIUS + "px 0 0 -" + REFRACT_RADIUS + "px";
      document.body.appendChild(dbgEl);
    }
    dbgEl.style.transform = "translate(" + px + "px," + py + "px)";
  }

  // ---- lifecycle -----------------------------------------------------------
  function start() {
    if (running) return;
    running = true;
    els.forEach(function (el) { el.classList.add("refract-active"); });   // hand the text to the canvas
    rebuild();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuild);
    setTimeout(rebuild, 400);   // belt-and-suspenders: re-raster once the web font has surely settled

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    window.addEventListener("scroll", function () { refreshRects(); schedule(); }, { passive: true });
    window.addEventListener("resize", rebuild);

    // Keep the loop alive while EITHER the hero OR the CONTACT section is on screen — the lens draws #wishLead in
    // #contact (the hero is long gone by then), and its word fill must keep re-rastering as CONTACT scrolls.
    // inView = any watched target intersecting.
    var watch = [document.querySelector(".hero"), document.getElementById("contact")].filter(Boolean);
    if (!watch.length) watch = [canvas];
    var seen = watch.map(function () { return false; });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { var i = watch.indexOf(e.target); if (i >= 0) seen[i] = e.isIntersecting; });
      inView = seen.some(Boolean);
      if (inView) schedule(); else if (raf) { cancelAnimationFrame(raf); raf = 0; lastNow = null; }
    });
    watch.forEach(function (el) { io.observe(el); });
    document.addEventListener("visibilitychange", function () {
      visible = document.visibilityState === "visible";
      if (visible) schedule(); else if (raf) { cancelAnimationFrame(raf); raf = 0; lastNow = null; }
    });
  }

  // Gate on the intro finishing (taglines are revealed then). If it already fired
  // or reduced-motion skipped the intro, start on the next tick.
  window.addEventListener("dandelion:introdone", start);
  if (!document.body.classList.contains("intro-lock")) setTimeout(start, 0);
  setTimeout(start, 6500);   // failsafe: never leave the taglines swapped-out if the event is missed
})();

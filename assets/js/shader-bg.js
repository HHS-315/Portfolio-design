/* ============================================================================
   ShaderBackground — "Mesh drift" (21st.dev Shader Builder), ported to vanilla
   JS for this static site. One WebGL canvas fixed behind the starfield, tinted
   to the deep-space palette (black + dark blue). It renders only while the hero
   is on screen and fades out as the hero scrolls away, so it never clashes with
   the dusk→dawn background journey. Stars (#space3d) sit above it; the hero
   image layers composite over both. No dependencies.

   Original React component: 21st.dev Shader Builder ("Mesh drift").
   ========================================================================== */
(function () {
  "use strict";

  const VERT = `attribute vec2 a_position;
void main(){ gl_Position = vec4(a_position, 0.0, 1.0); }`;

  const FRAG = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec3 u_colors[8];
uniform vec4 u_scene;      // resolution.xy, time, colour count
uniform vec4 u_shape;      // scale, intensity, paramA, warp
uniform vec4 u_surface;    // detail, contrast, brightness, saturation
uniform vec4 u_finish;     // hue, vignette, blur, grain
uniform vec4 u_transform;  // seed, rotation, drift, OKLab toggle
uniform vec4 u_space;      // offset.xy, pointer.xy

#define u_resolution u_scene.xy
#define u_time u_scene.z
#define u_colorCount u_scene.w
#define u_scale u_shape.x
#define u_intensity u_shape.y
#define u_warp u_shape.w
#define u_detail u_surface.x
#define u_contrast u_surface.y
#define u_brightness u_surface.z
#define u_saturation u_surface.w
#define u_hue u_finish.x
#define u_vignette u_finish.y
#define u_blur u_finish.z
#define u_grain u_finish.w
#ifdef GL_FRAGMENT_PRECISION_HIGH
#define u_seed u_transform.x
#else
#define u_seed mod(u_transform.x, 31.0)
#endif
#define u_rotate u_transform.y
#define u_drift u_transform.z
#define u_offset u_space.xy

float hash21(vec2 p){
#ifndef GL_FRAGMENT_PRECISION_HIGH
  p = mod(p, 31.0);
#endif
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float grainHash(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p){
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++){
    v += a * noise(p);
    p = p * 2.03 + vec2(17.0, 9.2);
    a *= 0.5;
  }
  return v;
}

vec3 shade(vec2 uv, vec2 p, float t){
  vec3 acc = u_colors[0] * 0.15;
  float total = 0.15;
  for (int i = 0; i < 8; i++){
    if (float(i) >= u_colorCount) break;
    float fi = float(i);
    vec2 c = vec2(
      sin(t * (0.21 + fi * 0.071) + fi * 2.4 + u_seed),
      cos(t * (0.17 + fi * 0.093) + fi * 1.7)) * (0.45 + u_intensity * 0.35);
    float w = exp(-dot(p - c, p - c) * 6.0);
    acc += u_colors[i] * w;
    total += w;
  }
  return acc / total;
}

vec3 hueRotate(vec3 col, float a){
  const mat3 toYIQ = mat3(0.299, 0.596, 0.211,
                          0.587, -0.274, -0.523,
                          0.114, -0.322, 0.312);
  const mat3 toRGB = mat3(1.0, 1.0, 1.0,
                          0.956, -0.272, -1.106,
                          0.621, -0.647, 1.703);
  vec3 yiq = toYIQ * col;
  float ca = cos(a), sa = sin(a);
  yiq = vec3(yiq.x, yiq.y * ca - yiq.z * sa, yiq.y * sa + yiq.z * ca);
  return toRGB * yiq;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 screenUv = uv;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy)
    / min(u_resolution.x, u_resolution.y);

  uv = p * min(u_resolution.x, u_resolution.y) / u_resolution.xy + 0.5;
  p *= u_scale;
  if (abs(u_rotate) > 0.0001){
    float cr = cos(u_rotate), sr = sin(u_rotate);
    p = mat2(cr, -sr, sr, cr) * p;
  }
  p += u_offset;
  if (u_drift > 0.0001)
    p += u_drift * vec2(sin(u_time * 0.31), cos(u_time * 0.23));
  if (u_warp > 0.0){
    p += u_warp * (vec2(
      fbm(p * u_detail + u_seed),
      fbm(p * u_detail + vec2(5.2, 1.3))) - 0.5);
  }

  vec3 col;
  if (u_blur > 0.0){
    float e = u_blur;
    float pe = e * u_scale;
    vec2 uvE = vec2(e) * min(u_resolution.x, u_resolution.y) / u_resolution.xy;
    col  = shade(uv, p, u_time) * 0.36;
    col += shade(uv + vec2(uvE.x, 0.0), p + vec2(pe, 0.0), u_time) * 0.16;
    col += shade(uv - vec2(uvE.x, 0.0), p - vec2(pe, 0.0), u_time) * 0.16;
    col += shade(uv + vec2(0.0, uvE.y), p + vec2(0.0, pe), u_time) * 0.16;
    col += shade(uv - vec2(0.0, uvE.y), p - vec2(0.0, pe), u_time) * 0.16;
  } else {
    col = shade(uv, p, u_time);
  }

  if (abs(u_contrast - 1.0) > 0.0001)
    col = (col - 0.5) * u_contrast + 0.5;
  if (abs(u_saturation - 1.0) > 0.0001){
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(luma), col, u_saturation);
  }
  if (abs(u_hue) > 0.0001)
    col = hueRotate(col, u_hue);
  if (abs(u_brightness) > 0.0001)
    col += u_brightness;
  if (u_vignette > 0.0001){
    float vd = length(screenUv - 0.5) * 1.41421356;
    col *= 1.0 - u_vignette * smoothstep(0.35, 1.0, vd);
  }
  if (u_grain > 0.0001)
    col += (grainHash(
      gl_FragCoord.xy + vec2(u_seed * 17.0, u_seed * 31.0)) - 0.5) * u_grain;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  // Deep-space recolour: black → dark navy → muted blue → faint indigo glow.
  // Kept dark so the white starfield reads clearly on top; blends with #05070E.
  const UNIFORMS = {
    colors: [
      [0.016, 0.031, 0.063], // near-void deep blue-black (~#08101 0)
      [0.043, 0.078, 0.160], // deep navy (~#0B1429)
      [0.094, 0.160, 0.320], // muted dark blue (~#182952)
      [0.160, 0.220, 0.420], // faint indigo glow (~#28386B)
      [0.160, 0.220, 0.420],
      [0.160, 0.220, 0.420],
      [0.160, 0.220, 0.420],
      [0.160, 0.220, 0.420],
    ],
    colorCount: 4,
    scale: 1.16,
    intensity: 0.34,
    warp: 0.0,
    detail: 2.4,
    contrast: 1.12,
    brightness: 0.0,
    saturation: 1.0,
    hue: 0.0,
    vignette: 0.22,
    blur: 0.0,
    grain: 0.035,
    seed: 1453.0,
    rotate: 0.0,
    offsetX: 0.0,
    offsetY: 0.0,
    drift: 0.0,
    oklab: 0.0,
    timeScale: 0.5,
  };

  function initShaderBackground() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = document.getElementById("shaderBg");
    const hero = document.getElementById("hero");
    if (!canvas || !hero || reduce) return; // static fallback: #bgLayer color

    const gl = canvas.getContext("webgl", { antialias: false });
    if (!gl) return; // no WebGL → keep the plain deep-space background

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const program = gl.createProgram();
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uni = {
      colors: gl.getUniformLocation(program, "u_colors"),
      scene: gl.getUniformLocation(program, "u_scene"),
      shape: gl.getUniformLocation(program, "u_shape"),
      surface: gl.getUniformLocation(program, "u_surface"),
      finish: gl.getUniformLocation(program, "u_finish"),
      transform: gl.getUniformLocation(program, "u_transform"),
      space: gl.getUniformLocation(program, "u_space"),
    };
    gl.uniform3fv(uni.colors, new Float32Array(UNIFORMS.colors.flat()));
    gl.uniform4f(uni.shape, UNIFORMS.scale, UNIFORMS.intensity, 0.5, UNIFORMS.warp);
    gl.uniform4f(uni.surface, UNIFORMS.detail, UNIFORMS.contrast, UNIFORMS.brightness, UNIFORMS.saturation);
    gl.uniform4f(uni.finish, UNIFORMS.hue, UNIFORMS.vignette, UNIFORMS.blur, UNIFORMS.grain);
    gl.uniform4f(uni.transform, UNIFORMS.seed, UNIFORMS.rotate, UNIFORMS.drift, UNIFORMS.oklab);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const raw = Math.max(1, Math.round(window.innerWidth * dpr)) *
        Math.max(1, Math.round(window.innerHeight * dpr));
      const scale = Math.min(1, Math.sqrt(2000000 / Math.max(1, raw)));
      const w = Math.max(1, Math.round(window.innerWidth * dpr * scale));
      const h = Math.max(1, Math.round(window.innerHeight * dpr * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    window.addEventListener("resize", resize);
    resize();

    // Opacity: full behind the hero, fading out as the hero scrolls away, so the
    // dusk→dawn journey (#bgLayer) takes over cleanly below the hero.
    const setFade = () => {
      const total = hero.offsetHeight - window.innerHeight;
      const p = total > 0
        ? Math.min(Math.max(-hero.getBoundingClientRect().top, 0), total) / total
        : 0;
      canvas.style.opacity = String(p < 0.5 ? 1 : Math.max(0, 1 - (p - 0.5) / 0.4));
    };
    window.addEventListener("scroll", setFade, { passive: true });
    setFade();

    // Render only while the hero is on screen (perf).
    let raf = 0;
    let running = false;
    const start0 = performance.now();
    const draw = (now) => {
      resize();
      gl.uniform4f(uni.scene, canvas.width, canvas.height,
        ((now - start0) / 1000) * UNIFORMS.timeScale, UNIFORMS.colorCount);
      gl.uniform4f(uni.space, UNIFORMS.offsetX, UNIFORMS.offsetY, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(draw);
    };
    const startLoop = () => { if (!running) { running = true; raf = requestAnimationFrame(draw); } };
    const stopLoop = () => { running = false; cancelAnimationFrame(raf); raf = 0; };

    new IntersectionObserver(
      (es) => es.forEach((e) => (e.isIntersecting ? startLoop() : stopLoop())),
      { threshold: 0 }
    ).observe(hero);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") startLoop();
      else stopLoop();
    });
  }

  window.initShaderBackground = initShaderBackground;
})();

/*
 * WORK section header — the word "WORK" rendered the SAME way as the intro "PORTFOLIO":
 * the letterforms (hero font, heavy) are rasterised to a grid and every filled cell becomes a
 * random ASCII glyph from the SAME `CODE` set as the dandelion, churning (swapping) and shimmering
 * in alpha — i.e. the "blink". Colour follows --work-ink so it darkens with the section as the light
 * cells fill behind it. Animates only while the header is on screen; static under reduced-motion.
 *
 * This file ALSO owns the ambient scatter fields — sparse ASCII glyphs churning/shimmering in the empty
 * space AROUND a section's content (reference: artefakt.mov). It's a factory (makeField) so more than one
 * section can have one: a per-section canvas, colour, keep-out set, and reveal signal, sharing one cluster
 * layout + box hit-test. Currently WORK's is OFF (FIELD_ON:false) and CONTACT's is ON. Everything draws in
 * THIS file's single rAF loop — no extra loops.
 */
(function () {
  "use strict";
  var host = document.getElementById("workAscii"); if (!host) return;
  var reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;

  // same character set the dandelion uses for its code glyphs
  var CODE = ['0','1','/','\\','<','>','{','}','(',')','=','+','-','*','#','$','%','&','|',';',':','.','x','?','!','^','~'];
  var pick = function (a) { return a[(Math.random() * a.length) | 0]; };
  // small seeded PRNG (mulberry32) for the field LAYOUT only — reset to a fixed seed each build so glyph
  // POSITIONS are identical across resizes and scroll round-trips (bare Math.random reshuffled them). Glyph
  // char + shimmer phase stay on Math.random (cosmetic; they churn anyway).
  function mulberry32(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  var root = document.documentElement;
  var HERO = (getComputedStyle(root).getPropertyValue("--hero-font") || "'Plus Jakarta Sans',sans-serif").trim();
  var MONO = (getComputedStyle(root).getPropertyValue("--mono") || "monospace").trim();
  var INK  = (getComputedStyle(root).getPropertyValue("--work-ink") || "#141414").trim() || "#141414";  // WORK field ink (dark)
  var BONE = (getComputedStyle(root).getPropertyValue("--bone") || "#e9e9e6").trim() || "#e9e9e6";       // CONTACT field ink (light)

  var cv = document.createElement("canvas"); cv.setAttribute("aria-hidden", "true");
  cv.style.display = "block"; host.appendChild(cv);
  var ctx = cv.getContext("2d");

  // ---- header knobs -------------------------------------------------------
  // Matched to the intro (dandelion.js extractText): glyph = FS 6–9px, step = glyph×0.7 (~1.43× overlap).
  var CELL_RATIO  = 0.10;
  var CELL_MIN    = 6, CELL_MAX = 7;
  var STEP_RATIO  = 0.70;
  var CHURN_MIN   = 280, CHURN_MAX = 1150;
  var SHIM_SPEED  = 0.006, SHIM_AMP = 0.16, SHIM_BASE = 0.62;
  // ---- ambient scatter field — SHARED knobs (both instances) --------------
  // Layout counts (FIELD_GLYPHS/CLUSTERS/CLUSTER_R) and glyph size (FS_SCALE) are now PER-INSTANCE — see the
  // WORK_* / CONTACT_* configs below. The values here are the WORK-instance layout defaults, kept in place so
  // the (currently OFF) WORK field is byte-for-byte what it was before the CONTACT reshape.
  var FIELD_GLYPHS   = 46;    // WORK: total scattered glyphs (sparse — a few dozen)
  var FIELD_CLUSTERS = 7;     // WORK: loose clusters
  var FIELD_CLUSTER_R= 64;    // WORK: cluster radius (px)
  // base glyph size — clamp(W/170, 6, 9), ×STRIP_SCALE_MOB(1.22) on mobile (W≤640). Each instance then scales
  // this by its own fsScale (WORK 1.0 = original strip-matched size; CONTACT < 1 = smaller, strip-decoupled).
  var FIELD_FS_DIV = 170, FIELD_FS_MIN = 6, FIELD_FS_MAX = 9;
  var FIELD_MOB_BP = 640, FIELD_MOB_SCALE = 1.22;
  var FIELD_GAP_RATIO = 1.1;  // tooClose reject radius = instanceFS × this (auto-narrows as fsScale shrinks)
  var FIELD_MARGIN   = 12;    // viewport-edge keep-out (px), absolute
  var FIELD_PAD      = 16;    // WORK keep-out padding around each excluded rect
  var FIELD_HIT_WX   = 0.42, FIELD_HIT_HY = 0.55;   // glyph half-extent (× instanceFS) for the BOX overlap test —
                                                    // both axes, so a glyph half-over a keep-out rect is rejected.
  // ---- per-instance field configs -----------------------------------------
  // WORK: dark glyphs on the white cells, opacity via --work-reveal. OFF for now (FIELD_ON:false) but the
  //       whole config is preserved so a single flag flip restores it.
  var WORK_FIELD_ON    = false;
  var WORK_FS_SCALE    = 1.0;                                                  // strip-matched (unchanged)
  var WORK_ALPHA_BASE  = 0.24, WORK_ALPHA_AMP = 0.09, WORK_ALPHA_MAX = 0.35;   // subtle on the WHITE bg
  var WORK_CHURN_MIN   = 900, WORK_CHURN_MAX = 2600, WORK_SHIM_SPEED = 0.0026; // slow/gentle
  // CONTACT: LIGHT glyphs (--bone) on the BLACK bg. Reshaped to be SMALLER, SPARSER (spread over the whole
  //       screen in many tiny clusters, not banded), and to BLINK — each glyph fully turns OFF then ON on its
  //       own timing (duty cycle below), replacing WORK's always-on sine shimmer. Opacity still gated by
  //       --contact-reveal (rises as the blocks clear; set by work-transition.js).
  var CONTACT_FIELD_ON  = true;
  var CONTACT_FS_SCALE  = 0.60;    // × base FS — decoupled from the strip; ~5.08px @1440 (base 8.47), smaller
  var CONTACT_GLYPHS    = 52;      // total (WORK 46) — barely higher, but now over the WHOLE screen → sparser
  var CONTACT_CLUSTERS  = 13;      // MORE clusters (WORK 7) …
  var CONTACT_CLUSTER_R = 34;      // … each SMALLER (WORK 64) with FEWER glyphs (52/13 ≈ 4 vs 46/7 ≈ 6.6)
  var CONTACT_PAD       = 22;      // larger keep-out pad (WORK 16) — compensates the smaller glyph hit-box so
                                   //   the shrunk glyphs still clear .wish__lead by a comfortable margin
  // blink — each glyph runs its own OFF→ON cycle, desynced by its per-glyph phase (c.ph). A short edge fade
  //   (not a hard strip-style snap) reads as a gentle twinkle rather than a harsh 60fps flicker across dozens
  //   of tiny glyphs. Only ~DUTY of a full cycle is the ON window, so only a fraction is lit at any instant.
  var CONTACT_BLINK      = true;
  var CONTACT_BLINK_SPEED = 0.00042;  // cycle rate — 1/SPEED ≈ 2380ms period per glyph
  var CONTACT_BLINK_DUTY  = 0.32;     // fraction of each cycle a glyph is ON (~1/3 visible at once)
  var CONTACT_BLINK_FADE  = 0.22;     // fade-in/out portion at each edge of the ON window (0 = hard snap)
  var CONTACT_ALPHA_PEAK  = 0.78;     // ON-brightness cap on the black bg (WORK-era aMax was 0.66)
  var CONTACT_ALPHA_BASE  = 0.42;     // static level shown under prefers-reduced-motion (no blink)
  var CONTACT_CHURN_MIN  = 320, CONTACT_CHURN_MAX = 1400;   // char-swap cadence (independent of blink)
  // -------------------------------------------------------------------------

  var DPR = 1, cells = [], cellFS = 10, tw = 0, th = 0;
  var work = document.getElementById("work");
  var contact = document.getElementById("contact");
  var bar = document.querySelector(".bar");

  // ---- shared field helpers -----------------------------------------------
  function fieldSize(W) { return Math.max(FIELD_FS_MIN, Math.min(FIELD_FS_MAX, W / FIELD_FS_DIV)) * (W <= FIELD_MOB_BP ? FIELD_MOB_SCALE : 1); }
  // tightest on-screen rect of an element's TEXT (Range), so the empty right margin of a full-width row stays usable.
  function textRect(el) {
    var t = el.querySelector(".wr__copy:not(.wr__copy--dup)") || el;
    try { var rg = document.createRange(); rg.selectNodeContents(t); var r = rg.getBoundingClientRect(); if (r && r.width) return r; } catch (e) {}
    return el.getBoundingClientRect();
  }
  function pad(r, p) { return { x: r.left - p, y: r.top - p, w: r.width + p * 2, h: r.height + p * 2 }; }
  // BOX overlap (not centre-point): a glyph's ±(hx,hy) half-box vs each keep-out rect, on BOTH axes.
  function boxHits(ex, x, y, hx, hy) {
    for (var i = 0; i < ex.length; i++) { var r = ex[i];
      if (x + hx >= r.x && x - hx <= r.x + r.w && y + hy >= r.y && y - hy <= r.y + r.h) return true;
    }
    return false;
  }
  // cluster seeds are PER-INSTANCE (build() calls cfg.seedFn), so the two fields can distribute differently.
  // WORK — weighted toward the right margin, then top / bottom bands (WORK keeps its big list on the LEFT, so
  //        the right + top/bottom bands are the reliably-empty space).
  function seedWork(W, H, rnd) {
    var band = rnd();
    if (band < 0.55) return { x: W * (0.60 + rnd() * 0.36), y: H * (0.10 + rnd() * 0.80) };
    if (band < 0.78) return { x: W * (0.06 + rnd() * 0.88), y: H * (0.04 + rnd() * 0.12) };
    return { x: W * (0.06 + rnd() * 0.88), y: H * (0.82 + rnd() * 0.14) };
  }
  // CONTACT — spread cluster centres across the WHOLE screen. STRATIFIED jitter, not pure random: each cluster
  //        gets its own cell of a coarse grid (sized to the viewport aspect) and lands at a RANDOM point inside
  //        that cell. Guarantees full-screen coverage (13 pure-random points clump badly at this N) while
  //        staying irregular — not a lattice. boxHits() carves .wish__lead back out afterwards, so the
  //        statement isn't special-cased here.
  function seedContact(W, H, rnd, ci, n) {
    var cols = Math.max(1, Math.round(Math.sqrt(n * W / H))), rows = Math.ceil(n / cols);
    var col = ci % cols, row = Math.floor(ci / cols), cw = W / cols, ch = H / rows;
    var mx = W * 0.03, my = H * 0.03;
    return { x: col * cw + mx + rnd() * (cw - 2 * mx), y: row * ch + my + rnd() * (ch - 2 * my) };
  }

  // keep-out rect builders (padded, live — recomputed each call as content scrolls)
  function workKeep() {
    var out = []; if (bar) out.push(pad(bar.getBoundingClientRect(), FIELD_PAD)); out.push(pad(host.getBoundingClientRect(), FIELD_PAD));
    if (work) [].forEach.call(work.querySelectorAll(".wbig__en,.wbig__ko"), function (el) { out.push(pad(textRect(el), FIELD_PAD)); });
    return out;
  }
  function contactKeep() {
    var out = []; if (bar) out.push(pad(bar.getBoundingClientRect(), CONTACT_PAD));   // .email/.clinks were removed — only the
    if (contact) [".wish__lead"].forEach(function (sel) { var el = contact.querySelector(sel); if (el) out.push(pad(el.getBoundingClientRect(), CONTACT_PAD)); });   // left statement remains
    return out;
  }

  // ---- field factory ------------------------------------------------------
  // cfg: { on, section, cls, color, seed, fsScale, glyphs, clusters, clusterR, seedFn(W,H,rnd), keep(),
  //        churnMin, churnMax,
  //        blink:false → shimmer: aBase, aAmp, aMax, shim
  //        blink:true  → duty blink: blinkSpeed, blinkDuty, blinkFade, aPeak, aMax(=aPeak), aBase(reduced-motion) }
  function makeField(cfg) {
    if (!cfg.on || !cfg.section) return { build: function () {}, draw: function () {} };   // inert (canvas never created)
    var canvas = document.createElement("canvas"); canvas.className = cfg.cls; canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    var g = canvas.getContext("2d");
    var fcells = [], W = 0, H = 0, fs = 12, hx = 0, hy = 0;

    function build() {
      W = window.innerWidth; H = window.innerHeight;
      fs = fieldSize(W) * cfg.fsScale; hx = fs * FIELD_HIT_WX; hy = fs * FIELD_HIT_HY;
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      g.setTransform(DPR, 0, 0, DPR, 0, 0); g.textAlign = "center"; g.textBaseline = "middle"; g.font = fs.toFixed(1) + "px " + MONO;
      var ex = cfg.keep();
      var gap = fs * FIELD_GAP_RATIO, gap2 = gap * gap;
      function tooClose(x, y) { for (var i = 0; i < fcells.length; i++) { var dx = fcells[i].x - x, dy = fcells[i].y - y; if (dx * dx + dy * dy < gap2) return true; } return false; }
      fcells = [];
      var GLYPHS = cfg.glyphs, CLUSTERS = cfg.clusters, CLUSTER_R = cfg.clusterR;
      var rnd = mulberry32(cfg.seed);   // fixed seed → identical layout every build (scroll/resize stable)
      var margin = FIELD_MARGIN, per = Math.max(2, Math.round(GLYPHS / CLUSTERS)), guard = 0;
      for (var ci = 0; ci < CLUSTERS && fcells.length < GLYPHS; ci++) {
        var s = cfg.seedFn(W, H, rnd, ci, CLUSTERS), added = 0;
        // cap ACCEPTED glyphs at ~per PER cluster: a clusterR region can hold far more than `per`, so without
        // this the first clusters greedily fill the whole quota and the later clusters (other screen regions)
        // never contribute — collapsing the field into one corner. Capping spreads glyphs across ALL clusters.
        for (var k = 0; k < per * 6 && added < per && fcells.length < GLYPHS; k++) {
          if (guard++ > GLYPHS * 60) break;
          var gx = s.x + (rnd() * 2 - 1) * CLUSTER_R, gy = s.y + (rnd() * 2 - 1) * CLUSTER_R;
          if (gx < margin || gx > W - margin || gy < margin || gy > H - margin) continue;
          if (boxHits(ex, gx, gy, hx, hy) || tooClose(gx, gy)) continue;
          fcells.push({ x: gx, y: gy, ch: pick(CODE), swapAt: 0, ph: Math.random() * 6.283 }); added++;
        }
      }
    }
    function draw(t) {
      if (!fcells.length) return;
      var _tp = window.HeroPerf ? HeroPerf.t() : 0;
      g.clearRect(0, 0, W, H);
      var live = cfg.keep();   // rects move as content scrolls → re-test each glyph against the CURRENT rects (box)
      g.fillStyle = cfg.color;
      for (var i = 0; i < fcells.length; i++) {
        var c = fcells[i];
        if (boxHits(live, c.x, c.y, hx, hy)) continue;
        if (!reduce && t > c.swapAt) { c.ch = pick(CODE); c.swapAt = t + cfg.churnMin + Math.random() * (cfg.churnMax - cfg.churnMin); }
        var a;
        if (cfg.blink) {
          // individual OFF→ON blink: each glyph on its own phase (c.ph). Only the DUTY window of each cycle is
          // lit; outside it the glyph is fully OFF (skipped). A short FADE at each edge softens the on/off.
          if (reduce) { a = cfg.aBase; }                                   // reduced motion → static, no blink
          else {
            var cyc = ((t * cfg.blinkSpeed + c.ph) % 1 + 1) % 1;           // 0..1 within this glyph's cycle
            if (cyc >= cfg.blinkDuty) continue;                            // OFF window → draw nothing
            var u = cyc / cfg.blinkDuty;                                   // 0..1 across the ON window
            var env = cfg.blinkFade > 0 ? Math.min(1, Math.min(u, 1 - u) / cfg.blinkFade) : 1;
            a = env * cfg.aPeak;
          }
        } else {
          a = reduce ? cfg.aBase : cfg.aBase + Math.sin(t * cfg.shim + c.ph) * cfg.aAmp;
        }
        if (a < 0.02) continue; if (a > cfg.aMax) a = cfg.aMax;
        g.globalAlpha = a;
        g.fillText(c.ch, c.x, c.y);
      }
      g.globalAlpha = 1;
      if (window.HeroPerf) HeroPerf.add("workfx", _tp);
    }
    return { build: build, draw: draw };
  }

  var workField = makeField({ on: WORK_FIELD_ON, section: work, cls: "work-fx", color: INK, seed: 1337,
    fsScale: WORK_FS_SCALE, glyphs: FIELD_GLYPHS, clusters: FIELD_CLUSTERS, clusterR: FIELD_CLUSTER_R, seedFn: seedWork,
    blink: false, aBase: WORK_ALPHA_BASE, aAmp: WORK_ALPHA_AMP, aMax: WORK_ALPHA_MAX,
    churnMin: WORK_CHURN_MIN, churnMax: WORK_CHURN_MAX, shim: WORK_SHIM_SPEED, keep: workKeep });
  var contactField = makeField({ on: CONTACT_FIELD_ON, section: contact, cls: "contact-fx", color: BONE, seed: 9271,
    fsScale: CONTACT_FS_SCALE, glyphs: CONTACT_GLYPHS, clusters: CONTACT_CLUSTERS, clusterR: CONTACT_CLUSTER_R, seedFn: seedContact,
    blink: CONTACT_BLINK, blinkSpeed: CONTACT_BLINK_SPEED, blinkDuty: CONTACT_BLINK_DUTY, blinkFade: CONTACT_BLINK_FADE,
    aBase: CONTACT_ALPHA_BASE, aPeak: CONTACT_ALPHA_PEAK, aMax: CONTACT_ALPHA_PEAK,
    churnMin: CONTACT_CHURN_MIN, churnMax: CONTACT_CHURN_MAX, keep: contactKeep });

  // ---- header (the word "WORK") -------------------------------------------
  function build() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    var LFS = parseFloat(getComputedStyle(host).fontSize) || 54;
    cellFS = Math.max(CELL_MIN, Math.min(CELL_MAX, LFS * CELL_RATIO));
    var step = Math.max(3, cellFS * STEP_RATIO);

    var off = document.createElement("canvas"), o = off.getContext("2d");
    o.font = "800 " + LFS + "px " + HERO;
    var word = "WORK";
    tw = Math.ceil(o.measureText(word).width) + 6;
    th = Math.ceil(LFS * 1.16) + 6;
    off.width = tw; off.height = th; o = off.getContext("2d");
    o.font = "800 " + LFS + "px " + HERO; o.textAlign = "center"; o.textBaseline = "middle"; o.fillStyle = "#fff";
    o.fillText(word, tw / 2, th / 2);
    var img = o.getImageData(0, 0, tw, th).data;

    cells = [];
    for (var y = step / 2; y < th; y += step) {
      var rw = (y | 0) * tw;
      for (var x = step / 2; x < tw; x += step) {
        if (img[(rw + (x | 0)) * 4 + 3] > 128) cells.push({ x: x, y: y, ch: pick(CODE), swapAt: 0, ph: Math.random() * 6.283 });
      }
    }
    cv.style.width = tw + "px"; cv.style.height = th + "px";
    cv.width = Math.round(tw * DPR); cv.height = Math.round(th * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = cellFS.toFixed(1) + "px " + MONO;

    workField.build(); contactField.build();   // rebuild both ambient fields (DPR is set above, used inside)
  }

  function draw(t) {
    ctx.clearRect(0, 0, tw, th);
    ctx.fillStyle = INK;
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      if (!reduce && t > c.swapAt) { c.ch = pick(CODE); c.swapAt = t + CHURN_MIN + Math.random() * (CHURN_MAX - CHURN_MIN); }
      var a = reduce ? 0.9 : SHIM_BASE + Math.sin(t * SHIM_SPEED + c.ph) * SHIM_AMP;
      if (a < 0.06) continue; if (a > 1) a = 1;
      ctx.globalAlpha = a;
      ctx.fillText(c.ch, c.x, c.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---- single rAF loop: header + both ambient fields ----------------------
  var raf = 0, onScreen = false, visible = document.visibilityState === "visible";
  function paint(t) { draw(t); workField.draw(t); contactField.draw(t); }
  function frame(t) { raf = 0; if (!onScreen || !visible) return; paint(t); if (!reduce) raf = requestAnimationFrame(frame); }
  function kick() { if (!raf && onScreen && visible && !reduce) raf = requestAnimationFrame(frame); }

  build();
  paint(performance.now());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { build(); paint(performance.now()); kick(); });

  // Observe BOTH the WORK and CONTACT sections — the loop must run while EITHER is on screen (the WORK header
  // AND the CONTACT field both need it). If only #work were observed, the CONTACT field would freeze on entry.
  var onScr = { work: false, contact: false };
  function io(el, key) {
    if (!el) return;
    new IntersectionObserver(function (es) {
      onScr[key] = es[0] ? es[0].isIntersecting : true;
      onScreen = onScr.work || onScr.contact;
      if (onScreen) { if (reduce) paint(performance.now()); else kick(); }
      else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }).observe(el);
  }
  io(work, "work"); io(contact, "contact");
  if (!work && !contact) { onScreen = true; kick(); }   // fallback: never observed → just run

  document.addEventListener("visibilitychange", function () {
    visible = document.visibilityState === "visible";
    if (visible) kick(); else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  });
  addEventListener("resize", function () { build(); paint(performance.now()); kick(); }, { passive: true });
})();

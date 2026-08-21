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
  // CONTACT: LIGHT glyphs (--bone) on the BLACK bg. Small, spread over the whole screen in clusters of VARYING
  //       size (big clumps + singletons). Its "twinkle" now matches the rest of the site: the alpha stays ON
  //       and only WOBBLES (never hits 0), and the visible flicker is the fast CHAR SWAP (churn) — the same
  //       model as the bottom strip and the WORK header. Opacity still gated by --contact-reveal.
  var CONTACT_FIELD_ON  = true;
  var CONTACT_FS_SCALE  = 0.60;    // × base FS — decoupled from the strip; ~5.08px @1440 (base 8.47) — UNCHANGED
  var CONTACT_GLYPHS    = 74;      // soft CEILING on total glyphs (was 52). Higher to allow the big clumps of
                                   //   part-2's varied cluster sizes; actual total emerges from the size draw.
  var CONTACT_CLUSTERS  = 13;      // cluster CENTRES (unchanged) — full-screen coverage via seedContact grid
  var CONTACT_CLUSTER_R = 34;      // fallback fixed radius (only used if size-linked radius is off)
  var CONTACT_PAD       = 26;      // keep-out pad around .wish__lead (was 22) — a touch more room now that the
                                   //   field is denser (always-on) so the statement doesn't feel crowded
  // --- shimmer (ALWAYS-ON alpha, like the strip/header) ---
  //   alpha = aBase ± aAmp, never touching 0. Range 0.40..0.80 (MAX = the real peak, so it is actually reached).
  //   These glyphs are ~5px (FS_SCALE 0.60) vs the strip's ~8.5px — thin strokes scatter more ink under AA, so
  //   the same alpha reads fainter. Pitched at/above the strip (0.68..1.0) & header (0.46..0.78) numerically so
  //   that OPTICALLY it lands as a legible background, not the palest layer.
  var CONTACT_ALPHA_BASE = 0.60, CONTACT_ALPHA_AMP = 0.20, CONTACT_ALPHA_MAX = 0.80;
  var CONTACT_BOLD       = 0.18;   // synthetic-bold: a thin same-colour strokeText over each glyph (screen px,
                                   //   like dandelion's STRIP_BOLD 0.3 but thinner for the ~5px glyphs) so the
                                   //   hairline strokes read solid instead of washing out under AA. 0 = off.
  var CONTACT_SHIM_SPEED = 0.004;  // gentle alpha wobble — below the header (0.006) / strip (0.012); the churn,
                                   //   not the alpha, carries the sparkle so this stays subtle
  var CONTACT_CHURN_MIN  = 150, CONTACT_CHURN_MAX = 600;    // FAST char-swap (was 320..1400) — between the strip
                                   //   (60..260, fastest) and the header (280..1150, mid); this is the twinkle
  // --- varied cluster sizes (part 2) — big clumps + medium + singletons, all from the SEEDED rnd ---
  var CONTACT_SIZE_MIN   = 1;      // singletons allowed (낱개)
  var CONTACT_SIZE_MAX   = 11;     // biggest clump target
  var CONTACT_SIZE_POW   = 2.1;    // skew of the size draw: size = MIN + floor(rnd()^POW × span). POW>1 → most
                                   //   clusters small, a long tail of a few big clumps (E[size] ≈ 4.2)
  var CONTACT_CLUSTER_R_K = 6.0;   // size-linked radius: R = K × sqrt(size). Grows with the clump so a big one
                                   //   isn't cramped, but sub-linearly so areal density stays roughly constant
  var CONTACT_CLUSTER_R_MIN = 7;   // floor radius (px) so even small clusters have a little scatter
  var CONTACT_GAP_RATIO  = 0.82;   // tooClose reject radius = fs × this (CONTACT-only; shared FIELD_GAP_RATIO is
                                   //   1.1). Lower → glyphs in a clump sit nearly touching, as in the reference
  // --- cluster LIFECYCLE (CONTACT only) — each clump independently fades IN, HOLDS, fades OUT, then respawns at
  //     a new spot with a new size / radius / char set. Runs on TIME inside the existing paint loop (no new rAF).
  //     Slow on purpose: hold ≫ fade so it reads as "a clump occasionally drifts to a new place", never a blink.
  //     env(cluster) multiplies the per-glyph shimmer alpha; churn (char swap) is independent and unchanged. ---
  var CONTACT_LIFE       = true;
  var CONTACT_LIFE_HOLD_MIN = 14000, CONTACT_LIFE_HOLD_MAX = 28000;  // ms fully-present per clump (staggered). Long
                                   //   so hold ≫ fade: at any instant only ~2-3 of 13 clumps are mid-fade, the
                                   //   rest sit fully lit → the field stays dense and a clump only "occasionally"
                                   //   drifts. (Shorter holds left too many clumps dim at once — the field thinned.)
  var CONTACT_LIFE_FADE_MIN = 1600, CONTACT_LIFE_FADE_MAX = 2600;    // ms fade-in and fade-out (each side); slow
                                   //   enough (>1.5s) to read as drift, not flicker
  var CONTACT_LIFE_REST   = 1600;  // ms a clump waits before retrying if it can't find a clear spawn spot
  var CONTACT_LIFE_RESUME_SPREAD = 3000;  // on loop resume, overdue clumps respawn spread over this window (ms)
                                   //   so they don't all pop back at once after the field was off-screen/hidden
  // --- blink — DISABLED, kept for future. When CONTACT_BLINK=true, draw() takes the duty-cycle path instead
  //     of the shimmer path above. All constants preserved so a single flag flip restores it. ---
  var CONTACT_BLINK      = false;
  var CONTACT_BLINK_SPEED = 0.00042, CONTACT_BLINK_DUTY = 0.32, CONTACT_BLINK_FADE = 0.22, CONTACT_ALPHA_PEAK = 0.78;
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
    var fcells = [], clusters = [], W = 0, H = 0, fs = 12, hx = 0, hy = 0, margin = FIELD_MARGIN, gap2 = 0;
    var lastT = 0, started = false;
    // a SEPARATE, persistent PRNG for the CONTACT lifecycle: it keeps advancing across respawns, so clumps get
    // fresh positions/sizes/chars OVER TIME. (WORK's static build still uses a fixed mulberry32(cfg.seed) below,
    // so WORK stays reproducible.) Only advanced by time-driven respawns, never by scroll → no scroll-jump.
    var lifeRnd = mulberry32((cfg.seed ^ 0x9e3779b1) >>> 0);

    // ---- lifecycle helpers (CONTACT only) ----
    function occupied(x, y, skip, extra) {   // tooClose against every OTHER cluster's glyphs + the new ones so far
      for (var i = 0; i < clusters.length; i++) { if (clusters[i] === skip) continue; var gl = clusters[i].glyphs;
        for (var j = 0; j < gl.length; j++) { var dx = gl[j].x - x, dy = gl[j].y - y; if (dx * dx + dy * dy < gap2) return true; } }
      for (var e = 0; e < extra.length; e++) { var ex2 = extra[e].x - x, ey2 = extra[e].y - y; if (ex2 * ex2 + ey2 * ey2 < gap2) return true; }
      return false;
    }
    function totalExcept(skip) { var n = 0; for (var i = 0; i < clusters.length; i++) if (clusters[i] !== skip) n += clusters[i].glyphs.length; return n; }
    function tryPlace(cx, cy, size, R, ex, clu) {   // seat up to `size` glyphs in R around (cx,cy), clearing keep-out + neighbours
      var out = [], attempts = size * 12 + 16;
      for (var k = 0; k < attempts && out.length < size; k++) {
        var gx = cx + (lifeRnd() * 2 - 1) * R, gy = cy + (lifeRnd() * 2 - 1) * R;
        if (gx < margin || gx > W - margin || gy < margin || gy > H - margin) continue;
        if (boxHits(ex, gx, gy, hx, hy) || occupied(gx, gy, clu, out)) continue;
        out.push({ x: gx, y: gy, ch: pick(CODE), swapAt: 0, ph: Math.random() * 6.283 });
      }
      return out;
    }
    // (re)spawn one clump: new centre (its grid cell), new size (budget-capped), new radius, new glyphs. `phase`:
    //   "stagger" = random initial age (build); "fresh" = start a fade-in now (respawn); "keep" = leave timers
    //   as-is (resize → same lifecycle phase, only the positions move).
    function spawnCluster(clu, ex, t, phase) {
      var avail = Math.max(1, cfg.glyphs - totalExcept(clu));               // keep the whole field under CONTACT_GLYPHS
      var size = Math.min(avail, Math.max(1, cfg.clusterSize(lifeRnd)));
      var R = cfg.clusterRFn(size), best = [], bestX = 0, bestY = 0;
      // try several centres and keep the one that seats the MOST glyphs — NOT just the first non-empty spot (that
      // would let a clump collapse to 1-2 near the statement / screen edge). First tries stay in the clump's grid
      // cell (screen coverage); if that cell is blocked (e.g. sits under .wish__lead), later tries fall back to
      // ANY open spot so the clump relocates instead of dying — keeps the field from thinning out over the text.
      for (var st = 0; st < 6 && best.length < size; st++) {
        var s = (st < 3) ? cfg.seedFn(W, H, lifeRnd, clu.ci, cfg.clusters)
                         : { x: margin + lifeRnd() * (W - 2 * margin), y: margin + lifeRnd() * (H - 2 * margin) };
        var gg = tryPlace(s.x, s.y, size, R, ex, clu);
        if (gg.length > best.length) { best = gg; bestX = s.x; bestY = s.y; }
      }
      if (!best.length) { clu.resting = true; clu.glyphs = []; clu.rest = t + CONTACT_LIFE_REST; return false; }
      var glyphs = best; clu.cx = bestX; clu.cy = bestY;
      clu.resting = false; clu.glyphs = glyphs; clu.size = glyphs.length; clu.R = R;
      if (phase !== "keep") {
        clu.hold = CONTACT_LIFE_HOLD_MIN + lifeRnd() * (CONTACT_LIFE_HOLD_MAX - CONTACT_LIFE_HOLD_MIN);
        clu.fade = CONTACT_LIFE_FADE_MIN + lifeRnd() * (CONTACT_LIFE_FADE_MAX - CONTACT_LIFE_FADE_MIN);
        clu.cycle = clu.hold + clu.fade * 2;
        clu.t0 = (phase === "stagger") ? t - lifeRnd() * clu.cycle : t;    // stagger → clumps start out of phase
      }
      return true;
    }
    function envelope(age, fade, hold) {   // 0→1 fade-in, 1 hold, 1→0 fade-out
      if (age <= 0) return 0;
      if (age < fade) return age / fade;
      if (age < fade + hold) return 1;
      var o = age - fade - hold;
      return o < fade ? 1 - o / fade : 0;
    }
    // Loop resumed after a pause (field scrolled off-screen, tab hidden): every clump whose cycle expired during
    // the gap would otherwise respawn on the SAME frame → one big pop. Re-stagger the overdue ones across a fresh
    // window, and desync churn deadlines. Mirrors dandelion.js reseedOnResume.
    function resumeReseed(t) {
      for (var i = 0; i < clusters.length; i++) { var c = clusters[i];
        if (c.resting) { c.rest = t + Math.random() * CONTACT_LIFE_RESUME_SPREAD; }
        else if (t - c.t0 >= c.cycle - 1) { c.t0 = t - c.cycle + Math.random() * CONTACT_LIFE_RESUME_SPREAD; }  // becomes due, spread out
        for (var j = 0; j < c.glyphs.length; j++) c.glyphs[j].swapAt = t + Math.random() * cfg.churnMax;
      }
    }

    function build() {
      W = window.innerWidth; H = window.innerHeight;
      fs = fieldSize(W) * cfg.fsScale; hx = fs * FIELD_HIT_WX; hy = fs * FIELD_HIT_HY;
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      g.setTransform(DPR, 0, 0, DPR, 0, 0); g.textAlign = "center"; g.textBaseline = "middle"; g.font = fs.toFixed(1) + "px " + MONO;
      var ex = cfg.keep();
      var gap = fs * (cfg.gapRatio || FIELD_GAP_RATIO); gap2 = gap * gap;
      var GLYPHS = cfg.glyphs, CLUSTERS = cfg.clusters, CLUSTER_R = cfg.clusterR;

      if (cfg.life) {
        // CONTACT: cluster lifecycle. On a FRESH build, create clumps with staggered phases; on a REBUILD
        // (resize), keep each clump's lifecycle phase (so they don't all fade in together) and only re-place its
        // glyphs for the new canvas size.
        var t = (typeof performance !== "undefined") ? performance.now() : 0;
        var fresh = clusters.length !== CLUSTERS;
        if (fresh) { clusters = []; for (var ci = 0; ci < CLUSTERS; ci++) clusters.push({ ci: ci, glyphs: [], size: 0, cx: 0, cy: 0, R: 0, t0: 0, hold: 0, fade: 0, cycle: 0, resting: false, rest: 0 }); }
        for (var c2 = 0; c2 < CLUSTERS; c2++) clusters[c2].glyphs = [];      // clear so occupied() only sees re-placed clumps
        var placed = [];
        for (var c = 0; c < CLUSTERS; c++) { spawnCluster(clusters[c], ex, t, fresh ? "stagger" : "keep"); placed.push([clusters[c].size, clusters[c].glyphs.length]); }
        started = false;   // next draw re-baselines lastT so the build→first-frame gap isn't seen as a resume
        if (cfg.dbg && window.console) console.log("[" + cfg.cls + "] life clusters sizes:", JSON.stringify(clusters.map(function (q) { return q.glyphs.length; })), "total:", clusters.reduce(function (a, q) { return a + q.glyphs.length; }, 0));
        return;
      }

      // WORK (and any non-lifecycle field): static, fixed-seed flat layout — UNCHANGED.
      function tooClose(x, y) { for (var i = 0; i < fcells.length; i++) { var dx = fcells[i].x - x, dy = fcells[i].y - y; if (dx * dx + dy * dy < gap2) return true; } return false; }
      fcells = [];
      var rnd = mulberry32(cfg.seed);   // fixed seed → identical layout every build (scroll/resize stable)
      var per = Math.max(2, Math.round(GLYPHS / CLUSTERS)), guard = 0, sp = [];
      for (var wi = 0; wi < CLUSTERS && fcells.length < GLYPHS; wi++) {
        var target = cfg.clusterSize ? Math.max(1, cfg.clusterSize(rnd)) : per;
        var R = cfg.clusterRFn ? cfg.clusterRFn(target) : CLUSTER_R;
        var attempts = cfg.clusterSize ? (target * 12 + 16) : per * 6;
        var added = 0, seatTries = cfg.clusterSize ? 5 : 1;
        for (var st = 0; st < seatTries && added === 0 && fcells.length < GLYPHS; st++) {
          var s = cfg.seedFn(W, H, rnd, wi, CLUSTERS);
          for (var k = 0; k < attempts && added < target && fcells.length < GLYPHS; k++) {
            if (guard++ > GLYPHS * 120) break;
            var gx = s.x + (rnd() * 2 - 1) * R, gy = s.y + (rnd() * 2 - 1) * R;
            if (gx < margin || gx > W - margin || gy < margin || gy > H - margin) continue;
            if (boxHits(ex, gx, gy, hx, hy) || tooClose(gx, gy)) continue;
            fcells.push({ x: gx, y: gy, ch: pick(CODE), swapAt: 0, ph: Math.random() * 6.283 }); added++;
          }
        }
        sp.push([target, added]);
      }
      if (cfg.dbg && window.console) console.log("[" + cfg.cls + "] clusters target/placed:", JSON.stringify(sp), "total:", fcells.length);
    }

    function draw(t) {
      var _tp = window.HeroPerf ? HeroPerf.t() : 0;
      g.clearRect(0, 0, W, H);
      var live = cfg.keep();   // ONE keep-out read per frame — reused for both drawing AND respawn placement
      g.fillStyle = cfg.color;

      if (cfg.life) {
        var bold = cfg.bold || 0;
        if (bold) { g.strokeStyle = cfg.color; g.lineJoin = "round"; g.lineWidth = bold; }
        // reduced motion → fully static: current clumps at base alpha, no churn, no lifecycle.
        if (reduce) {
          for (var ri = 0; ri < clusters.length; ri++) { var rg = clusters[ri].glyphs;
            for (var rj = 0; rj < rg.length; rj++) { var rc = rg[rj]; if (boxHits(live, rc.x, rc.y, hx, hy)) continue; g.globalAlpha = cfg.aBase; g.fillText(rc.ch, rc.x, rc.y); if (bold) g.strokeText(rc.ch, rc.x, rc.y); } }
          g.globalAlpha = 1; if (window.HeroPerf) HeroPerf.add("workfx", _tp); return;
        }
        var dt = t - lastT; lastT = t;
        if (started && dt > 500) resumeReseed(t);   // returned from off-screen/hidden → stagger the backlog
        started = true;
        for (var ci = 0; ci < clusters.length; ci++) {
          var clu = clusters[ci];
          if (clu.resting) { if (t >= clu.rest) spawnCluster(clu, live, t, "fresh"); if (clu.resting) continue; }
          var age = t - clu.t0;
          if (age >= clu.cycle) { spawnCluster(clu, live, t, "fresh"); if (clu.resting) continue; age = t - clu.t0; }
          var cenv = envelope(age, clu.fade, clu.hold);
          if (cenv <= 0) continue;
          var gl = clu.glyphs;
          for (var gi = 0; gi < gl.length; gi++) {
            var c = gl[gi];
            if (boxHits(live, c.x, c.y, hx, hy)) continue;
            if (t > c.swapAt) { c.ch = pick(CODE); c.swapAt = t + cfg.churnMin + Math.random() * (cfg.churnMax - cfg.churnMin); }
            var a = (cfg.aBase + Math.sin(t * cfg.shim + c.ph) * cfg.aAmp) * cenv;   // shimmer × clump envelope
            if (a < 0.02) continue; if (a > cfg.aMax) a = cfg.aMax;
            g.globalAlpha = a;
            g.fillText(c.ch, c.x, c.y);
            if (bold) g.strokeText(c.ch, c.x, c.y);
          }
        }
        g.globalAlpha = 1;
        if (window.HeroPerf) HeroPerf.add("workfx", _tp);
        return;
      }

      // WORK / non-lifecycle flat draw — UNCHANGED (shimmer or blink path).
      if (!fcells.length) { if (window.HeroPerf) HeroPerf.add("workfx", _tp); return; }
      for (var i = 0; i < fcells.length; i++) {
        var fc = fcells[i];
        if (boxHits(live, fc.x, fc.y, hx, hy)) continue;
        if (!reduce && t > fc.swapAt) { fc.ch = pick(CODE); fc.swapAt = t + cfg.churnMin + Math.random() * (cfg.churnMax - cfg.churnMin); }
        var fa;
        if (cfg.blink) {
          if (reduce) { fa = cfg.aBase; }
          else {
            var cyc = ((t * cfg.blinkSpeed + fc.ph) % 1 + 1) % 1;
            if (cyc >= cfg.blinkDuty) continue;
            var u = cyc / cfg.blinkDuty;
            var benv = cfg.blinkFade > 0 ? Math.min(1, Math.min(u, 1 - u) / cfg.blinkFade) : 1;
            fa = benv * cfg.aPeak;
          }
        } else {
          fa = reduce ? cfg.aBase : cfg.aBase + Math.sin(t * cfg.shim + fc.ph) * cfg.aAmp;
        }
        if (fa < 0.02) continue; if (fa > cfg.aMax) fa = cfg.aMax;
        g.globalAlpha = fa;
        g.fillText(fc.ch, fc.x, fc.y);
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
    gapRatio: CONTACT_GAP_RATIO,
    // varied cluster sizes → big clumps + singletons; radius links to size so clumps aren't cramped
    clusterSize: function (rnd) { return CONTACT_SIZE_MIN + Math.floor(Math.pow(rnd(), CONTACT_SIZE_POW) * (CONTACT_SIZE_MAX - CONTACT_SIZE_MIN + 1)); },
    clusterRFn: function (size) { return CONTACT_CLUSTER_R_MIN + CONTACT_CLUSTER_R_K * Math.sqrt(size); },
    blink: CONTACT_BLINK, blinkSpeed: CONTACT_BLINK_SPEED, blinkDuty: CONTACT_BLINK_DUTY, blinkFade: CONTACT_BLINK_FADE,
    aBase: CONTACT_ALPHA_BASE, aAmp: CONTACT_ALPHA_AMP, shim: CONTACT_SHIM_SPEED,
    aPeak: CONTACT_ALPHA_PEAK, aMax: CONTACT_BLINK ? CONTACT_ALPHA_PEAK : CONTACT_ALPHA_MAX,
    life: CONTACT_LIFE, bold: CONTACT_BOLD,
    churnMin: CONTACT_CHURN_MIN, churnMax: CONTACT_CHURN_MAX, keep: contactKeep,
    dbg: (typeof location !== "undefined" && /fielddbg/.test(location.search)) });

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

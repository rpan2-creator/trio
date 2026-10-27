/* PIP pixel engine — procedural creature generator + item sprites + room painter.
   Everything is painted from shape rules onto a low-res grid, then auto-shaded (hue-shifted),
   inner-lined and outlined, so any combination of parts stays coherent and cute. */
(function (global) {
  'use strict';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function hex2rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgb2hex(r, g, b) { return '#' + ((1 << 24) | (clamp(Math.round(r), 0, 255) << 16) | (clamp(Math.round(g), 0, 255) << 8) | clamp(Math.round(b), 0, 255)).toString(16).slice(1); }
  function mix(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
  const SHADOW = '#3d2a6b', LIGHT = '#fff7dc', INK = '#2b1d3a';
  const dark = (c, k) => mix(c, SHADOW, k == null ? 0.26 : k);
  const light = (c, k) => mix(c, LIGHT, k == null ? 0.38 : k);
  const outlineOf = c => mix(mix(c, '#000000', 0.45), INK, 0.55);
  // materials that never get form shading / inner lines
  const FLAT = new Set(['K', 'W', 'C', 'E', 'E2', 'N', 'T', 'R']);

  /* ---------------- Pix: a tiny raster with z-order, regions and form shading ---------------- */
  class Pix {
    constructor(w, h) { this.w = w; this.h = h; const n = w * h; this.m = new Array(n).fill(null); this.r = new Array(n).fill(null); this.z = new Int16Array(n); this.s = new Int8Array(n); this.zc = 0; }
    idx(x, y) { return y * this.w + x; }
    get(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null; return this.m[y * this.w + x]; }
    set(x, y, mat, reg, sh) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = y * this.w + x; this.m[i] = mat; this.r[i] = reg; this.z[i] = this.zc; this.s[i] = sh || 0; }
    shape(test, x0, y0, x1, y1, mat, reg, shadeFn) {
      this.zc++;
      const ya = Math.max(0, Math.floor(y0)), yb = Math.min(this.h - 1, Math.ceil(y1)), xa = Math.max(0, Math.floor(x0)), xb = Math.min(this.w - 1, Math.ceil(x1));
      for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
        if (test(x + 0.5, y + 0.5)) { const mm = typeof mat === 'function' ? mat(x, y) : mat; if (mm == null) continue; this.set(x, y, mm, reg, shadeFn ? shadeFn(x + .5, y + .5) : 0); }
      }
    }
    ell(cx, cy, rx, ry, mat, reg, o = {}) {
      const n = o.n || 2, shadeOn = o.shade !== false;
      const sf = shadeOn ? (x, y) => { const dx = (x - cx) / rx, dy = (y - cy) / ry; const d = dx * 0.45 + dy * 0.9; if (d > 0.62) return -1; const u = -dx * 0.55 - dy * 0.85; if (u > 0.62 && (dx * dx + dy * dy) > 0.3) return 1; return 0; } : null;
      const clip = o.clip;
      this.shape((x, y) => Math.abs((x - cx) / rx) ** n + Math.abs((y - cy) / ry) ** n <= 1 && (!clip || clip(x, y)), cx - rx, cy - ry, cx + rx, cy + ry, mat, reg, sf);
    }
    rell(cx, cy, rx, ry, ang, mat, reg, o = {}) {
      const c = Math.cos(ang), s = Math.sin(ang), R = Math.max(rx, ry);
      const tr = (x, y) => { const dx = x - cx, dy = y - cy; return [(dx * c + dy * s) / rx, (-dx * s + dy * c) / ry]; };
      const sf = o.shade === false ? null : (x, y) => { const dy = (y - cy) / R, dx = (x - cx) / R; const d = dx * 0.4 + dy * 0.9; return d > 0.5 ? -1 : (-dx * .5 - dy * .9 > .55 ? 1 : 0); };
      this.shape((x, y) => { const [u, v] = tr(x, y); return u * u + v * v <= 1 && (!o.clip || o.clip(x, y)); }, cx - R, cy - R, cx + R, cy + R, mat, reg, sf);
    }
    rect(x, y, w, h, mat, reg) { this.zc++; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, typeof mat === 'function' ? mat(x + i, y + j) : mat, reg, 0); }
    poly(pts, mat, reg, o = {}) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
      const inside = (x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if (((a[1] > y) !== (b[1] > y)) && (x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])) c = !c; } return c; };
      const cy = (y0 + y1) / 2, cx = (x0 + x1) / 2, R = Math.max(x1 - x0, y1 - y0) / 2 || 1;
      const sf = o.shade === false ? null : (x, y) => { const d = ((x - cx) * .4 + (y - cy) * .9) / R; return d > 0.55 ? -1 : d < -0.6 ? 1 : 0; };
      this.shape(inside, x0, y0, x1, y1, mat, reg, sf);
    }
    line(x0, y0, x1, y1, r, mat, reg, r1) {
      r1 = r1 == null ? r : r1; const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
      this.shape((x, y) => { let t = ((x - x0) * dx + (y - y0) * dy) / L2; t = clamp(t, 0, 1); const px = x0 + dx * t, py = y0 + dy * t, rr = r + (r1 - r) * t; return (x - px) ** 2 + (y - py) ** 2 <= rr * rr; },
        Math.min(x0, x1) - Math.max(r, r1) - 1, Math.min(y0, y1) - Math.max(r, r1) - 1, Math.max(x0, x1) + Math.max(r, r1) + 1, Math.max(y0, y1) + Math.max(r, r1) + 1, mat, reg);
    }
    bez(a, c, b, rFn, mat, reg, steps = 22) { // quadratic bezier as chain of discs; returns points
      const pts = []; for (let i = 0; i <= steps; i++) { const t = i / steps, u = 1 - t; pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1], rFn(t), t]); }
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p[0] - p[2]); y0 = Math.min(y0, p[1] - p[2]); x1 = Math.max(x1, p[0] + p[2]); y1 = Math.max(y1, p[1] + p[2]); }
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.max(x1 - x0, y1 - y0) / 2 || 1;
      const hit = (x, y) => { let best = null; for (const p of pts) { if ((x - p[0]) ** 2 + (y - p[1]) ** 2 <= p[2] * p[2]) { best = p; } } return best; };
      this.shape((x, y) => !!hit(x, y), x0, y0, x1, y1, typeof mat === 'function' ? (x, y) => mat(hit(x + .5, y + .5)[3], x, y) : mat, reg,
        (x, y) => { const d = ((x - cx) * .35 + (y - cy) * .9) / R; return d > .5 ? -1 : d < -.55 ? 1 : 0; });
      return pts;
    }
    px(x, y, mat, reg) { this.zc++; this.set(x, y, mat, reg, 0); }
    stamp(x, y, rows, map, reg) { this.zc++; rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.' || ch === ' ') continue; this.set(x + i, y + j, map[ch] || ch, reg || 'face', 0); } }); }
    recolor(test, mat) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const i = y * this.w + x; const m = this.m[i]; if (m && test(x + .5, y + .5, m, this.r[i], i)) this.m[i] = typeof mat === 'function' ? mat(m, x, y) : mat; } }
    render(pal, o = {}) {
      const W = this.w, H = this.h, out = new Array(W * H).fill(null);
      const col = m => (m && m[0] === '#') ? m : (pal[m] || '#ff00ff');
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, m = this.m[i]; if (!m) continue;
        let c = col(m);
        if (!FLAT.has(m) && !(m[0] === '#' && m.length === 8)) {
          let s = this.s[i];
          const below = this.get(x, y + 1), above = this.get(x, y - 1);
          if (!below) s = -1; else if (!above && s >= 0) s = 1;
          if (s === -1) c = dark(c); else if (s === 1) c = light(c); else if (s === 2) c = light(c, .7);
          if (o.inner !== false) {
            const rr = this.r[i], zz = this.z[i];
            for (const [ax, ay] of [[0, -1], [1, 0], [-1, 0], [0, 1]]) {
              const nx = x + ax, ny = y + ay; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx;
              const mj = this.m[j]; if (!mj || FLAT.has(mj) || this.r[j] === rr || this.r[j] === 'face' || this.r[j] === 'pat') continue;
              if (this.z[j] > zz) { c = mix(c, INK, .42); break; }
            }
          }
        }
        out[i] = c;
      }
      if (o.outline !== false) {
        const base = out.slice();
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const i = y * W + x; if (base[i]) continue;
          let nb = null;
          for (const [ax, ay] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const nx = x + ax, ny = y + ay; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (base[j] && this.m[j] !== 'noOL') { nb = this.m[j] && this.m[j][0] !== '#' && !FLAT.has(this.m[j]) ? col(this.m[j]) : base[j]; break; } }
          if (nb) out[i] = outlineOf(nb);
        }
      }
      return out;
    }
  }
  function toCanvas(cols, w, h, scale = 1) {
    const cv = document.createElement('canvas'); cv.width = w * scale; cv.height = h * scale; const ctx = cv.getContext('2d');
    if (scale === 1) { const im = ctx.createImageData(w, h); for (let i = 0; i < w * h; i++) { const c = cols[i]; if (!c) continue; const [r, g, b] = hex2rgb(c); im.data[i * 4] = r; im.data[i * 4 + 1] = g; im.data[i * 4 + 2] = b; im.data[i * 4 + 3] = 255; } ctx.putImageData(im, 0, 0); }
    else { for (let i = 0; i < w * h; i++) { const c = cols[i]; if (!c) continue; ctx.fillStyle = c; ctx.fillRect((i % w) * scale, Math.floor(i / w) * scale, scale, scale); } }
    return cv;
  }

  /* ---------------- Parts catalogue ---------------- */
  const PARTS = {
    body: [['chibi', 'Classic'], ['chubby', 'Chubby'], ['tall', 'Leggy'], ['bird', 'Egg / bird'], ['blob', 'Blob'], ['ghost', 'Floaty'], ['shell', 'Shell']],
    head: [['round', 'Round'], ['wide', 'Wide'], ['oval', 'Oval'], ['square', 'Boxy']],
    ears: [['pointy', 'Pointy'], ['fox', 'Big pointy'], ['round', 'Round'], ['small', 'Tiny'], ['bunny', 'Bunny'], ['floppy', 'Floppy'], ['side', 'Side'], ['gills', 'Gills'], ['tufts', 'Tufts'], ['bumps', 'Frog bumps'], ['none', 'None']],
    tail: [['long', 'Long'], ['fluffy', 'Fluffy'], ['short', 'Puff'], ['curly', 'Curly'], ['fish', 'Fin'], ['dragon', 'Spade'], ['thick', 'Thick'], ['none', 'None']],
    wings: [['none', 'None'], ['feather', 'Feather'], ['bat', 'Dragon'], ['fairy', 'Fairy']],
    pattern: [['none', 'None'], ['spots', 'Spots'], ['stripes', 'Stripes'], ['patches', 'Patches'], ['mask', 'Mask'], ['face', 'Face'], ['socks', 'Socks'], ['tips', 'Tips']],
    eyes: [['sparkle', 'Sparkly'], ['dot', 'Dot'], ['round', 'Googly'], ['button', 'Button'], ['sleepy', 'Sleepy']],
    mouth: [['cat', 'Kitty'], ['smile', 'Smile'], ['snout', 'Snout'], ['teeth', 'Bucktooth'], ['beak', 'Beak'], ['fang', 'Fang']],
    extra: [['none', 'None'], ['horns', 'Horns'], ['antlers', 'Antlers'], ['uhorn', 'Unicorn horn'], ['antenna', 'Antenna'], ['sprout', 'Sprout'], ['crown', 'Crown'], ['halo', 'Halo']],
    hair: [['none', 'None'], ['tuft', 'Tuft'], ['mane', 'Mane'], ['curl', 'Curl']],
  };
  const SWATCHES = {
    base: ['#f6d7a7', '#f29a52', '#e8734a', '#c98a5a', '#8b5a3c', '#5b4636', '#3b3346', '#9aa3ad', '#f7f2ea', '#ffd1dc', '#f7a8c4', '#c9a7f2', '#9b7be0', '#86c5ff', '#5aa6e8', '#7ed6c1', '#79c96b', '#4f9e5b', '#ffe07a', '#ffb347', '#ff8fa3', '#b8e0ff', '#d0c3b0', '#e8d9ff'],
    belly: ['#fff8ec', '#ffffff', '#fde7c7', '#ffe9f0', '#fff3b0', '#e6f7ff', '#eaf7e4', '#f1e4ff', '#d9c2a5', '#3b3346'],
    pattern: ['#3b3346', '#5b4636', '#8b5a3c', '#c2573a', '#f29a52', '#ffffff', '#fff3b0', '#ff8fa3', '#9b7be0', '#5aa6e8', '#4f9e5b', '#ffd166'],
    accent: ['#ff9db5', '#ffb3c7', '#f77fa0', '#ffd166', '#c9a7f2', '#86c5ff', '#7ed6c1', '#ff8a5c', '#f4e6c8'],
    eye: ['#2b1d3a', '#3a2a1a', '#2f4a7a', '#2f6b4a', '#7a3a7a', '#b8452f'],
    horn: ['#ffe08a', '#f4e6c8', '#c9925c', '#ffd1f0', '#b8e0ff', '#ffffff'],
  };

  const C = (base, belly, pattern, accent, eye, horn) => ({ base, belly, pattern, accent, eye: eye || '#2b1d3a', horn: horn || '#ffe08a' });
  const PRESETS = {
    cat: { name: 'Cat', g: { body: 'chibi', head: 'wide', ears: 'pointy', tail: 'long', wings: 'none', pattern: 'stripes', belly: true, eyes: 'sparkle', mouth: 'cat', extra: 'none', hair: 'none', cheeks: true },
      pals: [C('#f29a52', '#fff3e0', '#c2573a', '#ff9db5'), C('#9aa3ad', '#f7f2ea', '#5f6670', '#ffb3c7'), C('#3b3346', '#f7f2ea', '#2b2433', '#ff9db5', '#5b7a2f'), C('#f7f2ea', '#ffffff', '#f29a52', '#ffb3c7', '#2f4a7a')] },
    dog: { name: 'Puppy', g: { body: 'chibi', head: 'round', ears: 'floppy', tail: 'curly', wings: 'none', pattern: 'spots', belly: true, eyes: 'dot', mouth: 'snout', extra: 'none', hair: 'none', cheeks: true },
      pals: [C('#e9b27a', '#fff3e0', '#8b5a3c', '#ff9db5'), C('#f7f2ea', '#ffffff', '#5b4636', '#ff9db5'), C('#ffd27a', '#fff6dc', '#c98a3c', '#ff9db5'), C('#5b4636', '#d9b590', '#3b2a22', '#ff9db5')] },
    bunny: { name: 'Bunny', g: { body: 'chibi', head: 'round', ears: 'bunny', tail: 'short', wings: 'none', pattern: 'none', belly: true, eyes: 'sparkle', mouth: 'teeth', extra: 'none', hair: 'none', cheeks: true },
      pals: [C('#f7f2ea', '#ffffff', '#c9a7f2', '#ffb3c7', '#7a3a7a'), C('#d0b49a', '#fff3e0', '#8b5a3c', '#ff9db5'), C('#ffd1dc', '#fff6fa', '#f7a8c4', '#ff8fa3'), C('#9aa3ad', '#f7f2ea', '#5f6670', '#ffb3c7')] },
    fox: { name: 'Fox', g: { body: 'chibi', head: 'wide', ears: 'fox', tail: 'fluffy', wings: 'none', pattern: 'tips', belly: true, eyes: 'sparkle', mouth: 'cat', extra: 'none', hair: 'none', cheeks: true },
      pals: [C('#f2853f', '#fff6ea', '#5b3a2e', '#ffd0b0'), C('#f2f6ff', '#ffffff', '#9aa3ad', '#b8e0ff', '#2f4a7a'), C('#c9a7f2', '#fff6ff', '#6b4fb0', '#ffd1f0', '#7a3a7a')] },
    panda: { name: 'Panda', g: { body: 'chubby', head: 'round', ears: 'round', tail: 'short', wings: 'none', pattern: 'patches', belly: false, eyes: 'dot', mouth: 'snout', extra: 'none', hair: 'none', cheeks: true },
      pals: [C('#f7f4ee', '#ffffff', '#33303b', '#33303b'), C('#ffe9f0', '#ffffff', '#c25a7a', '#c25a7a')] },
    redpanda: { name: 'Red panda', g: { body: 'chibi', head: 'wide', ears: 'pointy', tail: 'fluffy', wings: 'none', pattern: 'face', belly: false, eyes: 'dot', mouth: 'cat', extra: 'none', hair: 'none', cheeks: true },
      pals: [C('#d9663a', '#fff6ea', '#5b2f22', '#fff6ea'), C('#c98a5a', '#fff6ea', '#5b3a2e', '#fff6ea')] },
    frog: { name: 'Frog', g: { body: 'chibi', head: 'wide', ears: 'bumps', tail: 'none', wings: 'none', pattern: 'spots', belly: true, eyes: 'round', mouth: 'smile', extra: 'none', hair: 'none', cheeks: true },
      pals: [C('#79c96b', '#f3ffd9', '#4f9e5b', '#ff9db5'), C('#86c5ff', '#e6f7ff', '#4a7fd0', '#ffb3c7'), C('#ffb347', '#fff3b0', '#e06a2c', '#ff8fa3')] },
    axolotl: { name: 'Axolotl', g: { body: 'chibi', head: 'wide', ears: 'gills', tail: 'fish', wings: 'none', pattern: 'none', belly: true, eyes: 'dot', mouth: 'smile', extra: 'none', hair: 'none', cheeks: true },
      pals: [C('#ffc2d6', '#fff0f5', '#f77fa0', '#f2558a'), C('#c9a7f2', '#f6efff', '#9b7be0', '#7a5ad0'), C('#ffe07a', '#fff9dc', '#ffb347', '#ff8a5c')] },
    dragon: { name: 'Baby dragon', g: { body: 'chibi', head: 'round', ears: 'side', tail: 'dragon', wings: 'bat', pattern: 'none', belly: true, eyes: 'sparkle', mouth: 'fang', extra: 'horns', hair: 'none', cheeks: true },
      pals: [C('#7ed68a', '#fff3b0', '#4f9e5b', '#ffb3c7', '#2b1d3a', '#fff6dc'), C('#9b7be0', '#ffe9b0', '#6b4fb0', '#ff9db5', '#2b1d3a', '#ffe08a'), C('#ff7a6b', '#ffe9b0', '#c2473a', '#ffd166', '#2b1d3a', '#fff6dc'), C('#86c5ff', '#f0fbff', '#4a7fd0', '#c9a7f2', '#2b1d3a', '#ffffff')] },
    hamster: { name: 'Hamster', g: { body: 'chubby', head: 'wide', ears: 'small', tail: 'none', wings: 'none', pattern: 'none', belly: true, eyes: 'dot', mouth: 'teeth', extra: 'none', hair: 'tuft', cheeks: true },
      pals: [C('#f6c58a', '#fff8ec', '#d08a4a', '#ff9db5'), C('#f7f2ea', '#ffffff', '#c9b8a5', '#ffb3c7'), C('#c9b8a5', '#fff8ec', '#8b7a6a', '#ff9db5')] },
    owl: { name: 'Owl', g: { body: 'bird', head: 'round', ears: 'tufts', tail: 'none', wings: 'feather', pattern: 'face', belly: true, eyes: 'round', mouth: 'beak', extra: 'none', hair: 'none', cheeks: false },
      pals: [C('#a87c5a', '#f6e6cf', '#6b4a33', '#ffcf5a', '#2b1d3a', '#ffb534'), C('#c9a7f2', '#f6efff', '#7a5ad0', '#ffd166', '#2b1d3a', '#ffb534'), C('#9aa3ad', '#f2f2f2', '#5f6670', '#ffd166', '#2b1d3a', '#ffb534')] },
    penguin: { name: 'Penguin', g: { body: 'bird', head: 'round', ears: 'none', tail: 'none', wings: 'feather', pattern: 'face', belly: true, eyes: 'dot', mouth: 'beak', extra: 'none', hair: 'none', cheeks: true },
      pals: [C('#3b4560', '#ffffff', '#2b3348', '#ffb534', '#2b1d3a', '#ffb534'), C('#86c5ff', '#ffffff', '#4a7fd0', '#ffb534', '#2b1d3a', '#ffb534'), C('#5b4f6e', '#fff8ec', '#3b3346', '#ffb534', '#2b1d3a', '#ff8a5c')] },
    bear: { name: 'Bear', g: { body: 'chubby', head: 'round', ears: 'round', tail: 'none', wings: 'none', pattern: 'none', belly: true, eyes: 'dot', mouth: 'snout', extra: 'none', hair: 'none', cheeks: true },
      pals: [C('#a8744f', '#e9c9a0', '#6b4a33', '#e9c9a0'), C('#f7f2ea', '#ffffff', '#c9b8a5', '#ffd1dc'), C('#ffd1dc', '#fff6fa', '#f7a8c4', '#ffffff'), C('#5b4636', '#c9a07a', '#3b2a22', '#c9a07a')] },
    deer: { name: 'Deer', g: { body: 'tall', head: 'oval', ears: 'side', tail: 'short', wings: 'none', pattern: 'spots', belly: true, eyes: 'sparkle', mouth: 'smile', extra: 'antlers', hair: 'none', cheeks: true },
      pals: [C('#c98a5a', '#fff3e0', '#fff3e0', '#ffd1b0', '#2b1d3a', '#8b5a3c'), C('#e8d9ff', '#ffffff', '#ffffff', '#ffd1f0', '#7a3a7a', '#c9a7f2')] },
    turtle: { name: 'Turtle', g: { body: 'shell', head: 'round', ears: 'none', tail: 'short', wings: 'none', pattern: 'none', belly: true, eyes: 'dot', mouth: 'smile', extra: 'none', hair: 'none', cheeks: true },
      pals: [C('#8fd17a', '#f3ffd9', '#5b8a3c', '#b07a4a'), C('#7ed6c1', '#effffa', '#3f9e88', '#5aa6e8'), C('#ffd1dc', '#fff6fa', '#c25a7a', '#c9a7f2')] },
    slime: { name: 'Slime', g: { body: 'blob', head: 'round', ears: 'none', tail: 'none', wings: 'none', pattern: 'none', belly: false, eyes: 'sparkle', mouth: 'smile', extra: 'sprout', hair: 'none', cheeks: true },
      pals: [C('#7fd6ff', '#e6f7ff', '#4aa6e0', '#ff9db5'), C('#8fe08a', '#effff0', '#4f9e5b', '#ff9db5'), C('#ff9fc8', '#fff0f7', '#e0609a', '#ffd166'), C('#c9a7f2', '#f6efff', '#7a5ad0', '#ffd166')] },
    ghost: { name: 'Ghost', g: { body: 'ghost', head: 'round', ears: 'none', tail: 'none', wings: 'none', pattern: 'none', belly: false, eyes: 'sparkle', mouth: 'smile', extra: 'none', hair: 'curl', cheeks: true },
      pals: [C('#f4f1ff', '#ffffff', '#c9b8f2', '#ff9db5'), C('#d6f0ff', '#ffffff', '#86c5ff', '#ff9db5'), C('#ffe6f2', '#ffffff', '#f7a8c4', '#c9a7f2')] },
    unicorn: { name: 'Unicorn', g: { body: 'tall', head: 'oval', ears: 'pointy', tail: 'fluffy', wings: 'none', pattern: 'none', belly: false, eyes: 'sparkle', mouth: 'smile', extra: 'uhorn', hair: 'mane', cheeks: true },
      pals: [C('#fbf7ff', '#ffffff', '#c9a7f2', '#ffb3c7', '#7a3a7a', '#ffd65a'), C('#ffe9f0', '#ffffff', '#86c5ff', '#ffb3c7', '#2f4a7a', '#ffd65a'), C('#3b3346', '#5b4f6e', '#ff8fc8', '#c9a7f2', '#ffd166', '#ffd65a')] },
    capybara: { name: 'Capybara', g: { body: 'chubby', head: 'square', ears: 'small', tail: 'none', wings: 'none', pattern: 'none', belly: false, eyes: 'sleepy', mouth: 'snout', extra: 'none', hair: 'none', cheeks: true },
      pals: [C('#b9875a', '#d9b590', '#8b5a3c', '#d9a07a'), C('#d6a77a', '#f0d6b4', '#a8744f', '#e9b28a')] },
    otter: { name: 'Otter', g: { body: 'chibi', head: 'wide', ears: 'small', tail: 'thick', wings: 'none', pattern: 'face', belly: true, eyes: 'dot', mouth: 'snout', extra: 'none', hair: 'none', cheeks: true },
      pals: [C('#8b5a3c', '#e9d2b4', '#5b3a2e', '#e9d2b4'), C('#a8744f', '#f6e6cf', '#6b4a33', '#f6e6cf')] },
  };

  /* ---------------- Creature painter ---------------- */
  const GW = 64, GH = 64;
  function creature(g, st) {
    st = st || {};
    const P = new Pix(GW, GH);
    const stage = st.stage || 'adult';
    const headMul = { baby: .86, kid: .93, adult: 1 }[stage], bodyMul = { baby: .7, kid: .85, adult: 1 }[stage];
    const cx = 32, ground = 62 - (st.lift || 0);
    const body = g.body;
    let hrx = 14.5 * headMul, hry = 12 * headMul, hn = 2, brx = 10.5 * bodyMul, bry = 8.5 * bodyMul, legH = 2;
    if (g.head === 'wide') { hrx *= 1.1; hry *= .93; } else if (g.head === 'oval') { hrx *= .92; hry *= 1.05; } else if (g.head === 'square') { hn = 3.2; hrx *= .96; hry *= .94; }
    if (body === 'chubby') { brx = 13 * bodyMul + 1; bry = 9.5 * bodyMul; }
    if (body === 'tall') { brx = 9.5 * bodyMul; bry = 7.5 * bodyMul; legH = stage === 'baby' ? 4 : stage === 'kid' ? 5 : 7; }
    if (body === 'shell') { brx = 12 * bodyMul + 1; bry = 8.5 * bodyMul; }
    let bodyCy = ground - legH - bry + 1.5;
    let hy = bodyCy - bry - hry * 0.42 + 3.5;
    let hx = cx;
    const floating = body === 'ghost';
    const fl = floating ? 4 + (st.float || 0) : 0;
    if (body === 'bird') { brx = 13.5 * (headMul * .5 + bodyMul * .5) + 1; bry = 15.5 * (headMul * .5 + bodyMul * .5); bodyCy = ground - 2 - bry + 1; hrx = brx * 0.98; hry = bry * 0.62; hy = bodyCy - bry * 0.36; }
    if (body === 'blob') { hrx = 16 * headMul + 1; hry = 13 * headMul; bodyCy = ground - hry + 1; hy = bodyCy; brx = hrx; bry = hry; }
    if (body === 'ghost') { hrx = 14.5 * headMul + .5; hry = 13 * headMul; hy = ground - hry - 7 - fl; bodyCy = hy; brx = hrx; bry = hry; }
    if (st.squash) { hy += st.squash; bodyCy += st.squash * .5; }
    const look = clamp(st.look || 0, -1, 1);
    const top = hy - hry;
    const S = headMul;
    // face geometry
    const eyeDX = Math.round(hrx * 0.42 + (body === 'blob' ? 1 : 0));
    let eyeY = Math.round(hy + hry * (body === 'bird' ? .02 : body === 'ghost' ? -.08 : .1));
    const mouthY = Math.round(hy + hry * (body === 'bird' ? .45 : body === 'ghost' ? .32 : .5));
    const fx = Math.round(hx + look);
    const wag = st.wag || 0, flap = st.flap || 0;
    const regHead = (body === 'bird' || body === 'blob' || body === 'ghost') ? 'body' : 'head';

    /* --- back layer: tail --- */
    const ax = cx + brx * 0.7, ay = bodyCy + bry * 0.35;
    const tailTip = (t) => t > 0.72 ? 'tip' : 'tail';
    if (body !== 'blob' && body !== 'ghost') {
      const T = g.tail;
      if (T === 'long') P.bez([ax - 2, ay + 1], [ax + 9, ay + 2], [ax + 8 + wag * 4, ay - 13], t => 1.9 - t * .3, (t) => 'B', 'tail');
      if (T === 'long') P.bez([ax + 6.5 + wag * 3.2, ay - 9.5], [ax + 8 + wag * 4, ay - 11.5], [ax + 8 + wag * 4, ay - 13.5], () => 1.75, 'B', 'tip');
      if (T === 'fluffy') { P.bez([ax - 3, ay + 1], [ax + 11, ay + 3], [ax + 9 + wag * 4, ay - 13], t => 2.2 + 3.8 * Math.sin(Math.PI * clamp(t * .95 + .05, 0, 1)), 'B', 'tail');
        P.ell(ax + 8.8 + wag * 3.6, ay - 11.2, 3.6, 3.4, 'B', 'tip'); }
      if (T === 'short') P.ell(cx + brx * .92, bodyCy + bry * .35, 3.6 * S, 3.4 * S, g.belly ? 'L' : 'B', 'tip');
      if (T === 'curly') { const ox = ax + 3 + wag, oy = ay - 4; P.shape((x, y) => { const d = Math.hypot(x - ox, y - oy); const a = Math.atan2(y - oy, x - ox); return d >= 1.7 && d <= 3.7 && !(a > 1.2 && a < 2.6); }, ox - 4, oy - 4, ox + 4, oy + 4, 'B', 'tail'); P.line(ax - 2, ay + 1, ox - 0.5, oy + 3, 1.6, 'B', 'tail'); }
      if (T === 'fish') { P.rell(ax + 8 + wag * 2, ay - 2, 7, 4.2, -0.5 + wag * .2, 'A', 'fin'); P.line(ax - 3, ay + 1, ax + 9 + wag * 2, ay - 3, 3, 'B', 'tail', 1.2); }
      if (T === 'dragon') { const pts = P.bez([ax - 3, ay + 1], [ax + 12, ay + 4], [ax + 10 + wag * 3, ay - 8], t => 3.2 - t * 2.3, 'B', 'tail'); const e = pts[pts.length - 1]; P.poly([[e[0] - 3, e[1] + 1], [e[0], e[1] - 5], [e[0] + 3, e[1] + 1], [e[0], e[1] + 3]], 'A', 'tip'); }
      if (T === 'thick') P.bez([ax - 3, ay + 1], [ax + 10, ay + 5], [ax + 13 + wag * 2, ay - 2], t => 3.4 - t * 2.1, 'B', 'tail');
    }
    /* --- wings (behind) --- */
    const wy = bodyCy - bry * 0.55;
    const wS = stage === 'baby' ? .75 : stage === 'kid' ? .88 : 1;
    if (g.wings !== 'none') {
      for (const sgn of [-1, 1]) {
        const wx = cx + sgn * (brx + (body === 'bird' ? -1 : 2));
        if (g.wings === 'feather') {
          const ang = sgn * (-0.75 - flap * 0.45);
          if (body === 'bird') { P.rell(cx + sgn * (brx - 2), bodyCy + 1, 4.2 * wS + 1, 8.5 * wS, sgn * (0.35 + flap * .5), 'P', 'wing'); }
          else { P.rell(wx + sgn * 3 * wS, wy - 2, 7 * wS, 4.5 * wS, ang, 'L', 'wing'); P.rell(wx + sgn * 2.5 * wS, wy, 5.5 * wS, 3 * wS, ang + sgn * .35, 'A', 'wing2'); }
        } else if (g.wings === 'bat') {
          const up = flap * 3; const k = wS;
          P.poly([[wx - sgn * 2, wy + 2], [wx + sgn * 3 * k, wy - 9 * k - up], [wx + sgn * 12 * k, wy - 7 * k - up], [wx + sgn * 10 * k, wy + 1 * k], [wx + sgn * 7 * k, wy - 1], [wx + sgn * 4 * k, wy + 3 * k]], 'A', 'wing');
          P.line(wx - sgn, wy + 1, wx + sgn * 3 * k, wy - 9 * k - up, .9, 'B', 'wingb'); P.line(wx + sgn * 3 * k, wy - 9 * k - up, wx + sgn * 12 * k, wy - 7 * k - up, .9, 'B', 'wingb');
        } else if (g.wings === 'fairy') {
          P.rell(wx + sgn * 4 * wS, wy - 5 * wS - flap * 2, 6 * wS, 3.8 * wS, sgn * (-0.9 - flap * .3), 'F', 'wing');
          P.rell(wx + sgn * 3 * wS, wy + 1.5, 4 * wS, 2.6 * wS, sgn * (0.5), 'F', 'wing2');
        }
      }
    }
    /* --- hair mane (behind head) --- */
    if (g.hair === 'mane') { for (let i = 0; i < 6; i++) { const a = -2.4 + i * 0.32; P.ell(hx + Math.cos(a) * hrx * .95 - 1, hy + Math.sin(a) * hry * .95 + 1, 3.3, 3.3, 'P', 'mane'); } P.ell(hx - hrx * .95, hy + 3, 3, 4.5, 'P', 'mane'); }
    /* --- ears behind head --- */
    const E = g.ears; let earTipY = top;
    const mirror = (fn) => { fn(-1); fn(1); };
    if (E === 'pointy' || E === 'fox') {
      const big = E === 'fox' ? 1.35 : 1;
      mirror(s => { const bx1 = hx + s * hrx * 0.88, bx2 = hx + s * hrx * 0.22, by = hy - hry * 0.45, tx = hx + s * hrx * (E === 'fox' ? .78 : .74), ty = top - 6.5 * big * S + 1; earTipY = ty;
        P.poly([[bx1 + s * .6, by + 2], [tx, ty], [bx2, by - hry * .38]], 'B', 'ear');
        P.poly([[bx1 - s * 1.8, by - 0.5], [tx - s * .4, ty + 3], [bx2 + s * 2.4, by - hry * .3]], 'A', 'earin', { shade: false }); });
    } else if (E === 'round' || E === 'small') {
      const r = (E === 'round' ? hrx * .34 : hrx * .24);
      mirror(s => { const ex = hx + s * hrx * (E === 'round' ? .7 : .68), ey = hy - hry * (E === 'round' ? .78 : .86); earTipY = ey - r; P.ell(ex, ey, r, r, 'B', 'ear'); P.ell(ex + s * .2, ey + .6, r * .55, r * .55, 'A', 'earin', { shade: false }); });
    } else if (E === 'bunny') {
      mirror(s => { const ex = hx + s * hrx * .38, len = 10.5 * S + 2; const ey = top - len * .55 + 2; const tilt = s * (0.18 + (st.earTwitch && s > 0 ? .25 : 0)); earTipY = ey - len;
        P.rell(ex + s * 1.5, ey, 3.4 * S + .4, len, tilt, 'B', 'ear'); P.rell(ex + s * 1.5, ey + 1, 1.6 * S + .2, len - 3, tilt, 'A', 'earin', { shade: false }); });
    } else if (E === 'tufts') {
      mirror(s => { const bx = hx + s * hrx * .62; P.poly([[bx - s * 4, top + 4], [bx + s * 4.5, top - 4], [bx + s * 2, top + 6]], 'B', 'ear'); earTipY = top - 4; });
    } else if (E === 'gills') {
      mirror(s => { const gx = hx + s * (hrx - 1), gy = hy - 1; for (let k = -1; k <= 1; k++) { const ang = k * 0.55 - 0.15; const L = 7 - Math.abs(k) * 1.2; const tx = gx + s * Math.cos(ang) * L, ty = gy + Math.sin(ang) * L * 1.1 - 2 + k * 2; P.line(gx - s * 2, gy + k * 2.4, tx, ty, 1.5, 'A', 'gill', 1.2); P.ell(tx, ty, 1.6, 1.6, 'A', 'gill'); } });
    } else if (E === 'side') {
      mirror(s => { P.rell(hx + s * (hrx + 1.5), hy - hry * .35, 5 * S + .5, 2.6 * S + .3, s * -0.42, 'B', 'ear'); P.rell(hx + s * (hrx + 1.8), hy - hry * .35, 3 * S, 1.2 * S, s * -0.42, 'A', 'earin', { shade: false }); });
    } else if (E === 'bumps') {
      mirror(s => { P.ell(hx + s * eyeDX, top + 2.5, 5.2 * S, 4.6 * S, 'B', 'ear'); }); eyeY = Math.round(top + 2.5);
    }
    /* --- body --- */
    const blush = 'C';
    if (body === 'shell') { P.ell(cx, bodyCy - 2, brx + 2, bry + 2.5, 'A', 'shell'); }
    if (body === 'chibi' || body === 'chubby' || body === 'tall' || body === 'shell') {
      // back feet peeking for chubby/tall
      if (body === 'tall') mirror(s => { P.rect(Math.round(cx + s * brx * .5 - 2), Math.round(bodyCy), 4, Math.round(ground - bodyCy + 1), 'B', 'leg'); });
      P.ell(cx, bodyCy, brx, bry, 'B', 'body');
    }
    if (body === 'bird') { P.ell(cx, bodyCy, brx, bry, 'B', 'body'); }
    if (body === 'blob') { P.ell(cx, bodyCy, hrx, hry, 'B', 'body', { n: 2.15, clip: (x, y) => y < ground + 1 }); P.ell(cx, ground - 1, hrx + 1.5, 2.2, 'B', 'body', { clip: (x, y) => true }); }
    if (body === 'ghost') {
      const by = hy;
      P.shape((x, y) => { const dx = (x - cx) / hrx; if (y < by) return dx * dx + ((y - by) / hry) ** 2 <= 1; if (Math.abs(x - cx) > hrx) return false; const wave = Math.sin((x - cx) * 0.75 + (st.float || 0) * 3) * 1.6; return y < by + 9 + wave - Math.abs(dx) ** 4 * 4; }, cx - hrx, by - hry, cx + hrx, by + 12, 'B', 'body', (x, y) => { const dx = (x - cx) / hrx, dy = (y - by) / (hry + 6); const d = dx * .45 + dy * .9; return d > .6 ? -1 : (-dx * .55 - dy * .85 > .6 ? 1 : 0); });
    }
    /* legs/feet in front */
    if (body === 'chibi' || body === 'chubby' || body === 'shell') {
      mirror(s => { const fxp = cx + s * brx * (body === 'chubby' ? .5 : .46), lift = st.walk && ((s < 0) === (st.walk > 0)) ? 1 : 0; P.ell(fxp, ground - 1.6 - lift, 3.4 * S + .2, 2.3, 'B', 'foot'); });
    }
    if (body === 'tall') mirror(s => { const lx = Math.round(cx + s * brx * .32 - 2), lift = st.walk && ((s < 0) === (st.walk > 0)) ? 1 : 0; P.rect(lx, Math.round(bodyCy + bry * .3), 4, Math.round(ground - bodyCy - bry * .3) - lift, 'B', 'leg2'); P.rect(lx, ground - 1 - lift, 4, 2, 'P', 'hoof'); });
    if (body === 'bird') mirror(s => { const lx = Math.round(cx + s * 4.5 - 1.5); const lift = st.walk && ((s < 0) === (st.walk > 0)) ? 1 : 0; P.rect(lx - 1, ground - 1 - lift, 4, 1, 'Bk', 'foot'); P.rect(lx, ground - 2 - lift, 2, 1, 'Bk', 'foot'); });
    /* --- head --- */
    if (body !== 'bird' && body !== 'blob' && body !== 'ghost') P.ell(hx, hy, hrx, hry, 'B', 'head', { n: hn });
    // floppy ears in front
    if (E === 'floppy') mirror(s => { const ang = s * (-0.38 - (st.earTwitch ? .25 : 0)); P.rell(hx + s * (hrx * .98 + 1), hy - hry * .05, 3.2 * S + .5, 6.4 * S + .4, ang, 'E1', 'ear'); earTipY = hy + 5; });
    /* arms */
    if (body === 'chibi' || body === 'chubby' || body === 'shell' || body === 'tall') {
      mirror(s => {
        if (st.arm === 'raise' && s > 0) { P.rell(cx + s * (brx + 1.5), bodyCy - bry - 1.5, 2.6 * S + .2, 4 * S, s * -0.5, 'B', 'arm'); return; }
        if (st.arm === 'both') { P.rell(cx + s * (brx + 1), bodyCy - bry - 1, 2.6 * S + .2, 4 * S, s * -0.6, 'B', 'arm'); return; }
        P.ell(cx + s * (brx * .62), bodyCy - bry * .02 + 1, 2.6 * S + .3, 3 * S + .3, 'B', 'arm');
      });
    }

    /* --- patterns (recolor base pixels by geometry) --- */
    const pat = g.pattern;
    const inHead = (x, y) => ((x - hx) / hrx) ** 2 + ((y - hy) / hry) ** 2 <= 1.05;
    const isB = m => m === 'B' || m === 'E1';
    const muz = g.mouth === 'snout' ? [4.6 * S + .4, 3.3 * S + .3] : [3.6 * S + .4, 2.4 * S + .3];
    if (g.belly) {
      if (body === 'bird') P.recolor((x, y, m, r) => isB(m) && ((x - cx) / (brx * .74)) ** 2 + ((y - (bodyCy + bry * .32)) / (bry * .6)) ** 2 <= 1, 'L');
      else if (body === 'blob' || body === 'ghost') { }
      else P.recolor((x, y, m, r) => isB(m) && r === 'body' && ((x - cx) / (brx * .62)) ** 2 + ((y - (bodyCy + bry * .3)) / (bry * .8)) ** 2 <= 1, 'L');
      if (g.mouth !== 'beak') P.recolor((x, y, m, r) => isB(m) && r === regHead && ((x - fx) / muz[0]) ** 2 + ((y - (mouthY - .5)) / muz[1]) ** 2 <= 1, 'L');
    } else if (g.mouth === 'snout') P.recolor((x, y, m, r) => isB(m) && r === regHead && ((x - fx) / muz[0]) ** 2 + ((y - (mouthY - .5)) / muz[1]) ** 2 <= 1, 'L');
    if (pat === 'spots') {
      const sp = [[-.55, -.45, 2.2, 'h'], [.5, -.62, 1.5, 'h'], [.62, .3, 2.6, 'b'], [-.6, -.1, 2, 'b'], [-.3, .6, 1.5, 'b'], [.75, -.35, 1.6, 'h']];
      for (const [u, v, r, w] of sp) { const X = w === 'h' ? hx + u * hrx : cx + u * brx, Y = w === 'h' ? hy + v * hry : bodyCy + v * bry; P.recolor((x, y, m, rg) => (m === 'B' || m === 'E1') && (x - X) ** 2 + (y - Y) ** 2 <= r * r * S, 'P'); }
    }
    if (pat === 'stripes') {
      const fy = Math.round(top);
      P.recolor((x, y, m, r) => m === 'B' && r === regHead && ((Math.abs(x - hx) < 1 && y > fy && y < fy + 4.5) || (Math.abs(Math.abs(x - hx) - 3) < 1 && y > fy + 1 && y < fy + 3.5)), 'P');
      P.recolor((x, y, m, r) => m === 'B' && r === regHead && Math.abs(x - hx) > hrx * .72 && (Math.floor(y) - Math.round(hy)) % 3 === 0 && y < hy + 3 && y > hy - 4, 'P');
      P.recolor((x, y, m, r) => m === 'B' && (r === 'body') && Math.abs(x - cx) > brx * .38 && (Math.floor(y) % 3 === 0), 'P');
      P.recolor((x, y, m, r) => m === 'B' && (r === 'tail' || r === 'tip') && (Math.floor(x) + Math.floor(y)) % 4 < 2, 'P');
    }
    if (pat === 'patches') {
      P.recolor((x, y, m, r) => r === 'ear' || r === 'arm' || r === 'foot' || r === 'leg' || r === 'leg2', 'P');
      P.recolor((x, y, m, r) => r === 'earin', 'P');
      mirror(s => P.recolor((x, y, m, r) => isB(m) && r === regHead && (((x - (fx + s * eyeDX)) * Math.cos(s * .5) + (y - eyeY - .8) * Math.sin(s * .5)) / 2.9) ** 2 + ((-(x - (fx + s * eyeDX)) * Math.sin(s * .5) + (y - eyeY - .8) * Math.cos(s * .5)) / 3.9) ** 2 <= 1, 'P'));
      P.recolor((x, y, m, r) => m === 'B' && r === 'body' && y < bodyCy - bry * .25, 'P');
    }
    if (pat === 'mask') P.recolor((x, y, m, r) => isB(m) && r === regHead && Math.abs(y - eyeY - .5) < 2.6 && Math.abs(x - fx) > 1.2, 'P');
    if (pat === 'face') {
      mirror(s => P.recolor((x, y, m, r) => (m === 'B' || m === 'P') && r === regHead && ((x - (fx + s * eyeDX)) / 4.6) ** 2 + ((y - eyeY - .8) / 4.3) ** 2 <= 1, 'L'));
      if (body !== 'bird') P.recolor((x, y, m, r) => m === 'B' && r === regHead && ((x - fx) / (muz[0] + 1)) ** 2 + ((y - (mouthY - .5)) / (muz[1] + .5)) ** 2 <= 1, 'L');
      if (g.base === 'redpanda' || body !== 'bird') P.recolor((x, y, m, r) => m === 'B' && (r === 'body' || r === 'foot' || r === 'arm') && body !== 'bird' && (r !== 'body' || y > bodyCy - bry * .2), 'P');
      if (body !== 'bird') P.recolor((x, y, m, r) => r === 'earin', 'L');
      if (g.tail === 'fluffy') P.recolor((x, y, m, r) => m === 'B' && (r === 'tail' || r === 'tip') && (Math.floor(x * .7 + y)) % 4 < 2, 'P');
    }
    if (pat === 'socks') { P.recolor((x, y, m, r) => r === 'foot' || r === 'leg2' || (r === 'arm' && y > bodyCy), 'L'); P.recolor((x, y, m, r) => r === 'tip', 'L'); }
    if (pat === 'tips') { P.recolor((x, y, m, r) => (r === 'ear') && y < earTipY + 4.5, 'P'); P.recolor((x, y, m, r) => r === 'foot' || r === 'leg2' || (r === 'arm' && y > bodyCy + 1), 'P'); P.recolor((x, y, m, r) => r === 'tip', g.belly ? 'L' : 'P'); }
    if (body === 'shell') { // hex plates
      P.recolor((x, y, m, r) => r === 'shell' && (Math.floor(y + Math.floor(x / 5) * 2) % 5 === 0 || Math.floor(x) % 5 === 0), 'Sh');
    }
    if (body === 'tall' && g.belly) P.recolor((x, y, m, r) => r === 'leg2' && y < bodyCy + bry, 'B');

    /* --- face features --- */
    const eyeMap = { K: 'K', W: 'W', E: 'E', e: 'E2' };
    const eyesState = st.eyes || 'open';
    const stampEye = (s, rows) => { const w = rows[0].length; const ex = s < 0 ? fx - eyeDX - Math.floor(w / 2) : fx + eyeDX - Math.ceil(w / 2); P.stamp(ex, eyeY - Math.floor(rows.length / 2), rows, eyeMap); };
    const EYES = {
      sparkle: ['.EE.', 'EWEE', 'EEEE', 'EEeE', '.EE.'],
      dot: ['EW', 'EE', 'EE'],
      button: ['.E.', 'EWE', 'EEE', '.E.'],
      sleepy: ['EEEE', '.EE.'],
    };
    if (eyesState === 'open') {
      if (g.eyes === 'round') mirror(s => { const ex = fx + s * eyeDX; P.ell(ex, eyeY + .5, 3.2, 3.4, 'W', 'face', { shade: false }); P.stamp(Math.round(ex - 1 + look), eyeY, ['KK', 'KK'], { K: 'E' }); P.px(Math.round(ex - 1 + look), eyeY, 'W', 'face'); });
      else mirror(s => stampEye(s, EYES[g.eyes] || EYES.dot));
      if (g.eyes === 'sparkle') mirror(s => { /* tiny lower glint */ });
    } else if (eyesState === 'closed' || eyesState === 'sleep') mirror(s => stampEye(s, ['K..K', '.KK.']));
    else if (eyesState === 'blink') mirror(s => stampEye(s, ['KKKK']));
    else if (eyesState === 'happy') mirror(s => stampEye(s, ['.KK.', 'K..K']));
    else if (eyesState === 'heart') mirror(s => stampEye(s, ['.R.R.', 'RRRRR', '.RRR.', '..R..']));
    else if (eyesState === 'star') mirror(s => stampEye(s, ['..Y..', '.YYY.', 'YYWYY', '.Y.Y.']));
    else if (eyesState === 'dizzy') mirror(s => stampEye(s, ['K.K', '.K.', 'K.K']));
    else if (eyesState === 'wide') mirror(s => stampEye(s, ['.KK.', 'KWWK', 'KWKK', '.KK.']));
    // cheeks
    if (g.cheeks !== false && eyesState !== 'sleep') mirror(s => { const cxp = s < 0 ? fx - eyeDX - 4 : fx + eyeDX + 2; P.stamp(cxp, eyeY + 2 + (g.eyes === 'round' ? 1 : 0), ['CC'], { C: 'C' }); });
    // mouth
    const M = st.mouth || 'default';
    const mx = fx - 3;
    const MOUTH = {
      cat: ['..NN..', 'K.KK.K', '.K..K.'], smile: ['K....K', '.KKKK.'], fang: ['K....K', '.KKKK.', '....W.'],
      snout: ['.NNNN.', '..NN..', '.K..K.'], teeth: ['..NN..', '..KK..', '.KWWK.', '..WW..'], beak: ['.BBBB.', '..BB..'],
    };
    const mm = { K: 'K', N: g.mouth === 'snout' ? 'K' : 'N', W: 'W', B: 'Bk', R: 'R', T: 'T' };
    if (M === 'default') { let rows = MOUTH[g.mouth] || MOUTH.smile; if (g.mouth === 'snout') rows = ['.NNNN.', '..NN..', '.K..K.']; P.stamp(mx, mouthY - (g.mouth === 'cat' || g.mouth === 'teeth' || g.mouth === 'snout' ? 1 : 0), rows, mm); if (g.mouth === 'snout') P.px(mx + 2, mouthY - 1, 'W', 'face'); }
    else {
      const beak = g.mouth === 'beak';
      if (beak) P.stamp(mx, mouthY - 1, M === 'open' || M === 'laugh' ? ['.BBBB.', '.KRRK.', '..BB..'] : ['.BBBB.', '..BB..'], mm);
      else {
        const nose = g.mouth === 'cat' || g.mouth === 'teeth' ? ['..NN..'] : g.mouth === 'snout' ? ['.NNNN.', '..NN..'] : [];
        const body2 = M === 'open' ? ['..KK..', '.KRRK.', '.KTTK.', '..KK..'] : M === 'laugh' ? ['.KKKK.', '.KRRK.', '..TT..'] : M === 'chew' ? ['.K..K.', '..KK..'] : M === 'o' ? ['..KK..', '.K..K.', '..KK..'] : ['K....K', '.KKKK.'];
        P.stamp(mx, mouthY - nose.length, nose.concat(body2), mm);
      }
    }
    // head highlight
    if (body !== 'ghost') { const hx0 = Math.round(hx - hrx * .55), hy0 = Math.round(hy - hry * .62); if (P.get(hx0, hy0) === 'B') { P.recolor((x, y, m, r, i) => (Math.floor(x) === hx0 && Math.floor(y) === hy0) || (Math.floor(x) === hx0 + 1 && Math.floor(y) === hy0 - 1 && P.get(hx0 + 1, hy0 - 1) === 'B'), 'Hi'); } }

    /* --- hair --- */
    if (g.hair === 'tuft') { P.poly([[hx - 3, top + 2.5], [hx - 1.5, top - 3], [hx + .5, top + 1.5]], 'B', 'hair'); P.poly([[hx - .5, top + 2], [hx + 2, top - 4], [hx + 3, top + 2.5]], 'B', 'hair'); }
    if (g.hair === 'curl') { P.bez([hx - 1, top + 2], [hx - 1.5, top - 2], [hx + 2, top - 2.5], t => 1.6 - t * .9, 'B', 'hair'); }
    if (g.hair === 'mane') { P.ell(hx - hrx * .35, top + 1, 4.2, 2.8, 'P', 'mane2'); P.ell(hx - hrx * .65, top + 2.8, 3, 3, 'P', 'mane2'); }

    /* --- extras --- */
    const X = g.extra;
    if (X === 'horns') mirror(s => { const bx = hx + s * hrx * .38; P.poly([[bx - s * 2.2, top + 2.5], [bx + s * 2.4, top + 1.5], [bx + s * 1.8, top - 5 * S]], 'G', 'horn'); });
    if (X === 'antlers') mirror(s => { const bx = hx + s * hrx * .42, by = top + 1.5, k = stage === 'baby' ? .6 : stage === 'kid' ? .8 : 1; P.line(bx, by, bx + s * 3 * k, by - 8 * k, 1, 'G', 'horn'); P.line(bx + s * 1.2 * k, by - 3.5 * k, bx + s * 6 * k, by - 5.5 * k, .9, 'G', 'horn'); P.line(bx + s * 2.6 * k, by - 6 * k, bx + s * .2 * k, by - 10 * k, .85, 'G', 'horn'); });
    if (X === 'uhorn') { const k = stage === 'baby' ? .7 : stage === 'kid' ? .85 : 1; P.poly([[hx - 2.4, top + 2.5], [hx + 2.4, top + 2.5], [hx + .5, top - 8 * k]], (x, y) => (Math.floor(y + x * .6) % 3 === 0 ? 'G2' : 'G'), 'horn'); }
    if (X === 'antenna') { P.line(hx + .5, top + 1, hx + 2.5, top - 6, .7, 'B', 'ant'); P.ell(hx + 3, top - 7.5, 2.2, 2.2, 'A', 'antb'); }
    if (X === 'sprout') { P.line(hx + .5, top + 1, hx + .5, top - 4, .7, '#5aa04a', 'sp'); P.rell(hx - 2.5, top - 4.5, 3.2, 1.7, .5, '#79c96b', 'leaf'); P.rell(hx + 3.5, top - 5.5, 3.2, 1.7, -.5, '#8fe08a', 'leaf'); }
    if (X === 'crown') { P.poly([[hx - 5, top + 2.5], [hx - 5, top - 3], [hx - 2.5, top - .5], [hx + .5, top - 4.5], [hx + 3.5, top - .5], [hx + 6, top - 3], [hx + 6, top + 2.5]], 'Au', 'crown'); P.px(Math.round(hx), Math.round(top), 'R', 'gem'); }
    if (X === 'halo') { const oy = top - 5; P.shape((x, y) => { const v = ((x - hx - .5) / 7) ** 2 + ((y - oy) / 2.2) ** 2; return v <= 1 && v >= .38; }, hx - 8, oy - 3, hx + 8, oy + 3, 'Au', 'halo'); }

    /* --- outfit --- */
    const o = st.outfit || {};
    if (o.neck) drawNeck(P, o.neck, { cx, y: body === 'bird' ? bodyCy - 1 : body === 'blob' || body === 'ghost' ? hy + hry * .62 : bodyCy - bry + 2, w: (body === 'bird' || body === 'blob' || body === 'ghost') ? hrx * .78 : brx * .9 });
    if (o.glasses) drawGlasses(P, o.glasses, { fx, eyeY, eyeDX });
    if (o.hat) drawHat(P, o.hat, { hx, top: top + (E === 'bunny' ? 1 : 0), hrx, S });

    const pal = palette(g);
    return { pix: P, pal, anchors: { headTop: top, hx, hy, eyeY, mouthY, bodyCy, ground, hrx, earTipY } };
  }
  function palette(g) {
    const c = g.colors || {};
    const base = c.base || '#f6d7a7';
    return {
      B: base, E1: g.ears === 'floppy' && g.pattern !== 'patches' ? mix(base, c.pattern || base, g.pattern === 'tips' || g.pattern === 'spots' ? .75 : .25) : base,
      L: c.belly || '#fff8ec', P: c.pattern || dark(base, .5), A: c.accent || '#ff9db5', G: c.horn || '#ffe08a', G2: dark(c.horn || '#ffe08a', .3),
      F: mix(c.accent || '#c9a7f2', '#ffffff', .45), Sh: dark(c.accent || '#b07a4a', .35),
      K: INK, E: c.eye || INK, E2: light(c.eye || INK, .55), W: '#ffffff', C: '#ff8fa8', N: '#ff7a96', R: '#ff4d7a', T: '#ff8fa3', Bk: c.horn && g.mouth === 'beak' ? c.horn : '#ffb534',
      Hi: light(base, .62), Au: '#ffd23f', Y: '#ffd23f',
    };
  }
  /* --- outfits --- */
  const HATS = { party: 'Party hat', beanie: 'Beanie', cap: 'Ball cap', tophat: 'Top hat', flower: 'Flower crown', bow: 'Big bow', wizard: 'Wizard hat', chef: 'Chef hat' };
  const GLASSES = { round: 'Round specs', shades: 'Cool shades', heart: 'Heart glasses', nerd: 'Square specs' };
  const NECKS = { scarf: 'Cozy scarf', bowtie: 'Bow tie', bandana: 'Bandana', bell: 'Bell collar' };
  function drawHat(P, id, a) {
    const { hx, top } = a; const t = Math.round(top);
    if (id === 'party') { P.poly([[hx - 5.5, t + 3], [hx + 5.5, t + 3], [hx + 1.5, t - 10]], (x, y) => (Math.floor(y) % 4 < 2 ? '#ff6fa3' : '#ffd23f'), 'hat'); P.ell(hx + 1.5, t - 10.5, 2, 2, '#7fd6ff', 'hat2'); }
    if (id === 'beanie') { P.ell(hx, t + 2, 8.5, 7, '#5aa6e8', 'hat', { clip: (x, y) => y < t + 2 }); P.rect(Math.round(hx - 9), t + 1, 18, 3, (x) => (x % 2 ? '#e9f4ff' : '#cfe4ff'), 'hat2'); P.ell(hx, t - 5.5, 2.4, 2.4, '#ffffff', 'hat3'); }
    if (id === 'cap') { P.ell(hx, t + 2.5, 8, 6.5, '#ff6b5a', 'hat', { clip: (x, y) => y < t + 2.5 }); P.rect(Math.round(hx), t + 1, 13, 2, '#e04a3a', 'brim'); P.px(Math.round(hx), t - 4, '#ffffff', 'b'); P.rect(Math.round(hx - 7), t - 1, 4, 1, '#ffffff', 'logo'); }
    if (id === 'tophat') { P.rect(Math.round(hx - 5), t - 9, 10, 11, '#3b3346', 'hat'); P.rect(Math.round(hx - 5), t - 1, 10, 2, '#ff6fa3', 'band'); P.rect(Math.round(hx - 9), t + 2, 18, 2, '#2b2433', 'brim'); }
    if (id === 'flower') { const cols = ['#ff8fb1', '#ffd23f', '#9fd8ff', '#ff8fb1', '#c9a7f2']; for (let i = 0; i < 5; i++) { const fxp = hx - 8 + i * 4, fy = t + 1.5 + Math.abs(i - 2) * 1.2; P.ell(fxp, fy, 2.2, 2.2, cols[i], 'fl' + i); P.px(Math.round(fxp - .5), Math.round(fy - .5), '#fff6c0', 'fc' + i); } }
    if (id === 'bow') { const bx = hx + 5, by = t + 1; P.poly([[bx, by], [bx - 7, by - 5], [bx - 7, by + 4]], '#ff5f8f', 'bow'); P.poly([[bx, by], [bx + 7, by - 5], [bx + 7, by + 4]], '#ff5f8f', 'bow2'); P.ell(bx, by, 2, 2, '#ff8fb1', 'knot'); }
    if (id === 'wizard') { P.poly([[hx - 6, t + 2], [hx + 6, t + 2], [hx + 4, t - 7], [hx + 9, t - 12], [hx, t - 9]], '#7a5ad0', 'hat'); P.rect(Math.round(hx - 10), t + 1, 20, 2, '#5b3fb0', 'brim'); P.px(Math.round(hx - 2), t - 3, '#ffd23f', 's1'); P.px(Math.round(hx + 2), t - 1, '#ffd23f', 's2'); P.px(Math.round(hx + 1), t - 6, '#fff6c0', 's3'); }
    if (id === 'chef') { P.ell(hx - 3.5, t - 4, 4, 4, '#ffffff', 'c1'); P.ell(hx + 3.5, t - 4, 4, 4, '#ffffff', 'c2'); P.ell(hx, t - 6, 4.2, 4, '#ffffff', 'c3'); P.rect(Math.round(hx - 6), t - 2, 12, 4, '#f2f2f7', 'band'); }
  }
  function drawGlasses(P, id, a) {
    const { fx, eyeY, eyeDX } = a;
    if (id === 'round') { for (const s of [-1, 1]) { const ex = fx + s * eyeDX; P.shape((x, y) => { const d = Math.hypot(x - ex, y - eyeY - .5); return d <= 4 && d >= 3; }, ex - 5, eyeY - 5, ex + 5, eyeY + 5, 'K', 'gl'); } P.rect(fx - eyeDX + 4, eyeY - 1, 2 * eyeDX - 8, 1, 'K', 'glb'); }
    if (id === 'shades') { for (const s of [-1, 1]) { const ex = fx + s * eyeDX; P.ell(ex, eyeY + .5, 4, 3, '#2b2433', 'gl', { shade: false }); P.px(Math.round(ex - 2), eyeY - 1, '#9aa3ad', 'gs'); } P.rect(fx - eyeDX + 3, eyeY - 1, 2 * eyeDX - 6, 1, '#2b2433', 'glb'); }
    if (id === 'heart') { for (const s of [-1, 1]) { const ex = Math.round(fx + s * eyeDX); P.stamp(ex - 3, eyeY - 2, ['.RR.RR', 'RRRRRR', 'RRRRRR', '.RRRR.', '..RR..'], { R: '#ff5f8f' }, 'gl'); P.px(ex - 2, eyeY - 1, '#ffd0de', 'gs'); } P.rect(fx - eyeDX + 3, eyeY - 1, 2 * eyeDX - 6, 1, '#ff5f8f', 'glb'); }
    if (id === 'nerd') { for (const s of [-1, 1]) { const ex = Math.round(fx + s * eyeDX); P.stamp(ex - 4, eyeY - 3, ['KKKKKKK', 'K.....K', 'K.....K', 'K.....K', 'K.....K', 'KKKKKKK'], { K: '#3a2a5a' }, 'gl'); } P.rect(fx - eyeDX + 3, eyeY - 2, 2 * eyeDX - 6, 1, '#3a2a5a', 'glb'); }
  }
  function drawNeck(P, id, a) {
    const { cx, y, w } = a; const yy = Math.round(y);
    if (id === 'scarf') { P.ell(cx, yy, w + 1, 2.6, (x) => (Math.floor(x) % 4 < 2 ? '#ff6b5a' : '#ffd23f'), 'scarf'); P.rect(Math.round(cx + w * .3), yy + 1, 3, 6, (x, y) => (y % 3 === 0 ? '#ffd23f' : '#ff6b5a'), 'scarf2'); }
    if (id === 'bowtie') { P.poly([[cx, yy + 1], [cx - 5, yy - 2], [cx - 5, yy + 4]], '#ff5f8f', 'bt'); P.poly([[cx, yy + 1], [cx + 5, yy - 2], [cx + 5, yy + 4]], '#ff5f8f', 'bt2'); P.rect(Math.round(cx - 1), yy, 2, 2, '#d93f6f', 'k'); }
    if (id === 'bandana') { P.poly([[cx - w, yy - 1], [cx + w, yy - 1], [cx, yy + 7]], '#4a90e2', 'bd'); for (const [dx, dy] of [[-4, 1], [2, 1], [-1, 3], [0, 0], [4, 0]]) P.px(Math.round(cx + dx), yy + dy, '#e6f2ff', 'dot'); }
    if (id === 'bell') { P.rect(Math.round(cx - w), yy - 1, Math.round(2 * w), 2, '#e0475a', 'col'); P.ell(cx, yy + 2.5, 2.4, 2.4, '#ffd23f', 'bell'); P.px(Math.round(cx - .5), yy + 3, '#8a6a10', 'bk'); }
  }

  /* ---------------- Genome helpers ---------------- */
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  function presetGenome(id, palIdx) {
    const p = PRESETS[id] || PRESETS.cat; const pal = p.pals[(palIdx || 0) % p.pals.length];
    return Object.assign({ base: id, colors: Object.assign({}, pal) }, JSON.parse(JSON.stringify(p.g)));
  }
  function randomGenome(seed, rarity) {
    const r = rng(seed || (Math.random() * 1e9));
    rarity = rarity || 'common';
    const ids = Object.keys(PRESETS);
    const a = pick(r, ids);
    let g = presetGenome(a, Math.floor(r() * 9));
    if (rarity === 'common') return g;
    if (rarity === 'rare') { // preset with a dreamy recolor
      g.colors.base = pick(r, SWATCHES.base); g.colors.accent = pick(r, SWATCHES.accent); if (r() < .5) g.colors.pattern = pick(r, SWATCHES.pattern);
      return g;
    }
    // epic & legendary: hybrids built from parts
    const b = presetGenome(pick(r, ids), Math.floor(r() * 9));
    const keys = ['body', 'head', 'ears', 'tail', 'pattern', 'eyes', 'mouth', 'extra', 'hair', 'wings'];
    for (const k of keys) if (r() < .45) g[k] = b[k];
    if (g.ears === 'bumps' && g.body !== 'chibi') g.ears = 'round';
    g.base = 'mix';
    g.colors = r() < .5 ? Object.assign({}, b.colors) : g.colors;
    if (r() < .6) g.colors.base = pick(r, SWATCHES.base);
    g.colors.accent = pick(r, SWATCHES.accent);
    if (rarity === 'legendary') { if (g.wings === 'none') g.wings = pick(r, ['feather', 'fairy', 'bat']); if (g.extra === 'none' || r() < .5) g.extra = pick(r, ['crown', 'halo', 'uhorn', 'horns']); g.eyes = 'sparkle'; g.colors.horn = pick(r, ['#ffd65a', '#ffd1f0', '#b8e0ff']); }
    return g;
  }
  function mystery(seed) { const r = rng(seed); const t = r(); return randomGenome(Math.floor(r() * 1e9), t < .45 ? 'rare' : t < .85 ? 'epic' : 'legendary'); }

  /* ---------------- Render + cache ---------------- */
  const cache = new Map();
  function renderPet(g, st, scale) {
    st = st || {}; scale = scale || 1;
    const key = JSON.stringify([g, st, scale]);
    let c = cache.get(key); if (c) return c;
    const { pix, pal } = creature(g, st);
    c = toCanvas(pix.render(pal), GW, GH, scale);
    cache.set(key, c); if (cache.size > 500) cache.delete(cache.keys().next().value);
    return c;
  }
  function anchors(g, st) { return creature(g, st || {}).anchors; }

  /* ---------------- Items ---------------- */
  function item(w, h, draw, pal) { const P = new Pix(w, h); draw(P); return toCanvas(P.render(pal || {}, { inner: true }), w, h); }
  const ITEMS = {
    // food
    apple: { kind: 'food', name: 'Red apple', price: 0, tags: ['fruit'], fill: 18, draw: P => { P.ell(10, 11, 6, 5.6, '#ff5a5a'); P.ell(7.5, 9, 1.4, 1.2, '#ffc2c2', 'hl', { shade: false }); P.line(10, 6, 11, 3, .7, '#7a4a2a', 'st'); P.rell(13, 4, 2.6, 1.3, -.4, '#6cd36b', 'lf'); } },
    carrot: { kind: 'food', name: 'Crunchy carrot', price: 6, tags: ['veg'], fill: 16, draw: P => { P.poly([[6, 6], [14, 6], [10.5, 18]], '#ff9a3c'); P.px(9, 9, '#d9702a'); P.px(11, 12, '#d9702a'); P.rell(8, 3.5, 1.5, 3, -.3, '#6cd36b', 'l1'); P.rell(12, 3.5, 1.5, 3, .3, '#4fb04f', 'l2'); } },
    fish: { kind: 'food', name: 'Little fish', price: 10, tags: ['fish'], fill: 26, draw: P => { P.ell(9, 10, 6.5, 4, '#7fb6ff'); P.poly([[14, 10], [19, 6], [19, 14]], '#5a90e0', 'tl'); P.px(6, 9, '#2b1d3a'); P.ell(9, 11.5, 4, 1.2, '#d6ecff', 'bl', { shade: false }); } },
    cookie: { kind: 'food', name: 'Choco cookie', price: 8, tags: ['sweet'], fill: 14, draw: P => { P.ell(10, 10, 7, 6.5, '#e0a35a'); for (const [x, y] of [[7, 8], [12, 7], [9, 12], [13, 12], [6, 11]]) P.rect(x, y, 2, 1, '#6b3a22', 'c'); } },
    berries: { kind: 'food', name: 'Berry bunch', price: 7, tags: ['fruit'], fill: 14, draw: P => { for (const [x, y] of [[7, 11], [12, 11], [9.5, 14.5], [9.5, 8]]) P.ell(x, y, 3, 3, '#7a5ad0', 'b' + x + y); P.rell(10, 4.5, 3, 1.4, .2, '#6cd36b', 'l'); } },
    cheese: { kind: 'food', name: 'Cheese wedge', price: 9, tags: ['dairy'], fill: 20, draw: P => { P.poly([[3, 15], [17, 15], [17, 7]], '#ffd84a'); P.ell(12, 12.5, 1.3, 1.3, '#e8b62a', 'h1', { shade: false }); P.px(15, 10, '#e8b62a'); } },
    sushi: { kind: 'food', name: 'Salmon sushi', price: 14, tags: ['fish'], fill: 28, draw: P => { P.ell(10, 13, 7, 3.5, '#ffffff'); P.ell(10, 9.5, 7.5, 3, '#ff9a6b'); for (const x of [6, 9, 12, 15]) P.rect(x, 8, 1, 3, '#ffd2b8', 'st' + x); } },
    cake: { kind: 'food', name: 'Strawberry cake', price: 20, tags: ['sweet'], fill: 30, draw: P => { P.rect(4, 9, 13, 8, '#fff2e6'); P.rect(4, 12, 13, 2, '#ff8fb1', 'jam'); P.rect(4, 8, 13, 2, '#ffffff', 'cr'); P.ell(10.5, 6, 2.5, 2.5, '#ff4d6a', 'sb'); P.px(10, 3, '#6cd36b'); } },
    icecream: { kind: 'food', name: 'Ice cream', price: 12, tags: ['sweet', 'dairy'], fill: 16, draw: P => { P.poly([[5, 9], [15, 9], [10, 19]], (x, y) => ((x + y) % 3 === 0 ? '#c98a4a' : '#e8b06a')); P.ell(10, 7, 5.5, 4.5, '#ffb3d1'); P.px(8, 5, '#ffffff'); P.ell(10, 2.5, 1.5, 1.5, '#ff4d6a', 'ch'); } },
    honey: { kind: 'food', name: 'Honey pot', price: 15, tags: ['sweet'], fill: 22, draw: P => { P.ell(10, 12, 7, 6, '#f2a43a'); P.rect(5, 5, 10, 3, '#c97a2a', 'lid'); P.ell(10, 8, 6, 1.6, '#ffd23f', 'drip'); P.rect(7, 12, 6, 3, '#fff2c8', 'lab'); } },
    pizza: { kind: 'food', name: 'Pizza slice', price: 16, tags: ['meal'], fill: 30, draw: P => { P.poly([[3, 4], [17, 4], [10, 18]], '#ffd27a'); P.rect(3, 3, 15, 2, '#d9903a', 'crust'); for (const [x, y] of [[8, 7], [12, 8], [10, 12]]) P.ell(x, y, 1.4, 1.4, '#e0474a', 'pp' + x); } },
    donut: { kind: 'food', name: 'Sprinkle donut', price: 11, tags: ['sweet'], fill: 18, draw: P => { P.shape((x, y) => { const d = Math.hypot(x - 10, y - 10); return d <= 7 && d >= 2.4; }, 2, 2, 18, 18, (x, y) => (y < 11 ? ((x * 7 + y * 3) % 11 === 0 ? '#7fd6ff' : (x * 5 + y) % 13 === 0 ? '#ffd23f' : '#ff8fb1') : '#e0a35a'), 'd', (x, y) => (y > 13 ? -1 : y < 6 ? 1 : 0)); } },
    // toys
    ball: { kind: 'toy', name: 'Bouncy ball', price: 0, draw: P => { P.ell(10, 10, 6.5, 6.5, (x, y) => (Math.abs(y - 10) < 1.5 ? '#ffffff' : '#ff5a6a')); } },
    yarn: { kind: 'toy', name: 'Yarn ball', price: 25, draw: P => { P.ell(10, 10, 6.5, 6.5, (x, y) => ((x + y * 2) % 5 === 0 ? '#c76ad9' : '#e59af2')); P.line(15, 14, 19, 18, .6, '#c76ad9', 'th'); } },
    frisbee: { kind: 'toy', name: 'Frisbee', price: 35, draw: P => { P.ell(10, 10, 8, 4, '#4fc3a1'); P.ell(10, 9, 4, 1.8, '#8ef0d0', 'c', { shade: false }); } },
    duck: { kind: 'toy', name: 'Rubber duck', price: 30, draw: P => { P.ell(10, 13, 7, 4.5, '#ffd23f'); P.ell(7, 8, 4, 3.8, '#ffd23f', 'h'); P.rect(2, 8, 3, 2, '#ff9a3c', 'b'); P.px(6, 7, '#2b1d3a'); } },
    plush: { kind: 'toy', name: 'Star plushie', price: 40, draw: P => { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.6 : 8; pts.push([10 + Math.cos(a) * r, 11 + Math.sin(a) * r]); } P.poly(pts, '#ffd23f'); P.px(8, 10, '#2b1d3a'); P.px(11, 10, '#2b1d3a'); P.px(7, 12, '#ff8fa8'); P.px(12, 12, '#ff8fa8'); } },
  };
  const FURN = {
    plant: { name: 'Potted plant', price: 40, w: 20, h: 26, layer: 'floor', draw: P => { P.rect(6, 17, 9, 8, '#e07a4a'); P.rect(5, 16, 11, 2, '#c95f35', 'rim'); P.rell(7, 10, 2.6, 6, -.5, '#5fbf5a', 'l1'); P.rell(14, 10, 2.6, 6, .5, '#4fa84a', 'l2'); P.rell(10.5, 7, 2.6, 7, 0, '#6fd36a', 'l3'); } },
    lamp: { name: 'Floor lamp', price: 55, w: 16, h: 40, layer: 'floor', draw: P => { P.poly([[2, 10], [14, 10], [11, 1], [5, 1]], '#ffd27a'); P.rect(7, 10, 2, 26, '#7a5a4a', 'pole'); P.ell(8, 37, 5, 2, '#5b4636', 'base'); } },
    bed: { name: 'Cozy pet bed', price: 70, w: 36, h: 18, layer: 'floor', draw: P => { P.ell(18, 11, 17, 6.5, '#7aa7ff'); P.ell(18, 10, 12, 3.6, '#dbe8ff', 'cush'); P.ell(18, 15, 16, 2.4, '#5a86e0', 'base'); } },
    rug: { name: 'Round rug', price: 45, w: 48, h: 14, layer: 'rug', draw: P => { P.ell(24, 7, 23, 6.2, (x, y) => { const d = ((x - 24) / 23) ** 2 + ((y - 7) / 6.2) ** 2; return d > .62 ? '#ff9fb8' : d > .3 ? '#fff0d6' : '#ffc96b'; }, 'rug', { shade: false }); } },
    shelf: { name: 'Bookshelf', price: 90, w: 26, h: 36, layer: 'floor', draw: P => { P.rect(1, 1, 24, 34, '#a8744f'); P.rect(3, 3, 20, 9, '#5b3a2e', 'i1'); P.rect(3, 14, 20, 9, '#5b3a2e', 'i2'); P.rect(3, 25, 20, 8, '#5b3a2e', 'i3'); const cols = ['#ff6b6b', '#4ecdc4', '#ffd166', '#9b7be0', '#86c5ff', '#ff8fb1']; let i = 0; for (const yy of [3, 14]) for (let x = 4; x < 21; x += 3) { P.rect(x, yy + 1 + (i % 3 === 0 ? 1 : 0), 2, 8 - (i % 3 === 0 ? 1 : 0), cols[i % 6], 'bk' + i); i++; } P.ell(13, 30, 4, 3, '#79c96b', 'pl'); } },
    beanbag: { name: 'Beanbag', price: 60, w: 28, h: 20, layer: 'floor', draw: P => { P.ell(14, 12, 13, 7.5, '#ffb347'); P.ell(10, 8, 6, 3, '#ffd08a', 'h', { shade: false }); } },
    fishbowl: { name: 'Fish bowl', price: 75, w: 20, h: 22, layer: 'floor', draw: P => { P.rect(3, 17, 14, 4, '#8b5a3c'); P.ell(10, 10, 8, 7.5, '#bfe9ff', 'g', { shade: false }); P.ell(10, 12, 7, 5, '#7fd0ff', 'w', { shade: false }); P.ell(9, 12, 2.4, 1.5, '#ff8a3c', 'f'); P.px(13, 12, '#ff8a3c'); P.px(6, 6, '#ffffff'); } },
    tower: { name: 'Climbing tower', price: 120, w: 26, h: 46, layer: 'floor', draw: P => { P.rect(10, 6, 5, 36, (x, y) => (y % 3 === 0 ? '#c9a07a' : '#e0bf94'), 'post'); P.ell(12.5, 7, 11, 3, '#9b7be0', 'p1'); P.ell(12.5, 24, 9, 2.6, '#9b7be0', 'p2'); P.rect(2, 41, 22, 4, '#7a5ad0', 'base'); P.line(5, 9, 5, 14, .5, '#ffd23f', 'str'); P.ell(5, 15, 1.6, 1.6, '#ff8fb1', 'pom'); } },
    poster: { name: 'Star poster', price: 30, w: 20, h: 24, layer: 'wall', draw: P => { P.rect(1, 1, 18, 22, '#3a3f7a'); for (const [x, y] of [[5, 5], [14, 7], [9, 12], [5, 17], [14, 18]]) P.px(x, y, '#ffe08a'); P.ell(10, 12, 3, 3, '#ffd23f', 'st'); } },
    clock: { name: 'Wall clock', price: 35, w: 18, h: 18, layer: 'wall', draw: P => { P.ell(9, 9, 8, 8, '#ff8fb1'); P.ell(9, 9, 6, 6, '#fffaf0', 'f', { shade: false }); P.rect(9, 5, 1, 4, '#2b1d3a', 'h'); P.rect(9, 9, 3, 1, '#2b1d3a', 'm'); } },
    lights: { name: 'String lights', price: 50, w: 60, h: 10, layer: 'wall', draw: P => { for (let x = 1; x < 59; x++) P.px(x, Math.round(2 + Math.sin(x / 59 * Math.PI) * 3), '#3d5a3d'); const cols = ['#ffd23f', '#ff8fb1', '#7fd6ff', '#8fe08a']; for (let i = 0; i < 7; i++) { const x = 4 + i * 8.5; P.ell(x, 4.5 + Math.sin(x / 59 * Math.PI) * 3, 1.5, 2, cols[i % 4], 'b' + i, { shade: false }); } } },
    painting: { name: 'Sunny painting', price: 45, w: 26, h: 20, layer: 'wall', draw: P => { P.rect(0, 0, 26, 20, '#c9925c'); P.rect(2, 2, 22, 16, '#bfe9ff', 'sky'); P.ell(13, 20, 14, 7, '#79c96b', 'hill', { shade: false }); P.ell(19, 7, 3, 3, '#ffd23f', 'sun', { shade: false }); } },
    toybox: { name: 'Toy box', price: 40, w: 24, h: 18, layer: 'floor', draw: P => { P.rect(1, 6, 22, 11, '#ff7a6b'); P.rect(1, 9, 22, 2, '#ffd23f', 'band'); P.ell(7, 5, 3, 3, '#7fd6ff', 'b1'); P.ell(15, 4, 3.5, 3.5, '#ffd23f', 'b2'); } },
    cactus: { name: 'Tiny cactus', price: 20, w: 14, h: 20, layer: 'floor', draw: P => { P.rect(3, 13, 8, 6, '#e8a87a'); P.ell(7, 8, 3.5, 6, '#5fbf5a'); P.ell(3, 8, 1.5, 2.5, '#5fbf5a', 'a1'); P.px(7, 2, '#ff8fb1'); } },
  };
  const WALLPAPERS = { cream: { name: 'Cream stripes', price: 0, a: '#fbe9cf', b: '#f6dfbf', kind: 'stripe' }, mint: { name: 'Mint dots', price: 60, a: '#d9f5ea', b: '#bfe9d8', kind: 'dots' }, berry: { name: 'Berry check', price: 60, a: '#ffe1ea', b: '#ffd0de', kind: 'check' }, night: { name: 'Starry blue', price: 80, a: '#3a4a8a', b: '#4a5ba0', kind: 'stars' }, lilac: { name: 'Lilac waves', price: 70, a: '#ece2ff', b: '#dccdfb', kind: 'wave' } };
  const FLOORS = { wood: { name: 'Honey wood', price: 0, a: '#d79a62', b: '#c7884f' }, tile: { name: 'Checker tile', price: 50, a: '#f5f0ff', b: '#d8cff0' }, grass: { name: 'Grass carpet', price: 60, a: '#9ad67a', b: '#8ac96a' }, carpet: { name: 'Plush carpet', price: 50, a: '#c99ad6', b: '#bd8acb' } };
  const ICONCACHE = new Map();
  function itemCanvas(id) {
    if (ICONCACHE.has(id)) return ICONCACHE.get(id);
    let c; const it = ITEMS[id], f = FURN[id];
    if (it) c = item(20, 20, it.draw); else if (f) c = item(f.w, f.h, f.draw);
    ICONCACHE.set(id, c); return c;
  }
  /* small fx sprites */
  const SPR = {
    heart: ['.RR.RR.', 'RWRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'],
    star: ['...Y...', '..YYY..', 'YYYWYYY', '.YYYYY.', '.YY.YY.', 'Y.....Y'],
    sparkle: ['..W..', '..W..', 'WWYWW', '..W..', '..W..'],
    note: ['..KKK', '..K.K', '..K..', 'KKK..', 'KKK..'],
    coin: ['.YYYY.', 'YYWYYY', 'YWYYOY', 'YYYYOY', 'YYYOOY', '.YYYY.'],
    drop: ['..B..', '.BBB.', 'BBWBB', 'BBBBB', '.BBB.'],
    crumb: ['OO', 'OO'],
    bubble: ['.bbb.', 'bWccb', 'bcccb', 'bcccb', '.bbb.'],
    z: ['KKKK', '..K.', '.K..', 'KKKK'],
    excl: ['RR', 'RR', 'RR', '..', 'RR'],
    q: ['.BBB.', 'B...B', '...B.', '..B..', '.....', '..B..'],
    angry: ['R.R', '.R.', 'R.R'],
  };
  const SPRCOL = { R: '#ff5f8f', W: '#ffffff', Y: '#ffd23f', O: '#e09a2a', K: '#5a4a8a', B: '#6fc3ff', b: '#a8dcff', c: '#e8f7ff' };
  const SPRC = new Map();
  function sprite(name, scale, tint) {
    const k = name + scale + (tint || ''); if (SPRC.has(k)) return SPRC.get(k);
    const rows = SPR[name]; const w = rows[0].length + 2, h = rows.length + 2; const cols = new Array(w * h).fill(null);
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const ch = r[x]; if (ch !== '.') cols[(y + 1) * w + x + 1] = (tint && ch !== 'W') ? tint : SPRCOL[ch]; } });
    if (name !== 'crumb' && name !== 'z' && name !== 'note') { const base = cols.slice(); for (let i = 0; i < w * h; i++) { if (base[i]) continue; const x = i % w, y = (i / w) | 0; for (const [a, b] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const nx = x + a, ny = y + b; if (nx >= 0 && ny >= 0 && nx < w && ny < h && base[ny * w + nx]) { cols[i] = outlineOf(base[ny * w + nx]); break; } } } }
    const c = toCanvas(cols, w, h, scale || 1); SPRC.set(k, c); return c;
  }
  /* ---------------- Room painter (logical px) ---------------- */
  function drawRoom(ctx, W, H, o) {
    o = o || {}; const floorY = o.floorY || Math.round(H * .62); const hour = o.hour == null ? new Date().getHours() + new Date().getMinutes() / 60 : o.hour;
    const wp = WALLPAPERS[o.wall || 'cream'] || WALLPAPERS.cream, fl = FLOORS[o.floor || 'wood'] || FLOORS.wood;
    const night = hour < 6 || hour >= 19.5, dusk = (hour >= 17.5 && hour < 19.5) || (hour >= 6 && hour < 7.5);
    const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    // wall
    R(0, 0, W, floorY, wp.a);
    if (wp.kind === 'stripe') for (let x = 0; x < W; x += 12) R(x, 0, 5, floorY, wp.b);
    if (wp.kind === 'dots') for (let y = 4; y < floorY; y += 10) for (let x = (y / 10 % 2 ? 5 : 0) + 2; x < W; x += 10) R(x, y, 2, 2, wp.b);
    if (wp.kind === 'check') for (let y = 0; y < floorY; y += 8) for (let x = ((y / 8) % 2) * 8; x < W; x += 16) R(x, y, 8, 8, wp.b);
    if (wp.kind === 'stars') for (let i = 0; i < 60; i++) { const x = (i * 37) % W, y = (i * 53) % floorY; R(x, y, 1, 1, '#ffe08a'); if (i % 5 === 0) { R(x - 1, y, 3, 1, '#ffe08a'); R(x, y - 1, 1, 3, '#ffe08a'); } }
    if (wp.kind === 'wave') for (let y = 6; y < floorY; y += 12) for (let x = 0; x < W; x++) R(x, y + Math.round(Math.sin(x / 4) * 1.5), 1, 2, wp.b);
    // wainscot
    R(0, floorY - 26, W, 26, mix(wp.a, '#ffffff', .25)); R(0, floorY - 27, W, 2, mix(wp.b, '#8b5a3c', .35));
    for (let x = 6; x < W; x += 22) R(x, floorY - 22, 16, 18, mix(wp.a, '#000000', .04));
    R(0, floorY - 4, W, 4, mix(fl.b, '#3d2a6b', .3));
    // window
    const wx = o.winX == null ? Math.round(W * .08) : o.winX, wy = o.winY == null ? Math.round(floorY * .2) : o.winY, ww = o.winW || Math.round(Math.min(56, W * .42)), wh = o.winH || Math.round(floorY * .34);
    let sky1, sky2; if (night) { sky1 = '#1d1b4a'; sky2 = '#3b2f7a'; } else if (dusk) { sky1 = '#ff9f7a'; sky2 = '#ffd39a'; } else { sky1 = '#7fc8ff'; sky2 = '#c6ecff'; }
    R(wx - 3, wy - 3, ww + 6, wh + 6, '#fff8ee'); R(wx - 3, wy + wh + 1, ww + 6, 3, '#e8d6bb');
    for (let y = 0; y < wh; y++) R(wx, wy + y, ww, 1, mix(sky1, sky2, y / wh));
    if (night) { for (let i = 0; i < 14; i++) R(wx + (i * 17) % ww, wy + (i * 11) % (wh - 8), 1, 1, '#fff6c0'); ctx.fillStyle = '#fff3c0'; ctx.beginPath(); ctx.arc(wx + ww * .72, wy + wh * .3, 5, 0, 7); ctx.fill(); ctx.fillStyle = sky1; ctx.beginPath(); ctx.arc(wx + ww * .72 + 2.5, wy + wh * .3 - 1.5, 4.2, 0, 7); ctx.fill(); }
    else { ctx.fillStyle = dusk ? '#ffef9a' : '#fff3a0'; ctx.beginPath(); ctx.arc(wx + ww * .74, wy + wh * (dusk ? .62 : .3), 5, 0, 7); ctx.fill(); const cl = (cx, cy) => { R(cx, cy, 12, 3, '#ffffff'); R(cx + 3, cy - 2, 6, 2, '#ffffff'); }; cl(wx + 6 + ((o.t || 0) * 2) % 20, wy + 7); cl(wx + ww - 22 - ((o.t || 0) * 1.4) % 10, wy + wh * .55); }
    // hills
    for (let x = 0; x < ww; x++) { const hh = Math.round(4 + Math.sin(x / 7) * 2 + Math.sin(x / 3.1) * 1); R(wx + x, wy + wh - hh, 1, hh, night ? '#2d4a5a' : dusk ? '#c98a6a' : '#79c96b'); }
    R(wx + Math.floor(ww / 2) - 1, wy, 2, wh, '#fff8ee'); R(wx, wy + Math.floor(wh / 2) - 1, ww, 2, '#fff8ee');
    // curtains
    R(wx - 8, wy - 7, ww + 16, 3, '#b07a4a');
    for (let y = 0; y < wh + 8; y++) { const sw = Math.round(7 + Math.sin(y / 3) * .8 + (y > wh * .5 ? (y - wh * .5) * .12 : 0)); R(wx - 8, wy - 4 + y, sw, 1, (y % 4 < 2) ? '#ff9fb8' : '#ff8aa8'); R(wx + ww + 8 - sw, wy - 4 + y, sw, 1, (y % 4 < 2) ? '#ff9fb8' : '#ff8aa8'); }
    // floor
    for (let y = floorY; y < H; y++) { const band = Math.floor((y - floorY) / 7); R(0, y, W, 1, band % 2 ? fl.a : fl.b); }
    if (o.floor === 'tile') for (let y = floorY; y < H; y += 10) for (let x = (((y - floorY) / 10) % 2) * 10; x < W; x += 20) R(x, y, 10, 10, fl.b);
    else for (let y = floorY; y < H; y += 7) for (let x = ((y / 7) % 2) * 17; x < W; x += 34) R(x, y, 1, 7, mix(fl.b, '#3d2a6b', .2));
    // light pool from window
    if (!night) { ctx.globalAlpha = .18; ctx.fillStyle = '#fff6c0'; ctx.beginPath(); ctx.moveTo(wx, floorY); ctx.lineTo(wx + ww, floorY); ctx.lineTo(wx + ww + 30, H); ctx.lineTo(wx + 14, H); ctx.fill(); ctx.globalAlpha = 1; }
    return { floorY, night, dusk, win: { x: wx, y: wy, w: ww, h: wh } };
  }

  function paint(w, h, draw, o) { const P = new Pix(w, h); draw(P); return toCanvas(P.render({}, o || {}), w, h); }
  global.PIPEngine = { Pix, toCanvas, paint, outlineOf, PARTS, SWATCHES, PRESETS, HATS, GLASSES, NECKS, ITEMS, FURN, WALLPAPERS, FLOORS, presetGenome, randomGenome, mystery, renderPet, anchors, itemCanvas, sprite, drawRoom, mix, dark, light, rng, GW, GH };
})(window);

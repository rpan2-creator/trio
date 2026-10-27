/* INK STUDY v2 — app shell, screens, simulated AR camera controller, aging model, consultation pack. */
(function () {
'use strict';
const D = window.InkDesigns;
const app = document.getElementById('app');
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
if (window.Frame) Frame.tone('light');

/* ================= storage ================= */
const KEY = 'inkstudy.v2';
const defaults = () => ({ settings: { skin: 1, units: 'cm', motion: true, hair: true }, my: [], caps: [], consult: { idea: '', notes: '', q: ['q1', 'q3', 'q5', 'q7'], custom: [], sel: [] }, last: 'rose' });
let S;
try { S = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = defaults(); }
S.settings = Object.assign(defaults().settings, S.settings); S.consult = Object.assign(defaults().consult, S.consult);
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Storage is full — delete a few captures'); } }

const IDB = (() => {
  let dbp = null; const mem = new Map();
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res) => {
      try { const r = indexedDB.open('inkstudy', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); }
    });
    return dbp;
  }
  const tx = async (mode, fn) => { const db = await open(); if (!db) return fn(null); return new Promise((res) => { const t = db.transaction('kv', mode); const st = t.objectStore('kv'); const r = fn(st); t.oncomplete = () => res(r && 'result' in r ? r.result : undefined); t.onerror = () => res(undefined); }); };
  return {
    get: k => mem.has(k) ? Promise.resolve(mem.get(k)) : tx('readonly', st => st ? st.get(k) : null),
    set: (k, v) => { mem.set(k, v); return tx('readwrite', st => st && st.put(v, k)); },
    del: k => { mem.delete(k); return tx('readwrite', st => st && st.delete(k)); },
    clear: () => { mem.clear(); return tx('readwrite', st => st && st.clear()); }
  };
})();

/* ================= helpers ================= */
const $ = (sel, el) => (el || app).querySelector(sel);
const $$ = (sel, el) => Array.from((el || app).querySelectorAll(sel));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function len(cm, dec) { if (S.settings.units === 'in') return (cm / 2.54).toFixed(dec == null ? 1 : dec) + ' in'; return cm.toFixed(dec == null ? (cm < 10 ? 1 : 0) : dec) + ' cm'; }
function lenPair(w, h) { const u = S.settings.units === 'in'; const f = v => u ? (v / 2.54).toFixed(1) : v.toFixed(v < 10 ? 1 : 0); return `${f(w)} × ${f(h)} ${u ? 'in' : 'cm'}`; }
let toastT; function toast(msg) { let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); app.appendChild(t); } t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }
function rangeFill(inp) { const p = (inp.value - inp.min) / (inp.max - inp.min) * 100; inp.style.setProperty('--p', p + '%'); }

const I = {
  home: '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  cam: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.5-2h5L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.6"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  stack: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  split: '<path d="M12 3v18"/><path d="M8 8l-4 4 4 4M16 8l4 4-4 4"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
  l: '<path d="M15 5l-7 7 7 7"/>', r: '<path d="M9 5l7 7-7 7"/>', u: '<path d="M5 15l7-7 7 7"/>', d: '<path d="M5 9l7 7 7-7"/>',
  rl: '<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v4h4"/>', rr: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4h-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  resize: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
  design: '<path d="M12 3c4 3 6 6 6 9a6 6 0 0 1-12 0c0-3 2-6 6-9z"/>',
  adjust: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
  hand: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  check: '<path d="M5 12l5 5L20 7"/>', spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  forearm: '<path d="M5 20c2-6 4-11 9-16M10 21c1-5 3-10 9-15"/>', upper: '<path d="M7 21c-1-6 0-12 3-17M15 21c0-6 1-12 3-17"/><path d="M10 4c2-1 5-1 8 0"/>', calf: '<path d="M8 3c-1 5 0 9 1 12 0 3-1 5-1 6M15 3c2 5 2 9 0 12-1 2-1 4 0 6"/>'
};
const ico = (n, cls) => `<svg viewBox="0 0 24 24" aria-hidden="true" ${cls ? `class="${cls}"` : ''}>${I[n]}</svg>`;

/* ================= skin + model constants ================= */
const SKINS = [
  { id: 'I', rgb: [0.93, 0.78, 0.69], hex: '#efd4c4', frk: .55 },
  { id: 'II', rgb: [0.88, 0.69, 0.57], hex: '#e2b89c', frk: .3 },
  { id: 'III', rgb: [0.79, 0.57, 0.43], hex: '#c8956f', frk: .12 },
  { id: 'IV', rgb: [0.64, 0.43, 0.30], hex: '#a3714f', frk: 0 },
  { id: 'V', rgb: [0.45, 0.29, 0.19], hex: '#734b31', frk: 0 },
  { id: 'VI', rgb: [0.27, 0.17, 0.115], hex: '#45302a', frk: 0 }
];
const STOPS = [
  { days: 0, label: 'Fresh', sub: 'Day 0', big: 'Fresh', note: '<b>Day 0 — an open wound.</b> Redness and slight swelling ring the lines; plasma and excess ink leave a glossy sheen. Lines look their sharpest and darkest right now.' },
  { days: 9, label: 'Healing', sub: 'Wk 1–2', big: 'Healing', note: '<b>Days 4–14 — peeling.</b> The surface flakes like a mild sunburn and the tattoo looks cloudy and dull while new skin forms over it. Don’t pick or scratch; follow your artist’s aftercare.' },
  { days: 30, label: 'Healed', sub: '1 mo', big: 'Healed', note: '<b>About a month — the real baseline.</b> Ink now sits under a fresh layer of skin, so it reads slightly softer and lighter than day 0.' },
  { days: 30 + 365, label: '1 yr', sub: 'Year 1', big: 'Year <em>1</em>', note: '<b>Settled.</b> Bold lines hold well; very fine lines may already soften a touch. Daily sunscreen from here on matters most.' },
  { days: 30 + 5 * 365, label: '5 yrs', sub: 'Year 5', big: 'Year <em>5</em>', note: '<b>Slow ink migration.</b> Lines widen slightly. Light inks — yellow, white, pastels — start to lose punch first.' },
  { days: 30 + 10 * 365, label: '10 yrs', sub: 'Year 10', big: 'Year <em>10</em>', note: '<b>Softening.</b> Fine lines blur and tight gaps start to close; colours lose saturation while black holds strongest. Many people consider a touch-up around 10–15 years.' },
  { days: 30 + 20 * 365, label: '20 yrs', sub: 'Year 20', big: 'Year <em>20</em>', note: '<b>Two decades.</b> Spread is greatest where lines were thinnest, black can take on a faint blue-green cast, and sun-exposed spots fade most. A touch-up can restore contrast.' }
];
function daysAt(pos) { const i = Math.floor(clamp(pos, 0, 5.9999)), t = clamp(pos, 0, 6) - i; return STOPS[i].days + (STOPS[Math.min(6, i + 1)].days - STOPS[i].days) * t; }
const SUN = { low: .7, med: 1, high: 1.6 }, CARE = { great: .85, ok: 1, poor: 1.25 };
const RATE = { black: .010, grey: .018, red: .030, orange: .038, yellow: .065, green: .026, blue: .023, purple: .042, white: .11 };
const SWATCH = { black: '#141110', grey: '#77716b', red: '#c8261c', orange: '#e2601e', yellow: '#f2b928', green: '#2e7b3a', blue: '#25568f', purple: '#c25878', white: '#fbf7ee' };

function ageModel(days, mods, line, palette) {
  const fresh = Math.exp(-days / 1.6), healing = sstep(2.5, 6, days) * (1 - sstep(13, 26, days)), settled = sstep(14, 30, days);
  const yEff = Math.max(days - 30, 0) / 365 * mods.sun * mods.place * mods.care;
  const lw = line === 'fine' ? 1.7 : 1;
  const sigma = .045 + (.034 * Math.pow(yEff, .62) + .018 * settled) * lw;
  const spread = 2.355 * (sigma - .045); // FWHM growth in mm
  const dens = k => (1 - .1 * settled) * Math.exp(-RATE[k] * yEff) * (1 - .12 * healing) * (line === 'fine' ? Math.exp(-.006 * yEff * .7) : 1);
  let colorW = 0, colorR = 0;
  if (palette) for (const k in palette) { if (k === 'black' || k === 'grey' || !palette[k]) continue; colorW += palette[k]; colorR += palette[k] * dens(k); }
  return { fresh, healing, settled, yEff, sigma, spread, black: dens('black'), color: colorW > .03 ? colorR / colorW : null, touch: yEff > 10 || (colorW > .03 && colorR / colorW < .62) };
}
function sstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

function analyze(cv) {
  const s = 96, c = document.createElement('canvas'); c.width = s; c.height = Math.max(1, Math.round(s * cv.height / cv.width));
  const x = c.getContext('2d'); x.drawImage(cv, 0, 0, c.width, c.height);
  const px = x.getImageData(0, 0, c.width, c.height).data; const out = { black: 0, grey: 0, red: 0, orange: 0, yellow: 0, green: 0, blue: 0, purple: 0, white: 0 }; let n = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 120) continue; n++;
    const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
    if (mx < .3) { out.black++; continue; }
    if (sat < .2) { out[mn > .8 ? 'white' : 'grey']++; continue; }
    let h; const dd = mx - mn; if (mx === r) h = ((g - b) / dd + 6) % 6; else if (mx === g) h = (b - r) / dd + 2; else h = (r - g) / dd + 4; h *= 60;
    out[h < 18 || h >= 330 ? 'red' : h < 38 ? 'orange' : h < 72 ? 'yellow' : h < 170 ? 'green' : h < 260 ? 'blue' : 'purple']++;
  }
  for (const k in out) out[k] = n ? out[k] / n : 0;
  return out;
}

/* ================= designs: lookup, raster, textures ================= */
function getDesign(id) {
  const lib = D.LIB.find(d => d.id === id); if (lib) return Object.assign({ kind: 'lib' }, lib);
  const my = S.my.find(d => d.id === id); if (my) return my;
  return null;
}
const rasterCache = new Map();
async function rasterOf(d, mode, px) {
  const key = d.id + '|' + (mode || '') + '|' + (px || 1024);
  if (rasterCache.has(key)) return rasterCache.get(key);
  const p = (async () => {
    if (d.kind === 'built') return D.rasterBuilt(d.spec, px || 1024);
    if (d.kind === 'upload') { const src = await IDB.get('up:' + d.id); const img = await loadImg(src); const cv = document.createElement('canvas'); const sc = (px || 1024) / Math.max(img.width, img.height); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); return cv; }
    return D.raster(d, px || 1024, mode);
  })();
  rasterCache.set(key, p); p.catch(() => rasterCache.delete(key));
  return p;
}
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Image failed')); i.src = src; }); }
const thumbCache = new Map();
async function thumbURL(d, mode) {
  const key = d.id + '|' + (mode || '');
  if (thumbCache.has(key)) return thumbCache.get(key);
  let url;
  if (d.kind === 'lib' && d.build && !d.text) url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(d.build(mode));
  else if (d.thumb) url = d.thumb;
  else { const cv = await rasterOf(d, mode, 420); url = cv.toDataURL('image/png'); }
  thumbCache.set(key, url); return url;
}
function hydrateThumbs(root) {
  $$('img[data-thumb]', root).forEach(async img => { const d = getDesign(img.dataset.thumb); if (!d) return; try { img.src = await thumbURL(d, img.dataset.mode || undefined); } catch (e) {} });
}
// pad + resample into a power-of-two texture so every GPU can mipmap it
async function textureFor(d, mode) {
  const cv = await rasterOf(d, mode, 1024);
  const cw = cv.width, ch = cv.height, pad = .08 * Math.max(cw, ch);
  const T = document.createElement('canvas'); T.width = T.height = 1024;
  const x = T.getContext('2d');
  const W = cw + 2 * pad, H = ch + 2 * pad;
  x.drawImage(cv, pad / W * 1024, pad / H * 1024, cw / W * 1024, ch / H * 1024);
  return { tex: T, aspectC: cw / ch, aspectP: W / H, padH: H / ch, canvas: cv };
}
function lineOf(d, mode) { if (d.kind === 'built') return d.spec.mode === 'fine' ? 'fine' : 'bold'; if (mode === 'fine') return 'fine'; return d.line || 'bold'; }

/* ================= shared offscreen renderer for stills ================= */
let snapEng = null, snapTexKey = '';
function snapEngine() {
  if (snapEng !== null) return snapEng;
  try { snapEng = InkAR.create(document.createElement('canvas'), { fixed: [200, 200, 2] }); } catch (e) { snapEng = false; }
  return snapEng;
}
async function snapshot(o) {
  const E = snapEngine(); if (!E) return null;
  const d = getDesign(o.design) || getDesign('rose');
  const key = d.id + '|' + (o.mode || '');
  let t = snapTex.get(key); if (!t) { t = await textureFor(d, o.mode); snapTex.set(key, t); }
  if (snapTexKey !== key) { E.setTattoo(t.tex, t.aspectP); snapTexKey = key; }
  E.setFixed([o.w, o.h, o.dpr || 2]);
  if (E.state.body !== (o.body || 'forearm')) E.setBody(o.body || 'forearm');
  const B = E.body, sk = SKINS[o.skin != null ? o.skin : S.settings.skin];
  const L = o.sizeCm || d.size || 9, hC = t.aspectC >= 1 ? L / t.aspectC : L;
  const zc = o.z != null ? o.z : (B.defaultZ || 0);
  E.set({ sway: 0, scan: 0, lock: 0, edit: 0, reveal: 1, split: o.split != null ? o.split : -1, daysL: o.daysL != null ? o.daysL : (o.days || 0), daysR: o.days || 0,
    roll: (o.roll != null ? o.roll : -B.phiFace), pitch: o.pitch || 0, yaw: 0, zoom: o.zoom || 1, shiftX: o.shiftX || 0, shiftY: o.shiftY || 0,
    mods: [SUN[o.sun || 'med'], o.place || 1, CARE[o.care || 'ok'], lineOf(d, o.mode) === 'fine' ? 1.7 : 1],
    hair: o.hair == null ? (S.settings.hair ? .32 : 0) : o.hair, freckle: sk.frk, skin: sk.rgb });
  E.state.place = { f: o.f != null ? o.f : E.fracFromPhi(zc, B.phiFace), z: zc, size: hC * t.padH, rot: o.rot || 0 };
  E.state.t0 = performance.now() - 1000;
  return E.capture(o.type || 'image/jpeg');
}
const snapTex = new Map();
// queue stills so they don't fight each other
let snapQ = Promise.resolve();
function snap(o) { const p = snapQ.then(() => snapshot(o)).catch(() => null); snapQ = p; return p; }

/* ================= router ================= */
let cleanup = null, curView = '';
const TABS = [['studio', 'Studio', 'home', '#/'], ['flash', 'Flash', 'grid', '#/flash'], ['ar', 'Try on', 'cam', '#/ar'], ['builder', 'Builder', 'layers', '#/builder'], ['sessions', 'Sessions', 'stack', '#/sessions']];
function tabbar(active) {
  return `<nav class="tabbar" aria-label="Main">${TABS.map(([id, label, ic, href]) => id === 'ar'
    ? `<a class="tab-cta" href="${href}/${esc(S.last)}" aria-label="Try on in AR"><span class="ring">${ico(ic)}</span><b>${label}</b></a>`
    : `<a href="${href}" ${active === id ? 'aria-current="page"' : ''}>${ico(ic)}<span>${label}</span></a>`).join('')}</nav>`;
}
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, a, b] = h.split('/');
  if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
  const views = { '': viewStudio, flash: viewFlash, design: viewDesign, builder: viewBuilder, ar: viewAR, sessions: viewSessions, compare: viewCompare, consult: viewConsult, settings: viewSettings };
  const fn = views[name] || viewStudio;
  curView = name;
  app.innerHTML = '';
  fn(decodeURIComponent(a || ''), decodeURIComponent(b || ''));
  const v = $('.view'); if (v && !reduceMotion) v.classList.add('enter');
}
window.addEventListener('hashchange', route);

function shell(active, inner) {
  app.innerHTML = `<div class="view" id="view">${inner}</div>${tabbar(active)}`;
  hydrateThumbs(app);
  return $('#view');
}
function flashCard(d, i, cls) {
  return `<a class="flash ${cls || ''}" href="#/design/${esc(d.id)}"><span class="no">No. ${String(i + 1).padStart(2, '0')}</span><img class="art" data-thumb="${esc(d.id)}" alt="${esc(d.name)} — ${esc(styleLabel(d.style))} flash"><span class="meta"><b>${esc(d.name)}</b><span>${esc(styleLabel(d.style))} · ${esc(len(d.size || 9, 0))}</span></span></a>`;
}
function styleLabel(s) { const x = D.STYLES.find(t => t.id === s); return x ? x.label : s === 'custom' ? 'My design' : s === 'upload' ? 'Upload' : s; }

/* ================= Studio (home) ================= */
function viewStudio() {
  const feat = ['rose', 'swallow', 'mandala', 'koi', 'butterfly', 'dagger'].map(id => D.LIB.find(d => d.id === id));
  const caps = S.caps.slice(-6).reverse();
  const v = shell('studio', `
  <header class="topbar"><span class="wordmark" aria-label="Ink Study">Ink<i>study</i></span><a class="icon-btn" href="#/settings" aria-label="Settings">${ico('gear')}</a></header>
  <section class="hero" aria-label="Simulated AR preview">
    <img class="hero-shot" alt="Simulated camera view of a traditional rose tattoo on a forearm">
    <div class="hero-hud"><span class="rec">AR · Simulated</span><span>Inner forearm · Year 10</span></div>
    <div class="brackets" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div class="hero-copy">
      <span class="eyebrow">Try on · Compare · Age · Consult</span>
      <h1 class="display">Wear it <em>before</em><br>it’s forever.</h1>
      <div class="row"><a class="btn btn-primary" href="#/ar/${esc(S.last)}">${ico('cam')}Open AR camera</a><a class="btn btn-ghost" href="#/flash">Browse flash</a></div>
    </div>
  </section>
  <section class="section"><div class="section-head"><h2 class="h2">Featured flash</h2><a class="link" href="#/flash">All 20</a></div>
    <div class="hscroll">${feat.map((d, i) => flashCard(d, D.LIB.indexOf(d), 'feat')).join('')}</div></section>
  <section class="section"><div class="promo">
    <img class="promo-art" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(D.buildSVG({ motif: 'swallow', frame: 'ring', accents: ['sparkles'], mode: 'fine' }))}" alt="">
    <span class="eyebrow">Tattoo Builder</span><h2 class="display">Compose your own piece.</h2>
    <p>Pick a motif, a frame, accents and lettering. Switch between full colour, black &amp; grey or fine line.</p>
    <a class="btn btn-bone btn-sm" href="#/builder">Start building ${ico('arrow')}</a></div></section>
  <section class="section"><div class="section-head"><h2 class="h2">How ink ages</h2><a class="link" href="#/ar/${esc(S.last)}/age">See it</a></div>
    <div class="facts">
      <div class="fact"><b>Black</b><span>is the most stable pigment and holds contrast longest.</span></div>
      <div class="fact"><b>Sun</b><span>is the biggest accelerant of fading. SPF on healed ink helps.</span></div>
      <div class="fact"><b>Fine lines</b><span>blur proportionally more than bold lines as ink migrates.</span></div>
      <div class="fact"><b>10–15 yrs</b><span>is when many people consider a touch-up.</span></div>
    </div></section>
  <section class="section"><div class="section-head"><h2 class="h2">My sessions</h2>${caps.length ? '<a class="link" href="#/sessions">View all</a>' : ''}</div>
    ${caps.length ? `<div class="sessions">${caps.slice(0, 3).map(capTile).join('')}</div>` : `<div class="empty"><div class="h3">No captures yet</div>Open the AR camera, place a design and press the shutter. Captures land here for comparing and for your artist.</div>`}</section>
  <p class="foot-note">Illustrative simulation — your artist and dermatologist know your skin.</p>`);
  (async () => {
    const url = await heroShot();
    const img = $('.hero-shot', v); if (img && url) { img.src = url; img.onload = () => img.classList.add('ready'); }
  })();
}
let heroURL = null;
async function heroShot() {
  if (heroURL) return heroURL;
  heroURL = await snap({ design: 'rose', w: 365, h: 440, dpr: 2, days: STOPS[5].days, zoom: 1.45, shiftY: -0.18, shiftX: 0.05, sizeCm: 10, z: 1.5, roll: -0.15, type: 'image/jpeg' });
  return heroURL;
}
function capTile(c) { return `<a class="sess" href="#/sessions"><img src="${c.thumb}" alt="Capture: ${esc(c.designName)}, ${esc(c.stage)}"><span class="lbl">${esc(c.designName)}<br>${esc(c.stage)}</span></a>`; }

/* ================= Flash gallery ================= */
const LEDES = { all: 'Twenty original pieces drawn for trying on. Tap any sheet for details and aging.', traditional: 'Bold outlines, a tight palette of red, green and yellow, and solid black shading — built to read from across a room for decades.', fineline: 'Single-needle work. Delicate and airy, but lines this thin are the first to soften as ink migrates.', blackwork: 'Solid black, geometry and dotwork. Black is the most stable pigment, so these hold contrast longest.', japanese: 'Irezumi-inspired waves, koi and blossoms with flowing movement. Best given room to breathe.', script: 'Lettering in script, blackletter and typewriter. Keep letters large enough that counters stay open over time.' };
let flashFilter = 'all', flashQuery = '';
function viewFlash() {
  const v = shell('flash', `
  <div class="page-head"><span class="eyebrow">The flash wall</span><h1 class="display">Flash <em>&</em> designs</h1></div>
  <label class="search">${ico('search')}<span class="sr-only">Search designs</span><input type="search" placeholder="Search rose, moon, koi…" value="${esc(flashQuery)}" id="q"></label>
  <div class="chips" role="group" aria-label="Filter by style" style="padding-left:20px;margin-left:0">${D.STYLES.map(s => `<button class="chip" data-f="${s.id}" aria-pressed="${flashFilter === s.id}">${s.label}</button>`).join('')}${S.my.length ? `<button class="chip" data-f="mine" aria-pressed="${flashFilter === 'mine'}">My designs</button>` : ''}</div>
  <p class="style-lede" id="lede"></p>
  <div class="gal"><div class="grid2" id="g"></div></div>
  <section class="section"><label class="btn btn-ghost btn-block" tabindex="0">${ico('upload')} Upload your own PNG or SVG<input type="file" id="up" accept="image/png,image/svg+xml,image/jpeg,image/webp" class="sr-only"></label>
  <p class="muted small" style="margin-top:8px;text-align:center">Images stay on this device. SVGs are sanitized and rasterized.</p></section>`);
  const draw = () => {
    const q = flashQuery.trim().toLowerCase();
    let list = flashFilter === 'mine' ? S.my : D.LIB.filter(d => flashFilter === 'all' || d.style === flashFilter);
    if (flashFilter === 'all') list = list.concat(S.my);
    if (q) list = list.filter(d => (d.name + ' ' + (d.tags || []).join(' ') + ' ' + d.style).toLowerCase().includes(q));
    $('#g', v).innerHTML = list.map((d, i) => flashCard(d, D.LIB.indexOf(d) >= 0 ? D.LIB.indexOf(d) : i)).join('') || `<div class="empty" style="grid-column:1/-1">Nothing matches “${esc(q)}”.</div>`;
    $('#lede', v).textContent = LEDES[flashFilter] || 'Designs you built or uploaded.';
    hydrateThumbs(v);
  };
  draw();
  $$('.chip', v).forEach(b => b.onclick = () => { flashFilter = b.dataset.f; $$('.chip', v).forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); });
  $('#q', v).oninput = e => { flashQuery = e.target.value; draw(); };
  $('#up', v).onchange = e => handleUpload(e.target.files[0]);
}

async function handleUpload(file) {
  if (!file) return;
  if (file.size > 8e6) return toast('That file is over 8 MB');
  try {
    let src;
    if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
      const txt = await file.text();
      src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sanitizeSVG(txt));
    } else src = await new Promise((r, j) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = j; fr.readAsDataURL(file); });
    const img = await loadImg(src);
    const sc = 1024 / Math.max(img.naturalWidth || img.width || 1024, img.naturalHeight || img.height || 1024);
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round((img.naturalWidth || 1024) * sc)); cv.height = Math.max(1, Math.round((img.naturalHeight || 1024) * sc));
    const x = cv.getContext('2d'); x.drawImage(img, 0, 0, cv.width, cv.height);
    // no transparency? treat it as a drawing on paper: luminance -> ink alpha
    const id = x.getImageData(0, 0, cv.width, cv.height), p = id.data; let opaque = true;
    for (let i = 3; i < p.length; i += 16) if (p[i] < 250) { opaque = false; break; }
    if (opaque) for (let i = 0; i < p.length; i += 4) { const l = (p[i] * .3 + p[i + 1] * .59 + p[i + 2] * .11) / 255; const a = clamp((1 - l) * 1.25, 0, 1); p[i + 3] = a * 255; if (a > 0) { p[i] = clamp((p[i] - 255 * (1 - a)) / a, 0, 255); p[i + 1] = clamp((p[i + 1] - 255 * (1 - a)) / a, 0, 255); p[i + 2] = clamp((p[i + 2] - 255 * (1 - a)) / a, 0, 255); } }
    x.putImageData(id, 0, 0);
    const trimmed = trim(cv);
    const did = 'up-' + uid();
    await IDB.set('up:' + did, trimmed.toDataURL('image/png'));
    const th = document.createElement('canvas'); const ts = 300 / Math.max(trimmed.width, trimmed.height); th.width = Math.round(trimmed.width * ts); th.height = Math.round(trimmed.height * ts); th.getContext('2d').drawImage(trimmed, 0, 0, th.width, th.height);
    S.my.push({ id: did, kind: 'upload', name: file.name.replace(/\.[a-z]+$/i, '').slice(0, 28) || 'My upload', style: 'upload', line: 'bold', size: 8, thumb: th.toDataURL('image/png'), tags: ['Upload'] });
    save(); toast('Added to My designs'); location.hash = '#/design/' + did;
  } catch (e) { toast('Could not read that image'); }
}
function sanitizeSVG(txt) {
  const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) throw new Error('Not an SVG');
  doc.querySelectorAll('script,foreignObject,iframe,embed,object,audio,video,animate,set,animateTransform,animateMotion').forEach(n => n.remove());
  doc.querySelectorAll('*').forEach(n => {
    [...n.attributes].forEach(a => {
      const nm = a.name.toLowerCase(), val = a.value.trim().toLowerCase();
      if (nm.startsWith('on')) n.removeAttribute(a.name);
      else if ((nm === 'href' || nm === 'xlink:href') && !(val.startsWith('#') || val.startsWith('data:image/'))) n.removeAttribute(a.name);
      else if (/url\(\s*['"]?(?!#)/i.test(a.value) || /javascript:/i.test(a.value)) n.removeAttribute(a.name);
    });
    if (n.nodeName.toLowerCase() === 'style') n.textContent = n.textContent.replace(/@import[^;]+;?/gi, '').replace(/url\(\s*['"]?(?!#)[^)]*\)/gi, 'none');
  });
  if (!svg.getAttribute('width') && svg.getAttribute('viewBox')) { const vb = svg.getAttribute('viewBox').split(/[\s,]+/).map(Number); svg.setAttribute('width', vb[2] || 512); svg.setAttribute('height', vb[3] || 512); }
  return new XMLSerializer().serializeToString(svg);
}
function trim(cv) {
  const x = cv.getContext('2d'), { width: w, height: h } = cv, p = x.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) if (p[(y * w + xx) * 4 + 3] > 12) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 <= x0 || y1 <= y0) return cv;
  const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1; o.getContext('2d').drawImage(cv, -x0, -y0); return o;
}

/* ================= Design detail ================= */
function viewDesign(id) {
  const d = getDesign(id); if (!d) { location.hash = '#/flash'; return; }
  const i = D.LIB.indexOf(D.LIB.find(x => x.id === id));
  const colorable = d.kind === 'lib' && d.build && d.style !== 'fineline' && d.style !== 'blackwork' && !d.text;
  let mode = '';
  const v = shell('flash', `
  <div class="back-row"><a class="icon-btn" href="#/flash" aria-label="Back to flash">${ico('back')}</a><span class="eyebrow">${esc(styleLabel(d.style))}${i >= 0 ? ' · No. ' + String(i + 1).padStart(2, '0') : ''}</span></div>
  <div class="detail-art" style="margin-top:12px"><span class="corner tl">Ink Study</span><span class="corner tr">${esc(d.artist || 'Original')}</span><span class="corner bl">Flash sheet</span><span class="corner br">${esc(len(d.size || 9, 0))}</span><img id="art" data-thumb="${esc(d.id)}" alt="${esc(d.name)}"></div>
  <section class="section" style="margin-top:20px">
    <h1 class="display" style="font-size:34px">${esc(d.name)}</h1>
    <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">${(d.tags || []).map(t => `<span class="tag" style="color:var(--bone-2)">${esc(t)}</span>`).join('')}<span class="tag" style="color:var(--gold)">${lineOf(d) === 'fine' ? 'Fine line' : 'Bold line'}</span></div>
    <div class="kv"><div><b>${esc(len(d.size || 9, 0))}</b><span>Suggested</span></div><div><b>${lineOf(d) === 'fine' ? 'Fine' : 'Bold'}</b><span>Linework</span></div><div><b id="pal-n">—</b><span>Ink colours</span></div></div>
    ${colorable ? `<div class="seg" style="margin-top:14px" role="group" aria-label="Ink"><button data-m="" aria-pressed="true">Full colour</button><button data-m="bw" aria-pressed="false">Black &amp; grey</button><button data-m="fine" aria-pressed="false">Fine line</button></div>` : ''}
  </section>
  <section class="section"><div class="section-head"><h2 class="h2">How it ages</h2><span class="muted small">Inner forearm · Medium sun</span></div>
    <div class="age-strip" id="strip">${[2, 4, 5, 6].map(k => `<figure><div class="ph"><img alt="${esc(d.name)} simulated at ${STOPS[k].sub}" hidden></div><figcaption>${STOPS[k].sub}</figcaption></figure>`).join('')}</div>
    <div class="palette-bar" id="pbar" aria-hidden="true"></div><div class="palette-legend" id="pleg"></div>
    <p class="stage-note" id="pnote"></p></section>
  <div class="sticky-cta"><a class="btn btn-primary" style="flex:1" id="try" href="#/ar/${esc(d.id)}">${ico('cam')} Try on in AR</a>${d.kind === 'built' ? `<a class="btn btn-ghost" href="#/builder/${esc(d.id)}">Edit</a>` : ''}${d.kind !== 'lib' ? `<button class="btn btn-ghost" id="del" aria-label="Delete design">${ico('trash')}</button>` : ''}</div>`);
  let token = 0;
  async function refresh() {
    const my = ++token;
    const img = $('#art', v); thumbURL(d, mode || undefined).then(u => { if (my === token) img.src = u; });
    const cv = await rasterOf(d, mode || undefined, 512); if (my !== token) return;
    const pal = analyze(cv);
    const keys = Object.keys(pal).filter(k => pal[k] > .015).sort((a, b) => pal[b] - pal[a]);
    $('#pal-n', v).textContent = keys.length;
    $('#pbar', v).innerHTML = keys.map(k => `<i style="flex:${pal[k]};background:${SWATCH[k]}"></i>`).join('');
    const m10 = ageModel(STOPS[5].days, { sun: 1, place: 1, care: 1 }, lineOf(d, mode), pal);
    $('#pleg', v).innerHTML = keys.map(k => `<span><i style="background:${SWATCH[k]}"></i>${k[0].toUpperCase() + k.slice(1)} · ${Math.round(100 * Math.exp(-RATE[k] * m10.yEff) * .9)}% at 10 yrs</span>`).join('');
    $('#pnote', v).innerHTML = `Simulated with medium sun and average aftercare. ${keys.includes('yellow') || keys.includes('white') ? 'Light inks here (yellow / white) will fade first; ' : ''}${lineOf(d, mode) === 'fine' ? 'fine lines will soften visibly by year 10.' : 'bold black outlines keep the design readable for decades.'} <a class="link" href="#/ar/${esc(d.id)}${mode ? '/' + mode : ''}/age">Scrub the full timeline →</a>`;
    $('#try', v).href = `#/ar/${d.id}${mode ? '/' + mode : ''}`;
    const figs = $$('#strip figure', v);
    for (let j = 0; j < 4; j++) {
      const k = [2, 4, 5, 6][j];
      const ph = figs[j].querySelector('.ph'), im = figs[j].querySelector('img'); ph.classList.remove('ready'); im.hidden = true;
      const url = await snap({ design: d.id, mode: mode || undefined, w: 84, h: 112, dpr: 2, days: STOPS[k].days, zoom: 2.4, sizeCm: Math.min(d.size || 9, 9), shiftY: 0, z: 0.5, hair: 0, roll: 0 });
      if (my !== token) return;
      if (url) { im.src = url; im.hidden = false; ph.classList.add('ready'); }
    }
  }
  refresh();
  $$('.seg button', v).forEach(b => b.onclick = () => { mode = b.dataset.m; $$('.seg button', v).forEach(x => x.setAttribute('aria-pressed', x === b)); refresh(); });
  const del = $('#del', v); if (del) del.onclick = () => confirmModal('Delete this design?', 'It will be removed from My designs on this device.', 'Delete', async () => { S.my = S.my.filter(x => x.id !== d.id); if (d.kind === 'upload') IDB.del('up:' + d.id); if (S.last === d.id) S.last = 'rose'; save(); location.hash = '#/flash'; });
}

/* ================= Builder ================= */
let bspec = null;
function viewBuilder(editId) {
  const editing = editId ? S.my.find(x => x.id === editId && x.kind === 'built') : null;
  if (editing) bspec = JSON.parse(JSON.stringify(editing.spec));
  if (!bspec) bspec = { motif: 'rose', frame: 'banner', accents: ['stars'], mode: 'color', text: { str: 'Mom', font: 'script', pos: 'below', curve: .2 }, bannerText: 'MOM' };
  const v = shell('builder', `
  <div class="builder-stage"><div class="page-head" style="padding:4px 4px 10px;display:flex;justify-content:space-between;align-items:flex-end"><div><span class="eyebrow">Tattoo Builder</span><h1 class="display" style="font-size:30px;margin-top:6px">${editing ? 'Edit <em>design</em>' : 'Compose <em>yours</em>'}</h1></div><button class="btn btn-ghost btn-sm" id="rand">${ico('spark')} Surprise me</button></div>
    <div class="builder-paper"><span class="corner tl">Live preview</span><span class="corner tr" id="bmode"></span><canvas id="pv" aria-label="Live preview of your design" role="img"></canvas></div></div>
  <div class="bsec"><div class="lab"><b>Ink</b><span>Colour mode</span></div><div class="seg" role="group" aria-label="Colour mode" id="mode">${[['color', 'Full colour'], ['bw', 'Black & grey'], ['fine', 'Fine line']].map(([k, l]) => `<button data-v="${k}" aria-pressed="${bspec.mode === k}">${l}</button>`).join('')}</div></div>
  <div class="bsec"><div class="lab"><b>Central motif</b><span>${D.MOTIFS.length} options</span></div><div class="tiles" id="motifs" role="group" aria-label="Motif"></div></div>
  <div class="bsec"><div class="lab"><b>Frame</b><span>Behind or around</span></div><div class="tiles" id="frames" role="group" aria-label="Frame"></div></div>
  <div class="bsec"><div class="lab"><b>Accents</b><span>Pick any</span></div><div class="tiles" id="accents" role="group" aria-label="Accents"></div></div>
  <div class="bsec"><div class="lab"><b>Lettering</b><span>Optional</span></div>
    <label class="field"><span class="sr-only">Lettering text</span><input id="txt" maxlength="22" placeholder="A name, a date, a word…" value="${esc(bspec.text.str)}"></label>
    <div class="seg" style="margin-top:10px" role="group" aria-label="Font" id="font">${Object.entries(D.FONTS).map(([k, f]) => `<button data-v="${k}" aria-pressed="${bspec.text.font === k}" style="font-family:${f.css.replace(/"/g, "'")};font-size:${k === 'script' ? 17 : k === 'blackletter' ? 16 : 12}px;font-weight:${f.weight}">${k === 'serif' ? 'SERIF' : k === 'typewriter' ? 'Type' : f.label}</button>`).join('')}</div>
    <div class="seg" style="margin-top:10px" role="group" aria-label="Lettering position" id="pos">${[['below', 'Below'], ['above', 'Above'], ['over', 'Across'], ['none', 'Off']].map(([k, l]) => `<button data-v="${k}" aria-pressed="${bspec.text.pos === k}">${l}</button>`).join('')}</div>
    <div class="range" style="margin-top:8px"><span class="muted small" style="width:76px">Arc curve</span><input type="range" id="curve" min="-1" max="1" step="0.05" value="${bspec.text.curve}" aria-label="Lettering arc curve"><output id="curveo"></output></div>
  </div>
  <div class="builder-actions"><button class="btn btn-ghost" id="savebtn" style="flex:1">${editing ? 'Save changes' : 'Save to My designs'}</button><button class="btn btn-primary" id="tryb" style="flex:1">${ico('cam')} Try on</button></div>
  <p class="muted small" style="margin:12px 20px 0;text-align:center">Banner frame uses your lettering inside the ribbon.</p>`);
  const tile = (id, label, src, on) => `<button class="tile" data-v="${id}" aria-pressed="${on}"><span class="tbox">${src ? `<img src="${src}" alt="">` : `<span>∅</span>`}</span>${esc(label)}</button>`;
  const svgURL = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  function tiles() {
    $('#motifs', v).innerHTML = D.MOTIFS.map(m => tile(m.id, m.label, svgURL(D.buildSVG({ motif: m.id, frame: 'none', mode: bspec.mode })), bspec.motif === m.id)).join('');
    $('#frames', v).innerHTML = D.FRAMES.map(f => tile(f.id, f.label, f.id === 'none' ? null : svgURL(D.buildSVG({ motif: '__', frame: f.id, mode: bspec.mode, bannerText: 'TEXT' }).replace(/<g transform="translate\(300 300\) scale\([\d.]+\) translate\(-300 -300\)">[\s\S]*?<\/g>(?=<)/, '')), bspec.frame === f.id)).join('');
    $('#accents', v).innerHTML = D.ACCENTS.map(a => `<button class="tile" data-v="${a.id}" aria-pressed="${bspec.accents.includes(a.id)}"><span class="tbox"><img src="${svgURL(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600'>${'' }</svg>`)}" data-acc="${a.id}" alt=""></span>${a.label}</button>`).join('');
    $$('#accents img', v).forEach(img => { img.src = svgURL(D.buildSVG({ motif: '__none', frame: 'none', accents: [img.dataset.acc], mode: bspec.mode }).replace(/<g transform="translate\(300 300\)[^>]*>[\s\S]*?<\/g>/, '')); });
    $('#frames .tile[data-v=none] .tbox', v).classList.add('dark');
    bind();
  }
  let tok = 0;
  async function preview() {
    const my = ++tok; save();
    bspec.bannerText = (bspec.text.str || '').toUpperCase();
    const cv = await D.rasterBuilt(bspec, 720); if (my !== tok) return;
    const pv = $('#pv', v); if (!pv) return;
    pv.width = cv.width; pv.height = cv.height; pv.getContext('2d').drawImage(cv, 0, 0);
    pv.style.width = (cv.width >= cv.height ? 230 : 230 * cv.width / cv.height) + 'px';
    $('#bmode', v).textContent = { color: 'Full colour', bw: 'Black & grey', fine: 'Fine line' }[bspec.mode];
    $('#curveo', v).textContent = (bspec.text.curve > 0 ? '+' : '') + Math.round(bspec.text.curve * 100);
    rangeFill($('#curve', v));
  }
  function bind() {
    $$('#motifs .tile', v).forEach(b => b.onclick = () => { bspec.motif = b.dataset.v; $$('#motifs .tile', v).forEach(x => x.setAttribute('aria-pressed', x === b)); preview(); });
    $$('#frames .tile', v).forEach(b => b.onclick = () => { bspec.frame = b.dataset.v; $$('#frames .tile', v).forEach(x => x.setAttribute('aria-pressed', x === b)); preview(); });
    $$('#accents .tile', v).forEach(b => b.onclick = () => { const a = b.dataset.v; bspec.accents = bspec.accents.includes(a) ? bspec.accents.filter(x => x !== a) : bspec.accents.concat(a); b.setAttribute('aria-pressed', bspec.accents.includes(a)); preview(); });
  }
  $$('#mode button', v).forEach(b => b.onclick = () => { bspec.mode = b.dataset.v; $$('#mode button', v).forEach(x => x.setAttribute('aria-pressed', x === b)); tiles(); preview(); });
  $$('#font button', v).forEach(b => b.onclick = () => { bspec.text.font = b.dataset.v; $$('#font button', v).forEach(x => x.setAttribute('aria-pressed', x === b)); preview(); });
  $$('#pos button', v).forEach(b => b.onclick = () => { bspec.text.pos = b.dataset.v; $$('#pos button', v).forEach(x => x.setAttribute('aria-pressed', x === b)); preview(); });
  $('#txt', v).oninput = e => { bspec.text.str = e.target.value; preview(); };
  $('#curve', v).oninput = e => { bspec.text.curve = +e.target.value; preview(); };
  $('#rand', v).onclick = () => {
    const pick = a => a[Math.floor(Math.random() * a.length)];
    bspec.motif = pick(D.MOTIFS).id; bspec.frame = pick(D.FRAMES).id; bspec.mode = pick(['color', 'color', 'bw', 'fine']);
    bspec.accents = D.ACCENTS.filter(() => Math.random() < .3).map(a => a.id).slice(0, 2);
    bspec.text.font = pick(Object.keys(D.FONTS)); bspec.text.str = pick(['Mom', 'Wanderer', 'Stay Gold', 'Amor', 'Est. 2026', 'Hold On', '']); bspec.text.pos = bspec.text.str ? pick(['below', 'above']) : 'none';
    route();
  };
  async function persist() {
    const cv = await D.rasterBuilt(bspec, 300);
    const name = (bspec.text.str && bspec.text.pos !== 'none' ? bspec.text.str + ' · ' : '') + (D.MOTIFS.find(m => m.id === bspec.motif) || {}).label;
    const rec = { id: editing ? editing.id : 'my-' + uid(), kind: 'built', name, style: 'custom', line: bspec.mode === 'fine' ? 'fine' : 'bold', size: 9, spec: JSON.parse(JSON.stringify(bspec)), thumb: cv.toDataURL('image/png'), tags: ['Builder', { color: 'Colour', bw: 'Black & grey', fine: 'Fine line' }[bspec.mode]] };
    if (editing) { Object.assign(editing, rec); } else S.my.push(rec);
    [...rasterCache.keys()].filter(k => k.startsWith(rec.id + '|')).forEach(k => rasterCache.delete(k));
    [...thumbCache.keys()].filter(k => k.startsWith(rec.id + '|')).forEach(k => thumbCache.delete(k));
    snapTex.forEach((_, k) => { if (k.startsWith(rec.id + '|')) snapTex.delete(k); }); snapTexKey = '';
    save(); return rec;
  }
  $('#savebtn', v).onclick = async () => { const r = await persist(); toast('Saved to My designs'); if (!editing) setTimeout(() => location.hash = '#/design/' + r.id, 600); };
  $('#tryb', v).onclick = async () => { const r = await persist(); location.hash = '#/ar/' + r.id; };
  tiles(); preview();
}

/* ================= AR camera ================= */
const AR = { body: 'forearm', place: null, zoom: 1, roll: null, pitch: 0, pos: 2, split: false, splitX: .5, sun: 'med', care: 'ok', lineOverride: null, tab: 'age', hair: null, bg: 'room', sway: true };
function viewAR(id, a2) {
  let mode = '', tabArg = '';
  if (a2 === 'age' || a2 === 'design' || a2 === 'adjust' || a2 === 'skin') tabArg = a2; else if (a2) mode = a2;
  const h3 = location.hash.split('/')[4]; if (h3) tabArg = h3;
  const d = getDesign(id) || getDesign(S.last) || getDesign('rose');
  if (d.id !== S.last) { S.last = d.id; save(); }
  if (AR.lastDesign !== d.id + mode) { AR.place = null; AR.lastDesign = d.id + mode; }
  if (tabArg) AR.tab = tabArg;
  app.innerHTML = `<div class="ar" id="ar">
    <canvas class="gl" tabindex="0" aria-label="Simulated camera view. Drag the limb to rotate it, drag the tattoo to move it. Arrow keys move the tattoo, plus and minus resize, [ and ] rotate."></canvas>
    <div class="vignette"></div>
    <div class="ar-brackets scan" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div class="split-line" aria-hidden="true"><button tabindex="-1">${ico('split')}</button></div>
    <span class="split-lab glass" id="sla">Fresh · Day 0</span><span class="split-lab glass" id="slb"></span>
    <div class="ar-top"><a class="round glass" href="#/design/${esc(d.id)}" aria-label="Close camera">${ico('close')}</a>
      <div class="track glass" id="track" role="status" aria-live="polite"><span class="dot"></span><span id="trk">Scanning skin surface…</span></div>
      <button class="round glass" id="camtog" aria-pressed="${AR.bg === 'cam'}" aria-label="Use my camera as background">${ico('video')}</button></div>
    <div class="ar-read" aria-hidden="true"><span class="pill glass" id="rd-place"></span><span class="pill glass" id="rd-size"></span></div>
    <div class="age-badge" aria-live="polite"><div class="big" id="ab-big"></div><div class="sub" id="ab-sub"></div></div>
    <button class="handle" id="handle" aria-label="Drag to resize and rotate the tattoo" hidden>${ico('resize')}</button>
    <div class="ar-hint glass" id="hint">Drag arm to rotate · drag ink to move</div>
    <div class="cam-row"><a class="l thumb-btn" id="lastcap" href="#/sessions" aria-label="Open sessions"></a>
      <button class="shutter" id="shutter" aria-label="Capture photo"><span></span></button>
      <div class="r"><button class="round glass" id="splittog" aria-pressed="${AR.split}" aria-label="Before and after split view">${ico('split')}</button></div></div>
    <section class="sheet" aria-label="Camera controls"><div class="grab"></div>
      <div class="sheet-tabs" role="tablist">${[['design', 'Design', 'design'], ['adjust', 'Adjust', 'adjust'], ['age', 'Age', 'clock'], ['skin', 'Skin', 'hand']].map(([k, l, ic]) => `<button role="tab" data-t="${k}" aria-selected="${AR.tab === k}">${ico(ic)}${l}</button>`).join('')}</div>
      <div class="sheet-body" id="sb" role="tabpanel"></div></section>
    <div class="flashfx"></div></div>`;
  const root = $('#ar'), canvas = $('canvas.gl', root);
  let E;
  try { E = InkAR.create(canvas, { onFrame }); }
  catch (e) { root.insertAdjacentHTML('beforeend', `<div class="modal" style="align-items:center;background:var(--ink)"><div class="empty" style="margin:20px;color:var(--bone)"><div class="h3">The simulated camera needs WebGL</div>Your browser blocked WebGL. You can still browse flash, build designs and prepare a consultation pack.<br><br><a class="btn btn-bone btn-sm" href="#/">Back to studio</a></div></div>`); return; }

  const sk = () => SKINS[AR.skin != null ? AR.skin : S.settings.skin];
  let tex = null, pal = null, line = lineOf(d, mode);
  const B = () => E.body;
  function applySkin() { const s = sk(); E.set({ skin: s.rgb, freckle: s.frk, hair: (AR.hair != null ? AR.hair : S.settings.hair) ? .32 : 0 }); }
  function setBody(b) {
    AR.body = b; E.setBody(b); AR.roll = -B().phiFace; AR.pitch = 0;
    const z = B().defaultZ || 0; AR.place = { f: E.fracFromPhi(z, B().phiFace), z, L: AR.place ? AR.place.L : (d.size || 9), rot: AR.place ? AR.place.rot : 0 };
  }
  E.setBody(AR.body);
  if (AR.roll == null) AR.roll = -B().phiFace;
  if (!AR.place) { const z = B().defaultZ || 0; AR.place = { f: E.fracFromPhi(z, B().phiFace), z, L: d.size || 9, rot: 0 }; }
  applySkin();
  E.set({ zoom: AR.zoom, roll: AR.roll, pitch: AR.pitch, shiftY: -0.27, sway: AR.sway && S.settings.motion && !reduceMotion ? 1 : 0, scan: 0, reveal: 0, hasTat: 0 });

  function syncPlace() {
    if (!tex) return;
    const hC = tex.aspectC >= 1 ? AR.place.L / tex.aspectC : AR.place.L;
    E.state.place = { f: AR.place.f, z: AR.place.z, size: hC * tex.padH, rot: AR.place.rot };
    const side = E.sideFor(AR.place.f);
    AR.placeMult = side.mult; AR.side = side.name;
    E.state.mods = [SUN[AR.sun], side.mult, CARE[AR.care], (AR.lineOverride || line) === 'fine' ? 1.7 : 1];
    $('#rd-place').innerHTML = `${esc(side.name)}`;
    $('#rd-size').innerHTML = `<b>${lenPair(hC * tex.aspectC, hC)}</b>`;
  }
  function syncAge() {
    const days = daysAt(AR.pos);
    if (AR.split) { E.set({ daysL: 0, daysR: days, split: AR.splitX }); } else E.set({ daysL: days, daysR: days, split: -1 });
    const k = Math.round(AR.pos), st = STOPS[clamp(k, 0, 6)], exact = Math.abs(AR.pos - k) < .04;
    const yrs = (days - 30) / 365;
    $('#ab-big').innerHTML = exact ? st.big : days < 30 ? `Day <em>${Math.round(days)}</em>` : `Year <em>${yrs < 1 ? yrs.toFixed(1) : Math.round(yrs)}</em>`;
    $('#ab-sub').textContent = AR.split ? 'Right of split' : (days < 1 ? 'Just tattooed' : days < 30 ? 'Since tattooing' : 'Simulated aging');
    $('#slb').textContent = exact ? st.sub + (k > 2 ? '' : ' · ' + st.label) : (days < 30 ? 'Day ' + Math.round(days) : 'Year ' + (yrs < 1 ? yrs.toFixed(1) : Math.round(yrs)));
    const sl = $('.split-line'); sl.classList.toggle('on', AR.split); sl.style.left = (AR.splitX * 100) + '%';
    $('#sla').classList.toggle('on', AR.split); $('#slb').classList.toggle('on', AR.split);
    $('#sla').style.left = '12px'; $('#slb').style.right = '12px';
    $('#splittog').setAttribute('aria-pressed', AR.split);
    if (AR.tab === 'age') updateAgePanel();
  }

  /* ---------- sheet panels ---------- */
  const sb = $('#sb');
  function renderTab() {
    $$('.sheet-tabs button', root).forEach(b => b.setAttribute('aria-selected', b.dataset.t === AR.tab));
    E.state.edit = AR.tab === 'adjust' ? 1 : 0;
    if (AR.tab === 'design') {
      const list = D.LIB.concat(S.my);
      sb.innerHTML = `<div class="dtiles" role="group" aria-label="Designs">${list.map(x => `<button class="dtile" data-id="${esc(x.id)}" aria-pressed="${x.id === d.id}"><span class="tbox"><img data-thumb="${esc(x.id)}" alt=""></span>${esc(x.name)}</button>`).join('')}</div>
        <div style="display:flex;gap:8px;margin-top:12px"><a class="btn btn-ghost btn-sm" style="flex:1" href="#/builder">${ico('layers')} Build your own</a><label class="btn btn-ghost btn-sm" style="flex:1" tabindex="0">${ico('upload')} Upload<input type="file" class="sr-only" accept="image/png,image/svg+xml,image/jpeg,image/webp" id="arup"></label></div>`;
      hydrateThumbs(sb);
      $$('.dtile', sb).forEach(b => b.onclick = () => { location.hash = '#/ar/' + b.dataset.id; });
      $('#arup', sb).onchange = e => handleUpload(e.target.files[0]).then(() => { const l = S.my[S.my.length - 1]; if (l) location.hash = '#/ar/' + l.id; });
      const cur = $('.dtile[aria-pressed=true]', sb); if (cur) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
    } else if (AR.tab === 'adjust') {
      const z0 = B().zLim;
      sb.innerHTML = `
        <div class="row2"><label for="a-size">Size</label><input type="range" id="a-size" min="2" max="26" step="0.1" value="${AR.place.L}"><output class="mono small" id="o-size"></output></div>
        <div class="row2"><label for="a-rot">Rotate</label><input type="range" id="a-rot" min="-180" max="180" step="1" value="${Math.round(AR.place.rot * 180 / Math.PI)}"><output class="mono small" id="o-rot"></output></div>
        <div class="row2"><label for="a-wrap">Around</label><input type="range" id="a-wrap" min="-0.5" max="0.5" step="0.005" value="${(((AR.place.f % 1) + 1.5) % 1) - .5}"><output class="mono small" id="o-wrap"></output></div>
        <div class="row2"><label for="a-z">Along</label><input type="range" id="a-z" min="${z0[0]}" max="${z0[1]}" step="0.1" value="${AR.place.z}"><output class="mono small" id="o-z"></output></div>
        <div class="nudge" role="group" aria-label="Nudge tattoo">
          <button data-n="l" aria-label="Move left">${ico('l')}</button><button data-n="r" aria-label="Move right">${ico('r')}</button><button data-n="u" aria-label="Move up">${ico('u')}</button><button data-n="d" aria-label="Move down">${ico('d')}</button><button data-n="rl" aria-label="Rotate counter-clockwise">${ico('rl')}</button><button data-n="rr" aria-label="Rotate clockwise">${ico('rr')}</button></div>
        <div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-ghost btn-sm" style="flex:1" id="a-reset">Reset placement</button><button class="btn btn-ghost btn-sm" style="flex:1" id="a-view">Reset view</button></div>`;
      const upd = () => {
        $('#o-size').textContent = len(AR.place.L); $('#o-rot').textContent = Math.round(AR.place.rot * 180 / Math.PI) + '°';
        const fw = (((AR.place.f % 1) + 1.5) % 1) - .5; $('#o-wrap').textContent = Math.round(fw * 360) + '°'; $('#o-z').textContent = (AR.place.z >= 0 ? '+' : '') + len(Math.abs(AR.place.z)).replace(' ', ' ');
        $$('input[type=range]', sb).forEach(rangeFill);
      };
      $('#a-size').oninput = e => { AR.place.L = +e.target.value; syncPlace(); upd(); };
      $('#a-rot').oninput = e => { AR.place.rot = +e.target.value * Math.PI / 180; syncPlace(); upd(); };
      $('#a-wrap').oninput = e => { AR.place.f = +e.target.value; syncPlace(); upd(); };
      $('#a-z').oninput = e => { AR.place.z = +e.target.value; syncPlace(); upd(); };
      $$('.nudge button', sb).forEach(b => b.onclick = () => { nudge(b.dataset.n); renderTabValues(); });
      $('#a-reset').onclick = () => { setBody(AR.body); syncPlace(); renderTab(); };
      $('#a-view').onclick = () => { AR.roll = -B().phiFace; AR.pitch = 0; AR.zoom = 1; E.set({ roll: AR.roll, pitch: 0, zoom: 1 }); };
      upd(); renderTabValues = () => { $('#a-size').value = AR.place.L; $('#a-rot').value = Math.round(AR.place.rot * 180 / Math.PI); $('#a-wrap').value = (((AR.place.f % 1) + 1.5) % 1) - .5; $('#a-z').value = AR.place.z; upd(); };
    } else if (AR.tab === 'age') {
      const ln = AR.lineOverride || line;
      sb.innerHTML = `
        <div class="timeline"><div class="tl-track"><div class="tl-ticks">${STOPS.map((_, i) => `<i style="left:${i / 6 * 100}%"></i>`).join('')}</div>
          <input type="range" id="tl" min="0" max="6" step="0.01" value="${AR.pos}" aria-label="Aging timeline" aria-valuetext=""></div>
          <div class="tl-labels">${STOPS.map((s, i) => `<button data-i="${i}" style="left:${i / 6 * 100}%" aria-label="Jump to ${s.label}">${s.label}<small>${i < 3 ? s.sub : '&nbsp;'}</small></button>`).join('')}</div></div>
        <div class="age-meters"><div class="meter"><b id="m-spread">—</b><span>Line spread</span><div class="bar"><i id="mb-spread"></i></div></div><div class="meter"><b id="m-black">—</b><span>Black density</span><div class="bar"><i id="mb-black"></i></div></div><div class="meter"><b id="m-color">—</b><span>Colour</span><div class="bar"><i id="mb-color"></i></div></div></div>
        <p class="stage-note" id="stnote"></p>
        <div class="mods">
          <label>Sun</label><div class="seg" data-k="sun">${[['low', 'Low'], ['med', 'Medium'], ['high', 'High']].map(([k, l]) => `<button data-v="${k}" aria-pressed="${AR.sun === k}">${l}</button>`).join('')}</div>
          <label>Aftercare</label><div class="seg" data-k="care">${[['great', 'Great'], ['ok', 'Average'], ['poor', 'Poor']].map(([k, l]) => `<button data-v="${k}" aria-pressed="${AR.care === k}">${l}</button>`).join('')}</div>
          <label>Lines</label><div class="seg" data-k="line">${[['fine', 'Fine'], ['bold', 'Bold']].map(([k, l]) => `<button data-v="${k}" aria-pressed="${ln === k}">${l}</button>`).join('')}</div>
          <label>Placement</label><span class="small" id="placef" style="color:var(--bone-2)"></span>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-ghost btn-sm" style="flex:1" id="splitbtn">${ico('split')} ${AR.split ? 'Hide' : 'Fresh vs now'}</button><button class="btn btn-ghost btn-sm" style="flex:1" id="pairbtn">${ico('cam')} Save aging pair</button></div>
        <details class="evidence"><summary><b>Why it ages this way</b></summary>
          <ul><li><b>Black</b> (carbon) is the most stable ink; it fades slowest and holds contrast.</li>
          <li><b>Light inks</b> — yellow, white and pastels — fade fastest; reds and oranges moderately; greens and blues in between.</li>
          <li><b>Sun (UV)</b> is the main accelerant. Covered or SPF-protected skin keeps ink longer.</li>
          <li><b>Ink migrates</b> slowly in the dermis, so lines widen; <b>fine lines</b> blur proportionally more than bold ones.</li>
          <li><b>Friction &amp; placement</b> matter: hands, fingers and outer forearms age faster than calves or backs.</li>
          <li>Many people consider a <b>touch-up after 10–15 years</b>.</li></ul>
          <em>Illustrative simulation — your artist and dermatologist know your skin.</em></details>`;
      const tl = $('#tl', sb);
      tl.oninput = () => { AR.pos = +tl.value; syncAge(); };
      tl.onchange = () => { const k = Math.round(AR.pos); if (Math.abs(AR.pos - k) < .18) { AR.pos = k; tl.value = k; syncAge(); } };
      $$('.tl-labels button', sb).forEach(b => b.onclick = () => animateTo(+b.dataset.i));
      $$('.mods .seg', sb).forEach(sg => $$('button', sg).forEach(b => b.onclick = () => {
        const k = sg.dataset.k; if (k === 'line') AR.lineOverride = b.dataset.v; else AR[k] = b.dataset.v;
        $$('button', sg).forEach(x => x.setAttribute('aria-pressed', x === b)); syncPlace(); syncAge();
      }));
      $('#splitbtn', sb).onclick = toggleSplit;
      $('#pairbtn', sb).onclick = savePair;
      updateAgePanel();
    } else if (AR.tab === 'skin') {
      const hair = AR.hair != null ? AR.hair : S.settings.hair;
      sb.innerHTML = `<span class="sublab">Skin tone · Fitzpatrick</span><div class="swatches" role="group" aria-label="Skin tone">${SKINS.map((s, i) => `<button class="swatch" style="background:${s.hex}" data-i="${i}" aria-pressed="${(AR.skin != null ? AR.skin : S.settings.skin) === i}" aria-label="Type ${s.id}">${s.id}</button>`).join('')}</div>
        <span class="sublab">Body part</span><div class="body-pick" role="group" aria-label="Body part">${[['forearm', 'Forearm'], ['upper', 'Upper arm'], ['calf', 'Calf']].map(([k, l]) => `<button data-b="${k}" aria-pressed="${AR.body === k}">${ico(k)}${l}</button>`).join('')}</div>
        <span class="sublab">Scene</span>
        <div class="toggle-row"><span>Body hair</span><button class="switch" role="switch" id="sw-hair" aria-checked="${hair}" aria-label="Body hair"></button></div>
        <div class="toggle-row"><span>Hand-held camera motion</span><button class="switch" role="switch" id="sw-sway" aria-checked="${AR.sway && S.settings.motion && !reduceMotion}" aria-label="Hand-held motion"></button></div>
        <div class="toggle-row"><span>Live camera background <span class="muted small">(optional)</span></span><button class="switch" role="switch" id="sw-cam" aria-checked="${AR.bg === 'cam'}" aria-label="Live camera background"></button></div>`;
      $$('.swatch', sb).forEach(b => b.onclick = () => { AR.skin = +b.dataset.i; $$('.swatch', sb).forEach(x => x.setAttribute('aria-pressed', x === b)); applySkin(); });
      $$('.body-pick button', sb).forEach(b => b.onclick = () => { setBody(b.dataset.b); $$('.body-pick button', sb).forEach(x => x.setAttribute('aria-pressed', x === b)); E.set({ roll: AR.roll, pitch: 0 }); syncPlace(); syncAge(); rescan(); });
      $('#sw-hair', sb).onclick = e => { AR.hair = !(AR.hair != null ? AR.hair : S.settings.hair); e.currentTarget.setAttribute('aria-checked', AR.hair); applySkin(); };
      $('#sw-sway', sb).onclick = e => { AR.sway = !(E.state.sway > 0); E.state.sway = AR.sway ? 1 : 0; e.currentTarget.setAttribute('aria-checked', AR.sway); };
      $('#sw-cam', sb).onclick = () => toggleCam();
    }
  }
  let renderTabValues = () => {};
  function updateAgePanel() {
    if (!$('#m-spread')) return;
    const days = daysAt(AR.pos), ln = AR.lineOverride || line;
    const m = ageModel(days, { sun: SUN[AR.sun], place: AR.placeMult || 1, care: CARE[AR.care] }, ln, pal);
    $('#m-spread').textContent = days < 20 ? '0.00 mm' : '+' + m.spread.toFixed(2) + ' mm';
    $('#mb-spread').style.width = clamp(m.spread / .6 * 100, 2, 100) + '%'; $('#mb-spread').style.background = m.spread > .3 ? 'var(--verm-2)' : m.spread > .15 ? 'var(--gold)' : 'var(--ok)';
    const bk = m.black * (days < 25 ? 1 : 1); $('#m-black').textContent = Math.round(bk * 100) + '%'; $('#mb-black').style.width = bk * 100 + '%';
    if (m.color == null) { $('#m-color').textContent = 'n/a'; $('#mb-color').style.width = '0'; }
    else { $('#m-color').textContent = Math.round(m.color * 100) + '%'; $('#mb-color').style.width = m.color * 100 + '%'; $('#mb-color').style.background = m.color < .62 ? 'var(--verm-2)' : m.color < .8 ? 'var(--gold)' : 'var(--ok)'; }
    const k = clamp(Math.round(AR.pos), 0, 6);
    $('#stnote').innerHTML = STOPS[k].note + (m.touch && k >= 4 ? ' <b style="color:var(--gold)">Touch-up likely worth discussing.</b>' : '');
    $('#placef').innerHTML = `${esc(AR.side || '')} · ×${(AR.placeMult || 1).toFixed(2)} fade rate`;
    $$('.tl-labels button', sb).forEach((b, i) => b.setAttribute('aria-current', Math.abs(AR.pos - i) < .04));
    const tl = $('#tl', sb); if (tl) { tl.value = AR.pos; rangeFill(tl); tl.setAttribute('aria-valuetext', STOPS[k].label); }
  }
  let anim = 0;
  function animateTo(i) {
    cancelAnimationFrame(anim);
    if (reduceMotion) { AR.pos = i; syncAge(); return; }
    const from = AR.pos, t0 = performance.now(), dur = 520 + Math.abs(i - from) * 90;
    const stepf = now => { const t = clamp((now - t0) / dur, 0, 1), e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; AR.pos = from + (i - from) * e; syncAge(); if (t < 1) anim = requestAnimationFrame(stepf); };
    anim = requestAnimationFrame(stepf);
  }
  function toggleSplit() { AR.split = !AR.split; if (AR.split && AR.pos < 3) AR.pos = 5; syncAge(); if (AR.tab === 'age') renderTab(); }
  $$('.sheet-tabs button', root).forEach(b => b.onclick = () => { AR.tab = b.dataset.t; renderTab(); });
  $('#splittog').onclick = toggleSplit;

  /* ---------- tracking intro ---------- */
  const trk = $('#trk'), track = $('#track'), brk = $('.ar-brackets');
  let scanStart = 0, phase = 'scan', confT = 0;
  function rescan() { scanStart = performance.now(); phase = 'scan'; track.classList.remove('locked'); brk.classList.add('scan'); brk.classList.remove('locked'); trk.textContent = 'Scanning skin surface…'; E.set({ scan: 0.001, reveal: 0, lock: 0 }); }
  function tickIntro(now) {
    if (phase === 'scan') {
      const t = (now - scanStart) / (reduceMotion ? 1 : 2300);
      E.state.scan = clamp(t, 0.001, 1);
      if (t > .55 && trk.textContent.startsWith('Scanning')) trk.textContent = 'Mapping surface · ' + Math.round(t * 100) + '%';
      else if (t > .55) trk.textContent = 'Mapping surface · ' + Math.min(99, Math.round(t * 100)) + '%';
      if (t >= 1) { phase = 'lock'; scanStart = now; E.state.scan = 0; E.state.lock = 1; track.classList.add('locked'); brk.classList.remove('scan'); brk.classList.add('locked'); }
    } else if (phase === 'lock') {
      const t = (now - scanStart) / (reduceMotion ? 1 : 900);
      E.state.lock = clamp(1 - t, 0, 1); E.state.reveal = tex ? clamp(t * 1.3, 0, 1) : 0;
      if (t >= 1 && tex) { phase = 'live'; E.state.lock = 0; E.state.reveal = 1; }
    }
    if (phase !== 'scan' && now - confT > 900) { confT = now; trk.innerHTML = `Tracking locked <span class="conf">${(94 + Math.random() * 4.6).toFixed(1)}%</span>`; }
  }

  /* ---------- per-frame HUD ---------- */
  const handle = $('#handle');
  function corners() {
    if (!tex) return null;
    const hC = tex.aspectC >= 1 ? AR.place.L / tex.aspectC : AR.place.L, wC = hC * tex.aspectC;
    const per = E.perimeter(AR.place.z), cr = Math.cos(AR.place.rot), sr = Math.sin(AR.place.rot);
    const pt = (X, Y) => { const dx = cr * X - sr * Y, dz = sr * X + cr * Y; return E.project(AR.place.f + dx / per, AR.place.z + dz); };
    return { c: E.project(AR.place.f, AR.place.z), tr: pt(wC / 2 + .5, hC / 2 + .5), w: wC, h: hC };
  }
  function onFrame(now) {
    tickIntro(now);
    if (phase === 'live' && E.state.edit < .99 && AR.tab === 'adjust') E.state.edit = 1;
    const k = corners();
    if (k && k.c && k.tr && phase === 'live' && AR.tab === 'adjust' && k.c.facing) {
      handle.hidden = false; handle.style.left = k.tr.x + 'px'; handle.style.top = k.tr.y + 'px';
    } else handle.hidden = true;
  }

  /* ---------- gestures ---------- */
  const ptrs = new Map(); let gesture = null;
  function local(e) { const r = canvas.getBoundingClientRect(); const s = r.width / canvas.clientWidth; return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s }; }
  function hitTattoo(p) { const k = corners(); if (!k || !k.c || !k.tr || !k.c.facing) return false; const R = Math.hypot(k.tr.x - k.c.x, k.tr.y - k.c.y) * .85; return Math.hypot(p.x - k.c.x, p.y - k.c.y) < R; }
  function jac() {
    const e1 = .004, e2 = .2; const c = E.project(AR.place.f, AR.place.z), a = E.project(AR.place.f + e1, AR.place.z), b = E.project(AR.place.f, AR.place.z + e2);
    return { a: (a.x - c.x) / e1, b: (b.x - c.x) / e2, c: (a.y - c.y) / e1, d: (b.y - c.y) / e2 };
  }
  function moveBy(dx, dy) {
    const J = jac(), det = J.a * J.d - J.b * J.c; if (Math.abs(det) < 1e-6) return;
    const df = (J.d * dx - J.b * dy) / det, dz = (-J.c * dx + J.a * dy) / det;
    AR.place.f += clamp(df, -.05, .05); AR.place.z = clamp(AR.place.z + clamp(dz, -2, 2), B().zLim[0], B().zLim[1]); syncPlace();
  }
  function hideHint() { const h = $('#hint'); if (h) h.style.opacity = 0; }
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId); const p = local(e); ptrs.set(e.pointerId, p); hideHint();
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; gesture = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), z0: AR.zoom }; return; }
    gesture = phase === 'live' && hitTattoo(p) ? { type: 'move', last: p } : { type: 'orbit', last: p };
    if (gesture.type === 'move') { E.state.edit = 1; }
  });
  canvas.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) { canvas.style.cursor = phase === 'live' && hitTattoo(local(e)) ? 'move' : 'grab'; return; }
    const p = local(e); ptrs.set(e.pointerId, p);
    if (!gesture) return;
    if (gesture.type === 'pinch' && ptrs.size >= 2) { const [a, b] = [...ptrs.values()]; AR.zoom = clamp(gesture.z0 * Math.hypot(a.x - b.x, a.y - b.y) / gesture.d0, .7, 2.8); E.state.zoom = AR.zoom; return; }
    const dx = p.x - gesture.last.x, dy = p.y - gesture.last.y; gesture.last = p;
    if (gesture.type === 'move') moveBy(dx, dy);
    else if (gesture.type === 'orbit') { AR.roll += dx * .009; AR.pitch = clamp(AR.pitch + dy * .004, -.35, .35); E.set({ roll: AR.roll, pitch: AR.pitch }); }
  });
  const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2 && gesture && gesture.type === 'pinch') gesture = null; if (!ptrs.size) { if (gesture && gesture.type === 'move' && AR.tab !== 'adjust') E.state.edit = 0; gesture = null; renderTabValues(); } };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); AR.zoom = clamp(AR.zoom * Math.exp(-e.deltaY * .0012), .7, 2.8); E.state.zoom = AR.zoom; }, { passive: false });
  // handle: scale + rotate around tattoo centre
  handle.addEventListener('pointerdown', e => {
    e.stopPropagation(); handle.setPointerCapture(e.pointerId);
    const k = corners(); const p = local(e);
    // which way does +rot turn on screen here?
    const r0 = AR.place.rot; AR.place.rot += .05; const k2 = corners(); AR.place.rot = r0;
    const sgn = Math.sign(Math.atan2(k2.tr.y - k2.c.y, k2.tr.x - k2.c.x) - Math.atan2(k.tr.y - k.c.y, k.tr.x - k.c.x)) || 1;
    gesture = { type: 'handle', c: k.c, v0: [p.x - k.c.x, p.y - k.c.y], L0: AR.place.L, rot0: AR.place.rot, sgn };
  });
  handle.addEventListener('pointermove', e => {
    if (!gesture || gesture.type !== 'handle') return;
    const p = local(e), v = [p.x - gesture.c.x, p.y - gesture.c.y];
    const s = Math.hypot(v[0], v[1]) / Math.max(10, Math.hypot(gesture.v0[0], gesture.v0[1]));
    const da = Math.atan2(v[1], v[0]) - Math.atan2(gesture.v0[1], gesture.v0[0]);
    AR.place.L = clamp(gesture.L0 * s, 2, 26); AR.place.rot = gesture.rot0 + da * gesture.sgn; syncPlace(); renderTabValues();
  });
  handle.addEventListener('pointerup', () => { gesture = null; });
  handle.addEventListener('keydown', e => { if (e.key === '+' || e.key === '=') nudge('+'); if (e.key === '-') nudge('-'); });
  function nudge(n) {
    const per = E.perimeter(AR.place.z);
    if (n === 'l') AR.place.f -= .4 / per; if (n === 'r') AR.place.f += .4 / per;
    if (n === 'u') AR.place.z = clamp(AR.place.z + .4, B().zLim[0], B().zLim[1]); if (n === 'd') AR.place.z = clamp(AR.place.z - .4, B().zLim[0], B().zLim[1]);
    if (n === 'rl') AR.place.rot += 5 * Math.PI / 180; if (n === 'rr') AR.place.rot -= 5 * Math.PI / 180;
    if (n === '+') AR.place.L = clamp(AR.place.L + .5, 2, 26); if (n === '-') AR.place.L = clamp(AR.place.L - .5, 2, 26);
    syncPlace();
  }
  canvas.addEventListener('keydown', e => {
    const map = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd', '[': 'rl', ']': 'rr', '+': '+', '=': '+', '-': '-' };
    if (map[e.key]) { e.preventDefault(); nudge(map[e.key]); renderTabValues(); }
    if (e.key === ',' || e.key === '.') { AR.roll += e.key === ',' ? -.1 : .1; E.state.roll = AR.roll; }
  });
  // split drag
  const sl = $('.split-line');
  sl.addEventListener('pointerdown', e => { sl.setPointerCapture(e.pointerId); gesture = { type: 'split' }; });
  sl.addEventListener('pointermove', e => { if (!gesture || gesture.type !== 'split') return; AR.splitX = clamp(local(e).x / canvas.clientWidth, .08, .92); syncAge(); });
  sl.addEventListener('pointerup', () => gesture = null);

  /* ---------- camera background ---------- */
  let stream = null, video = null;
  async function toggleCam() {
    if (AR.bg === 'cam') { stopCam(); AR.bg = 'room'; E.set({ camMode: 0 }); syncCamUI(); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
      video = document.createElement('video'); video.muted = true; video.playsInline = true; video.srcObject = stream; await video.play();
      const fm = stream.getVideoTracks()[0].getSettings().facingMode;
      E.set({ camMode: 1, video, mirror: fm === 'user' || !fm ? 1 : 0 }); AR.bg = 'cam'; toast('Live camera behind the simulated limb');
    } catch (e) { AR.bg = 'room'; toast('Camera unavailable — using the studio scene'); }
    syncCamUI();
  }
  function stopCam() { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; video = null; }
  function syncCamUI() { $('#camtog').setAttribute('aria-pressed', AR.bg === 'cam'); const sw = $('#sw-cam'); if (sw) sw.setAttribute('aria-checked', AR.bg === 'cam'); }
  $('#camtog').onclick = toggleCam;
  if (AR.bg === 'cam') { AR.bg = 'room'; toggleCam(); }

  /* ---------- capture ---------- */
  async function capture(silent) {
    const edit = E.state.edit; E.state.edit = 0;
    const url = E.capture('image/png'); E.state.edit = edit;
    const img = await loadImg(url);
    const W = 720, H = Math.round(W * img.height / img.width);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
    x.drawImage(img, 0, 0, W, H);
    const days = daysAt(AR.pos), k = Math.round(AR.pos), exact = Math.abs(AR.pos - k) < .04;
    const stage = exact ? STOPS[k].sub + (k < 3 ? ' · ' + STOPS[k].label : '') : (days < 30 ? 'Day ' + Math.round(days) : 'Year ' + Math.round((days - 30) / 365));
    const g = x.createLinearGradient(0, H - 150, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.72)'); x.fillStyle = g; x.fillRect(0, H - 150, W, 150);
    x.fillStyle = '#f3ecdf'; x.font = '500 34px Fraunces, Lora, Georgia, serif'; x.fillText(d.name, 32, H - 66);
    x.font = '600 17px "JetBrains Mono", "DejaVu Sans Mono", monospace'; x.fillStyle = 'rgba(243,236,223,.82)';
    const hC = tex.aspectC >= 1 ? AR.place.L / tex.aspectC : AR.place.L;
    x.fillText(`${(AR.split ? 'FRESH | ' : '') + stage.toUpperCase()} · ${AR.side.toUpperCase()} · ${lenPair(hC * tex.aspectC, hC).toUpperCase()}`, 32, H - 34);
    x.textAlign = 'right'; x.fillStyle = 'rgba(243,236,223,.55)'; x.fillText('INK STUDY · SIMULATED', W - 32, 64); x.textAlign = 'left';
    const full = cv.toDataURL('image/png');
    const th = document.createElement('canvas'); th.width = 240; th.height = Math.round(240 * H / W); th.getContext('2d').drawImage(cv, 0, 0, th.width, th.height);
    const cap = { id: 'c' + uid(), t: Date.now(), design: d.id, mode, designName: d.name, body: AR.body, side: AR.side, sizeCm: [+(hC * tex.aspectC).toFixed(1), +hC.toFixed(1)], days: Math.round(days), stage: (AR.split ? 'Fresh | ' : '') + stage, sun: AR.sun, care: AR.care, line: AR.lineOverride || line, skin: SKINS[AR.skin != null ? AR.skin : S.settings.skin].id, thumb: th.toDataURL('image/jpeg', .82) };
    await IDB.set('cap:' + cap.id, full);
    S.caps.push(cap); if (!S.consult.sel.includes(cap.id)) S.consult.sel.push(cap.id); save();
    $('#lastcap').style.backgroundImage = `url(${cap.thumb})`;
    if (!silent) { const fx = $('.flashfx'); fx.classList.remove('go'); void fx.offsetWidth; fx.classList.add('go'); toast('Saved to Sessions · ' + stage); }
    return cap;
  }
  $('#shutter').onclick = () => { if (tex) capture(); };
  async function savePair() {
    const pos = AR.pos, split = AR.split; AR.split = false;
    AR.pos = 0; syncAge(); const a = await capture(true);
    AR.pos = pos < 3 ? 5 : pos; syncAge(); const b = await capture(true);
    AR.pos = pos; AR.split = split; syncAge();
    S.cmp = [a.id, b.id]; save();
    const fx = $('.flashfx'); fx.classList.remove('go'); void fx.offsetWidth; fx.classList.add('go');
    toast('Aging pair saved — open Compare in Sessions');
  }
  const lc = S.caps[S.caps.length - 1]; if (lc) $('#lastcap').style.backgroundImage = `url(${lc.thumb})`;

  /* ---------- load design ---------- */
  (async () => {
    const t = await textureFor(d, mode || undefined);
    tex = t; pal = analyze(t.canvas);
    E.setTattoo(t.tex, t.aspectP); E.state.hasTat = 1; E.state.reveal = phase === 'live' ? 1 : 0;
    syncPlace(); syncAge(); renderTab();
  })();
  syncAge(); renderTab(); rescan();
  E.start();
  const onVis = () => { if (document.hidden) E.stop(); else E.start(); };
  document.addEventListener('visibilitychange', onVis);
  cleanup = () => { cancelAnimationFrame(anim); document.removeEventListener('visibilitychange', onVis); stopCam(); AR.zoom = E.state.zoom; E.destroy(); };
  window.__ar = { E, AR, capture, savePair, syncAge, syncPlace, renderTab, animateTo };
}

/* ================= Sessions ================= */
function viewSessions() {
  const caps = S.caps.slice().reverse();
  const v = shell('sessions', `
  <div class="page-head"><span class="eyebrow">${caps.length} capture${caps.length === 1 ? '' : 's'} · stored on this device</span><h1 class="display">Sessions</h1></div>
  <section class="section" style="margin-top:16px"><div class="grid2">
    <a class="promo" href="#/compare" style="margin:0;padding:16px;display:block;text-decoration:none;color:inherit;background:linear-gradient(140deg,#1d1a17,#121110);border-color:var(--line-2)"><span class="eyebrow">Side by side</span><div class="h2" style="margin:8px 0 4px;font-size:21px">Compare</div><span class="muted small">Two captures, a slider, the differences.</span></a>
    <a class="promo" href="#/consult" style="margin:0;padding:16px;display:block;text-decoration:none;color:inherit"><span class="eyebrow">For your artist</span><div class="h2" style="margin:8px 0 4px;font-size:21px">Consult pack</div><span class="muted small">Captures, notes, questions → PDF.</span></a>
  </div></section>
  <section class="section">${caps.length ? `<div class="sessions">${caps.map(c => `<button class="sess" data-id="${c.id}" aria-label="Open capture ${esc(c.designName)}, ${esc(c.stage)}"><img src="${c.thumb}" alt=""><span class="lbl">${esc(c.designName)}<br>${esc(c.stage)}</span></button>`).join('')}</div>`
      : `<div class="empty"><div class="h3">Nothing captured yet</div>Open the AR camera and press the shutter — or save an aging pair from the Age panel.<br><br><a class="btn btn-primary btn-sm" href="#/ar/${esc(S.last)}">${ico('cam')} Open camera</a></div>`}</section>`);
  $$('.sess', v).forEach(b => b.onclick = () => openCapture(b.dataset.id));
}
async function openCapture(id) {
  const c = S.caps.find(x => x.id === id); if (!c) return;
  const full = await IDB.get('cap:' + id) || c.thumb;
  const m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Capture');
  m.innerHTML = `<div class="panel"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div><span class="eyebrow">${new Date(c.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${esc(c.side)}</span><div class="h2" style="margin-top:4px">${esc(c.designName)}</div></div><button class="icon-btn" data-x aria-label="Close">${ico('close')}</button></div>
    <img src="${full}" alt="" style="width:100%;border-radius:16px;display:block;max-height:420px;object-fit:cover">
    <div style="display:flex;gap:8px;margin-top:14px"><button class="btn btn-primary btn-sm" style="flex:1" data-cmp>Compare</button><a class="btn btn-ghost btn-sm" style="flex:1" href="#/ar/${esc(c.design)}${c.mode ? '/' + c.mode : ''}" data-x2>Re-open in AR</a><button class="btn btn-ghost btn-sm" data-del aria-label="Delete capture">${ico('trash')}</button></div></div>`;
  app.appendChild(m);
  const close = () => m.remove();
  m.onclick = e => { if (e.target === m || e.target.closest('[data-x]')) close(); };
  $('[data-x2]', m).onclick = close;
  $('[data-cmp]', m).onclick = () => { const other = S.caps.slice().reverse().find(x => x.id !== id); S.cmp = [id, other ? other.id : id]; save(); close(); location.hash = '#/compare'; };
  $('[data-del]', m).onclick = () => { S.caps = S.caps.filter(x => x.id !== id); S.consult.sel = S.consult.sel.filter(x => x !== id); IDB.del('cap:' + id); save(); close(); route(); };
}

/* ================= Compare ================= */
let cmpMode = 'slider';
function viewCompare() {
  if (S.caps.length < 2) {
    shell('sessions', `<div class="back-row"><a class="icon-btn" href="#/sessions" aria-label="Back">${ico('back')}</a><span class="eyebrow">Compare</span></div>
      <div class="page-head"><h1 class="display" style="margin-top:8px">Compare <em>two</em></h1></div>
      <section class="section"><div class="empty"><div class="h3">You need two captures</div>Capture two placements, or let us make a Fresh vs Year 10 pair of <b>${esc((getDesign(S.last) || {}).name || 'your design')}</b> right now.<br><br><button class="btn btn-primary btn-sm" id="mk">${ico('spark')} Make an aging pair</button></div></section>`);
    $('#mk').onclick = async () => { $('#mk').textContent = 'Rendering…'; await makePair(S.last); route(); };
    return;
  }
  let [a, b] = (S.cmp || []).map(id => S.caps.find(c => c.id === id));
  if (!a || !b) { a = S.caps[S.caps.length - 2]; b = S.caps[S.caps.length - 1]; }
  const v = shell('sessions', `<div class="back-row"><a class="icon-btn" href="#/sessions" aria-label="Back">${ico('back')}</a><span class="eyebrow">Compare</span><span style="flex:1"></span><div class="seg" style="width:180px" role="group" aria-label="Compare mode"><button data-m="slider" aria-pressed="${cmpMode === 'slider'}">Slider</button><button data-m="side" aria-pressed="${cmpMode === 'side'}">Side by side</button></div></div>
    <div id="cmpbox"></div>
    <div class="pick-row" role="group" aria-label="Choose captures. Tap to set A, tap again to set B">${S.caps.slice().reverse().map(c => `<button data-id="${c.id}" class="${c.id === a.id ? 'a' : c.id === b.id ? 'b' : ''}" aria-label="${esc(c.designName)} ${esc(c.stage)}"><img src="${c.thumb}" alt="">${c.id === a.id ? '<b>A</b>' : c.id === b.id ? '<b>B</b>' : ''}</button>`).join('')}</div>
    <div class="cmp-table" id="ctab"></div>
    <section class="section"><a class="btn btn-primary btn-block" href="#/consult">${ico('doc')} Add to consultation pack</a></section>`);
  async function draw() {
    const [fa, fb] = await Promise.all([IDB.get('cap:' + a.id), IDB.get('cap:' + b.id)]);
    const A = fa || a.thumb, Bi = fb || b.thumb;
    $('#cmpbox', v).innerHTML = cmpMode === 'slider'
      ? `<div class="cmp" style="--x:50%"><img src="${A}" alt="A: ${esc(a.designName)} ${esc(a.stage)}"><div class="b-wrap"><img src="${Bi}" alt="B: ${esc(b.designName)} ${esc(b.stage)}"></div><div class="div"><span>${ico('split')}</span></div><span class="lab a glass">A · ${esc(a.stage)}</span><span class="lab b glass">B · ${esc(b.stage)}</span><input type="range" min="0" max="100" value="50" aria-label="Reveal B"></div>`
      : `<div class="cmp-side"><figure><img src="${A}" alt=""><figcaption>A · ${esc(a.stage)}<br>${esc(a.side)}</figcaption></figure><figure><img src="${Bi}" alt=""><figcaption>B · ${esc(b.stage)}<br>${esc(b.side)}</figcaption></figure></div>`;
    const r = $('.cmp input', v); if (r) r.oninput = () => $('.cmp', v).style.setProperty('--x', r.value + '%');
    const row = (k, x, y) => `<div><span>${k}</span><span>${esc(x)}</span><span style="${x !== y ? 'color:var(--verm-2)' : ''}">${esc(y)}</span></div>`;
    $('#ctab', v).innerHTML = row('', 'A', 'B') + row('Design', a.designName, b.designName) + row('Placement', a.side, b.side) + row('Size', lenPair(a.sizeCm[0], a.sizeCm[1]), lenPair(b.sizeCm[0], b.sizeCm[1])) + row('Stage', a.stage, b.stage) + row('Sun / care', a.sun + ' / ' + a.care, b.sun + ' / ' + b.care) + row('Skin', 'Type ' + a.skin, 'Type ' + b.skin);
  }
  draw();
  $$('.seg button', v).forEach(btn => btn.onclick = () => { cmpMode = btn.dataset.m; $$('.seg button', v).forEach(x => x.setAttribute('aria-pressed', x === btn)); draw(); });
  let next = 'a';
  $$('.pick-row button', v).forEach(btn => btn.onclick = () => {
    const c = S.caps.find(x => x.id === btn.dataset.id); if (next === 'a') { a = c; next = 'b'; } else { b = c; next = 'a'; }
    S.cmp = [a.id, b.id]; save(); route();
  });
}
async function makePair(designId) {
  const d = getDesign(designId) || getDesign('rose');
  const out = [];
  for (const k of [0, 5]) {
    const url = await snap({ design: d.id, w: 393, h: 600, dpr: 1.6, days: STOPS[k].days, zoom: 1.25, sizeCm: d.size || 9, shiftY: -0.05, type: 'image/png' });
    if (!url) break;
    const th = await (async () => { const img = await loadImg(url); const c = document.createElement('canvas'); c.width = 240; c.height = Math.round(240 * img.height / img.width); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .82); })();
    const cap = { id: 'c' + uid(), t: Date.now(), design: d.id, designName: d.name, body: 'forearm', side: 'Inner forearm', sizeCm: [d.size || 9, d.size || 9], days: STOPS[k].days, stage: STOPS[k].sub + (k < 3 ? ' · ' + STOPS[k].label : ''), sun: 'med', care: 'ok', line: lineOf(d), skin: SKINS[S.settings.skin].id, thumb: th };
    await IDB.set('cap:' + cap.id, url); S.caps.push(cap); out.push(cap.id);
  }
  if (out.length === 2) { S.cmp = out; out.forEach(id => { if (!S.consult.sel.includes(id)) S.consult.sel.push(id); }); }
  save();
}

/* ================= Consultation pack ================= */
const QUESTIONS = [
  { id: 'q1', g: 'Placement', t: 'Is this placement and size right for the level of detail in the design?' },
  { id: 'q2', g: 'Placement', t: 'How will it look when my arm moves or the skin stretches?' },
  { id: 'q3', g: 'Linework', t: 'Would bolder outlines or more spacing help it stay readable in 10+ years?' },
  { id: 'q4', g: 'Linework', t: 'Are any fine details too small to hold up as the ink settles?' },
  { id: 'q5', g: 'Over time', t: 'Which colours in this palette fade first on my skin tone, and what would you swap?' },
  { id: 'q6', g: 'Over time', t: 'When would you expect a touch-up, and is it included?' },
  { id: 'q7', g: 'Healing', t: 'What aftercare do you recommend, and how long until it’s fully healed?' },
  { id: 'q8', g: 'Practical', t: 'How many sessions, roughly how long, and what’s the deposit?' }
];
function viewConsult() {
  const C = S.consult; const caps = S.caps.slice().reverse();
  const v = shell('sessions', `<div class="back-row"><a class="icon-btn" href="#/sessions" aria-label="Back">${ico('back')}</a><span class="eyebrow">Consultation pack</span></div>
    <div class="page-head"><h1 class="display" style="margin-top:8px">Brief your <em>artist</em></h1><p class="muted small" style="margin:8px 0 0">Choose captures, add notes and questions, then export a one-page PDF to bring or email.</p></div>
    <div class="steps" aria-hidden="true"><i class="on"></i><i class="on"></i><i class="on"></i></div>
    <section class="section"><div class="section-head"><h2 class="h2">1 · Captures</h2><span class="muted small" id="selc"></span></div>
      ${caps.length ? `<div class="sessions">${caps.map(c => `<label class="sess"><img src="${c.thumb}" alt=""><input type="checkbox" data-id="${c.id}" ${C.sel.includes(c.id) ? 'checked' : ''} aria-label="Include ${esc(c.designName)} ${esc(c.stage)}"><span class="lbl">${esc(c.designName)}<br>${esc(c.stage)}</span></label>`).join('')}</div>`
        : `<div class="empty">No captures yet. <button class="link" id="mk2">Make an aging pair</button> or <a class="link" href="#/ar/${esc(S.last)}">open the camera</a>.</div>`}</section>
    <section class="section"><h2 class="h2" style="margin-bottom:12px">2 · Your idea</h2>
      <textarea class="field" id="idea" placeholder="What it means to you, the feel you’re after, references you love…" aria-label="Your idea">${esc(C.idea)}</textarea>
      <textarea class="field" id="notes" style="margin-top:8px;min-height:72px" placeholder="Practical notes: budget, timing, allergies, previous tattoos…" aria-label="Practical notes">${esc(C.notes)}</textarea></section>
    <section class="section"><div class="section-head"><h2 class="h2">3 · Questions</h2><span class="muted small" id="aibox"></span></div>
      <div class="qlist">${QUESTIONS.concat(C.custom.map((t, i) => ({ id: 'c' + i, g: 'Mine', t }))).map(q => `<label class="q"><input type="checkbox" data-q="${q.id}" ${C.q.includes(q.id) || q.id[0] === 'c' ? 'checked' : ''}><span><small>${esc(q.g)}</small>${esc(q.t)}</span></label>`).join('')}</div>
      <div class="field" style="margin-top:8px"><input id="newq" placeholder="Add your own question…" aria-label="Add your own question"><button class="btn btn-sm btn-ghost" id="addq">Add</button></div></section>
    <section class="section"><h2 class="h2" style="margin-bottom:4px">Preview</h2></section>
    <div class="doc-preview" id="prev"></div>
    <section class="section"><button class="btn btn-primary btn-block" id="pdf">${ico('doc')} Export PDF</button>
      <button class="btn btn-ghost btn-block" id="copy" style="margin-top:8px">Copy summary text</button></section>`);
  const upd = () => {
    const sel = C.sel.filter(id => S.caps.some(c => c.id === id));
    $('#selc', v).textContent = sel.length + ' selected';
    const cs = sel.map(id => S.caps.find(c => c.id === id));
    const qs = selectedQs();
    $('#prev', v).innerHTML = `<span class="eyebrow">Ink Study · Consultation</span><h3>${esc(cs[0] ? cs[0].designName : 'My tattoo idea')}</h3><div style="color:#6b5f50">${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} · ${cs.length} capture${cs.length === 1 ? '' : 's'} · ${qs.length} questions</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:12px 0">${cs.slice(0, 8).map(c => `<img src="${c.thumb}" alt="" style="width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:4px">`).join('')}</div>
      ${C.idea ? `<p style="margin:0 0 8px;font:italic 13px/1.4 var(--serif)">“${esc(C.idea.slice(0, 160))}${C.idea.length > 160 ? '…' : ''}”</p>` : ''}
      <ol style="margin:0;padding-left:18px">${qs.slice(0, 4).map(q => `<li>${esc(q)}</li>`).join('')}${qs.length > 4 ? `<li style="list-style:none;color:#8a7c6a">+ ${qs.length - 4} more</li>` : ''}</ol>`;
  };
  const selectedQs = () => QUESTIONS.filter(q => C.q.includes(q.id)).map(q => q.t).concat(C.custom);
  $$('.sess input', v).forEach(i => i.onchange = () => { C.sel = i.checked ? C.sel.concat(i.dataset.id) : C.sel.filter(x => x !== i.dataset.id); save(); upd(); });
  $$('.q input', v).forEach(i => i.onchange = () => { const id = i.dataset.q; if (id[0] === 'c') { if (!i.checked) { C.custom.splice(+id.slice(1), 1); save(); route(); } return; } C.q = i.checked ? C.q.concat(id) : C.q.filter(x => x !== id); save(); upd(); });
  $('#idea', v).oninput = e => { C.idea = e.target.value; save(); upd(); };
  $('#notes', v).oninput = e => { C.notes = e.target.value; save(); };
  $('#addq', v).onclick = () => { const t = $('#newq', v).value.trim(); if (!t) return; C.custom.push(t.slice(0, 200)); save(); route(); };
  const mk2 = $('#mk2', v); if (mk2) mk2.onclick = async () => { mk2.textContent = 'Rendering…'; await makePair(S.last); route(); };
  $('#pdf', v).onclick = () => exportPack();
  $('#copy', v).onclick = async () => {
    const cs = C.sel.map(id => S.caps.find(c => c.id === id)).filter(Boolean);
    const txt = `Tattoo consultation — ${cs[0] ? cs[0].designName : ''}\n\nIdea: ${C.idea}\nNotes: ${C.notes}\n\nCaptures:\n${cs.map(c => `• ${c.designName} — ${c.side}, ${lenPair(c.sizeCm[0], c.sizeCm[1])}, ${c.stage}`).join('\n')}\n\nQuestions:\n${selectedQs().map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n(Illustrative simulation from INK STUDY.)`;
    try { await navigator.clipboard.writeText(txt); toast('Copied to clipboard'); } catch (e) { toast('Copy failed — select text in the PDF instead'); }
  };
  upd();
  // optional AI-drafted questions when the deployment has a model configured
  fetch('/api/health').then(r => r.json()).then(h => {
    if (!h.ai) return; const box = $('#aibox', v); if (!box) return;
    box.innerHTML = `<button class="link" id="ai">${ico('spark').replace('<svg', '<svg style="width:13px;height:13px;vertical-align:-2px;stroke:currentColor;fill:none"')} Draft with AI</button>`;
    $('#ai', v).onclick = async () => {
      const c = S.caps.find(x => C.sel.includes(x.id));
      box.textContent = 'Drafting…';
      try {
        const r = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task: 'ink-questions', design: c ? c.designName : '', region: c ? c.side : '', size: c ? lenPair(c.sizeCm[0], c.sizeCm[1]) : '', intent: C.idea, concerns: C.notes, scenario: c ? c.stage : '' }) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error);
        (j.questions || []).forEach(q => { if (!C.custom.includes(q.text)) C.custom.push(q.text); }); save(); route(); toast('Added AI-drafted questions — edit freely');
      } catch (e) { box.textContent = 'AI unavailable'; }
    };
  }).catch(() => {});
}
async function exportPack() {
  const C = S.consult; const cs = C.sel.map(id => S.caps.find(c => c.id === id)).filter(Boolean);
  const imgs = await Promise.all(cs.map(async c => (await IDB.get('cap:' + c.id)) || c.thumb));
  const qs = QUESTIONS.filter(q => C.q.includes(q.id)).map(q => q.t).concat(C.custom);
  let root = document.getElementById('print-root'); if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
  root.innerHTML = `<div class="pp-head"><div><div style="font:600 8pt Helvetica,Arial;letter-spacing:3px;color:#a8301b">INK STUDY · CONSULTATION PACK</div><h1>${esc(cs[0] ? cs[0].designName : 'My tattoo idea')}</h1></div><div style="text-align:right;font:9pt Helvetica,Arial;color:#555">${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}<br>${cs.length} capture(s)</div></div>
    ${C.idea ? `<h2>The idea</h2><p>${esc(C.idea)}</p>` : ''}
    <h2>Captures</h2><div class="pp-grid">${cs.map((c, i) => `<figure><img src="${imgs[i]}" alt=""><figcaption><b>${esc(c.designName)}</b> — ${esc(c.side)}, ${esc(lenPair(c.sizeCm[0], c.sizeCm[1]))}<br>${esc(c.stage)} · sun ${esc(c.sun)} · skin type ${esc(c.skin)}</figcaption></figure>`).join('')}</div>
    <h2>Placement &amp; size</h2><table>${cs.map(c => `<tr><td>${esc(c.designName)}</td><td>${esc(c.side)}</td><td>${esc(lenPair(c.sizeCm[0], c.sizeCm[1]))}</td><td>${esc(c.line)} lines</td></tr>`).join('')}</table>
    <h2>Questions for my artist</h2><ol>${qs.map(q => `<li>${esc(q)}</li>`).join('')}</ol>
    ${C.notes ? `<h2>Notes</h2><p>${esc(C.notes)}</p>` : ''}
    <p class="note">Aging images are an illustrative simulation (ink migration, pigment-specific fading, sun, placement and aftercare modifiers). They are not a prediction for any individual. Your artist and dermatologist know your skin.</p>`;
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  await Promise.all([...root.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  window.print();
  setTimeout(done, 1500);
}

/* ================= Settings ================= */
function viewSettings() {
  const st = S.settings;
  const v = shell('studio', `<div class="back-row"><a class="icon-btn" href="#/" aria-label="Back">${ico('back')}</a><span class="eyebrow">Settings</span></div>
    <div class="page-head"><h1 class="display" style="margin-top:8px">Settings</h1></div>
    <section class="section"><span class="sublab">Default skin tone</span><div class="swatches" role="group" aria-label="Default skin tone" style="justify-content:space-between">${SKINS.map((s, i) => `<button class="swatch" style="width:44px;height:44px;background:${s.hex}" data-i="${i}" aria-pressed="${st.skin === i}" aria-label="Fitzpatrick type ${s.id}">${s.id}</button>`).join('')}</div>
      <p class="muted small" style="margin-top:8px">Fitzpatrick I–VI. Used by the AR camera, aging previews and the studio.</p></section>
    <section class="section"><span class="sublab">Preferences</span></section>
    <div class="list">
      <div class="li"><span>Units<span class="sub">Tattoo sizes and placement</span></span><div class="seg" style="width:140px" id="units"><button data-v="cm" aria-pressed="${st.units === 'cm'}">cm</button><button data-v="in" aria-pressed="${st.units === 'in'}">in</button></div></div>
      <div class="li"><span>Hand-held camera motion<span class="sub">${reduceMotion ? 'Off — your system prefers reduced motion' : 'Natural sway in the AR camera'}</span></span><button class="switch" role="switch" id="sw-m" aria-checked="${st.motion && !reduceMotion}" aria-label="Hand-held camera motion" ${reduceMotion ? 'disabled' : ''}></button></div>
      <div class="li"><span>Body hair<span class="sub">Fine hair on the simulated skin</span></span><button class="switch" role="switch" id="sw-h" aria-checked="${st.hair}" aria-label="Body hair"></button></div>
    </div>
    <section class="section"><span class="sublab">About</span></section>
    <div class="list">
      <button class="li" id="about"><span>How the aging simulation works<span class="sub">Evidence and limits</span></span>${ico('r').replace('<svg', '<svg style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8"')}</button>
      <div class="li"><span>Your data<span class="sub">${S.caps.length} captures · ${S.my.length} designs · stored only on this device</span></span></div>
      <button class="li danger" id="wipe"><span>Delete all my data<span class="sub">Captures, designs, notes and settings</span></span>${ico('trash').replace('<svg', '<svg style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8"')}</button>
    </div>
    <p class="foot-note">INK STUDY v2 · Original flash drawn for this app. Aging images are an illustrative simulation — your artist and dermatologist know your skin.</p>`);
  $$('.swatch', v).forEach(b => b.onclick = () => { st.skin = +b.dataset.i; AR.skin = null; heroURL = null; save(); $$('.swatch', v).forEach(x => x.setAttribute('aria-pressed', x === b)); });
  $$('#units button', v).forEach(b => b.onclick = () => { st.units = b.dataset.v; save(); $$('#units button', v).forEach(x => x.setAttribute('aria-pressed', x === b)); });
  $('#sw-m', v).onclick = e => { st.motion = !st.motion; save(); e.currentTarget.setAttribute('aria-checked', st.motion); };
  $('#sw-h', v).onclick = e => { st.hair = !st.hair; AR.hair = null; heroURL = null; save(); e.currentTarget.setAttribute('aria-checked', st.hair); };
  $('#about', v).onclick = () => infoModal('How the aging simulation works', `<p>The camera renders a 3D limb with layered skin shading. Your design is wrapped onto the curved surface and aged per pixel:</p><ul style="padding-left:18px;line-height:1.55"><li><b>Healing:</b> day-0 redness, swelling and plasma gloss; a cloudy, peeling phase in weeks 1–2; a settled, slightly lighter look at about a month.</li><li><b>Ink migration:</b> line spread grows with time, so fine lines blur proportionally more than bold lines.</li><li><b>Pigment fading:</b> black is the most stable; yellow, white and pastels fade fastest; reds and oranges moderately; greens and blues in between. Old black may drift faintly blue-green.</li><li><b>Modifiers:</b> sun exposure (the biggest accelerant), placement (hands and outer forearms age faster than calves or backs) and aftercare.</li><li>Many people consider a touch-up after 10–15 years.</li></ul><p class="muted">Rates are illustrative, chosen to match these well-documented trends — not measured from your skin. Your artist and dermatologist know your skin.</p>`);
  $('#wipe', v).onclick = () => confirmModal('Delete all data?', 'This permanently removes captures, designs, notes and settings from this device.', 'Delete everything', async () => { await IDB.clear(); localStorage.removeItem(KEY); S = defaults(); heroURL = null; rasterCache.clear(); thumbCache.clear(); toast('All data deleted'); location.hash = '#/'; route(); });
}
function confirmModal(title, body, cta, fn) {
  const m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'alertdialog'); m.setAttribute('aria-label', title);
  m.innerHTML = `<div class="panel"><div class="h2">${esc(title)}</div><p class="muted" style="margin:8px 0 18px">${esc(body)}</p><div style="display:flex;gap:10px"><button class="btn btn-ghost" style="flex:1" data-n>Cancel</button><button class="btn btn-primary" style="flex:1" data-y>${esc(cta)}</button></div></div>`;
  app.appendChild(m); $('[data-n]', m).focus();
  m.onclick = e => { if (e.target === m || e.target.closest('[data-n]')) m.remove(); if (e.target.closest('[data-y]')) { m.remove(); fn(); } };
}
function infoModal(title, html) {
  const m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', title);
  m.innerHTML = `<div class="panel"><div style="display:flex;justify-content:space-between;align-items:center"><div class="h2">${esc(title)}</div><button class="icon-btn" data-x aria-label="Close">${ico('close')}</button></div><div style="font-size:14px;color:var(--bone-2);margin-top:10px">${html}</div></div>`;
  app.appendChild(m); $('[data-x]', m).focus();
  m.onclick = e => { if (e.target === m || e.target.closest('[data-x]')) m.remove(); };
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const m = $('.modal'); if (m) m.remove(); } });

// load bundled fonts early so canvas lettering is correct
try { document.fonts && ['40px "Ink Script"', '40px "Ink Blackletter"'].forEach(f => document.fonts.load(f)); } catch (e) {}
route();
window.InkApp = { S, makePair, route, IDB, snap };
})();

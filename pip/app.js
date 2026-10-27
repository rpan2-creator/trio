/* PIP — core: state, persistence, audio, pixel icons, FX, UI helpers, onboarding.
   Classic scripts share the global scope, so pages.js and games.js build on these. */
'use strict';
const E = window.PIPEngine;
const APP = document.getElementById('app');
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const choice = a => a[Math.floor(Math.random() * a.length)];
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ============================== STATE ============================== */
const KEY = 'pip.save.v2';
const PERSONALITIES = {
  playful: { name: 'Playful', e: '🎾', d: 'Zoomies & games', likes: 'play' },
  cuddly: { name: 'Cuddly', e: '🧸', d: 'Loves belly rubs', likes: 'love' },
  curious: { name: 'Curious', e: '🔍', d: 'Asks lots of questions', likes: 'fun' },
  sleepy: { name: 'Sleepy', e: '🌙', d: 'Champion napper', likes: 'energy' },
  cheeky: { name: 'Cheeky', e: '😜', d: 'A little mischief', likes: 'fun' },
  brave: { name: 'Brave', e: '⭐', d: 'Fearless explorer', likes: 'play' },
};
const HABITS = ['Naps in sunbeams', 'Zoomies at night', 'Food-motivated', 'Shy with strangers', 'Lap snuggler', 'Very talkative', 'Steals socks', 'Scared of the vacuum', 'Loves car rides', 'Greets at the door'];
const NAMES = ['Mochi', 'Pip', 'Biscuit', 'Bean', 'Tofu', 'Pudding', 'Noodle', 'Maple', 'Clover', 'Sprout', 'Waffles', 'Peanut', 'Dumpling', 'Juniper', 'Pickle', 'Comet', 'Marshmallow', 'Basil', 'Sesame', 'Pebble', 'Olive', 'Kiwi', 'Taro', 'Nori', 'Boba', 'Cocoa', 'Ziggy', 'Luna', 'Sunny', 'Fig'];
const NEEDS = [
  { k: 'hunger', n: 'Food', c: '#ff9a3c', ic: 'food' },
  { k: 'fun', n: 'Fun', c: '#ff6f91', ic: 'ball' },
  { k: 'energy', n: 'Energy', c: '#ffc93c', ic: 'bolt' },
  { k: 'clean', n: 'Clean', c: '#4fb2ff', ic: 'drop' },
  { k: 'love', n: 'Love', c: '#f2558a', ic: 'heart' },
];
const DECAY = { hunger: 4.5, fun: 5, energy: 3, clean: 2.4, love: 3 }; // points per hour (gentle)
const FOODS = Object.keys(E.ITEMS).filter(k => E.ITEMS[k].kind === 'food');
const TOYS = Object.keys(E.ITEMS).filter(k => E.ITEMS[k].kind === 'toy');
const OUTFITS = [].concat(
  Object.keys(E.HATS).map(k => ({ id: 'hat:' + k, slot: 'hat', key: k, name: E.HATS[k], price: { party: 0, beanie: 40, cap: 45, tophat: 80, flower: 60, bow: 50, wizard: 90, chef: 70 }[k] })),
  Object.keys(E.GLASSES).map(k => ({ id: 'glasses:' + k, slot: 'glasses', key: k, name: E.GLASSES[k], price: { round: 40, shades: 55, heart: 65, nerd: 45 }[k] })),
  Object.keys(E.NECKS).map(k => ({ id: 'neck:' + k, slot: 'neck', key: k, name: E.NECKS[k], price: { scarf: 0, bowtie: 35, bandana: 40, bell: 50 }[k] })));
const TRICKS = [
  { id: 'sit', n: 'Sit', e: '🪑', l: '#ffe6cc', lvl: 1 },
  { id: 'spin', n: 'Spin', e: '🌀', l: '#d8eeff', lvl: 1 },
  { id: 'jump', n: 'Jump', e: '⬆️', l: '#d3f7e6', lvl: 2 },
  { id: 'high5', n: 'High-five', e: '✋', l: '#ffd3de', lvl: 3 },
  { id: 'wave', n: 'Wave', e: '👋', l: '#e7e0ff', lvl: 4 },
  { id: 'dance', n: 'Dance', e: '💃', l: '#fff1c2', lvl: 6 },
];
const QUEST_POOL = [
  { id: 'pet', t: n => `Give ${n} 5 cuddles`, goal: 5, stat: 'pets', ic: 'heart', r: 30 },
  { id: 'feed', t: n => `Feed ${n} 3 snacks`, goal: 3, stat: 'feeds', ic: 'food', r: 25 },
  { id: 'bath', t: () => 'Give a bubble bath', goal: 1, stat: 'baths', ic: 'drop', r: 25 },
  { id: 'fetch', t: () => 'Play fetch 3 times', goal: 3, stat: 'fetches', ic: 'ball', r: 30 },
  { id: 'game', t: () => 'Play 2 mini-games', goal: 2, stat: 'games', ic: 'pad', r: 40 },
  { id: 'trick', t: () => 'Practice tricks 2 times', goal: 2, stat: 'practice', ic: 'medal', r: 35 },
  { id: 'talk', t: n => `Chat with ${n}`, goal: 2, stat: 'talks', ic: 'talk', r: 25 },
  { id: 'tickle', t: () => 'Tickle or boop 6 times', goal: 6, stat: 'pokes', ic: 'star', r: 20 },
  { id: 'dress', t: () => 'Try on an outfit', goal: 1, stat: 'dress', ic: 'hat', r: 20 },
  { id: 'nap', t: () => 'Tuck in for a nap', goal: 1, stat: 'sleeps', ic: 'moon', r: 20 },
];
const ACH = [
  { id: 'hello', n: 'First hello', d: 'Meet your pet', ic: 'heart', l: '#ffd3de', test: s => true },
  { id: 'pets50', n: 'Cuddle bug', d: 'Give 50 cuddles', ic: 'heart', l: '#ffd3de', test: s => s.stats.pets >= 50 },
  { id: 'feed20', n: 'Chef', d: 'Serve 20 snacks', ic: 'food', l: '#ffe6cc', test: s => s.stats.feeds >= 20 },
  { id: 'bath5', n: 'Squeaky clean', d: 'Give 5 baths', ic: 'drop', l: '#d8eeff', test: s => s.stats.baths >= 5 },
  { id: 'fetch10', n: 'Good catch', d: 'Play fetch 10 times', ic: 'ball', l: '#ffd3de', test: s => s.stats.fetches >= 10 },
  { id: 'trick1', n: 'Smarty', d: 'Learn a trick', ic: 'medal', l: '#fff1c2', test: s => Object.values(s.tricks).some(t => t.m >= 100) },
  { id: 'trick4', n: 'Show-off', d: 'Learn 4 tricks', ic: 'medal', l: '#fff1c2', test: s => Object.values(s.tricks).filter(t => t.m >= 100).length >= 4 },
  { id: 'lvl5', n: 'Growing up', d: 'Reach level 5', ic: 'star', l: '#e7e0ff', test: s => s.level >= 5 },
  { id: 'lvl10', n: 'All grown', d: 'Reach level 10', ic: 'star', l: '#e7e0ff', test: s => s.level >= 10 },
  { id: 'games5', n: 'Gamer', d: 'Play 5 mini-games', ic: 'pad', l: '#d3f7e6', test: s => s.stats.games >= 5 },
  { id: 'star3', n: 'Superstar', d: 'Get 3 stars in a game', ic: 'star', l: '#fff1c2', test: s => s.stats.threeStars >= 1 },
  { id: 'decor', n: 'Interior designer', d: 'Place 3 furniture items', ic: 'sofa', l: '#ffe6cc', test: s => (s.stats.placed || 0) >= 3 },
  { id: 'dress', n: 'Fashionista', d: 'Own 5 outfits', ic: 'hat', l: '#e7e0ff', test: s => Object.keys(s.inv.outfits).length >= 5 },
  { id: 'memory', n: 'Remember me', d: 'Save a memory', ic: 'note', l: '#d8eeff', test: s => s.memories.length >= 1 },
  { id: 'streak3', n: 'Regular', d: '3-day visit streak', ic: 'fire', l: '#ffe6cc', test: s => s.streak.count >= 3 },
  { id: 'rich', n: 'Piggy bank', d: 'Earn 500 coins total', ic: 'coin', l: '#fff1c2', test: s => s.stats.coinsEarned >= 500 },
];

let S = null; // the save
function freshSave(pet) {
  return {
    v: 2, created: Date.now(), pet, level: 1, xp: 0, coins: 60,
    needs: { hunger: 80, fun: 75, energy: 90, clean: 85, love: 70 }, lastTick: Date.now(), lastSeen: Date.now(),
    inv: { food: { apple: 4, cookie: 2, carrot: 1 }, toys: { ball: 1 }, outfits: { 'hat:party': 1, 'neck:scarf': 1 }, furn: { rug: 1, plant: 1, bed: 1, clock: 1 }, walls: { cream: 1 }, floors: { wood: 1 } },
    room: { wall: 'cream', floor: 'wood', items: [{ id: 'rug', x: .5, dy: 12 }, { id: 'plant', x: .88, dy: -150 }, { id: 'bed', x: .2, dy: -120 }, { id: 'clock', x: .82, dy: -230 }] },
    wear: { hat: null, glasses: null, neck: null },
    tricks: Object.fromEntries(TRICKS.map(t => [t.id, { m: 0 }])),
    quests: null, streak: { last: today(), count: 1 },
    stats: { pets: 0, feeds: 0, baths: 0, fetches: 0, sleeps: 0, games: 0, practice: 0, talks: 0, pokes: 0, dress: 0, coinsEarned: 0, threeStars: 0, best: {} },
    ach: {}, memories: [], convo: [], seenShop: {},
    settings: { sound: true, rm: false, haptics: true, offerMemories: true },
  };
}
function load() { try { const raw = localStorage.getItem(KEY); if (!raw) return null; const s = JSON.parse(raw); if (!s || !s.pet) return null; return migrate(s); } catch (e) { return null; } }
function migrate(s) { const f = freshSave(s.pet); for (const k of Object.keys(f)) if (s[k] == null) s[k] = f[k]; for (const k of Object.keys(f.stats)) if (s.stats[k] == null) s.stats[k] = f.stats[k]; for (const k of Object.keys(f.inv)) if (!s.inv[k]) s.inv[k] = f.inv[k]; for (const t of TRICKS) if (!s.tricks[t.id]) s.tricks[t.id] = { m: 0 }; return s; }
let saveT = 0;
function persist() { clearTimeout(saveT); saveT = setTimeout(persistNow, 250); }
function persistNow() { if (!S) return true; try { S.lastSeen = Date.now(); localStorage.setItem(KEY, JSON.stringify(S)); return true; } catch (e) { return false; } }
window.addEventListener('pagehide', persistNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) persistNow(); else if (S) { tickNeeds(true); } });

/* needs: gentle decay, capped while away; never death or punishment */
function tickNeeds(wake) {
  if (!S) return;
  const now = Date.now(); let hrs = (now - S.lastTick) / 3600000; S.lastTick = now;
  if (hrs <= 0) return;
  const away = hrs > 0.25;
  if (away) hrs = Math.min(hrs, 8); // at most ~8h of decay counted while closed
  for (const k of Object.keys(DECAY)) {
    let d = DECAY[k] * hrs;
    if (k === 'energy' && (HOME && HOME.sleeping)) d = -30 * hrs;
    const floor = away ? 25 : 8; // while away needs never drop below 25
    if (d > 0) S.needs[k] = Math.max(Math.min(S.needs[k], floor), S.needs[k] - d); else S.needs[k] = clamp(S.needs[k] - d, 0, 100);
  }
  if (wake && away && hrs > 1) welcomeBack(hrs);
}
function needAvg() { const n = S.needs; return (n.hunger + n.fun + n.energy + n.clean + n.love) / 5; }
function mood() {
  const n = S.needs, a = needAvg();
  if (HOME && HOME.sleeping) return { k: 'sleep', n: 'Dreaming', e: 'moon' };
  const low = NEEDS.slice().sort((x, y) => n[x.k] - n[y.k])[0];
  if (a >= 85) return { k: 'ecstatic', n: 'Over the moon', e: 'star' };
  if (n[low.k] < 30) return { k: 'wish', n: { hunger: 'Snack-curious', fun: 'Wants to play', energy: 'Yawning', clean: 'A bit muddy', love: 'Wants cuddles' }[low.k], e: low.ic, need: low.k };
  if (a >= 65) return { k: 'happy', n: 'Happy', e: 'heart' };
  return { k: 'ok', n: 'Content', e: 'heart' };
}
function stageFor(lvl) { return lvl >= 10 ? 'adult' : lvl >= 5 ? 'kid' : 'baby'; }
function xpNeed(l) { return 40 + l * 30; }

/* ============================== AUDIO ============================== */
let AC = null;
function ac() { if (!S || !S.settings.sound) return null; try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; } catch (e) { return null; } }
function tone(f, d, type, vol, slide, delay) {
  const a = ac(); if (!a) return; const t = a.currentTime + (delay || 0);
  const o = a.createOscillator(), g = a.createGain(); o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || .06, t + .01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + .02);
}
function noise(d, vol, hp, delay) { const a = ac(); if (!a) return; const t = a.currentTime + (delay || 0); const b = a.createBuffer(1, a.sampleRate * d, a.sampleRate); const ch = b.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length); const s = a.createBufferSource(); s.buffer = b; const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800; const g = a.createGain(); g.gain.value = vol || .05; s.connect(f).connect(g).connect(a.destination); s.start(t); }
const SFX = {
  tap: () => tone(660, .06, 'square', .035, 880),
  pop: () => tone(520, .09, 'square', .05, 1200),
  coin: () => { tone(988, .07, 'square', .04); tone(1319, .16, 'square', .04, null, .07); },
  heart: () => tone(rand(700, 900), .12, 'triangle', .05, 1300),
  purr: () => { const a = ac(); if (!a) return; for (let i = 0; i < 4; i++) tone(70 + Math.random() * 15, .1, 'sawtooth', .025, 60, i * .09); },
  chomp: () => { noise(.06, .08, 1500); tone(180, .06, 'square', .04, 120, .02); },
  yum: () => { tone(660, .08, 'triangle', .05, 990); tone(990, .14, 'triangle', .05, 1320, .09); },
  bleh: () => tone(300, .25, 'sawtooth', .03, 150),
  splash: () => noise(.25, .06, 600),
  bubble: () => tone(rand(900, 1500), .05, 'sine', .05, rand(1600, 2200)),
  shake: () => { for (let i = 0; i < 6; i++) noise(.04, .05, 2500, i * .06); },
  boing: () => tone(220, .22, 'sine', .08, 660),
  throw: () => noise(.15, .04, 2000),
  bounce: () => tone(300, .07, 'sine', .07, 180),
  giggle: () => { for (let i = 0; i < 4; i++) tone(900 + i * 80 + Math.random() * 60, .06, 'triangle', .045, 1200, i * .07); },
  boop: () => tone(880, .1, 'sine', .07, 440),
  crack: () => { noise(.08, .12, 3000); tone(140, .05, 'square', .05, 90); },
  hatch: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .18, 'square', .045, null, i * .08)); noise(.3, .05, 4000, .05); },
  levelup: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, .14, 'square', .045, null, i * .09)); },
  good: () => { tone(784, .08, 'square', .045); tone(1175, .14, 'square', .045, null, .08); },
  bad: () => tone(200, .2, 'square', .04, 140),
  tick: () => tone(1200, .03, 'square', .025),
  zzz: () => tone(220, .5, 'sine', .03, 180),
  whoosh: () => noise(.2, .04, 1200),
  sparkle: () => { for (let i = 0; i < 3; i++) tone(1500 + i * 400, .08, 'sine', .035, null, i * .05); },
  buy: () => { tone(784, .06, 'square', .04); tone(988, .06, 'square', .04, null, .06); tone(1568, .18, 'square', .04, null, .12); },
};
function sfx(n) { try { SFX[n] && SFX[n](); } catch (e) { } }
function buzz(p) { if (S && S.settings.haptics && navigator.vibrate) try { navigator.vibrate(p || 12); } catch (e) { } }

/* ============================== PIXEL ICONS ============================== */
const ICONS = {
  coin: P => { P.ell(8, 8, 7, 7, '#ffc93c'); P.ell(8, 8, 4.5, 4.5, '#ffdb6e', 'in', { shade: false }); P.rect(7, 5, 2, 6, '#e09a12', 'm'); P.px(4, 4, '#fff6c0', 'hl'); },
  heart: P => P.stamp(1, 2, ['.RRR...RRR.', 'RRWRR.RRRRR', 'RWRRRRRRRRR', 'RRRRRRRRRRR', '.RRRRRRRRR.', '..RRRRRRR..', '...RRRRR...', '....RRR....', '.....R.....'].map(r => ' ' + r), { R: '#ff5f8f', W: '#ffd0de' }, 'h'),
  star: P => { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.4 : 7.6; pts.push([8 + Math.cos(a) * r, 8.6 + Math.sin(a) * r]); } P.poly(pts, '#ffc93c'); P.px(6, 6, '#fff6c0', 'h'); },
  bolt: P => P.poly([[9, 1], [3, 9], [7.5, 9], [6, 15], [13, 6], [8.5, 6], [10.5, 1]], '#ffc93c'),
  drop: P => { P.ell(8, 10, 5, 5, '#4fb2ff'); P.poly([[3.6, 9], [8, 1], [12.4, 9]], '#4fb2ff', 'tp'); P.px(6, 9, '#d8eeff', 'h'); P.px(6, 10, '#d8eeff', 'h2'); },
  food: P => { P.ell(8, 9, 5, 3.5, '#ff9a3c', 'fd'); P.ell(5, 7, 2, 2, '#ff5a5a', 'a'); P.ell(11, 7, 2, 2, '#79c96b', 'b'); P.rect(1, 10, 14, 1, '#5aa6e8', 'rim'); P.ell(8, 11, 6.5, 3.5, '#86c5ff', 'bowl', { clip: (x, y) => y > 10 }); },
  ball: P => P.ell(8, 8, 6.5, 6.5, (x, y) => (Math.abs(y - 8) < 1.3 ? '#ffffff' : '#ff5a6a')),
  home: P => { P.poly([[1, 8], [8, 1.5], [15, 8]], '#ff6f91'); P.rect(3, 8, 10, 7, '#fff1df', 'w'); P.rect(7, 10, 3, 5, '#a8744f', 'd'); P.rect(11, 3, 2, 4, '#c9925c', 'ch'); },
  pad: P => { P.ell(8, 9, 7.5, 5, '#8b6cff', 'p', { n: 3 }); P.rect(3, 8, 4, 1, '#fff', 'd1'); P.rect(4, 7, 1, 3, '#fff', 'd2'); P.px(11, 7, '#ffc93c', 'b1'); P.px(12, 9, '#ff6f91', 'b2'); P.px(10, 9, '#33cf8f', 'b3'); },
  bag: P => { P.rect(2, 6, 12, 9, '#ffc93c'); P.shape((x, y) => { const d = Math.hypot(x - 8, y - 6); return d <= 3.6 && d >= 2.4 && y < 6.5; }, 4, 1, 12, 7, '#e09a12', 'hd'); P.rect(2, 6, 12, 2, '#ff9a3c', 'tp'); P.ell(8, 11, 1.6, 1.6, '#fff', 's'); },
  book: P => { P.rect(2, 2, 12, 13, '#ff6f91'); P.rect(4, 3, 9, 11, '#fff6ea', 'pg'); P.rect(2, 2, 2, 13, '#d94c72', 'sp'); P.stamp(6, 6, ['.R.R.', 'RRRRR', '.RRR.', '..R..'], { R: '#ff5f8f' }); },
  bath: P => { P.ell(8, 10, 7, 4.5, '#86c5ff', 'tub', { clip: (x, y) => y > 8 }); P.rect(1, 8, 14, 2, '#e6f4ff', 'rim'); P.ell(5, 6, 2.2, 2.2, '#e6f7ff', 'b1', { shade: false }); P.ell(9, 4.5, 2.8, 2.8, '#e6f7ff', 'b2', { shade: false }); P.ell(12, 6.5, 1.6, 1.6, '#e6f7ff', 'b3', { shade: false }); P.rect(4, 14, 2, 2, '#5aa6e8', 'l1'); P.rect(11, 14, 2, 2, '#5aa6e8', 'l2'); },
  moon: P => { P.ell(8, 8, 6.5, 6.5, '#ffd65a'); P.ell(11, 6, 5, 5, null, 'cut'); P.recolor((x, y) => Math.hypot(x - 11, y - 6) < 5, null); P.px(12, 12, '#fff', 'z'); },
  medal: P => { P.poly([[4, 1], [7, 1], [9, 7], [6, 7]], '#4fb2ff', 'r1'); P.poly([[12, 1], [9, 1], [7, 7], [10, 7]], '#ff6f91', 'r2'); P.ell(8, 10.5, 4.6, 4.6, '#ffc93c'); P.px(8, 10, '#fff6c0', 'h'); },
  hat: P => { P.poly([[3, 13], [13, 13], [8.5, 1]], (x, y) => (Math.floor(y) % 4 < 2 ? '#ff6fa3' : '#ffd23f')); P.ell(8.5, 1.5, 1.8, 1.8, '#7fd6ff', 'p'); P.rect(2, 13, 12, 2, '#8b6cff', 'b'); },
  talk: P => { P.ell(8, 7, 7, 5.5, '#ffffff'); P.poly([[4, 10], [3, 15], [8, 11]], '#ffffff', 't'); P.px(5, 7, '#3a2a5a', 'd1'); P.px(8, 7, '#3a2a5a', 'd2'); P.px(11, 7, '#3a2a5a', 'd3'); },
  camera: P => { P.rect(1, 4, 14, 10, '#4a4a6a'); P.rect(4, 2, 5, 3, '#4a4a6a', 't'); P.ell(8, 9, 3.6, 3.6, '#86c5ff', 'l'); P.ell(8, 9, 1.5, 1.5, '#2b3348', 'p', { shade: false }); P.px(12, 6, '#ff6f91', 'r'); },
  sofa: P => { P.rect(2, 4, 12, 6, '#ff9a3c'); P.rect(1, 8, 14, 5, '#ffb36b', 's'); P.rect(1, 7, 3, 6, '#e06f12', 'a1'); P.rect(12, 7, 3, 6, '#e06f12', 'a2'); P.rect(2, 13, 2, 2, '#8b5a3c', 'l1'); P.rect(12, 13, 2, 2, '#8b5a3c', 'l2'); },
  note: P => { P.rect(3, 1, 10, 14, '#fff6ea'); P.rect(3, 1, 10, 3, '#4fb2ff', 't'); for (const y of [6, 8, 10, 12]) P.rect(5, y, 6, 1, '#c9b8e0', 'l' + y); },
  trophy: P => { P.ell(8, 5, 5, 5, '#ffc93c', 'c', { clip: (x, y) => y > 1 }); P.rect(3, 1, 10, 3, '#ffc93c', 't'); P.rect(7, 9, 2, 3, '#e09a12', 'st'); P.rect(4, 12, 8, 3, '#a8744f', 'b'); P.px(6, 4, '#fff6c0', 'h'); },
  fire: P => { P.ell(8, 10, 5.5, 5, '#ff6a3c'); P.poly([[3, 9], [6, 1], [8, 5], [11, 2], [13, 9]], '#ff6a3c', 'f'); P.ell(8, 11, 3, 3, '#ffc93c', 'in'); },
  gear: P => { for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; P.ell(8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, 1.7, 1.7, '#9a8cb4', 't' + i); } P.ell(8, 8, 5.5, 5.5, '#9a8cb4'); P.ell(8, 8, 2.2, 2.2, '#fff6ea', 'h', { shade: false }); },
  quest: P => { P.rect(2, 3, 12, 11, '#fff1c2'); P.rect(1, 2, 14, 2, '#e09a12', 't'); P.rect(1, 13, 14, 2, '#e09a12', 'b'); P.stamp(4, 6, ['......G', '.....GG', 'G...GG.', 'GG.GG..', '.GGG...', '..G....'], { G: '#33cf8f' }); },
  lock: P => { P.shape((x, y) => { const d = Math.hypot(x - 8, y - 7); return d <= 4.4 && d >= 2.6 && y < 7.5; }, 3, 2, 13, 8, '#9a8cb4', 's'); P.rect(3, 7, 10, 8, '#ffc93c', 'b'); P.rect(7, 10, 2, 3, '#8a5a00', 'k'); },
  egg: P => { P.ell(8, 9, 5.5, 6.8, '#fff6ea'); P.ell(6, 7, 1.5, 1.5, '#ff8fb1', 's1'); P.ell(10, 11, 1.6, 1.6, '#86c5ff', 's2'); P.ell(10.5, 5, 1, 1, '#ffc93c', 's3'); },
  brush: P => { P.line(3, 13, 10, 6, 1.4, '#a8744f', 'h'); P.ell(12, 4, 3.2, 3.2, '#ff6f91', 'b'); P.px(11, 3, '#ffd0de', 'hl'); },
  paw: P => { P.ell(8, 11, 4, 3.3, '#ff8fb1'); P.ell(3.5, 6.5, 1.8, 2.2, '#ff8fb1', 't1'); P.ell(6.5, 3.6, 1.8, 2.2, '#ff8fb1', 't2'); P.ell(9.8, 3.6, 1.8, 2.2, '#ff8fb1', 't3'); P.ell(12.6, 6.5, 1.8, 2.2, '#ff8fb1', 't4'); },
  music: P => { P.rect(6, 2, 2, 10, '#8b6cff'); P.rect(6, 2, 7, 2, '#8b6cff', 't'); P.rect(11, 2, 2, 8, '#8b6cff', 'r'); P.ell(5, 12, 2.6, 2, '#8b6cff', 'a'); P.ell(10, 10, 2.6, 2, '#8b6cff', 'b'); },
  gift: P => { P.rect(2, 6, 12, 9, '#ff6f91'); P.rect(1, 4, 14, 3, '#ff8fb1', 'lid'); P.rect(7, 4, 2, 11, '#ffc93c', 'rb'); P.ell(5.5, 3, 2.2, 1.6, '#ffc93c', 'b1'); P.ell(10.5, 3, 2.2, 1.6, '#ffc93c', 'b2'); },
};
const ICACHE = {};
function icon(n) { if (ICACHE[n]) return ICACHE[n]; const c = E.paint(16, 16, ICONS[n] || ICONS.star); const big = document.createElement('canvas'); big.width = 64; big.height = 64; const x = big.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, 64, 64); return (ICACHE[n] = big.toDataURL()); }
const ic = (n, alt, cls) => `<img src="${icon(n)}" alt="${esc(alt || '')}" class="pxi ${cls || ''}" ${alt ? '' : 'aria-hidden="true"'}>`;
const IURL = {};
function itemURL(id, scale) { const k = id + (scale || 3); if (IURL[k]) return IURL[k]; const c = E.itemCanvas(id); const s = scale || 3; const b = document.createElement('canvas'); b.width = c.width * s; b.height = c.height * s; const x = b.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, b.width, b.height); return (IURL[k] = b.toDataURL()); }
function outfitURL(o) {
  const k = 'o:' + o.id; if (IURL[k]) return IURL[k];
  // render a mannequin with and without the outfit, keep only the pixels the outfit changed
  const g = { body: 'chibi', head: 'round', ears: 'none', tail: 'none', wings: 'none', pattern: 'none', eyes: 'dot', mouth: 'smile', extra: 'none', hair: 'none', colors: { base: '#f3ecff', belly: '#f3ecff' }, cheeks: false };
  const a = E.renderPet(g, { outfit: {} }, 1).getContext('2d').getImageData(0, 0, 64, 64).data;
  const bC = E.renderPet(g, { outfit: { [o.slot]: o.key } }, 1); const bd = bC.getContext('2d').getImageData(0, 0, 64, 64);
  let x0 = 64, y0 = 64, x1 = 0, y1 = 0;
  for (let i = 0; i < 64 * 64; i++) { const j = i * 4; const same = a[j] === bd.data[j] && a[j + 1] === bd.data[j + 1] && a[j + 2] === bd.data[j + 2] && a[j + 3] === bd.data[j + 3]; if (same || !bd.data[j + 3]) { bd.data[j + 3] = 0; continue; } const x = i % 64, y = (i / 64) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const t = document.createElement('canvas'); t.width = 64; t.height = 64; t.getContext('2d').putImageData(bd, 0, 0);
  const w = x1 - x0 + 3, h = y1 - y0 + 3, side = Math.max(w, h, 16);
  const c = document.createElement('canvas'); c.width = side * 4; c.height = side * 4; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(t, x0 - 1, y0 - 1, w, h, Math.floor((side - w) / 2) * 4, Math.floor((side - h) / 2) * 4, w * 4, h * 4);
  return (IURL[k] = c.toDataURL());
}
const SVG = {
  x: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  dice: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>',
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>',
  send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-3-7z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
};

/* ============================== FX (screen-space particles) ============================== */
const FX = { cv: null, ctx: null, parts: [], raf: 0 };
function fxEnsure() {
  if (FX.cv && FX.cv.isConnected) return;
  FX.cv = document.createElement('canvas'); FX.cv.className = 'fx'; FX.cv.setAttribute('aria-hidden', 'true'); APP.appendChild(FX.cv); FX.ctx = FX.cv.getContext('2d'); fxResize();
}
function fxResize() { if (!FX.cv) return; const r = APP.getBoundingClientRect(); const d = Math.min(2, window.devicePixelRatio || 1); FX.cv.width = APP.clientWidth * d; FX.cv.height = APP.clientHeight * d; FX.d = d; }
window.addEventListener('resize', fxResize);
function appXY(cx, cy) { const r = APP.getBoundingClientRect(); const s = r.width / APP.clientWidth; return [(cx - r.left) / s, (cy - r.top) / s]; }
function elCenter(el) { const r = el.getBoundingClientRect(); return appXY(r.left + r.width / 2, r.top + r.height / 2); }
const CONF_COLS = ['#ff6f91', '#ffc93c', '#33cf8f', '#4fb2ff', '#8b6cff', '#ff9a3c', '#ffffff'];
function confetti(x, y, n, spread) {
  if (S && S.settings.rm) n = Math.min(n, 12);
  fxEnsure(); const W = APP.clientWidth;
  for (let i = 0; i < n; i++) { const a = rand(-Math.PI * .95, -Math.PI * .05), v = rand(4, 11) * (spread || 1); FX.parts.push({ t: 'conf', x: x == null ? rand(0, W) : x, y: y == null ? -10 : y, vx: Math.cos(a) * v, vy: y == null ? rand(1, 4) : Math.sin(a) * v, w: rand(5, 9), h: rand(8, 13), r: rand(0, 6), vr: rand(-.3, .3), c: choice(CONF_COLS), life: rand(90, 150) }); }
  fxRun();
}
function burst(x, y, kind, n, o) {
  fxEnsure(); o = o || {};
  for (let i = 0; i < n; i++) { const a = o.up ? rand(-Math.PI * .85, -Math.PI * .15) : rand(0, Math.PI * 2), v = rand(o.vmin || 1.5, o.vmax || 5); FX.parts.push({ t: 'spr', s: kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.lift || 0), g: o.g == null ? .12 : o.g, life: rand(40, 70), max: 70, sc: o.sc || 3, tint: o.tint }); }
  fxRun();
}
function fxRun() {
  if (FX.raf) return;
  const step = () => {
    const c = FX.ctx; if (!c) { FX.raf = 0; return; } const d = FX.d || 1;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, FX.cv.width, FX.cv.height); c.setTransform(d, 0, 0, d, 0, 0); c.imageSmoothingEnabled = false;
    FX.parts = FX.parts.filter(p => p.life > 0);
    for (const p of FX.parts) {
      p.life--; p.x += p.vx; p.y += p.vy;
      if (p.t === 'conf') { p.vy += .18; p.vx *= .985; p.vy *= .99; p.r += p.vr; c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.scale(1, Math.cos(p.life * .2)); c.fillStyle = p.c; c.globalAlpha = Math.min(1, p.life / 30); c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore(); }
      else { p.vy += p.g; p.vx *= .97; const sp = E.sprite(p.s, 1, p.tint); const a = Math.min(1, p.life / 25); c.globalAlpha = a; const sc = p.sc * (p.life > p.max - 8 ? (p.max - p.life) / 8 : 1); c.drawImage(sp, Math.round(p.x - sp.width * sc / 2), Math.round(p.y - sp.height * sc / 2), sp.width * sc, sp.height * sc); c.globalAlpha = 1; }
    }
    if (FX.parts.length) FX.raf = requestAnimationFrame(step); else { FX.raf = 0; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, FX.cv.width, FX.cv.height); }
  };
  FX.raf = requestAnimationFrame(step);
}
function floatText(x, y, txt, color) { const d = document.createElement('div'); d.className = 'ftxt'; d.style.left = x + 'px'; d.style.top = y + 'px'; if (color) d.style.setProperty('--c', color); d.textContent = txt; APP.appendChild(d); setTimeout(() => d.remove(), 1250); }
function flyCoins(x, y, n) {
  const pill = $('#coinPill'); if (!pill) return; const [tx, ty] = elCenter(pill);
  for (let i = 0; i < Math.min(n, 10); i++) {
    const im = document.createElement('img'); im.src = icon('coin'); im.className = 'coinfly pxi'; im.style.left = (x - 13) + 'px'; im.style.top = (y - 13) + 'px'; APP.appendChild(im);
    const dx = rand(-40, 40), dy = rand(-50, -10);
    im.animate([{ transform: 'translate(0,0) scale(.5)' }, { transform: `translate(${dx}px,${dy}px) scale(1.2)`, offset: .35 }, { transform: `translate(${tx - x}px,${ty - y}px) scale(.7)` }], { duration: 700 + i * 60, easing: 'cubic-bezier(.5,0,.6,1)' }).onfinish = () => { im.remove(); if (i === 0) { sfx('coin'); pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump'); } };
  }
}

/* ============================== UI HELPERS ============================== */
function say(msg) { const sr = document.getElementById('sr'); if (sr) { sr.textContent = ''; setTimeout(() => sr.textContent = msg, 30); } }
let toastT = 0;
function toast(msg, iconName) { $$('.toast', APP).forEach(t => t.remove()); const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.innerHTML = (iconName ? ic(iconName) : '') + '<span>' + esc(msg) + '</span>'; APP.appendChild(t); clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 2600); }
function petCanvas(st, scale, g) { const c = E.renderPet(g || S.pet.genome, Object.assign({ stage: S ? stageFor(S.level) : 'baby', outfit: S ? S.wear : {} }, st || {}), 1); const b = document.createElement('canvas'); b.width = 64 * (scale || 4); b.height = 64 * (scale || 4); b.className = 'px'; const x = b.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, b.width, b.height); return b; }
function petHead(size, st) {
  const g = S.pet.genome, stage = stageFor(S.level); const an = E.anchors(g, { stage });
  const spr = E.renderPet(g, Object.assign({ stage, outfit: S.wear }, st || {}), 1);
  const span = Math.max(30, an.hrx * 2 + 10); const cy = an.hy - 2; const sx = 32 - span / 2, sy = cy - span / 2;
  const b = document.createElement('canvas'); b.width = size * 2; b.height = size * 2; b.className = 'px'; b.style.width = b.style.height = size + 'px';
  const x = b.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(spr, sx, sy, span, span, 0, 0, b.width, b.height); return b;
}
function petURL(st, scale, g) { return petCanvas(st, scale, g).toDataURL(); }
function sheet(html, o) {
  o = o || {};
  const ov = document.createElement('div'); ov.className = 'ov'; ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(o.label || '')}"><div class="grab" aria-hidden="true"></div>${html}</div>`;
  APP.appendChild(ov); const prev = document.activeElement;
  const close = () => { if (ov.classList.contains('closing')) return; ov.classList.add('closing'); setTimeout(() => { ov.remove(); o.onClose && o.onClose(); if (prev && prev.focus && prev.isConnected) prev.focus({ preventScroll: true }); }, 190); };
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  ov.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  $$('[data-close]', ov).forEach(b => b.onclick = () => { sfx('tap'); close(); });
  if (o.height) $('.sheet', ov).style.height = o.height;
  setTimeout(() => { const f = $('[autofocus]', ov) || $('.x', ov); f && f.focus({ preventScroll: true }); }, 60);
  ov.close = close; return ov;
}
const sheetHead = (t, extra) => `<div class="sheet-h"><h2>${t}</h2>${extra || ''}<button class="x" data-close aria-label="Close">${SVG.x}</button></div>`;
function modal(html, o) {
  o = o || {};
  const ov = document.createElement('div'); ov.className = 'ov modal-ov'; ov.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(o.label || '')}">${html}</div>`;
  APP.appendChild(ov); const close = () => { ov.classList.add('closing'); setTimeout(() => { ov.remove(); o.onClose && o.onClose(); }, 190); };
  if (o.dismiss !== false) ov.addEventListener('click', e => { if (e.target === ov) close(); });
  ov.addEventListener('keydown', e => { if (e.key === 'Escape' && o.dismiss !== false) close(); });
  $$('[data-close]', ov).forEach(b => b.onclick = () => { sfx('tap'); close(); });
  setTimeout(() => { const f = $('.btn', ov); f && f.focus({ preventScroll: true }); }, 80);
  ov.close = close; return ov;
}
function confirmBox(title, text, okLabel, danger) {
  return new Promise(res => { const m = modal(`<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="btns"><button class="btn ${danger ? 'btn-danger' : 'btn-mint'}" data-ok>${esc(okLabel || 'OK')}</button><button class="btn btn-white" data-close>Cancel</button></div>`, { onClose: () => res(false) }); $('[data-ok]', m).onclick = () => { res(true); m.querySelector('.modal').remove(); m.remove(); }; });
}
// chunky button press feedback for every .btn
APP.addEventListener('pointerdown', e => { const b = e.target.closest('.btn,.iconbtn,.dock-btn,.tab,.opt,.chip,.sitem,.game-card,.path-card,.titem,.pill,.need,.tagpill'); if (b && !b.disabled) { buzz(6); } }, { passive: true });

/* ============================== PROGRESSION ============================== */
function addCoins(n, x, y) { S.coins += n; S.stats.coinsEarned += n; if (x != null) flyCoins(x, y, Math.ceil(n / 5)); else bumpHud(); checkAch(); persist(); }
function addXP(n, x, y) {
  if (!S) return; S.xp += n; if (x != null) floatText(x, y, '+' + n + ' XP', '#6646e0');
  let leveled = false; const before = stageFor(S.level);
  while (S.xp >= xpNeed(S.level)) { S.xp -= xpNeed(S.level); S.level++; leveled = true; }
  persist(); updateHud();
  if (leveled) setTimeout(() => levelUp(before !== stageFor(S.level)), 500);
  checkAch();
}
function bumpNeed(k, n) { S.needs[k] = clamp(S.needs[k] + n, 0, 100); updateHud(); persist(); }
function stat(k, n) { S.stats[k] = (S.stats[k] || 0) + (n || 1); questProgress(k); checkAch(); persist(); }
function levelUp(evolved) {
  sfx('levelup'); confetti(null, null, 90); buzz([20, 40, 20]);
  const st = stageFor(S.level); const reward = 20 + S.level * 5;
  const unlocked = TRICKS.filter(t => t.lvl === S.level).map(t => t.n);
  const m = modal(`<div class="ribbon">${evolved ? 'EVOLVED!' : 'LEVEL UP!'}</div><div class="art"><div class="rays" aria-hidden="true"></div></div>
    <h2>${evolved ? esc(S.pet.name) + ' grew into a ' + (st === 'kid' ? 'kid' : 'grown-up') + '!' : 'Level ' + S.level + '!'}</h2>
    <p>${evolved ? 'Look how much they\'ve grown. Same goofball, new look.' : esc(S.pet.name) + ' is getting stronger, smarter and even more fond of you.'}${unlocked.length ? '<br><b>New trick unlocked: ' + unlocked.join(', ') + '</b>' : ''}</p>
    <div class="rewards"><div class="reward">${ic('coin')} +${reward}</div></div>
    <div class="btns"><button class="btn btn-yellow btn-lg" data-close>Yay!</button></div>`, { label: 'Level up', onClose: () => { addCoins(reward); } });
  const art = $('.art', m); const c = petCanvas({ eyes: 'happy', mouth: 'open', arm: 'both' }, 3); art.appendChild(c);
}
/* quests */
function ensureQuests() {
  const d = today();
  if (!S.quests || S.quests.day !== d) {
    const r = E.rng(parseInt(d.replace(/-/g, ''), 10) + (S.created % 997));
    const pool = QUEST_POOL.slice(); const list = [];
    while (list.length < 3) { const q = pool.splice(Math.floor(r() * pool.length), 1)[0]; list.push({ id: q.id, prog: 0, claimed: false }); }
    S.quests = { day: d, list, bonus: false };
    // streak
    if (S.streak.last !== d) { const y = new Date(Date.now() - 864e5); const yd = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0'); S.streak.count = S.streak.last === yd ? S.streak.count + 1 : 1; S.streak.last = d; }
    persist();
  }
}
function questDef(id) { return QUEST_POOL.find(q => q.id === id); }
function questProgress(statKey) {
  if (!S.quests) return; let changed = false;
  for (const q of S.quests.list) { const def = questDef(q.id); if (def.stat === statKey && q.prog < def.goal) { q.prog++; changed = true; if (q.prog >= def.goal) { setTimeout(() => toast('Quest complete! Claim it in Play', 'quest'), 300); sfx('good'); } } }
  if (changed) { persist(); updateBadges(); }
}
function questsReady() { return S.quests ? S.quests.list.filter(q => !q.claimed && q.prog >= questDef(q.id).goal).length : 0; }
/* achievements */
function checkAch() {
  if (!S) return;
  for (const a of ACH) if (!S.ach[a.id] && a.test(S)) { S.ach[a.id] = Date.now(); setTimeout(() => { sfx('sparkle'); toast('Sticker earned: ' + a.n, a.ic); updateBadges(); }, 900); }
}

/* ============================== WELCOME BACK ============================== */
function welcomeBack(hrs) {
  const n = S.pet.name; const h = Math.round(hrs);
  const lines = [`${n} kept your spot warm while you were away!`, `${n} did a happy wiggle the second you opened the app.`, `${n} found a sunbeam and saved you half of it.`, `${n} missed you — and is so glad you're back!`];
  const gift = 10 + Math.min(30, h * 3);
  setTimeout(() => {
    const m = modal(`<div class="ribbon">WELCOME BACK!</div><div class="art"><div class="rays" aria-hidden="true"></div></div><h2>Hi again, ${esc(S.pet.addressAs || 'friend')}!</h2><p>${esc(choice(lines))} Nothing bad happens while you're gone — come back whenever life allows.</p><div class="rewards"><div class="reward">${ic('coin')} +${gift}</div></div><div class="btns"><button class="btn btn-mint btn-lg" data-close>Hello, ${esc(n)}!</button></div>`, { label: 'Welcome back', onClose: () => { const [x, y] = [APP.clientWidth / 2, APP.clientHeight / 2]; addCoins(gift, x, y); HOME && HOME.react('happy'); } });
    $('.art', m).appendChild(petCanvas({ eyes: 'happy', mouth: 'open', arm: 'raise' }, 3));
  }, 600);
}

/* ============================== ONBOARDING ============================== */
const OB = { path: null, genome: null, rarity: null, name: '', personality: 'playful', addressAs: '', habits: [], bio: '', step: 0 };
function screen(cls, html) { $$('.scr', APP).forEach(s => s.remove()); $$('.ov,.toast,.ftxt,.game', APP).forEach(s => s.remove()); const d = document.createElement('div'); d.className = 'scr scr-enter ' + cls; d.innerHTML = html; APP.prepend(d); return d; }
function obBG(scr, night) {
  const cv = document.createElement('canvas'); cv.className = 'ob-bg'; const W = Math.ceil(APP.clientWidth / 4), H = Math.ceil(APP.clientHeight / 4); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  // clouds + rolling hills + flowers
  const cl = (x, y, w) => { c.fillStyle = '#ffffff'; c.fillRect(x, y, w, 4); c.fillRect(x + 3, y - 3, w - 8, 3); c.fillRect(x + 6, y - 5, w - 16, 2); c.fillStyle = '#e6f4ff'; c.fillRect(x, y + 3, w, 1); };
  cl(6, 30, 26); cl(W - 40, 20, 30); cl(W * .45, 48, 20);
  for (let x = 0; x < W; x++) { const h = Math.round(H * .78 + Math.sin(x / 13) * 5 + Math.sin(x / 5) * 1.2); c.fillStyle = '#a7e08a'; c.fillRect(x, h, 1, H - h); c.fillStyle = '#c4ef9e'; c.fillRect(x, h, 1, 1); }
  for (let x = 0; x < W; x++) { const h = Math.round(H * .86 + Math.sin(x / 9 + 2) * 3); c.fillStyle = '#8fd17a'; c.fillRect(x, h, 1, H - h); c.fillStyle = '#b4e892'; c.fillRect(x, h, 1, 1); }
  for (let i = 0; i < 14; i++) { const x = (i * 29 + 7) % W, y = Math.round(H * .9 + (i * 13) % 8); c.fillStyle = ['#ff8fb1', '#ffd23f', '#ffffff'][i % 3]; c.fillRect(x, y, 1, 1); c.fillRect(x - 1, y + 1, 3, 1); c.fillRect(x, y + 2, 1, 1); }
  scr.prepend(cv);
}
function obTop(step, back) { return `<div class="ob-top">${back ? `<button class="iconbtn" data-back aria-label="Back">${SVG.back}</button>` : '<span style="width:44px"></span>'}<div class="ob-step" aria-label="Step ${step} of 4">${[1, 2, 3, 4].map(i => `<i class="${i < step ? 'done' : i === step ? 'on' : ''}"></i>`).join('')}</div><span style="width:44px"></span></div>`; }

function obWelcome() {
  window.Frame && Frame.tone('dark');
  const s = screen('ob', `<div class="ob-inner"><div style="height:30px"></div><div class="logo" aria-label="PIP"><span>P</span><span>I</span><span>P</span></div>
    <p class="tagline">A tiny pixel friend who's<br>always happy to see you.</p>
    <div class="parade" aria-hidden="true"></div>
    <div class="ob-foot"><button class="btn btn-lg btn-block" data-go>Let's begin!</button><button class="linkbtn" data-restore>Restore from a backup file</button></div></div>`);
  obBG(s);
  const par = $('.parade', s); const ids = ['cat', 'dragon', 'bunny', 'axolotl', 'frog', 'penguin', 'fox', 'slime', 'panda', 'capybara', 'owl', 'unicorn'];
  const pickIds = ids.sort(() => Math.random() - .5).slice(0, 5);
  const W = APP.clientWidth - 44;
  pickIds.forEach((id, i) => { const c = petCanvas({ eyes: i === 2 ? 'happy' : 'open' }, 2, E.presetGenome(id, Math.floor(Math.random() * 3))); c.style.width = c.style.height = (i === 2 ? 160 : 112) + 'px'; const big = i === 2; c.style.left = (big ? W / 2 - 80 : [0, W * .2, 0, W * .62, W * .8][i] - 10) + 'px'; c.style.bottom = (big ? 30 : [70, 6, 0, 6, 70][i]) + 'px'; c.style.animationDelay = (i * .18) + 's'; c.style.zIndex = big ? 2 : 1; par.appendChild(c); });
  $('[data-go]', s).onclick = () => { sfx('pop'); obChoose(); };
  $('[data-restore]', s).onclick = () => importBackup();
}
function obChoose() {
  const s = screen('ob', `<div class="ob-inner">${obTop(1, true)}<h1 class="ob-h">How will you meet?</h1><p class="ob-sub">Every PIP is one of a kind.</p>
    <div class="ob-foot" style="margin-top:18px;gap:16px">
      <button class="path-card" data-p="egg" style="--d:#f0d78a;--l:#fff1c2"><span class="tag">Surprise!</span><span class="art" data-art="egg"></span><span><h3>Hatch a mystery egg</h3><p>Tap to crack it open — common, rare, epic or even legendary.</p></span></button>
      <button class="path-card" data-p="design" style="--d:#c9b8f2;--l:#e7e0ff"><span class="art" data-art="design"></span><span><h3>Design your own</h3><p>20 species, endless mixes. Pick ears, tails, wings, colors…</p></span></button>
      <button class="path-card" data-p="real" style="--d:#ffc2d0;--l:#ffd3de"><span class="art" data-art="real"></span><span><h3>Inspired by my real pet</h3><p>A fictional pixel companion that looks and acts like a pet you love.</p></span></button>
    </div><div style="flex:1"></div></div>`);
  obBG(s);
  const eggC = eggCanvas(0, 0); eggC.style.cssText = 'width:60px;height:75px'; $('[data-art="egg"]', s).appendChild(eggC);
  const d = petCanvas({}, 2, E.mystery(Date.now() % 9999)); $('[data-art="design"]', s).appendChild(d);
  const r = petCanvas({ eyes: 'happy' }, 2, E.presetGenome('dog', 0)); $('[data-art="real"]', s).appendChild(r);
  $('[data-back]', s).onclick = () => obWelcome();
  $$('[data-p]', s).forEach(b => b.onclick = () => { sfx('pop'); OB.path = b.dataset.p; if (OB.path === 'egg') obEggPick(); else if (OB.path === 'design') { OB.genome = OB.genome || E.presetGenome('cat', 0); obEditor(); } else { OB.genome = E.presetGenome('dog', 0); obEditor(); } });
}
/* eggs */
const EGG_STYLES = [{ a: '#fff6ea', s: ['#ff8fb1', '#86c5ff', '#ffc93c'], k: 'spots' }, { a: '#d8eeff', s: ['#4fb2ff', '#ffffff'], k: 'zig' }, { a: '#ffe1ea', s: ['#8b6cff', '#ffc93c'], k: 'stars' }];
function eggCanvas(style, cracks, glow) {
  const st = EGG_STYLES[style % 3];
  return E.paint(32, 40, P => {
    P.ell(16, 22, 13, 16.5, st.a, 'egg', { clip: (x, y) => true });
    P.recolor((x, y, m) => m && y > 22 && (((x - 16) / 13) ** 2 + ((y - 22) / 16.5) ** 2) > .0 && false, null);
    if (st.k === 'spots') { P.recolor((x, y, m) => m && Math.hypot(x - 10, y - 14) < 2.6, st.s[0]); P.recolor((x, y, m) => m && Math.hypot(x - 21, y - 22) < 3.4, st.s[1]); P.recolor((x, y, m) => m && Math.hypot(x - 12, y - 30) < 2.2, st.s[2]); P.recolor((x, y, m) => m && Math.hypot(x - 22, y - 11) < 1.6, st.s[0]); }
    if (st.k === 'zig') P.recolor((x, y, m) => m && Math.abs(y - 23 - (Math.floor(x / 3) % 2 ? 2 : -1)) < 1.6, st.s[0]);
    if (st.k === 'zig') P.recolor((x, y, m) => m && Math.abs(y - 31 - (Math.floor(x / 3) % 2 ? -1 : 1)) < 1, st.s[0]);
    if (st.k === 'stars') { for (const [x0, y0] of [[10, 15], [21, 20], [13, 29], [22, 31], [17, 10]]) P.recolor((x, y, m) => m && ((Math.abs(x - x0) < .6 && Math.abs(y - y0) < 2.2) || (Math.abs(y - y0) < .6 && Math.abs(x - x0) < 2.2)), st.s[(x0 + y0) % 2]); }
    P.recolor((x, y, m, r) => m && Math.hypot(x - 10.5, y - 11) < 2, '#ffffff');
    const crackPaths = [[[16, 6], [14, 10], [17, 13], [15, 16]], [[15, 16], [11, 18], [8, 17]], [[17, 13], [21, 15], [24, 13]], [[8, 17], [5, 21]], [[24, 13], [27, 17]], [[15, 16], [18, 20], [16, 23]]];
    for (let i = 0; i < Math.min(cracks, crackPaths.length); i++) { const pth = crackPaths[i]; for (let j = 0; j < pth.length - 1; j++) { const [x0, y0] = pth[j], [x1, y1] = pth[j + 1]; const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let k = 0; k <= n; k++) P.px(Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), '#5a3a6a', 'cr'); } }
  });
}
function obEggPick() {
  const s = screen('ob', `<div class="ob-inner">${obTop(2, true)}<h1 class="ob-h">Pick an egg</h1><p class="ob-sub">Something is wiggling inside each one…</p>
    <div class="egg-choose">${[0, 1, 2].map(i => `<button class="egg-pick" data-egg="${i}" aria-label="Egg ${i + 1}"></button>`).join('')}</div>
    <div style="flex:1"></div><div class="notice"><span>✨</span><span>Rarity is just for fun: <b>Common</b> 40% · <b>Rare</b> 30% · <b>Epic</b> 22% · <b>Legendary</b> 8%. No paid rerolls, ever.</span></div></div>`);
  obBG(s);
  $$('[data-egg]', s).forEach(b => { const c = eggCanvas(+b.dataset.egg, 0); b.appendChild(c); b.onclick = () => { sfx('pop'); obHatch(+b.dataset.egg); }; });
  $('[data-back]', s).onclick = () => obChoose();
}
function obHatch(style) {
  const r = Math.random(); const rarity = r < .4 ? 'common' : r < .7 ? 'rare' : r < .92 ? 'epic' : 'legendary';
  const genome = E.randomGenome(Math.floor(Math.random() * 1e9), rarity);
  const s = screen('ob', `<div class="ob-inner">${obTop(2, true)}<h1 class="ob-h" id="hh">Tap the egg!</h1><p class="ob-sub" id="hs">Give it a few gentle taps to help it hatch.</p>
    <div class="egg-stage"><div class="rays" aria-hidden="true"></div><div class="egg-glow" aria-hidden="true"></div><button class="egg-big" aria-label="Tap to crack the egg"></button></div>
    <div class="ob-foot" id="hf"><p class="tap-hint" aria-hidden="true">👆 tap tap tap</p></div></div>`);
  obBG(s);
  const egg = $('.egg-big', s); let taps = 0; const need = 6;
  const draw = () => { egg.innerHTML = ''; egg.appendChild(eggCanvas(style, Math.floor(taps * 6 / need))); };
  draw();
  egg.onclick = () => {
    if (taps >= need) return; taps++; sfx('crack'); buzz(15); egg.classList.remove('shake'); void egg.offsetWidth; egg.classList.add('shake'); draw();
    const [x, y] = elCenter(egg); burst(x, y - 30, 'sparkle', 3, { up: true, sc: 3 });
    $('.egg-glow', s).style.opacity = taps / need;
    if (taps >= need) setTimeout(reveal, 450);
  };
  egg.focus({ preventScroll: true });
  function reveal() {
    sfx('hatch'); buzz([30, 50, 30]); const [x, y] = elCenter(egg); confetti(x, y, 80, 1.1); burst(x, y - 120, 'sparkle', 10, { sc: 3, up: true });
    $('.rays', s).style.opacity = 1; $('.rays', s).style.transition = 'opacity .5s';
    egg.remove();
    const pc = petCanvas({ eyes: 'happy', mouth: 'open', arm: 'both', stage: 'adult' }, 4, Object.assign({}, genome)); pc.className = 'reveal-pet px'; pc.style.position = 'relative'; $('.egg-stage', s).appendChild(pc);
    const sp = E.PRESETS[genome.base]; const label = sp ? sp.name : 'Mystery mix';
    $('#hh', s).innerHTML = `<span class="rarity ${rarity}">${rarity}</span>`; $('#hs', s).innerHTML = `It's a <b>${esc(label.toLowerCase())}</b>${rarity === 'epic' || rarity === 'legendary' ? ' — a one-of-a-kind hybrid!' : '!'}`;
    setTimeout(() => { pc.replaceWith(Object.assign(petCanvas({ stage: 'adult' }, 4, genome), { className: 'reveal-pet px', style: 'animation:parade 1.6s ease-in-out infinite;position:relative' })); }, 1400);
    $('#hf', s).innerHTML = `<button class="btn btn-lg btn-mint btn-block" data-keep>Keep this one!</button><div class="btnrow" style="margin-top:0"><button class="btn btn-white" data-tweak>Tweak colors</button><button class="btn btn-white" data-again>Another egg</button></div>`;
    OB.genome = genome; OB.rarity = rarity;
    $('[data-keep]', s).onclick = () => { sfx('pop'); obNaming(); };
    $('[data-tweak]', s).onclick = () => { sfx('pop'); obEditor('colors'); };
    $('[data-again]', s).onclick = () => { sfx('pop'); obEggPick(); };
    say('Your egg hatched! It is a ' + rarity + ' ' + label);
  }
  $('[data-back]', s).onclick = () => obEggPick();
}

/* ---------------- Editor (design + real-pet + later "edit look") ---------------- */
const ED_TABS = [['species', 'Species'], ['colors', 'Colors'], ['ears', 'Ears'], ['tail', 'Tail'], ['eyes', 'Eyes'], ['mouth', 'Mouth'], ['pattern', 'Pattern'], ['extra', 'Extras'], ['wings', 'Wings'], ['body', 'Body'], ['head', 'Head'], ['hair', 'Hair']];
function obEditor(startTab, opts) {
  opts = opts || {};
  const real = OB.path === 'real' && !opts.edit;
  let tab = startTab || 'species';
  let g = JSON.parse(JSON.stringify(opts.edit ? S.pet.genome : OB.genome));
  let palIdx = 0;
  const s = screen('ed', `<div class="ob-inner" style="padding-bottom:calc(var(--sb) + 14px)">${opts.edit ? `<div class="ob-top"><button class="iconbtn" data-back aria-label="Cancel">${SVG.back}</button><h1 style="flex:1;text-align:center;font-size:22px">Edit look</h1><span style="width:44px"></span></div>` : obTop(2, true)}
    ${real ? '<div class="notice pink" style="margin:6px 0 0"><span>💗</span><span>Pick the closest look, then match colors. This makes a <b>fictional companion</b> inspired by your pet — it can\'t know how your real pet is doing.</span></div>' : `<h1 class="ob-h" style="font-size:26px">${opts.edit ? '' : 'Design your pet'}</h1>`}
    <div class="ed-preview"><div class="stagepick"></div><button class="btn btn-yellow btn-sm dice" data-dice aria-label="Mystery mix: randomize everything">🎲 Mystery mix</button></div>
    <div class="ed-tabs" role="tablist" aria-label="Customize parts">${ED_TABS.map(([k, n]) => `<button role="tab" data-tab="${k}" aria-selected="${k === tab}">${n}</button>`).join('')}</div>
    <div class="ed-body" id="edb"></div>
    <div class="ob-foot" style="margin-top:8px"><button class="btn btn-lg btn-block" data-next>${opts.edit ? 'Save look' : 'Looks perfect!'}</button></div></div>`);
  const prev = $('.ed-preview', s);
  function drawPrev(bounce) { $$('canvas', prev).forEach(c => c.remove()); const c = petCanvas({ eyes: bounce ? 'happy' : 'open' }, 4, g); c.style.cssText = 'width:256px;height:256px;margin-top:-30px'; prev.prepend(c); if (bounce) c.animate([{ transform: 'scale(1,1)' }, { transform: 'scale(1.12,.88)' }, { transform: 'scale(.94,1.06)' }, { transform: 'scale(1,1)' }], { duration: 380, easing: 'ease-out' }); }
  const thumb = (gg, st) => { const c = E.renderPet(gg, Object.assign({ stage: 'adult' }, st || {}), 1); const b = document.createElement('canvas'); b.width = 64; b.height = 64; b.className = 'px'; b.getContext('2d').drawImage(c, 0, 0); return b; };
  function body() {
    const B = $('#edb', s); B.innerHTML = '';
    if (tab === 'species') {
      B.innerHTML = `<div class="optgrid" role="group" aria-label="Species">${Object.keys(E.PRESETS).map(id => `<button class="opt" data-sp="${id}" aria-pressed="${g.base === id}"><span data-th></span>${E.PRESETS[id].name}</button>`).join('')}</div>`;
      $$('[data-sp]', B).forEach(b => { b.querySelector('[data-th]').replaceWith(thumb(E.presetGenome(b.dataset.sp, 0))); b.onclick = () => { sfx('pop'); palIdx = g.base === b.dataset.sp ? palIdx + 1 : 0; g = E.presetGenome(b.dataset.sp, palIdx); drawPrev(true); body(); }; });
      return;
    }
    if (tab === 'colors') {
      const rows = [['base', 'Fur / skin', E.SWATCHES.base], ['belly', 'Belly & muzzle', E.SWATCHES.belly], ['pattern', 'Markings', E.SWATCHES.pattern], ['accent', 'Inner ears, fins & wings', E.SWATCHES.accent], ['eye', 'Eyes', E.SWATCHES.eye], ['horn', 'Horns, beak & antlers', E.SWATCHES.horn]];
      B.innerHTML = (E.PRESETS[g.base] ? `<div class="swrow"><h4>Preset palettes</h4><div class="optrow">${E.PRESETS[g.base].pals.map((p, i) => `<button class="chip" data-pal="${i}" aria-label="Palette ${i + 1}"><span style="display:inline-flex;gap:2px">${[p.base, p.belly, p.pattern, p.accent].map(c => `<i style="width:12px;height:12px;border-radius:4px;background:${c};display:inline-block;box-shadow:inset 0 0 0 1px rgba(0,0,0,.1)"></i>`).join('')}</span></button>`).join('')}</div></div>` : '') +
        rows.map(([k, n, list]) => `<div class="swrow"><h4>${n}</h4><div class="swatches">${list.map(c => `<button class="sw" style="background:${c}" data-k="${k}" data-c="${c}" aria-label="${n} ${c}" aria-pressed="${(g.colors[k] || '').toLowerCase() === c}"></button>`).join('')}<label class="sw custom" aria-label="Custom ${n} color"><input type="color" data-k="${k}" value="${g.colors[k] || '#ffffff'}"></label></div></div>`).join('') +
        `<div class="swrow"><h4>Options</h4><div class="optrow"><button class="chip" data-tg="belly" aria-pressed="${!!g.belly}">Light belly</button><button class="chip" data-tg="cheeks" aria-pressed="${g.cheeks !== false}">Rosy cheeks</button></div></div>`;
      $$('.sw[data-c]', B).forEach(b => b.onclick = () => { sfx('tap'); g.colors[b.dataset.k] = b.dataset.c; drawPrev(); $$('.sw[data-k="' + b.dataset.k + '"]', B).forEach(x => x.setAttribute('aria-pressed', x === b)); });
      $$('input[type=color]', B).forEach(i => i.oninput = () => { g.colors[i.dataset.k] = i.value; drawPrev(); });
      $$('[data-pal]', B).forEach(b => b.onclick = () => { sfx('tap'); g.colors = Object.assign({}, E.PRESETS[g.base].pals[+b.dataset.pal]); drawPrev(true); body(); });
      $$('[data-tg]', B).forEach(b => b.onclick = () => { sfx('tap'); const k = b.dataset.tg; if (k === 'cheeks') g.cheeks = g.cheeks === false; else g[k] = !g[k]; b.setAttribute('aria-pressed', k === 'cheeks' ? g.cheeks !== false : !!g[k]); drawPrev(); });
      return;
    }
    const list = E.PARTS[tab];
    B.innerHTML = `<div class="optgrid" role="group" aria-label="${tab}">${list.map(([k, n]) => `<button class="opt" data-v="${k}" aria-pressed="${g[tab] === k}"><span data-th></span>${n}</button>`).join('')}</div>`;
    $$('[data-v]', B).forEach(b => { const gg = Object.assign({}, g, { [tab]: b.dataset.v }); b.querySelector('[data-th]').replaceWith(thumb(gg)); b.onclick = () => { sfx('pop'); g[tab] = b.dataset.v; if (g.base !== 'mix' && E.PRESETS[g.base] && JSON.stringify(E.PRESETS[g.base].g[tab]) !== JSON.stringify(g[tab])) g.base = 'mix'; drawPrev(true); $$('[data-v]', B).forEach(x => x.setAttribute('aria-pressed', x === b)); }; });
  }
  drawPrev(); body();
  $$('[data-tab]', s).forEach(b => b.onclick = () => { sfx('tap'); tab = b.dataset.tab; $$('[data-tab]', s).forEach(x => x.setAttribute('aria-selected', x === b)); body(); });
  $('[data-dice]', s).onclick = () => { sfx('boing'); g = E.randomGenome(Math.floor(Math.random() * 1e9), choice(['rare', 'epic', 'epic', 'legendary'])); drawPrev(true); body(); const [x, y] = elCenter(prev); burst(x, y, 'sparkle', 8, { sc: 3 }); };
  $('[data-next]', s).onclick = () => {
    sfx('pop');
    if (opts.edit) { S.pet.genome = g; persistNow(); toast('New look saved!', 'star'); goMain('pet'); return; }
    OB.genome = g; OB.rarity = OB.rarity || (g.base === 'mix' ? 'epic' : 'common'); obNaming();
  };
  $('[data-back]', s).onclick = () => { if (opts.edit) goMain('pet'); else if (OB.path === 'egg') obEggPick(); else obChoose(); };
}
function obNaming() {
  const real = OB.path === 'real';
  if (!OB.name) OB.name = real ? '' : choice(NAMES);
  const s = screen('ed', `<div class="ob-inner">${obTop(3, true)}
    <div style="display:grid;place-items:center;height:150px;flex:none" id="np"></div>
    <div class="ed-body" style="padding-top:2px">
      <div class="field"><label for="nm">${real ? 'Their name' : 'Name your pet'}</label><div class="namerow"><input id="nm" class="inp" maxlength="16" value="${esc(OB.name)}" placeholder="${real ? 'e.g. Milo' : 'Name'}" autocomplete="off">${real ? '' : `<button class="iconbtn" data-rn aria-label="Random name">${SVG.dice}</button>`}</div></div>
      <div class="field"><label for="ad">What should ${real ? 'they' : 'it'} call you?</label><input id="ad" class="inp" maxlength="20" value="${esc(OB.addressAs)}" placeholder="e.g. Sam, bestie, captain" autocomplete="off"></div>
      <div class="field"><label id="plab">Personality</label><div class="persona" role="group" aria-labelledby="plab">${Object.entries(PERSONALITIES).map(([k, p]) => `<button data-pe="${k}" aria-pressed="${OB.personality === k}"><span class="e">${p.e}</span>${p.name}<small>${p.d}</small></button>`).join('')}</div></div>
      ${real ? `<div class="field"><label id="hlab">Their habits (pick any)</label><div class="optrow" role="group" aria-labelledby="hlab">${HABITS.map(h => `<button class="chip" data-hb="${esc(h)}" aria-pressed="${OB.habits.includes(h)}">${esc(h)}</button>`).join('')}</div></div>
      <div class="field"><label for="bio">Anything else? (optional)</label><textarea id="bio" class="inp" rows="3" maxlength="300" placeholder="e.g. Loves the blue blanket, snores softly, lives with my parents in Lyon.">${esc(OB.bio)}</textarea></div>
      <div class="notice pink"><span>💗</span><span>Your PIP will act like these habits, but it's a <b>fictional companion</b> — not your real pet, and it won't claim to know how they are.</span></div>` : ''}
    </div>
    <div class="ob-foot"><button class="btn btn-lg btn-block" data-next>Meet ${real ? 'them' : 'my pet'}!</button></div></div>`);
  const np = $('#np', s); const pc = petCanvas({}, 3, OB.genome); pc.style.cssText = 'width:192px;height:192px;animation:parade 1.6s ease-in-out infinite'; np.appendChild(pc);
  const nm = $('#nm', s);
  nm.oninput = () => { OB.name = nm.value; };
  $('#ad', s).oninput = e => OB.addressAs = e.target.value;
  const rn = $('[data-rn]', s); if (rn) rn.onclick = () => { sfx('boing'); OB.name = choice(NAMES.filter(n => n !== OB.name)); nm.value = OB.name; };
  $$('[data-pe]', s).forEach(b => b.onclick = () => { sfx('tap'); OB.personality = b.dataset.pe; $$('[data-pe]', s).forEach(x => x.setAttribute('aria-pressed', x === b)); });
  $$('[data-hb]', s).forEach(b => b.onclick = () => { sfx('tap'); const h = b.dataset.hb; OB.habits = OB.habits.includes(h) ? OB.habits.filter(x => x !== h) : OB.habits.concat(h); b.setAttribute('aria-pressed', OB.habits.includes(h)); });
  const bio = $('#bio', s); if (bio) bio.oninput = () => OB.bio = bio.value;
  $('[data-next]', s).onclick = () => {
    OB.name = nm.value.trim(); if (!OB.name) { nm.focus({ preventScroll: true }); nm.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 250 }); toast('Every pet needs a name!'); sfx('bad'); return; }
    sfx('pop'); obMeet();
  };
  $('[data-back]', s).onclick = () => { if (OB.path === 'egg') obEggPick(); else obEditor('colors'); };
}
function obMeet() {
  const foods = FOODS.slice(); const fav = choice(foods); const dis = choice(foods.filter(f => f !== fav && f !== 'apple'));
  const pet = { id: uid(), name: OB.name, genome: OB.genome, personality: OB.personality, mode: OB.path === 'real' ? 'real' : 'original', origin: OB.path, rarity: OB.rarity || 'common', addressAs: OB.addressAs.trim(), habits: OB.habits.slice(), bio: OB.bio.trim(), fav, dislike: dis, born: Date.now() };
  S = freshSave(pet); ensureQuests();
  window.Frame && Frame.tone('dark');
  const s = screen('ob', `<div class="ob-inner">${obTop(4, false)}<h1 class="ob-h">Say hello to ${esc(pet.name)}!</h1><p class="ob-sub" id="ms">Give ${esc(pet.name)} a gentle rub — drag your finger back and forth.</p>
    <div class="meet-stage"><div class="rays" aria-hidden="true" style="opacity:.5"></div></div>
    <div class="prog" style="margin:0 10px" aria-hidden="true"><i id="mp" style="width:0%"></i></div>
    <div class="ob-foot" id="mf"><button class="btn btn-white btn-block" data-skip>Skip — just say hi</button></div></div>`);
  obBG(s);
  const st = $('.meet-stage', s); let c = petCanvas({}, 4); c.classList.add('big'); st.appendChild(c);
  const hand = document.createElement('div'); hand.className = 'hint-hand'; hand.textContent = '👆'; hand.style.cssText = 'left:50%;top:60%'; st.appendChild(hand);
  const bub = document.createElement('div'); bub.className = 'speech pop'; bub.style.top = '8%'; bub.textContent = `Hi${pet.addressAs ? ' ' + pet.addressAs : ''}! I'm ${pet.name}!`; st.appendChild(bub);
  let prog = 0, last = null, down = false, done = false;
  const setFace = (eyes, mouth) => { const n = petCanvas({ eyes, mouth }, 4); n.className = c.className; c.replaceWith(n); c = n; bind(); };
  function bind() {
    c.onpointerdown = e => { down = true; last = [e.clientX, e.clientY]; c.setPointerCapture(e.pointerId); hand.remove(); };
    c.onpointermove = e => { if (!down || done) return; const d = Math.hypot(e.clientX - last[0], e.clientY - last[1]); last = [e.clientX, e.clientY]; prog += d / 9; if (Math.random() < d / 60) { const [x, y] = appXY(e.clientX, e.clientY); burst(x, y - 20, 'heart', 1, { up: true, sc: 3, g: -.02 }); sfx('heart'); } $('#mp', s).style.width = Math.min(100, prog) + '%'; if (prog > 30 && c.dataset.f !== 'h') { c.dataset.f = 'h'; setFace('happy', 'open'); sfx('purr'); } if (prog >= 100) finish(); };
    c.onpointerup = c.onpointercancel = () => { down = false; };
    c.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { prog += 34; $('#mp', s).style.width = Math.min(100, prog) + '%'; const [x, y] = elCenter(c); burst(x, y - 40, 'heart', 3, { up: true, sc: 3 }); if (prog >= 100) finish(); } };
    c.tabIndex = 0; c.setAttribute('role', 'button'); c.setAttribute('aria-label', 'Rub ' + pet.name + ' (press Enter)');
  }
  bind();
  function finish() {
    if (done) return; done = true; down = false; setFace('heart', 'open'); sfx('levelup'); confetti(null, null, 90); bub.textContent = 'We\'re going to be best friends!'; bub.classList.remove('pop'); void bub.offsetWidth; bub.classList.add('pop');
    $('#ms', s).textContent = 'You made a new friend!';
    S.stats.pets += 3; S.needs.love = 95; S.ach.hello = Date.now();
    $('#mf', s).innerHTML = `<button class="btn btn-lg btn-mint btn-block" data-home>Take ${esc(pet.name)} home</button>`;
    $('[data-home]', s).onclick = () => {
      sfx('pop'); persistNow();
      const m = modal(`<div class="ribbon">STARTER GIFT</div><div class="art" style="height:90px;margin-top:-10px;display:flex;gap:6px;align-items:center;justify-content:center">${['apple', 'cookie', 'ball'].map(i => `<img src="${itemURL(i, 3)}" alt="" style="width:60px">`).join('')}</div><h2>Welcome home!</h2><p>Here's 60 coins, a few snacks, a ball, a party hat and a scarf to get you started. Earn more by playing — everything in PIP is earned, never bought.</p><div class="btns"><button class="btn btn-yellow btn-lg" data-close>Let's go!</button></div>`, { label: 'Starter gift', onClose: () => goMain('home') });
    };
  }
  $('[data-skip]', s).onclick = () => { prog = 100; finish(); };
}

/* ============================== BACKUP ============================== */
function exportBackup() {
  persistNow(); const blob = new Blob([JSON.stringify({ app: 'pip', v: 2, exported: new Date().toISOString(), save: S }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pip-' + (S.pet.name || 'pet').toLowerCase().replace(/\W+/g, '-') + '-backup.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast('Backup downloaded', 'note');
}
function importBackup() {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/json,.json';
  i.onchange = async () => {
    const f = i.files[0]; if (!f) return;
    try { const j = JSON.parse(await f.text()); const sv = j.save || j; if (!sv.pet || !sv.pet.genome) throw new Error('bad'); if (S && !(await confirmBox('Replace current pet?', 'Importing will replace ' + S.pet.name + ' on this device with ' + sv.pet.name + ' from the backup.', 'Import', true))) return; S = migrate(sv); S.lastTick = Date.now(); persistNow(); toast('Welcome back, ' + S.pet.name + '!', 'heart'); goMain('home'); }
    catch (e) { toast('That file isn\'t a PIP backup.'); sfx('bad'); }
  };
  i.click();
}

/* ============================== BOOT ============================== */
function boot() {
  fxEnsure();
  [APP, APP.parentElement].forEach(el => el && el.addEventListener('scroll', () => { el.scrollTop = 0; el.scrollLeft = 0; }));
  S = load();
  if (S) { document.documentElement.classList.toggle('pip-rm', !!S.settings.rm); APP.classList.toggle('rm', !!S.settings.rm); ensureQuests(); tickNeeds(true); goMain('home'); }
  else obWelcome();
  fetch('/api/health').then(r => r.json()).then(h => { HEALTH.ai = !!h.ai; const el = document.getElementById('svc'); if (el) el.innerHTML = `<span class="status-chip ${h.ai ? 'ok' : 'off'}">AI chat ${h.ai ? '· connected' : '· not configured — replies are labeled "Simple response"'}</span>`; }).catch(() => { });
  setInterval(() => { if (S && !document.hidden) { tickNeeds(false); updateHud(); } }, 20000);
}
const HEALTH = { ai: null };
document.addEventListener('DOMContentLoaded', boot);

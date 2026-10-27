/* PIP — main shell (HUD, tabs) and the living home room with all direct interactions. */
'use strict';
const K = 3; // css px per art pixel in the room
const PK = 4; // css px per art pixel for the pet
let HOME = null;
let TAB = 'home';

function goMain(tab) {
  TAB = tab || 'home';
  if (HOME) HOME.destroy();
  const s = screen('main', `
    <div class="room" id="room" aria-label="${esc(S.pet.name)}'s room"><canvas id="rc" aria-hidden="true"></canvas></div>
    <div class="dark-ov" id="dark" aria-hidden="true"></div>
    <div class="room-ui" id="rui">
      <div class="hud">
        <button class="hud-pet" data-goto="pet" aria-label="Open ${esc(S.pet.name)}'s profile"><span class="hud-av" id="hav"></span><span style="flex:1;min-width:0"><span class="hud-name" id="hname"></span><span class="hud-meta"><span class="xpbar" aria-hidden="true"><i id="hxp"></i></span><span class="xptxt" id="hxpt"></span></span></span></button>
        <button class="pill" id="coinPill" data-goto="shop" aria-label="Coins">${ic('coin')}<span id="hcoins"></span></button>
      </div>
      <div class="needs" id="needs" role="group" aria-label="Needs">${NEEDS.map(n => `<button class="need" data-need="${n.k}" style="--c:${n.c}" aria-label="${n.n}">${ic(n.ic)}<span class="bar"><i></i></span><span class="nl">${n.n}</span></button>`).join('')}</div>
      <div class="mood"><button class="tagpill" id="moodPill" aria-label="Mood"></button></div>
      <div class="side-stack">
        <button class="iconbtn talk" data-act="talk" aria-label="Talk to ${esc(S.pet.name)}">${ic('talk')}</button>
        <button class="iconbtn" data-act="photo" aria-label="Photo mode">${ic('camera')}</button>
        <button class="iconbtn" data-act="decor" aria-label="Decorate room">${ic('sofa')}</button>
      </div>
      <div class="dock" id="dock" role="toolbar" aria-label="Care actions">
        ${[['feed', 'Feed', 'food', '#ffe6cc', '#f0cfa8', '#ff9a3c', '#e06f12'], ['bath', 'Bath', 'bath', '#d8eeff', '#b8d8f2', '#4fb2ff', '#2a86d9'], ['play', 'Play', 'ball', '#ffd3de', '#f2b4c4', '#ff6f91', '#d94c72'], ['sleep', 'Sleep', 'moon', '#e7e0ff', '#cdc2f2', '#8b6cff', '#6646e0'], ['tricks', 'Tricks', 'medal', '#fff1c2', '#f0d78a', '#ffc93c', '#e09a12'], ['dress', 'Dress', 'hat', '#d3f7e6', '#a8e6c8', '#33cf8f', '#1fa36c']].map(([k, n, i, l, d, c, dd]) => `<button class="dock-btn" data-act="${k}" style="--l:${l};--d:${d};--c:${c};--dd:${dd}" aria-pressed="false">${ic(i)}<span>${n}</span></button>`).join('')}
      </div>
    </div>
    <div class="page" id="page" hidden></div>
    <nav class="tabbar" aria-label="Main">${[['home', 'Home', 'home', '#ffd3de', '#f2b4c4'], ['play', 'Play', 'pad', '#e7e0ff', '#cdc2f2'], ['shop', 'Shop', 'bag', '#fff1c2', '#f0d78a'], ['pet', 'Journal', 'book', '#d3f7e6', '#a8e6c8']].map(([k, n, i, l, d]) => `<button class="tab" data-tab="${k}" style="--l:${l};--d:${d}" ${k === TAB ? 'aria-current="page"' : ''}>${ic(i)}<span>${n}</span><span class="badge" hidden></span></button>`).join('')}</nav>`);
  $$('[data-tab]', s).forEach(b => b.onclick = () => { if (b.dataset.tab === TAB) return; sfx('tap'); switchTab(b.dataset.tab); });
  $$('[data-goto]', s).forEach(b => b.onclick = () => { sfx('tap'); switchTab(b.dataset.goto); });
  $$('[data-need]', s).forEach(b => b.onclick = () => { const n = NEEDS.find(x => x.k === b.dataset.need); sfx('tap'); toast(`${n.n}: ${Math.round(S.needs[n.k])}% — ${needTip(n.k)}`, n.ic); });
  $('#moodPill', s).onclick = () => { sfx('tap'); const m = mood(); toast(`${S.pet.name} feels ${m.n.toLowerCase()}.` + (m.need ? ' ' + needTip(m.need) : ''), m.e); };
  $$('[data-act]', s).forEach(b => b.onclick = () => { sfx('pop'); HOME.action(b.dataset.act); });
  HOME = makeHome(s);
  updateHud(); updateBadges();
  switchTab(TAB, true);
}
function needTip(k) { return { hunger: 'Tap Feed and drag a snack to their mouth.', fun: 'Throw a ball or play a mini-game.', energy: 'Tuck them in with Sleep.', clean: 'A bubble bath does wonders.', love: 'Rub them gently — drag across the pet.' }[k]; }
function switchTab(t, first) {
  TAB = t; const page = $('#page'); if (!page) return;
  $$('.tab').forEach(b => b.toggleAttribute('aria-current', b.dataset.tab === t) || (b.dataset.tab === t && b.setAttribute('aria-current', 'page')));
  $$('.tab').forEach(b => { if (b.dataset.tab === t) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  if (t === 'home') { page.hidden = true; page.innerHTML = ''; $('#rui').hidden = false; HOME && HOME.resume(); window.Frame && Frame.tone(HOME && HOME.isDarkTop() ? 'light' : 'dark'); return; }
  HOME && HOME.pause(); HOME && HOME.endMode(); $('#rui').hidden = true; page.hidden = false; page.scrollTop = 0; window.Frame && Frame.tone('dark');
  if (t === 'play') renderPlay(page); else if (t === 'shop') renderShop(page); else if (t === 'pet') renderJournal(page);
  if (!first) { page.classList.remove('scr-enter'); void page.offsetWidth; page.classList.add('scr-enter'); }
}
function updateHud() {
  if (!S || !$('#hname')) return;
  $('#hname').textContent = S.pet.name;
  $('#hcoins').textContent = S.coins;
  const need = xpNeed(S.level); $('#hxp').style.width = (100 * S.xp / need) + '%'; $('#hxpt').textContent = `Lv ${S.level}`;
  const av = $('#hav'); const key = JSON.stringify([S.pet.genome, S.level, S.wear]);
  if (av.dataset.k !== key) { av.dataset.k = key; av.innerHTML = ''; av.appendChild(petCanvas({}, 1)); av.insertAdjacentHTML('beforeend', `<span class="lvl">${S.level}</span>`); }
  else $('.lvl', av).textContent = S.level;
  for (const n of NEEDS) { const b = $(`[data-need="${n.k}"]`); if (!b) continue; const v = Math.round(S.needs[n.k]); $('i', b).style.width = v + '%'; b.classList.toggle('low', v < 30); b.setAttribute('aria-label', `${n.n} ${v}%`); }
  const m = mood(); const mp = $('#moodPill'); if (mp) { mp.innerHTML = `${ic(m.e)}<span>${m.n}</span>`; }
}
function bumpHud() { updateHud(); const p = $('#coinPill'); if (p) { p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); } }
function updateBadges() {
  if (!S) return; const q = questsReady(); const b = $('.tab[data-tab="play"] .badge'); if (b) { b.hidden = !q; b.textContent = q; }
  const newShop = 0; const sb = $('.tab[data-tab="shop"] .badge'); if (sb) sb.hidden = true;
}

/* ============================== ROOM ============================== */
function makeHome(scr) {
  const room = $('#room', scr), cv = $('#rc', scr), ctx = cv.getContext('2d'), rui = $('#rui', scr), dark = $('#dark', scr);
  let W = 0, H = 0, dpr = 1, groundY = 0, floorCss = 0, LW = 0, LH = 0, bg = null, bgT = 0, roomInfo = null;
  const P = { x: 0, y: 0, face: 1, state: 'idle', t: 0, next: 2, target: null, onArrive: null, speed: 95, hop: 0, hopV: 0, blink: 3, blinkOn: 0, walkT: 0, walkF: 0, face2: null, faceT: 0, mouth: null, arm: null, emote: null, holding: null, wagT: 0, look: 0, squash: 0, spin: 0, jitter: 0, lastPoke: 0, pokes: 0 };
  const parts = []; // room particles
  const bubblesOn = []; // bath bubbles stuck to pet (relative)
  let ball = null, foodFly = null, mode = null, running = true, raf = 0, last = performance.now(), pointer = null, sayEl = null, sayT = 0, idleChat = 12, selFurn = null;
  const H_ = {};
  HOME = H_; // allow early access

  function layout() {
    W = APP.clientWidth; H = APP.clientHeight; dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; room.style.height = H + 'px';
    const dock = $('#dock', scr); const dr = dock.getBoundingClientRect(), ar = APP.getBoundingClientRect(); const sc = ar.width / W;
    const dockTop = (dr.top - ar.top) / sc;
    groundY = Math.round(dockTop - 12);
    floorCss = Math.round((groundY - 200) / K) * K;
    LW = Math.ceil(W / K) + 4; LH = Math.ceil(H / K);
    if (!P.x) P.x = W / 2;
    P.y = groundY; bg = null;
  }
  function stTop() { const v = parseFloat(getComputedStyle(APP).getPropertyValue('--safe-top')); return isNaN(v) ? 54 : v; }
  function renderBg(t) {
    if (!bg) { bg = document.createElement('canvas'); }
    bg.width = LW; bg.height = LH; const c = bg.getContext('2d');
    const floorY = floorCss / K; const winH = 38, winY = Math.max(Math.round((stTop() + 170) / K), floorY - 30 - winH);
    roomInfo = E.drawRoom(c, LW, LH, { floorY, wall: S.room.wall, floor: S.room.floor, t, winX: 12, winY, winW: 50, winH });
  }
  layout(); renderBg(0);
  const ro = new ResizeObserver(() => { layout(); renderBg(performance.now() / 1000); }); ro.observe(APP);

  /* ---- pet render helpers ---- */
  function stage() { return stageFor(S.level); }
  let anchorsCache = null, anchorsKey = '';
  function anchors() { const k = JSON.stringify([S.pet.genome, stage()]); if (k !== anchorsKey) { anchorsKey = k; anchorsCache = E.anchors(S.pet.genome, { stage: stage() }); } return anchorsCache; }
  function mouthPos() { const a = anchors(); return [P.x, P.y - P.hop - (62 - a.mouthY) * PK]; }
  function headPos() { const a = anchors(); return [P.x, P.y - P.hop - (62 - a.headTop) * PK]; }
  function petBox() { const a = anchors(); const top = P.y - P.hop - (62 - a.headTop + 2) * PK; return { x0: P.x - (a.hrx + 4) * PK, x1: P.x + (a.hrx + 4) * PK, y0: top, y1: P.y + 2, headY: P.y - P.hop - (62 - a.hy - 4) * PK }; }
  function inPet(x, y, pad) { const b = petBox(); pad = pad || 0; return x > b.x0 - pad && x < b.x1 + pad && y > b.y0 - pad && y < b.y1 + pad; }
  function petState() {
    const st = { stage: stage(), outfit: S.wear };
    // eyes
    let eyes = 'open';
    if (P.state === 'sleep') eyes = 'sleep';
    else if (P.blinkOn > 0) eyes = 'blink';
    if (P.face2 && P.faceT > 0) { if (P.face2.eyes) eyes = P.face2.eyes; if (P.face2.mouth) st.mouth = P.face2.mouth; if (P.face2.arm) st.arm = P.face2.arm; }
    if (P.state === 'sleep') { eyes = 'sleep'; }
    st.eyes = eyes;
    if (P.mouth) st.mouth = P.mouth;
    if (P.arm) st.arm = P.arm;
    if (P.state === 'walk' || P.state === 'fetch' || P.state === 'return') { st.walk = P.walkF ? 1 : -1; }
    st.wag = Math.round(Math.sin(P.wagT * (P.state === 'idle' ? 2.2 : 9)) * (needAvg() > 60 || P.state !== 'idle' ? 1 : 0));
    st.look = P.state === 'sleep' ? 0 : P.look;
    if (S.pet.genome.wings !== 'none') st.flap = (P.hop > 2 || P.state === 'trick') ? (Math.floor(P.wagT * 8) % 2) : (Math.floor(P.wagT * 1.4) % 4 === 0 ? 1 : 0);
    if (S.pet.genome.body === 'ghost') st.float = Math.floor(P.wagT * 2) % 4;
    if (P.squash > 0) st.squash = 1;
    return st;
  }
  function drawPet(c) {
    const st = petState(); const spr = E.renderPet(S.pet.genome, st, 1);
    let bob = 0; if (P.state === 'idle' || P.state === 'eat' || P.state === 'react') bob = (Math.floor(P.wagT * 1.6) % 2) * PK;
    if (P.state === 'sleep') bob = (Math.floor(P.wagT * .7) % 2) * PK;
    const jx = P.jitter > 0 ? (Math.floor(P.jitter * 30) % 2 ? PK * 2 : -PK * 2) : 0;
    const x = Math.round(P.x + jx), y = Math.round(P.y - P.hop + bob);
    // shadow
    const sw = (anchors().hrx + 2) * PK * (1 - Math.min(.5, P.hop / 200));
    c.fillStyle = 'rgba(58,30,80,.18)'; c.beginPath(); c.ellipse(Math.round(P.x), P.y - 2, sw, 5 * (1 - Math.min(.5, P.hop / 200)), 0, 0, 7); c.fill();
    c.save(); c.translate(x, y);
    let sx = P.face < 0 ? -1 : 1; if (P.spin > 0) sx *= Math.cos(P.spin * Math.PI * 4) || .05;
    c.scale(sx, 1);
    c.drawImage(spr, -32 * PK, -62 * PK, 64 * PK, 64 * PK);
    c.restore();
    // bath bubbles on pet
    for (const b of bubblesOn) { const sp = E.sprite('bubble', 1); const s = b.s; c.drawImage(sp, Math.round(x + b.dx - sp.width * s / 2), Math.round(y + b.dy - sp.height * s / 2), sp.width * s, sp.height * s); }
    // held item
    if (P.holding) { const ic2 = E.itemCanvas(P.holding); const [mx, my] = mouthPos(); c.drawImage(ic2, Math.round(mx - 12 * K * .8), Math.round(my - 8 * K), 20 * K * .8, 20 * K * .8); }
    // emote above head
    if (P.emote) { const [hx, hy] = headPos(); const sp = E.sprite(P.emote.s, 1); const bounce = Math.abs(Math.sin(P.emote.t * 6)) * 6; c.drawImage(sp, Math.round(hx + 20 - sp.width * K / 2), Math.round(hy - 14 - bounce - sp.height * K), sp.width * K, sp.height * K); }
  }
  function drawFurn(c, it, ox) {
    const f = E.FURN[it.id]; if (!f) return; const fc = E.itemCanvas(it.id); const x = Math.round(it.x * W - f.w * K / 2 + ox), y = Math.round(groundY + it.dy - f.h * K);
    c.drawImage(fc, x, y, f.w * K, f.h * K);
    if (mode === 'decor' && selFurn === it) { c.strokeStyle = '#ffc93c'; c.lineWidth = 3; c.setLineDash([8, 6]); c.strokeRect(x - 4, y - 4, f.w * K + 8, f.h * K + 8); c.setLineDash([]); }
  }
  function furnBox(it) { const f = E.FURN[it.id]; return { x0: it.x * W - f.w * K / 2, x1: it.x * W + f.w * K / 2, y0: groundY + it.dy - f.h * K, y1: groundY + it.dy }; }
  let parX = 0, parTX = 0;
  function draw(now) {
    const c = ctx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.imageSmoothingEnabled = false;
    if (now - bgT > 400) { bgT = now; renderBg(now / 1000); }
    parX += (parTX - parX) * .06;
    c.drawImage(bg, Math.round(-2 * K + parX * 2), 0, LW * K, LH * K);
    const night = roomInfo && roomInfo.night;
    // ambient: dust motes in day, fireflies at night
    const t = now / 1000;
    for (let i = 0; i < 14; i++) { const px = ((i * 71 + t * (8 + i % 3 * 4)) % (W + 40)) - 20, py = floorCss - 80 + Math.sin(t * .7 + i) * 60 + (i * 37) % 120; c.globalAlpha = .35 + .3 * Math.sin(t * 2 + i); c.fillStyle = night ? '#fff3a0' : '#ffffff'; c.fillRect(Math.round(px / K) * K, Math.round(py / K) * K, K, K); }
    c.globalAlpha = 1;
    const ox = parX * 4;
    const items = S.room.items.slice().sort((a, b) => (E.FURN[a.id].layer === 'rug' ? -1e4 : E.FURN[a.id].layer === 'wall' ? -2e4 : a.dy) - (E.FURN[b.id].layer === 'rug' ? -1e4 : E.FURN[b.id].layer === 'wall' ? -2e4 : b.dy));
    let petDrawn = false;
    for (const it of items) { if (!petDrawn && E.FURN[it.id].layer === 'floor' && it.dy > 0) { drawPet(c); petDrawn = true; } drawFurn(c, it, E.FURN[it.id].layer === 'wall' ? parX * 2 : ox); }
    if (!petDrawn) drawPet(c);
    // ball
    if (ball && !P.holding) { const bc = E.itemCanvas(ball.id); const s = K * .9; c.save(); c.translate(Math.round(ball.x), Math.round(ball.y)); c.rotate(Math.round(ball.rot * 4 / Math.PI) * Math.PI / 4); c.drawImage(bc, -10 * s, -10 * s, 20 * s, 20 * s); c.restore(); }
    // flying food
    if (foodFly) { const fc = E.itemCanvas(foodFly.id); const s = K * (1 - foodFly.t * .3); c.drawImage(fc, Math.round(foodFly.x - 10 * s), Math.round(foodFly.y - 10 * s), 20 * s, 20 * s); }
    // particles
    for (const p of parts) { const sp = E.sprite(p.s, 1, p.tint); const sc = p.sc || K; c.globalAlpha = Math.min(1, p.life / .4); c.drawImage(sp, Math.round(p.x - sp.width * sc / 2), Math.round(p.y - sp.height * sc / 2), sp.width * sc, sp.height * sc); }
    c.globalAlpha = 1;
    // night/sleep overlay
    const dk = mode === 'sleep' ? .55 : night ? .18 : 0;
    dark.style.background = dk ? `radial-gradient(ellipse 70% 50% at ${P.x}px ${groundY - 80}px, rgba(30,20,70,${dk * .55}), rgba(20,12,55,${dk}))` : 'transparent';
  }
  function spawn(s, x, y, o) { o = o || {}; parts.push(Object.assign({ s, x, y, vx: rand(-30, 30), vy: rand(-90, -40), g: 60, life: rand(.9, 1.4) }, o)); }
  /* ---- speech ---- */
  function speak(text, dur) {
    if (sayEl) sayEl.remove(); const [hx, hy] = headPos();
    sayEl = document.createElement('div'); sayEl.className = 'bubble-say'; sayEl.textContent = text; sayEl.setAttribute('role', 'status');
    sayEl.style.left = clamp(hx, 120, W - 120) + 'px'; sayEl.style.top = (hy - 22) + 'px'; room.appendChild(sayEl); sayT = dur || Math.max(2.4, text.length * .07);
  }
  function face(f, dur) { P.face2 = f; P.faceT = dur || 1.2; }
  function emote(s, dur) { P.emote = { s, t: 0, d: dur || 1.6 }; }
  function hop(v) { if (P.hop <= 0.5) { P.hopV = v || 260; P.hop = .6; } }
  function walkTo(x, cb, speed) { P.target = clamp(x, 50, W - 50); P.onArrive = cb || null; P.state = P.state === 'fetch' || P.state === 'return' ? P.state : 'walk'; P.speed = speed || 95; }
  function setIdle(n) { P.state = 'idle'; P.next = n == null ? rand(2.5, 6) : n; P.arm = null; P.mouth = null; P.holding = P.holding && P.state === 'idle' ? P.holding : P.holding; }

  /* ---- idle brain ---- */
  const IDLE_LINES = () => {
    const n = S.pet, m = mood(), a = S.pet.addressAs || 'friend';
    const L = [`Hi ${a}!`, 'La la la~', '*happy wiggle*', 'What should we do?', 'I like it here.', 'Did you see that dust bunny?', `Psst… ${a}… hi!`, 'Boop?'];
    if (m.need === 'hunger') L.push('Is it snack o\'clock?', 'My tummy said "blorp".');
    if (m.need === 'fun') L.push('Ball? Ball! Ball?', 'Wanna play a game?');
    if (m.need === 'energy') L.push('*yaaawn*', 'Nap time soon…');
    if (m.need === 'clean') L.push('Bubbles would be nice…', 'I rolled in something.');
    if (m.need === 'love') L.push('Pets, please?', 'Cuddle me!');
    if (n.personality === 'curious') L.push('What\'s outside the window?', 'Why is the sky that color?');
    if (n.personality === 'sleepy') L.push('Five more minutes…');
    if (n.personality === 'cheeky') L.push('Hehe. I hid a sock.', 'Bet you can\'t catch me!');
    if (n.mode === 'real' && n.habits.length) { const h = choice(n.habits).toLowerCase(); L.push(`(${h}, like always)`); }
    const nh = new Date().getHours(); if (nh < 6 || nh >= 21) L.push('It\'s so late… the stars are out.', '*sleepy blink*'); else if (nh < 11) L.push('Good morning!');
    return L;
  };
  function idleThink() {
    const r = Math.random();
    if (r < .45) { walkTo(rand(70, W - 70), () => setIdle()); }
    else if (r < .6) { emote(choice(['note', 'heart', 'sparkle']), 1.5); face({ eyes: 'happy' }, 1.2); setIdle(); }
    else if (r < .72) { hop(220); setIdle(); }
    else if (r < .82 && S.pet.mode === 'real' && S.pet.habits.length) { const h = S.pet.habits[Math.floor(Math.random() * S.pet.habits.length)]; habitAct(h); }
    else { P.face = -P.face; setIdle(); }
  }
  function habitAct(h) {
    if (/sunbeam|nap/i.test(h)) { walkTo(roomInfo ? (roomInfo.win.x + roomInfo.win.w / 2) * K : 100, () => { face({ eyes: 'closed' }, 3); emote('z', 2.5); setIdle(4); }); }
    else if (/zoom/i.test(h)) { walkTo(W - 60, () => walkTo(60, () => setIdle(), 230), 230); }
    else if (/talk/i.test(h)) { speak(choice(['Mrrrp!', 'Blep blep!', 'I have SO much to tell you!'])); setIdle(); }
    else if (/door|greet/i.test(h)) { hop(260); speak('You\'re here!!'); setIdle(); }
    else if (/sock/i.test(h)) { speak('*hides something behind back*'); face({ eyes: 'happy', mouth: 'smile' }, 2); setIdle(); }
    else { emote('heart'); setIdle(); }
  }

  /* ---- loop ---- */
  function update(dt) {
    P.wagT += dt; P.t += dt;
    if (P.faceT > 0) { P.faceT -= dt; if (P.faceT <= 0) P.face2 = null; }
    if (P.emote) { P.emote.t += dt; if (P.emote.t > P.emote.d) P.emote = null; }
    if (P.squash > 0) P.squash -= dt;
    if (P.jitter > 0) P.jitter -= dt;
    if (P.spin > 0) { P.spin -= dt; if (P.spin <= 0) P.spin = 0; }
    // blink
    P.blink -= dt; if (P.blink <= 0) { P.blinkOn = .13; P.blink = rand(2.2, 5.5); } if (P.blinkOn > 0) P.blinkOn -= dt;
    // hop physics
    if (P.hop > 0 || P.hopV > 0) { P.hop += P.hopV * dt; P.hopV -= 900 * dt; if (P.hop <= 0) { P.hop = 0; P.hopV = 0; P.squash = .1; } }
    // look at pointer
    if (pointer && P.state !== 'sleep') { const d = pointer.x - P.x; P.look = clamp(Math.round(d / 70), -1, 1) * (P.face < 0 ? -1 : 1); } else P.look = 0;
    // state
    if (P.state === 'walk' || P.state === 'fetch' || P.state === 'return') {
      if (P.state === 'fetch' && ball) P.target = clamp(ball.x, 40, W - 40);
      const d = P.target - P.x; const step = P.speed * dt;
      if (Math.abs(d) <= step + 1) { P.x = P.target; const cb = P.onArrive; P.onArrive = null; if (P.state === 'walk') setIdle(); cb && cb(); }
      else { P.x += Math.sign(d) * step; P.face = Math.sign(d); P.walkT += dt; if (P.walkT > .16) { P.walkT = 0; P.walkF = 1 - P.walkF; if (P.hop <= 0 && Math.random() < .5) { P.hop = .1; P.hopV = 60; } } }
      if (P.state === 'fetch' && ball && ball.state === 'rest' && Math.abs(ball.x - P.x) < 26) { P.holding = ball.id; ball = null; sfx('pop'); P.state = 'return'; P.speed = 140; P.target = clamp(W / 2 + rand(-40, 40), 60, W - 60); P.onArrive = fetchDone; }
    } else if (P.state === 'idle' && !mode) {
      P.next -= dt; if (P.next <= 0) idleThink();
      idleChat -= dt; if (idleChat <= 0 && !sayEl) { idleChat = rand(14, 26); speak(choice(IDLE_LINES())); }
    } else if (P.state === 'sleep') {
      P.t += 0; if (Math.random() < dt * .8) { const [hx, hy] = headPos(); spawn('z', hx + 26, hy, { vx: rand(10, 25), vy: -30, g: -5, life: 2, tint: '#c9b8ff' }); }
      if (mode === 'sleep') { bumpNeedSilent('energy', dt * 4.5); const bar = $('#sleepbar'); if (bar) bar.style.width = S.needs.energy + '%'; if (S.needs.energy >= 100) H_.endMode(true); }
    }
    // ball physics
    if (ball && ball.state === 'fly') {
      ball.vy += 1100 * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.rot += ball.vx * dt / 20;
      const floor = groundY - 12; const r = 26;
      if (ball.x < r) { ball.x = r; ball.vx = -ball.vx * .7; } if (ball.x > W - r) { ball.x = W - r; ball.vx = -ball.vx * .7; }
      if (ball.y < stTop() + 40) { ball.y = stTop() + 40; ball.vy = Math.abs(ball.vy) * .5; }
      if (ball.y > floor) { ball.y = floor; if (Math.abs(ball.vy) > 140) { ball.vy = -ball.vy * .55; sfx('bounce'); spawnDust(ball.x, floor + 10); } else { ball.vy = 0; } ball.vx *= .82; if (Math.abs(ball.vx) < 15 && ball.vy === 0) { ball.state = 'rest'; ball.vx = 0; } }
    }
    // food fly
    if (foodFly) { foodFly.t += dt / foodFly.d; const [mx, my] = mouthPos(); const t = Math.min(1, foodFly.t); foodFly.x = foodFly.sx + (mx - foodFly.sx) * t; foodFly.y = foodFly.sy + (my - foodFly.sy) * t - Math.sin(t * Math.PI) * 80; if (t >= 1) { const id = foodFly.id; foodFly = null; startEat(id); } }
    // particles
    for (const p of parts) { p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
    // speech
    if (sayEl) { sayT -= dt; const [hx, hy] = headPos(); sayEl.style.left = clamp(hx, 120, W - 120) + 'px'; sayEl.style.top = (hy - 22) + 'px'; if (sayT <= 0) { const el = sayEl; sayEl = null; el.classList.add('out'); setTimeout(() => el.remove(), 260); } }
  }
  function bumpNeedSilent(k, n) { S.needs[k] = clamp(S.needs[k] + n, 0, 100); if (Math.random() < .05) updateHud(); }
  function spawnDust(x, y) { for (let i = 0; i < 3; i++) spawn('crumb', x + rand(-10, 10), y, { vx: rand(-40, 40), vy: rand(-40, -10), g: 120, life: .4, tint: '#e8d6bb', sc: 3 }); }
  function loop(now) { if (!running) return; const dt = Math.min(.05, (now - last) / 1000); last = now; update(dt); draw(now); raf = requestAnimationFrame(loop); }
  raf = requestAnimationFrame(loop);

  /* ---- pointer: rub / poke / tap-to-come / follow ---- */
  let down = null;
  function rel(e) { return appXY(e.clientX, e.clientY); }
  room.addEventListener('pointermove', e => { const [x, y] = rel(e); pointer = { x, y }; parTX = (x / W - .5) * -2; if (down) onDrag(e, x, y); });
  room.addEventListener('pointerleave', () => { pointer = null; });
  room.addEventListener('pointerdown', e => {
    const [x, y] = rel(e); pointer = { x, y }; ac();
    if (mode === 'decor') return decorDown(e, x, y);
    if (mode === 'bath') { down = { x, y, sx: x, sy: y, t: performance.now(), kind: 'scrub', id: e.pointerId }; room.setPointerCapture(e.pointerId); moveSponge(x, y); return; }
    if (mode === 'play' && ball && Math.hypot(x - ball.x, y - ball.y) < 46) { down = { x, y, kind: 'ball', hist: [[x, y, performance.now()]], id: e.pointerId }; ball.state = 'held'; room.setPointerCapture(e.pointerId); return; }
    if (inPet(x, y, 6)) { down = { x, y, sx: x, sy: y, t: performance.now(), kind: 'pet', dist: 0, id: e.pointerId }; room.setPointerCapture(e.pointerId); return; }
    down = { x, y, sx: x, sy: y, t: performance.now(), kind: 'floor', id: e.pointerId };
  });
  room.addEventListener('pointerup', e => { if (!down) return; const [x, y] = rel(e); const d = down; down = null; onUp(d, x, y, e); });
  room.addEventListener('pointercancel', () => { if (down && down.kind === 'ball' && ball) ball.state = 'fly'; down = null; });
  let rubAcc = 0, rubHeart = 0, purrT = 0;
  function onDrag(e, x, y) {
    const d = down;
    if (d.kind === 'pet') {
      const dist = Math.hypot(x - d.x, y - d.y); d.dist += dist; d.x = x; d.y = y;
      if (d.dist > 14 && P.state !== 'sleep') {
        if (P.state !== 'idle' && P.state !== 'react') return;
        P.state = 'react'; P.next = 1; face({ eyes: 'happy', mouth: 'smile' }, .6); rubAcc += dist; rubHeart += dist;
        if (rubHeart > 55) { rubHeart = 0; spawn('heart', x + rand(-10, 10), y - 20, { vy: -70, g: -10, life: 1.1 }); sfx('heart'); }
        if (performance.now() - purrT > 700) { purrT = performance.now(); sfx('purr'); buzz(4); }
        bumpNeedSilent('love', dist * .02);
        if (rubAcc > 420) { rubAcc = 0; cuddleDone(x, y); }
      } else if (d.dist > 14 && P.state === 'sleep') { if (Math.random() < .02) speak('mmm… *snore*'); }
    } else if (d.kind === 'ball' && ball) { ball.x = x; ball.y = y; d.hist.push([x, y, performance.now()]); if (d.hist.length > 6) d.hist.shift(); }
    else if (d.kind === 'scrub') { scrub(x, y); }
  }
  function cuddleDone(x, y) {
    stat('pets'); addXP(3); face({ eyes: 'heart', mouth: 'open' }, 1.3); sfx('yum'); updateHud();
    const lines = ['Purrrfect.', 'More please!', 'You\'re the best!', 'Mmmm, right there!', 'Happy happy happy!', `I love you, ${S.pet.addressAs || 'friend'}!`];
    if (Math.random() < .45) speak(choice(lines)); emote('heart', 1.2);
    const [cx, cy] = appXY(0, 0); void cx; void cy;
    for (let i = 0; i < 4; i++) spawn('heart', x + rand(-30, 30), y - 10, { vy: rand(-110, -60), g: -10, life: 1.3 });
  }
  function onUp(d, x, y) {
    const dt = performance.now() - d.t;
    if (d.kind === 'pet' && d.dist < 12 && dt < 400) poke(x, y);
    else if (d.kind === 'pet') { if (P.state === 'react') setIdle(1.5); }
    else if (d.kind === 'ball' && ball) { const h = d.hist; const a = h[0], b = h[h.length - 1]; const tt = Math.max(16, b[2] - a[2]) / 1000; ball.vx = clamp((b[0] - a[0]) / tt, -1400, 1400); ball.vy = clamp((b[1] - a[1]) / tt, -1600, 900); ball.state = 'fly'; if (Math.hypot(ball.vx, ball.vy) > 200) { sfx('throw'); chaseBall(); } }
    else if (d.kind === 'floor' && !mode && dt < 400 && Math.hypot(x - d.sx, y - d.sy) < 12 && y > floorCss - 30 && P.state !== 'sleep') { spawn('sparkle', x, y, { vx: 0, vy: 0, g: 0, life: .5 }); sfx('tap'); walkTo(x, () => { face({ eyes: 'happy' }, .8); hop(180); setIdle(); }, 140); }
    else if (d.kind === 'scrub') { }
  }
  function poke(x, y) {
    if (P.state === 'sleep') { speak(choice(['Five more minutes…', 'zzz… *mumble*', '…pancakes…'])); P.jitter = .2; return; }
    const b = petBox(); const now = performance.now(); P.pokes = now - P.lastPoke < 900 ? P.pokes + 1 : 1; P.lastPoke = now;
    stat('pokes');
    if (P.pokes >= 5) { face({ eyes: 'dizzy', mouth: 'o' }, 1.4); speak('Whoa, whoa! Dizzy!'); sfx('boing'); P.spin = .5; P.pokes = 0; return; }
    if (y < b.headY) { face({ eyes: 'closed', mouth: 'o' }, .7); sfx('boop'); spawn('star', x, y - 10, { vy: -80, life: .8 }); speak(choice(['Boop!', 'Hey, my nose!', 'Beep!', 'Hehe!'])); P.squash = .15; }
    else { face({ eyes: 'happy', mouth: 'laugh' }, 1.2); sfx('giggle'); P.jitter = .4; spawn('note', x, y - 20, { vy: -70, life: 1, tint: '#ff6f91' }); speak(choice(['Hahaha that tickles!', 'Eeheehee!', 'Stop it! (don\'t stop)', 'Tickle attack!'])); bumpNeedSilent('fun', 2); }
    addXP(1);
  }
  /* ---- feed ---- */
  function startEat(id) {
    const it = E.ITEMS[id];
    if (S.pet.dislike === id) {
      face({ eyes: 'closed', mouth: 'o' }, 1.6); speak(choice([`Hmm… not a ${it.name.toLowerCase().split(' ').pop()} fan. You keep it!`, 'Bleh! Not my thing. Sorry!']), 2.6); sfx('bleh'); P.jitter = .3; setIdle(2);
      if (!S.pet.knownDislike) { S.pet.knownDislike = true; persist(); }
      return; // item not used up — no penalty
    }
    S.inv.food[id] = (S.inv.food[id] || 1) - 1; if (S.inv.food[id] <= 0) delete S.inv.food[id];
    P.state = 'eat'; let n = 0; sfx('chomp');
    const chew = () => {
      if (P.state !== 'eat') return; n++;
      P.mouth = n % 2 ? 'chew' : null; sfx('chomp'); const [mx, my] = mouthPos(); for (let i = 0; i < 2; i++) spawn('crumb', mx + rand(-8, 8), my + 4, { vx: rand(-50, 50), vy: rand(-80, -30), g: 400, life: .6, tint: '#e0a35a' });
      if (n < 6) setTimeout(chew, 170); else {
        P.mouth = null; const fav = S.pet.fav === id;
        bumpNeed('hunger', it.fill * (fav ? 1.4 : 1)); bumpNeedSilent('love', fav ? 6 : 2); stat('feeds'); addXP(fav ? 8 : 5, mx, my - 50);
        if (fav) { face({ eyes: 'heart', mouth: 'open' }, 1.8); speak(choice([`${it.name}!! My favorite!`, 'BEST. SNACK. EVER.']), 2.4); for (let i = 0; i < 6; i++) spawn('heart', mx + rand(-30, 30), my - 10, { vy: rand(-120, -60), g: -10, life: 1.3 }); sfx('levelup'); S.pet.knownFav = true; }
        else { face({ eyes: 'happy', mouth: 'smile' }, 1.2); sfx('yum'); if (Math.random() < .5) speak(choice(['Yum!', 'Nom nom nom!', 'Thank you!', 'Delicious!'])); spawn('sparkle', mx, my - 10, { vy: -50, life: .8 }); }
        setIdle(1.5); refreshTray();
      }
    };
    setTimeout(chew, 150);
  }
  function feed(id, fromX, fromY) {
    if (!S.inv.food[id]) { toast('Out of ' + E.ITEMS[id].name.toLowerCase() + ' — grab more in the Shop!', 'bag'); return; }
    if (S.needs.hunger >= 98) { speak('I\'m sooo full. Maybe later!'); face({ eyes: 'closed', mouth: 'smile' }, 1.2); return; }
    if (P.state === 'eat' || foodFly) return;
    if (P.state === 'sleep') return;
    P.state = 'eat'; face({ eyes: 'wide', mouth: 'open' }, .8); P.face = fromX < P.x ? -1 : 1;
    foodFly = { id, sx: fromX, sy: fromY, x: fromX, y: fromY, t: 0, d: .45 }; sfx('whoosh');
  }
  /* ---- fetch ---- */
  function chaseBall() { if (P.state === 'sleep') return; P.holding = null; P.state = 'fetch'; P.speed = 170; P.target = ball.x; face({ eyes: 'wide', mouth: 'open' }, .8); emote('excl', .8); }
  function fetchDone() {
    P.state = 'react'; P.face = 1; const id = P.holding; P.holding = null; const [mx, my] = mouthPos();
    ball = { id, x: mx + 30, y: groundY - 12, vx: 60, vy: -200, rot: 0, state: 'fly' };
    stat('fetches'); bumpNeed('fun', 12); bumpNeedSilent('energy', -2); addXP(6, mx, my - 50); hop(260);
    face({ eyes: 'happy', mouth: 'open' }, 1.4); speak(choice(['Again! Again!', 'Got it!', 'Throw it farther!', 'I\'m so fast!'])); sfx('good');
    if (Math.random() < .35) { const c = 2 + Math.floor(Math.random() * 3); addCoins(c, mx, my - 30); floatText(mx, my - 80, '+' + c, '#e09a12'); }
    setTimeout(() => setIdle(), 900);
  }
  function throwRandom() { if (!ball) return; ball.state = 'fly'; ball.x = W / 2; ball.y = groundY - 60; ball.vx = (Math.random() < .5 ? -1 : 1) * rand(380, 700); ball.vy = rand(-650, -450); sfx('throw'); chaseBall(); }
  /* ---- bath ---- */
  let scrubP = 0, sponge = null, lastBub = 0;
  function moveSponge(x, y) { if (!sponge) return; sponge.style.left = x + 'px'; sponge.style.top = y + 'px'; }
  function scrub(x, y) {
    moveSponge(x, y);
    if (!inPet(x, y, 4) || P.state === 'shake') return;
    const d = Math.hypot(x - (down.lx || x), y - (down.ly || y)); down.lx = x; down.ly = y;
    scrubP = Math.min(100, scrubP + d * .14); const bar = $('#bathbar'); if (bar) bar.style.width = scrubP + '%';
    face({ eyes: 'closed', mouth: 'smile' }, .5);
    if (performance.now() - lastBub > 110 && bubblesOn.length < 26) { lastBub = performance.now(); const b = petBox(); bubblesOn.push({ dx: clamp(x - P.x, -(b.x1 - b.x0) / 2 + 10, (b.x1 - b.x0) / 2 - 10), dy: y - P.y, s: rand(2, 4) }); sfx('bubble'); }
    if (scrubP >= 100) rinse();
  }
  function rinse() {
    if (P.state === 'shake') return; P.state = 'shake'; down = null; const m = $('#bathmsg'); if (m) m.textContent = 'Rinse… then shake it off!';
    sfx('splash'); let n = 0;
    const iv = setInterval(() => { for (let i = 0; i < 4; i++) spawn('drop', P.x + rand(-60, 60), P.y - 230, { vx: 0, vy: rand(260, 360), g: 300, life: .7 }); if (++n > 10) { clearInterval(iv); bubblesOn.length = 0; shakeDry(); } }, 90);
  }
  function shakeDry() {
    P.jitter = .9; sfx('shake'); face({ eyes: 'closed', mouth: 'o' }, 1);
    for (let i = 0; i < 16; i++) setTimeout(() => spawn('drop', P.x + rand(-30, 30), P.y - rand(40, 120), { vx: rand(-260, 260), vy: rand(-200, -60), g: 600, life: .7 }), i * 50);
    setTimeout(() => { face({ eyes: 'star', mouth: 'open' }, 1.6); sfx('sparkle'); for (let i = 0; i < 10; i++) spawn('sparkle', P.x + rand(-60, 60), P.y - rand(30, 160), { vx: 0, vy: -20, g: 0, life: rand(.6, 1.1) }); speak(choice(['Squeaky clean!', 'I smell like flowers!', 'Sparkle sparkle!']));
      bumpNeed('clean', 100); stat('baths'); addXP(10, P.x, P.y - 200); bumpNeedSilent('fun', 4); scrubP = 0; setIdle(1); setTimeout(() => H_.endMode(), 900); }, 1000);
  }
  /* ---- sleep ---- */
  function goSleep() {
    const bed = S.room.items.find(i => i.id === 'bed');
    const lie = () => { P.state = 'sleep'; P.face = 1; stat('sleeps'); sfx('zzz'); speak('Goodnight…', 1.6); };
    if (bed) walkTo(bed.x * W, lie, 120); else lie();
    window.Frame && Frame.tone('light');
  }
  /* ---- tricks ---- */
  function perform(id) {
    const tr = S.tricks[id]; const def = TRICKS.find(t => t.id === id); if (P.state === 'sleep') return;
    const ok = tr.m >= 100 || Math.random() * 100 < 30 + tr.m * .7;
    P.state = 'trick'; speak(choice([`${def.n}!`, `Okay, ${def.n.toLowerCase()}!`]), 1.2);
    const done = () => {
      if (ok) { face({ eyes: 'happy', mouth: 'open' }, 1.2); sfx('good'); for (let i = 0; i < 5; i++) spawn('star', P.x + rand(-60, 60), P.y - rand(60, 160), { vy: -60, life: 1 }); addXP(4, P.x, P.y - 210); bumpNeed('fun', 4); if (tr.m >= 100 && Math.random() < .5) addCoins(2, P.x, P.y - 120); speak(choice(['Ta-da!', 'Did you see that?!', 'Nailed it!']), 1.6); }
      else { face({ eyes: 'dizzy', mouth: 'smile' }, 1.4); sfx('boing'); speak(choice(['Oops! Still learning!', 'Hehe… was that it?', 'Practice makes paw-fect!']), 2); }
      setTimeout(() => setIdle(), 900);
    };
    const realId = ok ? id : choice(['sit', 'spin']);
    setTimeout(() => runTrick(realId, done), 500);
  }
  function runTrick(id, cb) {
    if (id === 'sit') { P.squash = .9; face({ eyes: 'happy' }, 1.2); setTimeout(cb, 1000); }
    else if (id === 'spin') { P.spin = .9; sfx('whoosh'); setTimeout(cb, 1000); }
    else if (id === 'jump') { hop(520); sfx('boing'); setTimeout(cb, 1100); }
    else if (id === 'high5') { P.arm = 'raise'; face({ eyes: 'happy', mouth: 'open' }, 1.2); setTimeout(() => { sfx('pop'); spawn('star', P.x + 60, P.y - 120, { vy: -40, life: .8 }); }, 400); setTimeout(() => { P.arm = null; cb(); }, 1100); }
    else if (id === 'wave') { let i = 0; const iv = setInterval(() => { P.arm = i % 2 ? null : 'raise'; if (++i > 6) { clearInterval(iv); P.arm = null; cb(); } }, 180); }
    else if (id === 'dance') { let i = 0; const iv = setInterval(() => { P.face = -P.face; if (i % 2) hop(180); spawn('note', P.x + rand(-50, 50), P.y - 150, { vy: -60, life: 1, tint: choice(['#ff6f91', '#8b6cff', '#4fb2ff']) }); sfx('tick'); if (++i > 8) { clearInterval(iv); cb(); } }, 220); }
  }

  /* ---- decorate ---- */
  let ddrag = null;
  function decorDown(e, x, y) {
    const items = S.room.items.slice().reverse();
    const hit = items.find(it => { const b = furnBox(it); return x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1; });
    selFurn = hit || null; refreshDecorSel();
    if (hit) { ddrag = { it: hit, ox: x - hit.x * W, oy: y - (groundY + hit.dy) }; room.setPointerCapture(e.pointerId); const mv = ev => { const [mx, my] = rel(ev); const f = E.FURN[hit.id]; hit.x = clamp((mx - ddrag.ox) / W, .06, .94); const minDy = f.layer === 'wall' ? (stTop() + 200 + f.h * K) - groundY : -150 + 20; const maxDy = f.layer === 'wall' ? -165 : 30; hit.dy = clamp(my - ddrag.oy - groundY, minDy, maxDy); refreshDecorSel(); }; const up = () => { room.removeEventListener('pointermove', mv); room.removeEventListener('pointerup', up); ddrag = null; persist(); sfx('pop'); }; room.addEventListener('pointermove', mv); room.addEventListener('pointerup', up); }
  }
  function refreshDecorSel() {
    $$('.decor-sel', room).forEach(x => x.remove()); if (!selFurn || mode !== 'decor') return;
    const b = furnBox(selFurn); const d = document.createElement('div'); d.className = 'decor-sel'; d.style.left = ((b.x0 + b.x1) / 2) + 'px'; d.style.top = (b.y0 - 10) + 'px';
    d.innerHTML = `<button class="btn btn-sm btn-white" data-store>Put away</button>`; room.appendChild(d);
    $('[data-store]', d).onclick = () => { S.room.items = S.room.items.filter(i => i !== selFurn); selFurn = null; persist(); sfx('pop'); refreshDecorSel(); decorBar(); };
  }
  function placeFurn(id) {
    const owned = S.inv.furn[id] || 0; const placed = S.room.items.filter(i => i.id === id).length; if (placed >= owned) return;
    const f = E.FURN[id]; const it = { id, x: rand(.25, .75), dy: f.layer === 'wall' ? -(groundY - (stTop() + 260 + f.h * K)) * 1 : f.layer === 'rug' ? 14 : -rand(40, 110) };
    if (f.layer === 'wall') it.dy = clamp((stTop() + 230 + f.h * K) - groundY, (stTop() + 200 + f.h * K) - groundY, -165);
    S.room.items.push(it); selFurn = it; persist(); sfx('buy'); spawn('sparkle', it.x * W, groundY + it.dy - 20, { vy: -40, life: .8 }); checkAch(); refreshDecorSel(); decorBar();
  }
  function decorBar() {
    const owned = Object.keys(S.inv.furn).filter(id => S.inv.furn[id] > 0);
    showBar(`<div class="row"><h3>Decorate</h3><button class="btn btn-sm btn-mint" data-done>Done</button></div><p>Drag furniture to move it. Tap to select & put away.</p>
      <div class="tray-row">${owned.length ? owned.map(id => { const left = S.inv.furn[id] - S.room.items.filter(i => i.id === id).length; return `<button class="titem ${left ? '' : 'empty'}" data-place="${id}" aria-label="Place ${E.FURN[id].name}, ${left} left"><img src="${itemURL(id, 2)}" alt="" style="width:auto;max-width:48px;max-height:40px"><span>${E.FURN[id].name.split(' ').pop()}</span>${left ? `<span class="cnt">${left}</span>` : ''}</button>`; }).join('') : '<p style="padding:6px">No furniture yet — buy some in the Shop!</p>'}</div>
      <div class="tray-row">${Object.keys(S.inv.walls).map(k => `<button class="chip" data-wall="${k}" aria-pressed="${S.room.wall === k}"><i style="width:14px;height:14px;border-radius:5px;background:${E.WALLPAPERS[k].a};box-shadow:inset 0 0 0 2px ${E.WALLPAPERS[k].b}"></i>${E.WALLPAPERS[k].name}</button>`).join('')}${Object.keys(S.inv.floors).map(k => `<button class="chip" data-floor="${k}" aria-pressed="${S.room.floor === k}"><i style="width:14px;height:14px;border-radius:5px;background:${E.FLOORS[k].a}"></i>${E.FLOORS[k].name}</button>`).join('')}</div>`, 'decor');
    $$('[data-place]', rui).forEach(b => b.onclick = () => placeFurn(b.dataset.place));
    $$('[data-wall]', rui).forEach(b => b.onclick = () => { S.room.wall = b.dataset.wall; persist(); bg = null; renderBg(0); sfx('pop'); decorBar(); });
    $$('[data-floor]', rui).forEach(b => b.onclick = () => { S.room.floor = b.dataset.floor; persist(); bg = null; renderBg(0); sfx('pop'); decorBar(); });
    $('[data-done]', rui).onclick = () => { sfx('pop'); H_.endMode(); };
  }

  /* ---- mode bars / trays ---- */
  function showBar(html, m, cls) {
    $$('.tray,.mode-bar', rui).forEach(x => x.remove()); $('#dock', scr).classList.add('hide');
    const d = document.createElement('div'); d.className = cls || 'mode-bar'; d.innerHTML = html; rui.appendChild(d); mode = m;
    $$('.dock-btn', scr).forEach(b => b.setAttribute('aria-pressed', b.dataset.act === m));
    return d;
  }
  function refreshTray() { if (mode === 'feed') feedTray(); }
  function feedTray() {
    const owned = FOODS.filter(f => S.inv.food[f] > 0);
    const d = showBar(`<div class="tray-head"><div><h3>Snacks</h3><p>Drag a snack to ${esc(S.pet.name)}'s mouth — or just tap it.</p></div><button class="x" data-done aria-label="Close">${SVG.x}</button></div>
      <div class="tray-row">${owned.length ? owned.map(f => `<button class="titem" data-food="${f}" aria-label="Feed ${E.ITEMS[f].name} (${S.inv.food[f]} left)">${S.pet.knownFav && S.pet.fav === f ? '<span class="fav" aria-hidden="true">💖</span>' : ''}<img src="${itemURL(f)}" alt=""><span>${E.ITEMS[f].name.split(' ').pop()}</span><span class="cnt">${S.inv.food[f]}</span></button>`).join('') : `<div class="empty" style="padding:8px">Out of snacks! <button class="btn btn-sm btn-yellow" data-shop>Visit shop</button></div>`}</div>`, 'feed', 'tray');
    $('[data-done]', d).onclick = () => { sfx('tap'); H_.endMode(); };
    const sh = $('[data-shop]', d); if (sh) sh.onclick = () => switchTab('shop');
    $$('[data-food]', d).forEach(b => dragItem(b, b.dataset.food));
  }
  function dragItem(btn, id) {
    btn.addEventListener('pointerdown', e => {
      e.preventDefault(); const sx = e.clientX, sy = e.clientY; let ghost = null, moved = false;
      const mv = ev => { const dd = Math.hypot(ev.clientX - sx, ev.clientY - sy); if (!moved && dd > 8) { moved = true; ghost = document.createElement('img'); ghost.src = itemURL(id); ghost.className = 'drag-ghost pxi'; APP.appendChild(ghost); face({ eyes: 'wide', mouth: 'open' }, 5); emote('excl', 1); } if (ghost) { const [x, y] = appXY(ev.clientX, ev.clientY); ghost.style.left = x + 'px'; ghost.style.top = y + 'px'; pointer = { x, y }; const [mx, my] = mouthPos(); if (Math.hypot(x - mx, y - my) < 70) face({ eyes: 'heart', mouth: 'open' }, 5); } };
      const up = ev => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
        if (!moved) { const [x, y] = elCenter(btn); feed(id, x, y); return; }
        const [x, y] = appXY(ev.clientX, ev.clientY); ghost && ghost.remove(); P.faceT = 0;
        const [mx, my] = mouthPos();
        if (Math.hypot(x - mx, y - my) < 80 || inPet(x, y, 10)) feed(id, x, y); else { sfx('tap'); speak('Over here!', 1.2); }
      };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const [x, y] = elCenter(btn); feed(id, x, y); } });
  }
  function playBar() {
    const owned = TOYS.filter(t => S.inv.toys[t]);
    const cur = ball ? ball.id : owned[0];
    if (!ball) ball = { id: cur, x: W * .72, y: groundY - 12, vx: 0, vy: 0, rot: 0, state: 'rest' };
    const d = showBar(`<div class="row"><h3>Fetch!</h3><button class="x" data-done aria-label="Close">${SVG.x}</button></div><p>Grab the toy and fling it — ${esc(S.pet.name)} will bring it back.</p>
      <div class="row"><div class="tray-row" style="flex:1;padding:0">${owned.map(t => `<button class="titem ${t === cur ? 'sel' : ''}" data-toy="${t}" aria-label="${E.ITEMS[t].name}" style="width:56px"><img src="${itemURL(t)}" alt="" style="width:34px;height:34px"></button>`).join('')}</div><button class="btn btn-sm btn-mint" data-throw>Throw!</button></div>`, 'play');
    $('[data-done]', d).onclick = () => { sfx('tap'); H_.endMode(); };
    $('[data-throw]', d).onclick = () => { if (P.state === 'fetch' || P.state === 'return') return; throwRandom(); };
    $$('[data-toy]', d).forEach(b => b.onclick = () => { if (P.holding) return; ball = { id: b.dataset.toy, x: W * .72, y: groundY - 60, vx: 0, vy: 0, rot: 0, state: 'fly' }; sfx('pop'); playBar(); });
  }
  function bathBar() {
    sponge = document.createElement('img'); sponge.className = 'sponge pxi'; sponge.src = spongeURL(); sponge.alt = ''; room.appendChild(sponge); moveSponge(W * .75, groundY - 100);
    scrubP = 0; room.style.cursor = 'none';
    const d = showBar(`<div class="row"><h3>Bubble bath</h3><button class="x" data-done aria-label="Close">${SVG.x}</button></div><p id="bathmsg">Scrub ${esc(S.pet.name)} with the sponge — rub back and forth!</p><div class="prog" aria-hidden="true"><i id="bathbar" style="width:0%"></i></div><button class="btn btn-sm btn-sky" data-auto>Auto-scrub (tap)</button>`, 'bath');
    $('[data-done]', d).onclick = () => { sfx('tap'); H_.endMode(); };
    $('[data-auto]', d).onclick = () => { if (P.state === 'shake') return; let k = 0; const iv = setInterval(() => { const x = P.x + Math.sin(k) * 50, y = P.y - 90 + Math.cos(k * 1.3) * 30; down = down || { kind: 'scrub' }; scrub(x, y); k += .6; if (scrubP >= 100 || mode !== 'bath' || k > 80) { clearInterval(iv); down = null; } }, 30); };
  }
  function sleepBar() {
    const d = showBar(`<div class="row"><h3>Sweet dreams</h3><button class="btn btn-sm btn-yellow" data-wake>Wake up</button></div><p>Energy refills while ${esc(S.pet.name)} sleeps.</p><div class="prog" aria-hidden="true"><i id="sleepbar" style="width:${S.needs.energy}%;background:linear-gradient(180deg,#ffe58a,#ffc93c)"></i></div>`, 'sleep');
    $('[data-wake]', d).onclick = () => { sfx('tap'); H_.endMode(); };
    goSleep();
  }
  function tricksBar() {
    const d = showBar(`<div class="row"><h3>Tricks</h3><button class="btn btn-sm btn-grape" data-train>Train</button><button class="x" data-done aria-label="Close">${SVG.x}</button></div><p>Tap a trick to ask ${esc(S.pet.name)} to do it.</p>
      <div class="tray-row" style="padding-bottom:2px">${TRICKS.map(t => { const m = S.tricks[t.id].m; const lock = S.level < t.lvl; return `<button class="chip" data-tr="${t.id}" ${lock ? 'disabled style="opacity:.5"' : ''} aria-label="${t.n}${lock ? ', unlocks at level ' + t.lvl : ', ' + Math.round(m) + '% learned'}"><span aria-hidden="true">${lock ? '🔒' : t.e}</span>${t.n}${lock ? ` <small>Lv${t.lvl}</small>` : m >= 100 ? ' ✓' : ` <small>${Math.round(m)}%</small>`}</button>`; }).join('')}</div>`, 'tricks');
    $('[data-done]', d).onclick = () => { sfx('tap'); H_.endMode(); };
    $('[data-train]', d).onclick = () => { sfx('pop'); openTrainer(); };
    $$('[data-tr]', d).forEach(b => b.onclick = () => { if (P.state === 'trick') return; sfx('pop'); perform(b.dataset.tr); });
  }

  /* ---- public ---- */
  Object.assign(H_, {
    get sleeping() { return P.state === 'sleep'; },
    action(a) {
      if (a === mode) { H_.endMode(); return; }
      H_.endMode();
      if (a === 'feed') feedTray(); else if (a === 'play') playBar(); else if (a === 'bath') bathBar(); else if (a === 'sleep') sleepBar(); else if (a === 'tricks') tricksBar(); else if (a === 'decor') decorBar();
      else if (a === 'dress') openWardrobe(); else if (a === 'talk') openTalk(); else if (a === 'photo') openPhoto();
    },
    endMode(woke) {
      const was = mode; mode = null; selFurn = null; refreshDecorSel();
      $$('.tray,.mode-bar', rui).forEach(x => x.remove()); const dk = $('#dock', scr); dk && dk.classList.remove('hide');
      $$('.dock-btn', scr).forEach(b => b.setAttribute('aria-pressed', 'false'));
      if (sponge) { sponge.remove(); sponge = null; room.style.cursor = ''; bubblesOn.length = 0; }
      if (was === 'play') { if (P.state === 'fetch' || P.state === 'return') setIdle(); ball = null; P.holding = null; }
      if (was === 'sleep' || P.state === 'sleep') { setIdle(1); face({ eyes: 'happy', mouth: 'open' }, 1.4); speak(woke ? 'Good morning! I feel amazing!' : '*yawn* …hi!'); hop(200); addXP(5); window.Frame && Frame.tone('dark'); updateHud(); }
      if (was === 'bath') { scrubP = 0; if (P.state === 'shake') setIdle(); }
      persist();
    },
    react(kind) { if (kind === 'happy') { face({ eyes: 'happy', mouth: 'open', arm: 'raise' }, 1.6); hop(240); emote('heart'); } },
    say: speak, face, emote, hop, perform, refreshLook() { anchorsKey = ''; },
    isDarkTop() { return roomInfo && roomInfo.night && S.room.wall === 'night'; },
    pause() { running = false; cancelAnimationFrame(raf); },
    resume() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
    destroy() { running = false; cancelAnimationFrame(raf); ro.disconnect(); HOME = null; },
    debug: P,
  });
  // first greeting
  setTimeout(() => { if (!mode) { speak(choice([`Hi ${S.pet.addressAs || 'friend'}!`, 'Yay, you\'re here!', 'Let\'s have fun today!'])); face({ eyes: 'happy', mouth: 'open' }, 1.2); hop(220); } }, 700);
  return H_;
}
let SPONGE = null;
function spongeURL() { if (SPONGE) return SPONGE; const c = E.paint(18, 18, P => { P.ell(9, 10, 8, 6, '#ffd84a', 's', { n: 3 }); for (const [x, y] of [[5, 9], [10, 7], [12, 12], [7, 13]]) P.px(x, y, '#e8b62a'); P.ell(4, 3, 2.4, 2.4, '#e8f7ff', 'b1', { shade: false }); P.ell(13, 3, 1.6, 1.6, '#e8f7ff', 'b2', { shade: false }); }); const b = document.createElement('canvas'); b.width = 54; b.height = 54; const x = b.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, 54, 54); return (SPONGE = b.toDataURL()); }

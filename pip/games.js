/* PIP — mini-games: Treat Catch, Memory Match, Bubble Pop. Shared start/countdown/end flow. */
'use strict';
const GDEF = {
  catch: { n: 'Treat Catch', bg: 'linear-gradient(180deg,#ffb36b,#ff6f91)', how: ['Move with ← → keys, A/D, or drag/tap left & right.', 'Catch treats for points — golden stars are worth 5!', 'Dodge grumpy rain clouds. 3 hearts — no harm if you lose them.'], stars: [15, 35, 60], len: 45 },
  match: { n: 'Memory Match', bg: 'linear-gradient(180deg,#a68bff,#ff8fb1)', how: ['Tap two cards (or use Tab + Enter) to flip them.', 'Find all 8 pairs before the timer runs out.', 'Fewer misses and more time left = more stars.'], stars: [40, 70, 95], len: 60 },
  bubble: { n: 'Bubble Pop', bg: 'linear-gradient(180deg,#6fd0ff,#8b6cff)', how: ['Tap bubbles before they float away.', 'Golden bubbles = 5 points. Chain pops quickly for combos!', 'Keyboard: press Space to pop the lowest bubble.'], stars: [25, 50, 80], len: 40 },
};
let GAME = null;
function startGame(id) {
  const d = GDEF[id]; HOME && HOME.pause();
  const g = document.createElement('div'); g.className = 'game'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-label', d.n); APP.appendChild(g);
  window.Frame && Frame.tone('light');
  const best = S.stats.best[id] || 0;
  g.innerHTML = `<div class="g-panel" style="--gbg:${d.bg}"><h1>${d.n}</h1><p class="sub">Play with ${esc(S.pet.name)} to earn coins & XP.</p><span data-hero></span><div class="how"><ul>${d.how.map(h => `<li>${h}</li>`).join('')}</ul></div><p class="best">Best: ${best} ${starsHtml(S.stats.best[id + '_stars'] || 0)}</p><div class="btns"><button class="btn btn-lg btn-yellow" data-go>Play!</button><button class="btn btn-white" data-quit>Back</button></div></div>`;
  const hero = petCanvas({ eyes: 'happy', mouth: 'open', arm: 'both' }, 3); hero.className = 'hero px'; $('[data-hero]', g).replaceWith(hero);
  $('[data-go]', g).onclick = () => { sfx('pop'); countdown(g, () => (id === 'catch' ? gCatch : id === 'match' ? gMatch : gBubble)(g, d)); };
  $('[data-quit]', g).onclick = () => quitGame(g);
  setTimeout(() => $('[data-go]', g).focus(), 100);
}
function quitGame(g) { if (GAME && GAME.stop) GAME.stop(); GAME = null; g.remove(); HOME && HOME.resume(); window.Frame && Frame.tone('dark'); const p = $('#page'); if (p && !p.hidden && TAB === 'play') renderPlay(p); }
function countdown(g, go) {
  g.innerHTML = ''; let n = 3; const cd = document.createElement('div'); cd.className = 'countdown'; g.appendChild(cd);
  const tick = () => { if (!g.isConnected) return; cd.innerHTML = `<b>${n || 'GO!'}</b>`; sfx(n ? 'tick' : 'good'); if (n-- > 0) setTimeout(tick, 650); else setTimeout(() => { cd.remove(); go(); }, 450); };
  tick();
}
function gHud(g, extra) {
  const h = document.createElement('div'); h.className = 'g-hud';
  h.innerHTML = `<button class="pill g-quit" data-quit aria-label="Quit game">✕</button><span class="pill" aria-label="Score">${ic('star')}<span data-score>0</span></span>${extra || ''}<span class="sp"></span><span class="pill timer" aria-label="Time left">⏱ <span data-time></span></span>`;
  g.appendChild(h); $('[data-quit]', h).onclick = () => { sfx('tap'); quitGame(g); }; return h;
}
function endGame(g, id, score, extraLine) {
  if (GAME && GAME.stop) GAME.stop(); GAME = null;
  const d = GDEF[id]; const stars = d.stars.filter(s => score >= s).length;
  const coins = Math.round(5 + score * .5 + stars * 5); const xp = 10 + stars * 8;
  const prevBest = S.stats.best[id] || 0; const isBest = score > prevBest;
  if (isBest) S.stats.best[id] = score; S.stats.best[id + '_stars'] = Math.max(S.stats.best[id + '_stars'] || 0, stars);
  if (stars === 3) S.stats.threeStars++;
  stat('games'); bumpNeed('fun', 25); S.needs.energy = clamp(S.needs.energy - 6, 0, 100);
  S.coins += coins; S.stats.coinsEarned += coins; persist();
  const p = document.createElement('div'); p.className = 'g-panel'; p.style.setProperty('--gbg', d.bg);
  p.innerHTML = `<h1>${stars === 3 ? 'Amazing!' : stars === 2 ? 'Great job!' : stars === 1 ? 'Nice!' : 'Good try!'}</h1><div class="g-stars" aria-label="${stars} of 3 stars">${[0, 1, 2].map(i => `<span class="${i < stars ? '' : 'off'}">⭐</span>`).join('')}</div>
    <div class="g-score">${score}</div><p class="sub">${isBest && score ? '🏆 New best score!' : 'Best: ' + Math.max(prevBest, score)}${extraLine ? ' · ' + extraLine : ''}</p><span data-hero></span>
    <div class="rewards" style="margin:4px 0 22px"><div class="reward">${ic('coin')} +${coins}</div><div class="reward xp">+${xp} XP</div></div>
    <div class="btns"><button class="btn btn-lg btn-yellow" data-again>Play again</button><button class="btn btn-white" data-done>Back to Play</button></div>`;
  g.appendChild(p);
  const hero = petCanvas(stars ? { eyes: stars === 3 ? 'star' : 'happy', mouth: 'open', arm: 'both' } : { eyes: 'happy', mouth: 'smile' }, 2.5); hero.className = 'hero px'; hero.style.cssText = 'width:160px;height:160px'; $('[data-hero]', p).replaceWith(hero);
  sfx(stars >= 2 ? 'levelup' : 'good'); if (stars) confetti(null, null, 40 + stars * 30);
  setTimeout(() => addXP(xp), 400); checkAch();
  $('[data-again]', p).onclick = () => { sfx('pop'); g.innerHTML = ''; countdown(g, () => (id === 'catch' ? gCatch : id === 'match' ? gMatch : gBubble)(g, d)); };
  $('[data-done]', p).onclick = () => { sfx('tap'); quitGame(g); };
  setTimeout(() => $('[data-again]', p).focus(), 100);
  say(`Game over. Score ${score}. ${stars} stars. Earned ${coins} coins.`);
}

/* ---------------- Treat Catch ---------------- */
function gCatch(g, d) {
  g.innerHTML = ''; const cv = document.createElement('canvas'); cv.className = 'gc'; g.appendChild(cv); const ctx = cv.getContext('2d');
  const hud = gHud(g, `<span class="pill lives" data-lives aria-label="Hearts"></span>`);
  const W = APP.clientWidth, H = APP.clientHeight, dpr = Math.min(2, devicePixelRatio || 1); cv.width = W * dpr; cv.height = H * dpr;
  const groundY = H - (parseFloat(getComputedStyle(APP).getPropertyValue('--safe-bottom')) || 30) - 30;
  const pet = { x: W / 2, vx: 0, tx: W / 2, face: 1, happy: 0, ouch: 0 };
  let items = [], score = 0, lives = 3, t = d.len, spawnT = 0, raf = 0, last = performance.now(), keys = {}, combo = 0, parts = [];
  const goods = ['apple', 'cookie', 'fish', 'berries', 'cheese', 'carrot', 'donut', 'sushi'];
  const sc = hud.querySelector('[data-score]'), tm = hud.querySelector('[data-time]'), lv = hud.querySelector('[data-lives]');
  const drawLives = () => lv.innerHTML = [0, 1, 2].map(i => `<img src="${icon('heart')}" alt="" style="${i < lives ? '' : 'filter:grayscale(1);opacity:.35'}">`).join('');
  drawLives();
  // background
  const bg = document.createElement('canvas'); const bw = Math.ceil(W / 3), bh = Math.ceil(H / 3); bg.width = bw; bg.height = bh; const b = bg.getContext('2d');
  for (let y = 0; y < bh; y++) { b.fillStyle = E.mix('#ffb36b', '#ffe6f0', y / bh); b.fillRect(0, y, bw, 1); }
  b.fillStyle = '#fff3c0'; b.beginPath(); b.arc(bw * .78, bh * .22, 14, 0, 7); b.fill();
  for (let x = 0; x < bw; x++) { const h = Math.round(bh * .72 + Math.sin(x / 11) * 6); b.fillStyle = '#ff9fb8'; b.fillRect(x, h, 1, bh - h); }
  for (let x = 0; x < bw; x++) { const h = Math.round(groundY / 3 - 4 + Math.sin(x / 6) * 1.5); b.fillStyle = '#8fd17a'; b.fillRect(x, h, 1, bh - h); b.fillStyle = '#b4e892'; b.fillRect(x, h, 1, 1); }
  const onKey = e => { if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key)) { keys[e.key.toLowerCase()] = e.type === 'keydown'; e.preventDefault(); } };
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
  const pt = e => { const [x] = appXY(e.clientX, e.clientY); pet.tx = x; };
  cv.addEventListener('pointerdown', e => { pt(e); cv.setPointerCapture(e.pointerId); }); cv.addEventListener('pointermove', e => { if (e.buttons || e.pointerType !== 'mouse') pt(e); else pt(e); });
  GAME = { stop() { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); } };
  function spawn() {
    const r = Math.random(); const x = rand(30, W - 30);
    if (r < .17 + (d.len - t) / 300) items.push({ k: 'cloud', x, y: -30, vy: rand(150, 210) + (d.len - t) * 3, w: 0 });
    else if (r < .27) items.push({ k: 'gold', x, y: -30, vy: rand(200, 260) + (d.len - t) * 3 });
    else items.push({ k: choice(goods), x, y: -30, vy: rand(160, 240) + (d.len - t) * 3.5, rot: 0 });
  }
  function loop(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now; t -= dt;
    if (keys.arrowleft || keys.a) pet.tx = pet.x - 300; if (keys.arrowright || keys.d) pet.tx = pet.x + 300;
    pet.tx = clamp(pet.tx, 40, W - 40); const dx = pet.tx - pet.x; const mv = clamp(dx, -560 * dt, 560 * dt); pet.x += mv; if (Math.abs(mv) > .5) pet.face = Math.sign(mv);
    if (keys.arrowleft || keys.a || keys.arrowright || keys.d) pet.tx = pet.x;
    spawnT -= dt; if (spawnT <= 0) { spawn(); spawnT = Math.max(.32, .8 - (d.len - t) / 70); }
    const mouthY = groundY - 150;
    for (const it of items) { it.y += it.vy * dt; it.rot = (it.rot || 0) + dt * 3;
      if (!it.done && it.y > mouthY - 30 && it.y < mouthY + 50 && Math.abs(it.x - pet.x) < 60) {
        it.done = true;
        if (it.k === 'cloud') { lives--; drawLives(); pet.ouch = .8; combo = 0; sfx('bad'); buzz(30); for (let i = 0; i < 6; i++) parts.push({ s: 'drop', x: it.x, y: it.y, vx: rand(-120, 120), vy: rand(-200, -60), life: .7 }); if (lives <= 0) return finish(); }
        else { const pts = it.k === 'gold' ? 5 : 1; combo++; const bonus = combo >= 5 ? 1 : 0; score += pts + bonus; sc.textContent = score; pet.happy = .5; sfx(it.k === 'gold' ? 'sparkle' : 'chomp'); floatText(it.x, it.y - 30, '+' + (pts + bonus) + (bonus ? ' combo!' : ''), it.k === 'gold' ? '#e09a12' : '#d94c72'); for (let i = 0; i < 4; i++) parts.push({ s: it.k === 'gold' ? 'star' : 'sparkle', x: it.x, y: it.y, vx: rand(-100, 100), vy: rand(-180, -60), life: .6 }); }
      }
      if (!it.done && it.y > groundY + 20) { it.done = true; if (it.k !== 'cloud') combo = 0; }
    }
    items = items.filter(i => !i.done);
    for (const p of parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; } parts = parts.filter(p => p.life > 0);
    pet.happy -= dt; pet.ouch -= dt;
    tm.textContent = Math.max(0, Math.ceil(t)); if (t <= 0) return finish();
    // draw
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(bg, 0, 0, bw * 3, bh * 3);
    ctx.fillStyle = 'rgba(58,30,80,.18)'; ctx.beginPath(); ctx.ellipse(pet.x, groundY, 50, 8, 0, 0, 7); ctx.fill();
    const spr = E.renderPet(S.pet.genome, { stage: stageFor(S.level), outfit: S.wear, eyes: pet.ouch > 0 ? 'dizzy' : pet.happy > 0 ? 'happy' : 'open', mouth: pet.ouch > 0 ? 'o' : 'open', arm: 'both', walk: Math.abs(dx) > 4 ? (Math.floor(now / 120) % 2 ? 1 : -1) : 0 }, 1);
    ctx.save(); ctx.translate(Math.round(pet.x), groundY + 3 + (pet.happy > 0 ? -6 : 0)); ctx.scale(pet.face, 1); ctx.drawImage(spr, -96, -186, 192, 192); ctx.restore();
    for (const it of items) {
      if (it.k === 'cloud') { ctx.fillStyle = '#7a6f9a'; const x = Math.round(it.x), y = Math.round(it.y); ctx.fillRect(x - 24, y - 6, 48, 14); ctx.fillRect(x - 15, y - 15, 30, 10); ctx.fillStyle = '#9a8fba'; ctx.fillRect(x - 12, y - 12, 12, 4); ctx.fillStyle = '#2b1d3a'; ctx.fillRect(x - 9, y - 1, 3, 3); ctx.fillRect(x + 6, y - 1, 3, 3); ctx.fillRect(x - 3, y + 4, 6, 2); ctx.fillStyle = '#6fc3ff'; ctx.fillRect(x - 15, y + 12, 3, 6); ctx.fillRect(x + 3, y + 14, 3, 6); }
      else if (it.k === 'gold') { const sp = E.sprite('star', 1); ctx.drawImage(sp, Math.round(it.x - sp.width * 2.5), Math.round(it.y - sp.height * 2.5), sp.width * 5, sp.height * 5); }
      else { ctx.drawImage(E.itemCanvas(it.k), Math.round(it.x - 30), Math.round(it.y - 30), 60, 60); }
    }
    for (const p of parts) { const sp = E.sprite(p.s, 1); ctx.globalAlpha = Math.min(1, p.life * 2); ctx.drawImage(sp, Math.round(p.x), Math.round(p.y), sp.width * 3, sp.height * 3); ctx.globalAlpha = 1; }
    raf = requestAnimationFrame(loop);
  }
  function finish() { cancelAnimationFrame(raf); GAME.stop(); endGame(g, 'catch', score, lives > 0 ? 'time!' : 'out of hearts'); }
  raf = requestAnimationFrame(loop);
}

/* ---------------- Memory Match ---------------- */
function gMatch(g, d) {
  g.innerHTML = ''; g.style.background = 'linear-gradient(180deg,#a68bff,#ffb3c7)';
  const hud = gHud(g, `<span class="pill" aria-label="Misses">❌ <span data-miss>0</span></span>`);
  const pool = ['apple', 'fish', 'cookie', 'duck', 'cake', 'icecream', 'plush', 'yarn', 'honey', 'donut', 'pizza', 'sushi'];
  const picks = pool.sort(() => Math.random() - .5).slice(0, 8);
  const deck = picks.concat(picks).sort(() => Math.random() - .5);
  const grid = document.createElement('div'); grid.className = 'mm-grid'; grid.setAttribute('role', 'grid'); g.appendChild(grid);
  grid.innerHTML = deck.map((id, i) => `<button class="mm-card" data-i="${i}" aria-label="Card ${i + 1}, face down"><span class="in"><span class="b"></span><span class="f"><img src="${itemURL(id)}" alt="" class="pxi"></span></span></button>`).join('');
  const petBox = document.createElement('div'); petBox.className = 'g-pet'; g.appendChild(petBox);
  const setPet = st => { petBox.innerHTML = ''; petBox.appendChild(petCanvas(st, 2.5)); };
  setPet({ eyes: 'open', arm: 'both' });
  const sc = hud.querySelector('[data-score]'), tm = hud.querySelector('[data-time]'), ms = hud.querySelector('[data-miss]');
  let open = [], found = 0, miss = 0, t = d.len, lock = false, score = 0;
  const timer = setInterval(() => { t--; tm.textContent = t; if (t <= 5 && t > 0) sfx('tick'); if (t <= 0) finish(); }, 1000); tm.textContent = t;
  GAME = { stop() { clearInterval(timer); } };
  $$('.mm-card', grid).forEach(c => c.onclick = () => {
    if (lock || c.classList.contains('up')) return; c.classList.add('up'); sfx('pop'); c.setAttribute('aria-label', 'Card ' + (+c.dataset.i + 1) + ': ' + E.ITEMS[deck[c.dataset.i]].name); open.push(c);
    if (open.length === 2) {
      lock = true; const [a, b] = open;
      if (deck[a.dataset.i] === deck[b.dataset.i]) { setTimeout(() => { a.classList.add('matched'); b.classList.add('matched'); a.disabled = b.disabled = true; sfx('good'); found++; score += 10; sc.textContent = score; const [x, y] = elCenter(b); burst(x, y, 'heart', 5, { sc: 3, up: true }); setPet({ eyes: 'happy', mouth: 'open', arm: 'raise' }); open = []; lock = false; if (found === 8) finish(); }, 300); }
      else { setTimeout(() => { a.classList.add('miss'); b.classList.add('miss'); sfx('bad'); miss++; ms.textContent = miss; setPet({ eyes: 'dizzy', mouth: 'o', arm: 'both' }); }, 450); setTimeout(() => { a.classList.remove('up', 'miss'); b.classList.remove('up', 'miss'); a.setAttribute('aria-label', 'Card ' + (+a.dataset.i + 1) + ', face down'); b.setAttribute('aria-label', 'Card ' + (+b.dataset.i + 1) + ', face down'); open = []; lock = false; setPet({ eyes: 'open', arm: 'both' }); }, 1000); }
    }
  });
  setTimeout(() => $('.mm-card', grid).focus(), 50);
  let ended = false;
  function finish() { if (ended) return; ended = true; clearInterval(timer); const final = score + (found === 8 ? Math.max(0, t) + Math.max(0, 20 - miss * 2) : 0); setTimeout(() => { g.style.background = ''; endGame(g, 'match', final, `${found}/8 pairs`); }, 600); }
}

/* ---------------- Bubble Pop ---------------- */
function gBubble(g, d) {
  g.innerHTML = ''; const cv = document.createElement('canvas'); cv.className = 'gc'; g.appendChild(cv); const ctx = cv.getContext('2d');
  const hud = gHud(g, `<span class="pill" aria-label="Combo">🔥 <span data-combo>x1</span></span>`);
  const W = APP.clientWidth, H = APP.clientHeight, dpr = Math.min(2, devicePixelRatio || 1); cv.width = W * dpr; cv.height = H * dpr;
  let bubs = [], parts = [], score = 0, t = d.len, raf = 0, last = performance.now(), spawnT = 0, combo = 1, comboT = 0, petHappy = 0;
  const sc = hud.querySelector('[data-score]'), tm = hud.querySelector('[data-time]'), cb = hud.querySelector('[data-combo]');
  const cols = ['#ff8fb1', '#7fd6ff', '#b9a6ff', '#8fe08a'];
  const bg = document.createElement('canvas'); const bw = Math.ceil(W / 3), bh = Math.ceil(H / 3); bg.width = bw; bg.height = bh; const b = bg.getContext('2d');
  for (let y = 0; y < bh; y++) { b.fillStyle = E.mix('#5ec8ff', '#2a5ab8', y / bh); b.fillRect(0, y, bw, 1); }
  for (let i = 0; i < 9; i++) { b.fillStyle = 'rgba(255,255,255,.12)'; const x = (i * 47) % bw; b.fillRect(x, 0, 6, bh); }
  for (let x = 0; x < bw; x++) { const h = Math.round(bh - 18 + Math.sin(x / 7) * 3); b.fillStyle = '#f6dca0'; b.fillRect(x, h, 1, bh - h); }
  for (let i = 0; i < 6; i++) { const x = 8 + i * 24; b.fillStyle = '#5fbf5a'; for (let y = 0; y < 18; y++) b.fillRect(x + Math.round(Math.sin(y / 3 + i) * 2), bh - 18 - y, 2, 1); }
  function pop(bb, auto) {
    bb.dead = true; const pts = bb.gold ? 5 : 1; score += pts * combo; sc.textContent = score; comboT = 1.1; combo = Math.min(5, combo + (bb.gold ? 1 : .34)); cb.textContent = 'x' + Math.floor(combo); petHappy = .4;
    sfx(bb.gold ? 'sparkle' : 'bubble'); floatText(bb.x, bb.y - bb.r, '+' + pts * Math.floor(combo), bb.gold ? '#e09a12' : '#2a86d9');
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; parts.push({ x: bb.x + Math.cos(a) * bb.r, y: bb.y + Math.sin(a) * bb.r, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, life: .35, c: bb.gold ? '#ffd23f' : bb.c }); }
  }
  cv.addEventListener('pointerdown', e => { const [x, y] = appXY(e.clientX, e.clientY); const hit = bubs.filter(bb => !bb.dead && Math.hypot(x - bb.x, y - bb.y) < bb.r + 10).sort((a, b) => a.r - b.r)[0]; if (hit) pop(hit); else { combo = 1; cb.textContent = 'x1'; } });
  const onKey = e => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); const low = bubs.filter(bb => !bb.dead && bb.y < H - 60).sort((a, b) => b.y - a.y)[0]; if (low) pop(low); } };
  window.addEventListener('keydown', onKey);
  GAME = { stop() { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); } };
  function loop(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now; t -= dt; comboT -= dt; if (comboT <= 0 && combo > 1) { combo = 1; cb.textContent = 'x1'; } petHappy -= dt;
    spawnT -= dt; if (spawnT <= 0) { spawnT = Math.max(.28, .7 - (d.len - t) / 80); const gold = Math.random() < .1; bubs.push({ x: rand(40, W - 40), y: H + 40, r: gold ? 24 : rand(22, 36), vy: rand(70, 120) + (d.len - t) * 2.5, ph: rand(0, 6), gold, c: choice(cols) }); }
    for (const bb of bubs) { bb.y -= bb.vy * dt; bb.ph += dt * 2; bb.x += Math.sin(bb.ph) * 20 * dt; if (bb.y < (parseFloat(getComputedStyle(APP).getPropertyValue('--safe-top')) || 54) + 40) { bb.dead = true; bb.escaped = true; } }
    if (bubs.some(bb => bb.escaped && !bb.counted && (bb.counted = true))) { combo = 1; cb.textContent = 'x1'; }
    bubs = bubs.filter(bb => !bb.dead);
    for (const p of parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; } parts = parts.filter(p => p.life > 0);
    tm.textContent = Math.max(0, Math.ceil(t)); if (t <= 0) { cancelAnimationFrame(raf); GAME.stop(); return endGame(g, 'bubble', score); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(bg, 0, 0, bw * 3, bh * 3);
    const spr = E.renderPet(S.pet.genome, { stage: stageFor(S.level), outfit: S.wear, eyes: petHappy > 0 ? 'happy' : 'open', mouth: petHappy > 0 ? 'open' : 'smile', arm: petHappy > 0 ? 'both' : null }, 1);
    ctx.drawImage(spr, W - 150, H - 190 - (parseFloat(getComputedStyle(APP).getPropertyValue('--safe-bottom')) || 30) + 60, 160, 160);
    for (const bb of bubs) {
      const x = Math.round(bb.x / 3) * 3, y = Math.round(bb.y / 3) * 3, r = Math.round(bb.r / 3) * 3;
      ctx.fillStyle = bb.gold ? 'rgba(255,210,63,.55)' : bb.c + '66'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = bb.gold ? '#ffd23f' : '#ffffff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(x - r * .5, y - r * .55, 6, 6); ctx.fillRect(x - r * .5 + 6, y - r * .55 - 3, 3, 3);
      if (bb.gold) { const sp = E.sprite('star', 1); ctx.drawImage(sp, x - 12, y - 12, 24, 24); }
    }
    for (const p of parts) { ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 4, 4); }
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
}

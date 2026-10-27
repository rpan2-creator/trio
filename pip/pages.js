/* PIP — pages (Play / Shop / Journal) and sheets (wardrobe, trainer, talk, memories, photo, settings). */
'use strict';

/* ============================== PLAY ============================== */
const GAMES = [
  { id: 'catch', n: 'Treat Catch', d: 'Slide left & right to catch falling treats. Dodge the grumpy clouds!', c: '#ff9a3c', dd: '#e06f12', thumb: 'catch' },
  { id: 'match', n: 'Memory Match', d: 'Flip the pixel cards and find every pair before time runs out.', c: '#8b6cff', dd: '#6646e0', thumb: 'match' },
  { id: 'bubble', n: 'Bubble Pop', d: 'Pop bubbles as they float up. Golden ones are worth extra!', c: '#4fb2ff', dd: '#2a86d9', thumb: 'bubble' },
];
function starsHtml(n) { return `<span class="stars" aria-label="${n} of 3 stars">${[0, 1, 2].map(i => `<span class="${i < n ? '' : 'off'}">⭐</span>`).join('')}</span>`; }
function renderPlay(page) {
  ensureQuests(); page.style.setProperty('--bg', '#f4efff');
  const qs = S.quests.list;
  page.innerHTML = `<div class="page-h"><h1>Play</h1><button class="pill" aria-label="Coins">${ic('coin')}<span>${S.coins}</span></button></div>
    <div class="streak">${ic('fire')}<div style="flex:1"><b>${S.streak.count}-day streak</b><p>Visit any day to keep it going. Missing a day never costs anything.</p></div></div>
    <div class="sec-h"><h2>Daily quests</h2><small>New quests at midnight</small></div>
    <div id="qlist">${qs.map((q, i) => { const d = questDef(q.id); const done = q.prog >= d.goal; return `<div class="quest ${q.claimed ? 'done' : ''}" style="--l:${done ? '#d3f7e6' : '#fff1df'}"><span class="qi">${ic(d.ic)}</span><div class="qt"><b>${esc(d.t(S.pet.name))}</b><div class="qp"><div class="prog" aria-hidden="true"><i style="width:${100 * Math.min(1, q.prog / d.goal)}%"></i></div><small>${Math.min(q.prog, d.goal)}/${d.goal}</small></div></div>${q.claimed ? '<span class="rw" style="color:#1fa36c">✓ Done</span>' : done ? `<button class="btn btn-sm btn-yellow" data-claim="${i}">${ic('coin')}${d.r}</button>` : `<span class="rw">${ic('coin')}${d.r}</span>`}</div>`; }).join('')}</div>
    ${qs.every(q => q.claimed) && !S.quests.bonus ? `<button class="btn btn-block btn-grape" data-bonus style="margin-bottom:6px">${ic('gift')} Open daily bonus chest!</button>` : ''}
    <div class="sec-h"><h2>Mini-games</h2><small>Earn coins & XP</small></div>
    ${GAMES.map(g => `<button class="game-card" data-game="${g.id}" style="--c:${g.c};--d:${g.dd}"><span class="thumb" data-thumb="${g.id}"></span><span style="flex:1;position:relative;z-index:1"><h3>${g.n}</h3><p>${g.d}</p><span class="meta"><span>Best ${S.stats.best[g.id] || 0}</span>${starsHtml(S.stats.best[g.id + '_stars'] || 0)}</span></span></button>`).join('')}
    <div class="sec-h"><h2>Tricks</h2><small>Level ${S.level}</small></div>
    <div class="tricks">${TRICKS.map(t => { const m = S.tricks[t.id].m, lock = S.level < t.lvl; return `<div class="trick" style="--l:${t.l}"><div class="tt"><span class="e" aria-hidden="true">${lock ? '🔒' : t.e}</span><b>${t.n}</b></div><div class="prog" aria-label="${Math.round(m)}% learned"><i style="width:${m}%"></i></div><div class="btns">${lock ? `<span style="font-size:12px;color:var(--ink3)">Unlocks at level ${t.lvl}</span>` : `<button class="btn btn-sm btn-grape" data-train="${t.id}">${m >= 100 ? 'Polish' : 'Train'}</button>`}</div></div>`; }).join('')}</div>`;
  $$('[data-thumb]', page).forEach(el => el.appendChild(gameThumb(el.dataset.thumb)));
  $$('[data-game]', page).forEach(b => b.onclick = () => { sfx('pop'); startGame(b.dataset.game); });
  $$('[data-train]', page).forEach(b => b.onclick = () => { sfx('pop'); openTrainer(b.dataset.train); });
  $$('[data-claim]', page).forEach(b => b.onclick = () => { const q = S.quests.list[+b.dataset.claim]; const d = questDef(q.id); q.claimed = true; const [x, y] = elCenter(b); sfx('coin'); confetti(x, y, 30, .8); S.coins += d.r; S.stats.coinsEarned += d.r; addXP(15); persist(); floatText(x, y - 20, '+' + d.r, '#e09a12'); updateBadges(); setTimeout(() => renderPlay(page), 500); });
  const bonus = $('[data-bonus]', page); if (bonus) bonus.onclick = () => openChest(page);
}
function openChest(page) {
  sfx('hatch'); S.quests.bonus = true; const coins = 60 + Math.floor(Math.random() * 40); const food = choice(FOODS.filter(f => E.ITEMS[f].price > 0)); S.inv.food[food] = (S.inv.food[food] || 0) + 2; S.coins += coins; S.stats.coinsEarned += coins; persist(); confetti(null, null, 100);
  const m = modal(`<div class="ribbon">DAILY BONUS</div><div class="art" style="height:100px;margin-top:-10px"><div class="rays" aria-hidden="true"></div><img src="${icon('gift')}" alt="" style="width:96px;position:relative"></div><h2>All quests done!</h2><p>You and ${esc(S.pet.name)} had a great day.</p><div class="rewards"><div class="reward">${ic('coin')} +${coins}</div><div class="reward xp"><img src="${itemURL(food)}" alt="">×2</div></div><div class="btns"><button class="btn btn-yellow btn-lg" data-close>Awesome!</button></div>`, { onClose: () => { checkAch(); renderPlay(page); } });
}
function gameThumb(id) {
  const c = document.createElement('canvas'); c.width = 88; c.height = 88; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  if (id === 'catch') { for (const [f, px, py] of [['cookie', 8, 6], ['apple', 50, 14], ['fish', 26, 30]]) x.drawImage(E.itemCanvas(f), px, py, 30, 30); x.drawImage(E.renderPet(S.pet.genome, { stage: stageFor(S.level), eyes: 'happy', mouth: 'open', arm: 'both' }, 1), 12, 30, 64, 64); }
  if (id === 'match') { for (let i = 0; i < 4; i++) { const px = 6 + (i % 2) * 40, py = 6 + Math.floor(i / 2) * 40; x.fillStyle = i === 1 ? '#fff' : '#ffd3de'; x.fillRect(px, py, 34, 36); if (i === 1 || i === 2) x.drawImage(E.itemCanvas(i === 1 ? 'duck' : 'duck'), px + 3, py + 4, 28, 28); else { x.fillStyle = '#ff8fb1'; x.fillRect(px + 12, py + 13, 10, 10); } } }
  if (id === 'bubble') { const sp = E.sprite('bubble', 1); for (const [px, py, s] of [[10, 10, 6], [52, 24, 4], [24, 50, 5], [60, 60, 3], [6, 62, 3]]) x.drawImage(sp, px, py, sp.width * s, sp.height * s); }
  return c;
}

/* ============================== SHOP ============================== */
let SHOPCAT = 'food';
const SHOP_CATS = [['food', 'Snacks', 'food'], ['toys', 'Toys', 'ball'], ['outfits', 'Outfits', 'hat'], ['furn', 'Furniture', 'sofa'], ['room', 'Walls & floors', 'home']];
function shopItems(cat) {
  if (cat === 'food') return FOODS.filter(f => E.ITEMS[f].price > 0).map(f => ({ id: f, name: E.ITEMS[f].name, price: E.ITEMS[f].price, img: itemURL(f), owned: S.inv.food[f] || 0, multi: true, tag: S.pet.knownFav && S.pet.fav === f ? 'fav' : '' }));
  if (cat === 'toys') return TOYS.filter(t => E.ITEMS[t].price > 0).map(t => ({ id: t, name: E.ITEMS[t].name, price: E.ITEMS[t].price, img: itemURL(t), owned: S.inv.toys[t] || 0 }));
  if (cat === 'outfits') return OUTFITS.filter(o => o.price > 0).map(o => ({ id: o.id, name: o.name, price: o.price, img: outfitURL(o), owned: S.inv.outfits[o.id] || 0 }));
  if (cat === 'furn') return Object.keys(E.FURN).map(f => ({ id: f, name: E.FURN[f].name, price: E.FURN[f].price, img: itemURL(f, 2), owned: S.inv.furn[f] || 0, multi: true, cap: 3 }));
  if (cat === 'room') return [].concat(Object.keys(E.WALLPAPERS).filter(k => E.WALLPAPERS[k].price).map(k => ({ id: 'wall:' + k, name: E.WALLPAPERS[k].name, price: E.WALLPAPERS[k].price, sw: E.WALLPAPERS[k], owned: S.inv.walls[k] ? 1 : 0 })), Object.keys(E.FLOORS).filter(k => E.FLOORS[k].price).map(k => ({ id: 'floor:' + k, name: E.FLOORS[k].name, price: E.FLOORS[k].price, sw: E.FLOORS[k], fl: true, owned: S.inv.floors[k] ? 1 : 0 })));
}
function renderShop(page) {
  page.style.setProperty('--bg', '#fff6e0');
  const items = shopItems(SHOPCAT);
  page.innerHTML = `<div class="page-h"><h1>Shop</h1><button class="pill" id="coinPill" aria-label="${S.coins} coins">${ic('coin')}<span id="hcoins">${S.coins}</span></button></div>
    <div class="shop-banner"><span data-sb></span><div><h3>Earned, never bought</h3><p>Every coin comes from caring and playing. No real money, no loot boxes, no timers.</p></div></div>
    <div class="cats" role="tablist" aria-label="Shop categories">${SHOP_CATS.map(([k, n, i]) => `<button role="tab" data-cat="${k}" aria-selected="${k === SHOPCAT}">${ic(i)}${n}</button>`).join('')}</div>
    <div class="shop-grid">${items.map(it => { const has = it.owned > 0 && !it.multi; const can = S.coins >= it.price; return `<button class="sitem" data-buy="${it.id}" aria-label="${esc(it.name)}, ${has ? 'owned' : it.price + ' coins'}${it.multi && it.owned ? ', you have ' + it.owned : ''}">${it.multi && it.owned ? `<span class="own">×${it.owned}</span>` : ''}${it.tag === 'fav' ? '<span class="own" style="left:auto;right:8px">💖</span>' : ''}<span class="art">${it.img ? `<img src="${it.img}" alt="" class="pxi ${SHOPCAT === 'outfits' ? 'o' : ''}">` : `<span style="width:56px;height:46px;border-radius:12px;display:block;background:${it.sw.a};box-shadow:inset 0 0 0 4px ${it.sw.b},0 3px 0 rgba(58,42,90,.15)"></span>`}</span><span class="nm">${esc(it.name)}</span>${has ? '<span class="price owned">Owned ✓</span>' : `<span class="price ${can ? '' : 'cant'}">${ic('coin')}${it.price}</span>`}</button>`; }).join('')}</div>
    <p class="fineprint">${SHOPCAT === 'furn' ? 'Place furniture from Home → Decorate.' : SHOPCAT === 'outfits' ? 'Try outfits on from Home → Dress.' : SHOPCAT === 'room' ? 'Switch walls and floors from Home → Decorate.' : 'Feed snacks from Home → Feed. Every pet has a secret favorite!'}</p>`;
  $('[data-sb]', page).appendChild(petCanvas({ eyes: 'happy', arm: 'raise' }, 1.25));
  $$('[data-cat]', page).forEach(b => b.onclick = () => { sfx('tap'); SHOPCAT = b.dataset.cat; renderShop(page); });
  $$('[data-buy]', page).forEach(b => b.onclick = () => buy(b.dataset.buy, b, page));
}
function buy(id, el, page) {
  const it = shopItems(SHOPCAT).find(x => x.id === id); if (!it) return;
  if (it.owned && !it.multi) { toast('Already yours!', 'star'); return; }
  if (it.cap && it.owned >= it.cap) { toast('That\'s plenty of those!'); return; }
  if (S.coins < it.price) { sfx('bad'); el.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], { duration: 250 }); toast(`Need ${it.price - S.coins} more coins — play a mini-game!`, 'coin'); return; }
  S.coins -= it.price;
  if (SHOPCAT === 'food') S.inv.food[id] = (S.inv.food[id] || 0) + 1;
  else if (SHOPCAT === 'toys') S.inv.toys[id] = 1;
  else if (SHOPCAT === 'outfits') S.inv.outfits[id] = 1;
  else if (SHOPCAT === 'furn') S.inv.furn[id] = (S.inv.furn[id] || 0) + 1;
  else if (SHOPCAT === 'room') { const [k, v] = id.split(':'); if (k === 'wall') S.inv.walls[v] = 1; else S.inv.floors[v] = 1; }
  persist(); sfx('buy'); const [x, y] = elCenter(el); burst(x, y, 'sparkle', 8, { sc: 3 }); floatText(x, y - 30, '-' + it.price, '#9a8cb4'); checkAch();
  setTimeout(() => renderShop(page), 380);
}

/* ============================== JOURNAL ============================== */
let JTAB = 'profile';
function renderJournal(page) {
  page.style.setProperty('--bg', '#effaf4');
  const p = S.pet; const pers = PERSONALITIES[p.personality];
  const age = Math.max(1, Math.ceil((Date.now() - p.born) / 864e5));
  const sp = E.PRESETS[p.genome.base]; const species = p.speciesLabel || (sp ? sp.name : 'Mystery mix');
  page.innerHTML = `<div class="page-h"><h1>Journal</h1><button class="iconbtn" data-settings aria-label="Settings">${ic('gear')}</button></div>
    <div class="seg" role="tablist" style="margin-bottom:14px">${[['profile', 'Profile'], ['memories', 'Memories'], ['stickers', 'Stickers']].map(([k, n]) => `<button role="tab" data-j="${k}" aria-selected="${JTAB === k}">${n}${k === 'memories' && S.memories.length ? ` · ${S.memories.length}` : ''}${k === 'stickers' ? ` · ${Object.keys(S.ach).length}/${ACH.length}` : ''}</button>`).join('')}</div>
    <div id="jb"></div>`;
  $$('[data-j]', page).forEach(b => b.onclick = () => { sfx('tap'); JTAB = b.dataset.j; renderJournal(page); });
  $('[data-settings]', page).onclick = () => { sfx('pop'); openSettings(); };
  const jb = $('#jb', page);
  if (JTAB === 'profile') {
    jb.innerHTML = `<div class="profile"><div class="stagebg"><span class="rarity ${p.rarity}" style="position:absolute;top:12px;left:12px;font-size:11px;padding:5px 12px">${p.rarity}</span>${p.mode === 'real' ? '<span class="trait f" style="position:absolute;top:12px;right:12px">💗 Inspired by a real pet</span>' : ''}</div>
      <div class="info"><div class="nm"><h2>${esc(p.name)}</h2><span class="trait">${pers.e} ${pers.name}</span></div>
      <p style="font-size:13.5px;color:var(--ink2);margin-top:4px">${esc(species)} · ${stageFor(S.level) === 'baby' ? 'Baby' : stageFor(S.level) === 'kid' ? 'Kid' : 'Grown-up'} · ${age} day${age > 1 ? 's' : ''} together${p.addressAs ? ' · calls you ' + esc(p.addressAs) : ''}</p>
      <div class="kv"><div><b>${S.level}</b><small>Level</small></div><div><b>${S.stats.pets}</b><small>Cuddles</small></div><div><b>${Object.values(S.tricks).filter(t => t.m >= 100).length}</b><small>Tricks</small></div><div><b>${S.stats.feeds}</b><small>Snacks</small></div><div><b>${S.stats.games}</b><small>Games</small></div><div><b>${S.stats.baths}</b><small>Baths</small></div></div>
      <div class="traits">${p.knownFav ? `<span class="trait f">💖 Loves ${esc(E.ITEMS[p.fav].name.toLowerCase())}</span>` : '<span class="trait n">💖 Favorite food: ??? (keep feeding!)</span>'}${p.knownDislike ? `<span class="trait n">🙅 Not a fan of ${esc(E.ITEMS[p.dislike].name.toLowerCase())}</span>` : ''}${p.habits.map(h => `<span class="trait">${esc(h)}</span>`).join('')}</div>
      ${p.bio ? `<p style="font-size:13.5px;color:var(--ink2);margin-top:10px;line-height:1.4">“${esc(p.bio)}”</p>` : ''}
      <div class="btnrow"><button class="btn btn-sm btn-mint" data-look>Edit look</button><button class="btn btn-sm btn-sky" data-about>Details</button><button class="btn btn-sm btn-yellow" data-photo>Photo</button></div></div></div>
      ${p.mode === 'real' ? '<div class="notice pink" style="margin-top:14px"><span>💗</span><span>This is a fictional companion inspired by your pet. It can\'t sense or report how your real pet is doing — for that, check in with whoever looks after them.</span></div>' : ''}`;
    const st = $('.stagebg', jb); const c = petCanvas({ eyes: 'happy' }, 4); c.style.cssText = 'width:256px;height:256px;margin-top:-20px;animation:parade 1.6s ease-in-out infinite'; st.appendChild(c);
    $('[data-look]', jb).onclick = () => { sfx('pop'); HOME && HOME.destroy(); obEditor('species', { edit: true }); };
    $('[data-about]', jb).onclick = () => { sfx('pop'); openDetails(page); };
    $('[data-photo]', jb).onclick = () => { sfx('pop'); openPhoto(); };
  } else if (JTAB === 'memories') {
    jb.innerHTML = `<div class="notice" style="margin-bottom:12px"><span>📒</span><span>${esc(p.name)} only remembers what you confirm. Memories are used in chats — edit, pause or forget any of them.</span></div>
      <button class="btn btn-block btn-sky" data-add style="margin-bottom:14px">+ Add a memory</button>
      ${S.memories.length ? S.memories.map(m => `<div class="mem ${m.on === false ? 'off' : ''}"><p>${esc(m.text)}</p><div class="mm"><span class="tagx">${m.src === 'chat' ? 'From a chat' : 'You added'}</span><span>${new Date(m.at).toLocaleDateString()}</span><span class="sp"></span><button class="linkbtn" data-tog="${m.id}">${m.on === false ? 'Use in chats' : 'Pause'}</button><button class="linkbtn" data-ed="${m.id}">Edit</button><button class="linkbtn" data-del="${m.id}" style="color:#c93a3a">Forget</button></div></div>`).join('') : `<div class="empty card"><span data-e></span><b>No memories yet</b><br>Tell ${esc(p.name)} about your day in Talk, or add one here.</div>`}`;
    const e = $('[data-e]', jb); if (e) e.replaceWith(petCanvas({ eyes: 'closed' }, 2));
    $('[data-add]', jb).onclick = () => editMemory(null, page);
    $$('[data-ed]', jb).forEach(b => b.onclick = () => editMemory(b.dataset.ed, page));
    $$('[data-tog]', jb).forEach(b => b.onclick = () => { const m = S.memories.find(x => x.id === b.dataset.tog); m.on = m.on === false; persist(); renderJournal(page); });
    $$('[data-del]', jb).forEach(b => b.onclick = async () => { if (await confirmBox('Forget this memory?', 'It will be deleted from this device and never used again.', 'Forget', true)) { S.memories = S.memories.filter(x => x.id !== b.dataset.del); persist(); renderJournal(page); toast('Forgotten.'); } });
  } else {
    jb.innerHTML = `<div class="card"><div class="stickers">${ACH.map((a, i) => { const got = S.ach[a.id]; return `<button class="sticker ${got ? '' : 'locked'}" style="--l:${a.l};--r:${(i % 3 - 1) * 5}deg" data-ach="${a.id}" aria-label="${a.n}: ${a.d}${got ? ', earned' : ', locked'}"><span class="sk">${ic(a.ic)}</span>${a.n}</button>`; }).join('')}</div></div>`;
    $$('[data-ach]', jb).forEach(b => b.onclick = () => { const a = ACH.find(x => x.id === b.dataset.ach); sfx('tap'); toast(`${a.n} — ${a.d}${S.ach[a.id] ? ' ✓' : ''}`, a.ic); });
  }
}
function editMemory(id, page) {
  const m = id ? S.memories.find(x => x.id === id) : null;
  const sh = sheet(sheetHead(m ? 'Edit memory' : 'New memory') + `<div class="sheet-b"><div class="field"><label for="mt">Something ${esc(S.pet.name)} should remember</label><textarea id="mt" class="inp" rows="3" maxlength="200" autofocus placeholder="e.g. Sam's sister walks Milo on Sundays.">${esc(m ? m.text : '')}</textarea></div><button class="btn btn-block btn-mint" data-save>Save memory</button></div>`, { label: 'Memory' });
  $('[data-save]', sh).onclick = () => { const t = $('#mt', sh).value.trim(); if (!t) return; if (m) { m.text = t; m.at = Date.now(); } else S.memories.unshift({ id: uid(), text: t, src: 'you', at: Date.now(), on: true }); persist(); checkAch(); sh.close(); sfx('good'); renderJournal(page); };
}
function openDetails(page) {
  const p = S.pet;
  const sh = sheet(sheetHead('Edit details') + `<div class="sheet-b">
    <div class="field"><label for="dn">Name</label><input id="dn" class="inp" maxlength="16" value="${esc(p.name)}"></div>
    <div class="field"><label for="da">${esc(p.name)} calls you</label><input id="da" class="inp" maxlength="20" value="${esc(p.addressAs)}"></div>
    <div class="field"><label for="dsp">Species (free text, used in chat)</label><input id="dsp" class="inp" maxlength="30" value="${esc(p.speciesLabel || (E.PRESETS[p.genome.base] ? E.PRESETS[p.genome.base].name.toLowerCase() : 'mystery creature'))}"></div>
    <div class="field"><label>Personality</label><div class="persona">${Object.entries(PERSONALITIES).map(([k, x]) => `<button data-pe="${k}" aria-pressed="${p.personality === k}"><span class="e">${x.e}</span>${x.name}</button>`).join('')}</div></div>
    <div class="field"><label for="db">Bio</label><textarea id="db" class="inp" rows="3" maxlength="300">${esc(p.bio)}</textarea></div>
    <button class="btn btn-block btn-mint" data-save>Save</button></div>`, { label: 'Edit details', height: '88%' });
  let pe = p.personality; $$('[data-pe]', sh).forEach(b => b.onclick = () => { pe = b.dataset.pe; $$('[data-pe]', sh).forEach(x => x.setAttribute('aria-pressed', x === b)); });
  $('[data-save]', sh).onclick = () => { const n = $('#dn', sh).value.trim(); if (!n) return; p.name = n; p.addressAs = $('#da', sh).value.trim(); p.speciesLabel = $('#dsp', sh).value.trim(); p.bio = $('#db', sh).value.trim(); p.personality = pe; persist(); sh.close(); sfx('good'); updateHud(); renderJournal(page); };
}
function openSettings() {
  const row = (k, t, d) => `<div class="list-row"><div class="t"><b>${t}</b><small>${d}</small></div><button class="switch" role="switch" aria-checked="${!!S.settings[k]}" data-set="${k}" aria-label="${t}"></button></div>`;
  const sh = sheet(sheetHead('Settings') + `<div class="sheet-b">
    ${row('sound', 'Sound effects', 'Cute bleeps and bloops')}${row('haptics', 'Haptics', 'Little buzzes on supported phones')}${row('rm', 'Reduce motion', 'Calmer animations, fewer particles')}${row('offerMemories', 'Memory suggestions', 'Let chats suggest things to remember (you always confirm)')}
    <div class="sec-h"><h2>Your data</h2></div>
    <p style="font-size:13px;color:var(--ink2);margin:0 2px 10px;line-height:1.4">Everything is saved on this device only. Make a backup to move ${esc(S.pet.name)} to another phone.</p>
    <div class="btnrow" style="margin-top:0"><button class="btn btn-sm btn-sky" data-exp>Export backup</button><button class="btn btn-sm btn-white" data-imp>Import backup</button></div>
    <div class="sec-h"><h2>Danger zone</h2></div>
    <button class="btn btn-block btn-danger" data-del>Say goodbye to ${esc(S.pet.name)}</button>
    <p class="fineprint">PIP is a toy companion. It never dies, never gets sick and never punishes you for being away.</p></div>`, { label: 'Settings', height: '86%' });
  $$('[data-set]', sh).forEach(b => b.onclick = () => { const k = b.dataset.set; S.settings[k] = !S.settings[k]; b.setAttribute('aria-checked', S.settings[k]); if (k === 'rm') APP.classList.toggle('rm', S.settings.rm); persist(); sfx('tap'); });
  $('[data-exp]', sh).onclick = () => exportBackup();
  $('[data-imp]', sh).onclick = () => importBackup();
  $('[data-del]', sh).onclick = async () => {
    if (!(await confirmBox(`Delete ${S.pet.name}?`, `This removes ${S.pet.name}, their memories, coins and room from this device. Export a backup first if you might want them back.`, 'Delete forever', true))) return;
    const nm = S.pet.name; try { localStorage.removeItem(KEY); } catch (e) { } S = null; HOME && HOME.destroy(); Object.assign(OB, { path: null, genome: null, rarity: null, name: '', personality: 'playful', addressAs: '', habits: [], bio: '' }); obWelcome(); toast(`Bye-bye, ${nm}. Thanks for playing together.`);
  };
}

/* ============================== WARDROBE ============================== */
function openWardrobe() {
  let slot = 'hat';
  const sh = sheet(sheetHead('Wardrobe') + `<div class="sheet-b"><div class="ward-prev" id="wp"></div><div class="seg" role="tablist" style="margin-bottom:12px">${[['hat', 'Hats'], ['glasses', 'Glasses'], ['neck', 'Neck']].map(([k, n]) => `<button role="tab" data-slot="${k}" aria-selected="${k === slot}">${n}</button>`).join('')}</div><div class="optgrid" id="wg"></div><p class="fineprint">Get more outfits in the Shop.</p></div>`, { label: 'Wardrobe', height: '82%' });
  const prev = () => { const w = $('#wp', sh); w.innerHTML = ''; const c = petCanvas({ eyes: 'happy', mouth: 'smile' }, 3.5); c.style.cssText = 'width:224px;height:224px;margin-top:-24px'; w.appendChild(c); };
  const grid = () => {
    const g = $('#wg', sh); const list = OUTFITS.filter(o => o.slot === slot);
    g.innerHTML = `<button class="opt" data-o="" aria-pressed="${!S.wear[slot]}"><span style="height:64px;display:grid;place-items:center;font-size:28px">🚫</span>None</button>` + list.map(o => { const own = S.inv.outfits[o.id]; return `<button class="opt" data-o="${o.id}" aria-pressed="${S.wear[slot] === o.key}" ${own ? '' : 'aria-disabled="true"'} style="${own ? '' : 'opacity:.5'}">${own ? '' : '<span class="lock">🔒</span>'}<img src="${outfitURL(o)}" alt="" style="width:56px;height:56px;margin:4px 0">${o.name}</button>`; }).join('');
    $$('[data-o]', g).forEach(b => b.onclick = () => {
      const o = OUTFITS.find(x => x.id === b.dataset.o);
      if (o && !S.inv.outfits[o.id]) { toast(`${o.name} is in the Shop for ${o.price} coins`, 'bag'); sfx('bad'); return; }
      S.wear[slot] = o ? o.key : null; persist(); sfx('pop'); if (o) { stat('dress'); } prev(); grid(); updateHud(); const [x, y] = elCenter($('#wp', sh)); burst(x, y, 'sparkle', 6, { sc: 3 });
      HOME && HOME.face({ eyes: 'happy', mouth: 'open' }, 1.4);
    });
  };
  $$('[data-slot]', sh).forEach(b => b.onclick = () => { slot = b.dataset.slot; sfx('tap'); $$('[data-slot]', sh).forEach(x => x.setAttribute('aria-selected', x === b)); grid(); });
  prev(); grid();
}

/* ============================== TRICK TRAINER ============================== */
function openTrainer(trickId) {
  const avail = TRICKS.filter(t => S.level >= t.lvl); let cur = trickId && avail.find(t => t.id === trickId) ? trickId : avail[0].id;
  let round = 0, results = [], pos = 0, dir = 1, raf = 0, running = false, speed = 0, zone = null;
  const sh = sheet(sheetHead('Trick school') + `<div class="sheet-b"><div class="ed-tabs" role="tablist">${avail.map(t => `<button role="tab" data-t="${t.id}" aria-selected="${t.id === cur}">${t.e} ${t.n}</button>`).join('')}</div>
    <div class="train-pet" id="tp"></div><div class="big-res" id="tr" aria-live="polite"></div>
    <div class="timing" aria-hidden="true"><div class="zone" id="tz"></div><div class="zone perfect" id="tzp"></div><div class="mk" id="tm"></div></div>
    <div class="round-dots" id="rd">${[0, 1, 2].map(() => '<i></i>').join('')}</div>
    <p class="fineprint" id="th" style="margin-top:10px">Press <b>Command!</b> (or Space) when the marker is in the green zone. Hit gold for a perfect!</p>
    <button class="btn btn-lg btn-block btn-grape" data-cmd style="margin-top:12px">Command!</button></div>`, { label: 'Trick school', height: '86%', onClose: () => cancelAnimationFrame(raf) });
  const tm = $('#tm', sh), tz = $('#tz', sh), tzp = $('#tzp', sh), res = $('#tr', sh);
  const petFace = (st) => { const w = $('#tp', sh); w.innerHTML = ''; const c = petCanvas(st || {}, 3); c.style.cssText = 'width:192px;height:192px'; w.appendChild(c); return c; };
  function setup() {
    const m = S.tricks[cur].m; const width = 26 - Math.min(10, m / 10); const start = rand(15, 85 - width);
    zone = [start, start + width]; tz.style.left = start + '%'; tz.style.width = width + '%'; tzp.style.left = (start + width * .35) + '%'; tzp.style.width = (width * .3) + '%';
    speed = 70 + round * 18 + Math.min(40, m / 3); pos = 0; dir = 1; running = true; petFace({ eyes: 'wide' }); res.textContent = `${TRICKS.find(t => t.id === cur).n}: round ${round + 1}/3`;
    let last = performance.now(); cancelAnimationFrame(raf);
    const step = now => { const dt = (now - last) / 1000; last = now; pos += dir * speed * dt; if (pos > 100) { pos = 100; dir = -1; } if (pos < 0) { pos = 0; dir = 1; } tm.style.left = pos + '%'; if (running) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
  }
  function hit() {
    if (!running) return; running = false; cancelAnimationFrame(raf);
    const mid = (zone[0] + zone[1]) / 2, w = zone[1] - zone[0]; const perfect = Math.abs(pos - mid) < w * .15, ok = pos >= zone[0] && pos <= zone[1];
    results.push(ok); $$('#rd i', sh)[round].className = ok ? 'ok' : 'no';
    const tr = S.tricks[cur];
    if (ok) { tr.m = Math.min(100, tr.m + (perfect ? 16 : 10)); res.textContent = perfect ? 'PERFECT!' : 'Good job!'; res.style.color = perfect ? '#e09a12' : '#1fa36c'; sfx(perfect ? 'levelup' : 'good'); const c = petFace({ eyes: perfect ? 'star' : 'happy', mouth: 'open', arm: cur === 'high5' || cur === 'wave' ? 'raise' : null }); c.animate(cur === 'spin' ? [{ transform: 'scaleX(1)' }, { transform: 'scaleX(-1)' }, { transform: 'scaleX(1)' }] : cur === 'jump' ? [{ transform: 'none' }, { transform: 'translateY(-40px)' }, { transform: 'none' }] : [{ transform: 'scale(1)' }, { transform: 'scale(1.1,.9)' }, { transform: 'scale(1)' }], { duration: 500 }); const [x, y] = elCenter(c); burst(x, y - 40, 'star', perfect ? 8 : 4, { sc: 3 }); }
    else { tr.m = Math.min(100, tr.m + 3); res.textContent = 'Almost! Treat anyway 🍪'; res.style.color = 'var(--ink2)'; sfx('boing'); petFace({ eyes: 'dizzy', mouth: 'smile' }); }
    persist(); round++;
    if (round < 3) setTimeout(setup, 900);
    else setTimeout(finish, 900);
  }
  function finish() {
    const good = results.filter(Boolean).length; const tr = S.tricks[cur]; const def = TRICKS.find(t => t.id === cur);
    stat('practice'); addXP(6 + good * 4); const coins = good * 3; if (coins) addCoins(coins);
    const learned = tr.m >= 100 && !tr.learned; if (learned) { tr.learned = true; persist(); }
    res.textContent = learned ? `${S.pet.name} learned ${def.n}! 🎉` : `${good}/3 — ${Math.round(tr.m)}% learned`;
    if (learned) { confetti(null, null, 80); sfx('levelup'); checkAch(); }
    $('[data-cmd]', sh).textContent = 'Practice again';
    renderTabsProg();
  }
  function renderTabsProg() { const p = $('#page'); if (p && !p.hidden && TAB === 'play') renderPlay(p); }
  function restart() { round = 0; results = []; $$('#rd i', sh).forEach(i => i.className = ''); $('[data-cmd]', sh).textContent = 'Command!'; setup(); }
  $('[data-cmd]', sh).onclick = () => { if (running) hit(); else if (round >= 3) restart(); };
  sh.addEventListener('keydown', e => { if (e.code === 'Space' && e.target.tagName !== 'BUTTON') { e.preventDefault(); $('[data-cmd]', sh).click(); } });
  $$('[data-t]', sh).forEach(b => b.onclick = () => { cur = b.dataset.t; $$('[data-t]', sh).forEach(x => x.setAttribute('aria-selected', x === b)); sfx('tap'); restart(); });
  setTimeout(() => { $('[data-cmd]', sh).focus({ preventScroll: true }); setup(); }, 300);
}

/* ============================== TALK ============================== */
let talkBusy = false, aiCtl = null;
function openTalk(prefill) {
  const p = S.pet;
  const aiState = HEALTH.ai === true ? '<span class="ai-chip on">● AI replies</span>' : HEALTH.ai === false ? '<span class="ai-chip off">● Simple replies · AI not set up</span>' : '';
  const sh = sheet(`<div class="sheet-h"><div class="chat-pet" style="flex:1"><span class="av" id="cav"></span><div><h2 style="font-size:21px">${esc(p.name)}</h2>${aiState}</div></div><button class="iconbtn" data-mem aria-label="Memories">${ic('note')}</button><button class="x" data-close aria-label="Close">${SVG.x}</button></div>
    <div class="sheet-b" id="chatb"><div class="chat" id="msgs"></div><div id="propbox"></div></div>
    <div class="sheet-f"><div class="qp-row">${['How was your day?', 'Want to play?', 'I missed you!', 'Tell me a secret'].map(q => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <div id="voicebox"></div>
    <div class="composer"><label class="sr-only" for="say">Message to ${esc(p.name)}</label><textarea id="say" class="inp" rows="1" maxlength="500" placeholder="Say something…">${esc(prefill || '')}</textarea><button class="iconbtn" data-mic aria-label="Speak instead">${SVG.mic}</button><button class="btn btn-sky" data-send aria-label="Send" style="min-width:52px;padding:0 14px;min-height:48px"><svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:#fff;fill:none;stroke-width:2.6;stroke-linejoin:round" aria-hidden="true"><path d="M4 12l16-8-6 16-3-7z"/></svg></button></div></div>`, { label: 'Talk', height: '90%', onClose: () => { if (aiCtl) aiCtl.abort(); } });
  $('#cav', sh).appendChild(petHead(52, { eyes: 'happy' }));
  paintMsgs(sh);
  const ta = $('#say', sh);
  ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('[data-send]', sh).click(); } };
  $('[data-send]', sh).onclick = () => { const t = ta.value.trim(); if (!t || talkBusy) return; ta.value = ''; send(sh, t); };
  $$('[data-q]', sh).forEach(b => b.onclick = () => { if (talkBusy) return; send(sh, b.dataset.q); });
  $('[data-mem]', sh).onclick = () => { sh.close(); JTAB = 'memories'; switchTab('pet'); };
  $('[data-mic]', sh).onclick = () => voice(sh);
  setTimeout(() => ta.focus({ preventScroll: true }), 350);
}
function paintMsgs(sh) {
  const box = $('#msgs', sh); if (!box) return; const p = S.pet;
  const msgs = S.convo.slice(-30);
  box.innerHTML = msgs.length ? msgs.map(m => `<div class="msg ${m.role} ${m.failed ? 'failed' : ''}">${esc(m.text)}${m.role === 'pet' ? `<span class="meta">${m.simple ? '<span class="lab simple">Simple response · not AI</span>' : '<span class="lab ai">AI reply</span>'}${m.refs && m.refs.length ? `<span>used ${m.refs.length} memor${m.refs.length > 1 ? 'ies' : 'y'}</span>` : ''}</span>` : m.failed ? '<span class="meta">Not delivered</span>' : ''}</div>`).join('')
    : `<div class="empty"><b>Say hi to ${esc(p.name)}!</b><br>${esc(p.name)} only knows what you tell them${p.mode === 'real' ? ' — and is a fictional companion, not your real pet' : ''}.</div>`;
  if (talkBusy) box.insertAdjacentHTML('beforeend', `<div class="msg pet"><span class="typing" aria-label="${esc(p.name)} is typing"><i></i><i></i><i></i></span></div>`);
  const b = $('#chatb', sh); b.scrollTop = b.scrollHeight;
}
function pickMemories(text) {
  const words = new Set(text.toLowerCase().split(/\W+/).filter(w => w.length > 2));
  return S.memories.filter(m => m.on !== false).map(m => ({ m, s: m.text.toLowerCase().split(/\W+/).filter(w => words.has(w)).length + m.at / 1e14 })).sort((a, b) => b.s - a.s).slice(0, 5).map(x => ({ id: x.m.id, text: x.m.text }));
}
async function send(sh, text) {
  const p = S.pet; S.convo.push({ role: 'user', text, at: Date.now() }); talkBusy = true; paintMsgs(sh); stat('talks');
  HOME && HOME.face({ eyes: 'wide' }, 1.5);
  const turns = S.convo.filter(m => !m.failed).slice(-8).map(m => ({ role: m.role, text: m.text }));
  const species = p.speciesLabel || (E.PRESETS[p.genome.base] ? E.PRESETS[p.genome.base].name.toLowerCase() : 'mystery creature');
  const body = { task: 'pet-respond', pet: { name: p.name, species, personality: PERSONALITIES[p.personality].name, mode: p.mode, addressAs: p.addressAs, bio: [p.bio, p.habits.length ? 'Habits: ' + p.habits.join(', ') : ''].filter(Boolean).join(' · ') }, turns, memories: pickMemories(text), event: 'conversation' };
  aiCtl = new AbortController(); const to = setTimeout(() => aiCtl && aiCtl.abort(), 20000);
  let reply = null;
  try {
    const r = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: aiCtl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'fail'); e.code = j.code; e.status = r.status; throw e; }
    HEALTH.ai = true;
    reply = { role: 'pet', text: j.reply_text, refs: j.referenced_memory_ids || [], at: Date.now(), anim: j.animation_key, prop: j.memory_proposal };
  } catch (e) {
    if (e.code === 'NO_MODEL') HEALTH.ai = false;
    const why = e.code === 'NO_MODEL' ? null : e.name === 'AbortError' ? 'The AI took too long, so here\'s a simple reply.' : e.status === 429 ? 'Lots of messages! Here\'s a simple reply.' : 'Couldn\'t reach the AI, so here\'s a simple reply.';
    if (why) toast(why);
    reply = { role: 'pet', text: simpleReply(text), simple: true, at: Date.now(), prop: simpleProposal(text) };
  } finally { clearTimeout(to); aiCtl = null; }
  await sleep(reply.simple ? 650 : 0);
  talkBusy = false; S.convo.push({ role: reply.role, text: reply.text, simple: reply.simple, refs: reply.refs, at: reply.at }); S.convo = S.convo.slice(-80); persist();
  if (!sh.isConnected) return;
  paintMsgs(sh); sfx('pop');
  if (HOME) { const a = reply.anim; HOME.face(a === 'rest' ? { eyes: 'closed' } : a === 'play' ? { eyes: 'happy', mouth: 'open', arm: 'raise' } : { eyes: 'happy', mouth: 'smile' }, 2); if (a === 'play' || a === 'react') HOME.hop(200); }
  if (reply.prop && reply.prop.text && S.settings.offerMemories) showProposal(sh, reply.prop.text);
}
function simpleReply(t) {
  const n = S.pet.name, l = t.toLowerCase(), a = S.pet.addressAs || 'friend';
  if (/sick|vet|ill|hurt|health|not eating|vomit|limp/.test(l)) return `I can't tell how a real animal is feeling. If you're worried, check with whoever is caring for them, or a vet. I'm here with you though.`;
  if (/miss|far|away|lonely|sad/.test(l)) return `*scoots closer* I'm right here whenever you open the app, ${a}. Want a cuddle or a game?`;
  if (/^(hi|hello|hey|yo)\b/.test(l)) return `Hi ${a}! *tail wiggle* I'm so happy you're here!`;
  if (/play|game|ball|fetch/.test(l)) return `YES! Tap Play and throw the ball — I'll bring it right back!`;
  if (/hungry|food|eat|snack|treat/.test(l)) return `Did someone say snack? *sniff sniff* Tap Feed and drag one over!`;
  if (/day|work|tired/.test(l)) return `Tell me more! I'll listen with both ears. *head tilt*`;
  if (/secret/.test(l)) return `Okay… sometimes I pretend the dust bunnies are my friends. Don't tell!`;
  if (/love|best/.test(l)) return `Aww! *happy spin* You're my favorite person, ${a}!`;
  if (/\?$/.test(l)) return `Hmm! *thinks very hard* I'm not sure, but I love that you asked me.`;
  return choice([`${n} tilts their head and listens closely.`, `*wiggle wiggle* Tell me more!`, `Mm-hm! *nods enthusiastically*`]);
}
function simpleProposal(t) {
  const m = t.match(/\bmy ([a-z]+(?: [a-z]+)?) (?:is|are|was|loves|likes|walks|lives) (.{3,80})/i) || t.match(/\bi (?:love|like|work|live|have) (.{3,80})/i);
  if (!m) return null; const who = S.pet.addressAs || 'You';
  return { text: (who + ' said: "' + t.trim().replace(/\s+/g, ' ').slice(0, 140) + '"') };
}
function showProposal(sh, text) {
  const box = $('#propbox', sh); if (!box) return;
  box.innerHTML = `<div class="proposal"><div class="lbl">Remember this?</div><label class="sr-only" for="ptext">Memory text</label><textarea id="ptext" class="inp" rows="2" maxlength="200">${esc(text)}</textarea><div class="btnrow"><button class="btn btn-sm btn-mint" data-yes>Save memory</button><button class="btn btn-sm btn-white" data-no>Not now</button></div><p style="font-size:11.5px;color:#8a5a00;margin-top:8px;font-weight:800">Nothing is saved unless you tap Save. Edit or forget it anytime in Journal → Memories.</p></div>`;
  $('[data-yes]', box).onclick = () => { const t = $('#ptext', box).value.trim(); if (!t) return; S.memories.unshift({ id: uid(), text: t, src: 'chat', at: Date.now(), on: true }); persist(); checkAch(); box.innerHTML = '<p class="fineprint" role="status">Saved to Memories 📒</p>'; sfx('good'); };
  $('[data-no]', box).onclick = () => { box.innerHTML = ''; };
  const b = $('#chatb', sh); b.scrollTop = b.scrollHeight;
}
function voice(sh) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; const vb = $('#voicebox', sh);
  if (!SR) { toast('Voice input isn\'t supported in this browser.'); return; }
  const r = new SR(); r.lang = 'en-US'; r.interimResults = true; r.maxAlternatives = 1; let txt = '';
  vb.innerHTML = `<div class="listening"><div class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><b id="vt" aria-live="polite">Listening…</b><button class="btn btn-sm btn-white" data-stop>Stop</button></div>`;
  $('[data-stop]', vb).onclick = () => r.stop();
  r.onresult = e => { txt = Array.from(e.results).map(x => x[0].transcript).join(' '); const v = $('#vt', vb); if (v) v.textContent = txt; };
  r.onerror = e => { vb.innerHTML = ''; toast(e.error === 'not-allowed' ? 'Microphone permission was denied.' : 'Didn\'t catch that — try again?'); };
  r.onend = () => { if (!txt) { vb.innerHTML = ''; return; } vb.innerHTML = `<div class="proposal" style="margin-bottom:10px"><div class="lbl">Send this?</div><label class="sr-only" for="vtx">Transcript</label><textarea id="vtx" class="inp" rows="2">${esc(txt)}</textarea><div class="btnrow"><button class="btn btn-sm btn-sky" data-vs>Send</button><button class="btn btn-sm btn-white" data-vx>Discard</button></div></div>`; $('[data-vs]', vb).onclick = () => { const t = $('#vtx', vb).value.trim(); vb.innerHTML = ''; if (t) send(sh, t); }; $('[data-vx]', vb).onclick = () => vb.innerHTML = ''; };
  try { r.start(); } catch (e) { vb.innerHTML = ''; }
}

/* ============================== PHOTO MODE ============================== */
function openPhoto() {
  const frames = [['sunny', 'Sunny', ['#ffd3e2', '#ffe9d2']], ['sky', 'Sky', ['#bfe6ff', '#e8f7ff']], ['night', 'Night', ['#2d2a6b', '#5a4aa0']], ['mint', 'Mint', ['#c9f2df', '#f0fff7']]];
  const poses = [['happy', 'Happy', { eyes: 'happy', mouth: 'open' }], ['love', 'Love', { eyes: 'heart', mouth: 'smile' }], ['wave', 'Wave', { eyes: 'happy', mouth: 'open', arm: 'raise' }], ['cool', 'Calm', {}], ['star', 'Starry', { eyes: 'star', mouth: 'open', arm: 'both' }]];
  let fr = 0, po = 0;
  const sh = sheet(sheetHead('Photo booth') + `<div class="sheet-b"><div class="photo-prev" id="pp"></div><div class="lbl">Background</div><div class="optrow" style="margin-bottom:10px">${frames.map((f, i) => `<button class="chip" data-fr="${i}" aria-pressed="${i === fr}"><i style="width:14px;height:14px;border-radius:5px;background:linear-gradient(${f[2][0]},${f[2][1]})"></i>${f[1]}</button>`).join('')}</div><div class="lbl">Pose</div><div class="optrow" style="margin-bottom:14px">${poses.map((p, i) => `<button class="chip" data-po="${i}" aria-pressed="${i === po}">${p[1]}</button>`).join('')}</div><button class="btn btn-block btn-pink" data-dl style="--c:var(--pink);--d:var(--pink-d)">Save PNG card</button></div>`, { label: 'Photo booth', height: '90%' });
  let card = null;
  const draw = () => {
    const W = 360, H = 480, c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2; const x = c.getContext('2d'); x.scale(2, 2); x.imageSmoothingEnabled = false;
    const f = frames[fr][2]; const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, f[0]); g.addColorStop(1, f[1]); x.fillStyle = g; x.fillRect(0, 0, W, H);
    // pixel confetti border
    const r = E.rng(S.created % 1000 + fr * 7); for (let i = 0; i < 70; i++) { x.fillStyle = choice(CONF_COLS); const px = Math.floor(r() * W / 6) * 6, py = Math.floor(r() * H / 6) * 6; if (px > 30 && px < W - 36 && py > 30 && py < H - 120) continue; x.fillRect(px, py, 6, 6); }
    x.fillStyle = 'rgba(58,30,80,.15)'; x.beginPath(); x.ellipse(W / 2, 318, 92, 14, 0, 0, 7); x.fill();
    const spr = E.renderPet(S.pet.genome, Object.assign({ stage: stageFor(S.level), outfit: S.wear }, poses[po][2]), 1); x.drawImage(spr, W / 2 - 160, 0, 320, 320);
    x.fillStyle = '#fff'; const rr = (X, Y, w, h, rad) => { x.beginPath(); x.moveTo(X + rad, Y); x.arcTo(X + w, Y, X + w, Y + h, rad); x.arcTo(X + w, Y + h, X, Y + h, rad); x.arcTo(X, Y + h, X, Y, rad); x.arcTo(X, Y, X + w, Y, rad); x.fill(); };
    rr(20, 344, W - 40, 116, 22);
    x.fillStyle = '#3a2a5a'; x.font = '700 30px Fredoka, "Baloo 2", ui-rounded, Nunito, Inter, sans-serif'; x.textAlign = 'center'; x.fillText(S.pet.name, W / 2, 384);
    const sp = E.PRESETS[S.pet.genome.base]; x.font = '800 14px Nunito, Inter, sans-serif'; x.fillStyle = '#6b5a8a';
    x.fillText(`Lv ${S.level} · ${PERSONALITIES[S.pet.personality].name} ${(S.pet.speciesLabel || (sp ? sp.name : 'Mystery mix')).toLowerCase()} · ${S.pet.rarity}`, W / 2, 408);
    x.fillText(`${S.stats.pets} cuddles · ${Object.values(S.tricks).filter(t => t.m >= 100).length} tricks · ${Math.max(1, Math.ceil((Date.now() - S.pet.born) / 864e5))} days together`, W / 2, 430);
    x.font = '900 11px Nunito, Inter, sans-serif'; x.fillStyle = '#9a8cb4'; x.fillText('made with PIP · pixel pet', W / 2, 450);
    card = c; const pp = $('#pp', sh); pp.innerHTML = ''; c.style.cssText = 'width:100%;max-width:280px;border-radius:20px;box-shadow:0 8px 24px -10px rgba(58,42,90,.5)'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'Photo card of ' + S.pet.name); pp.appendChild(c);
  };
  $$('[data-fr]', sh).forEach(b => b.onclick = () => { fr = +b.dataset.fr; $$('[data-fr]', sh).forEach(x => x.setAttribute('aria-pressed', x === b)); sfx('tap'); draw(); });
  $$('[data-po]', sh).forEach(b => b.onclick = () => { po = +b.dataset.po; $$('[data-po]', sh).forEach(x => x.setAttribute('aria-pressed', x === b)); sfx('tap'); draw(); });
  $('[data-dl]', sh).onclick = () => { card.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = S.pet.name.toLowerCase().replace(/\W+/g, '-') + '-pip.png'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400); }); sfx('sparkle'); const fl = document.createElement('div'); fl.style.cssText = 'position:absolute;inset:0;background:#fff;z-index:400;pointer-events:none'; APP.appendChild(fl); fl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400 }).onfinish = () => fl.remove(); toast('Photo saved!', 'camera'); };
  draw();
}

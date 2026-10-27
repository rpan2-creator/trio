/* TABLE app shell: home, host wizard, recommendations, player setup, rules intro,
   game host + in-game menu, results, library, settings. Games register in games/*.js. */
(function () {
  'use strict';
  const T = window.Table, esc = T.esc, icon = T.icon;
  const app = T.app();
  T.Cards.sprite();

  /* ---------- persistent state ---------- */
  const defaultRoster = () => [
    { id: T.uid(), name: 'You', emoji: '🦊', color: T.COLORS[0], bot: false, on: true },
    { id: T.uid(), name: 'Sam', emoji: '🐻', color: T.COLORS[1], bot: false, on: true },
    { id: T.uid(), name: 'Jordan', emoji: '🐸', color: T.COLORS[3], bot: false, on: true },
    { id: T.uid(), name: 'Casey', emoji: '🦄', color: T.COLORS[4], bot: false, on: true },
  ];
  let roster = T.store.get('roster', null) || defaultRoster();
  let host = Object.assign({ players: 4, vibes: ['chill'], minutes: 30, setting: 'home' }, T.store.get('host', {}));
  const saveRoster = () => T.store.set('roster', roster);
  const saveHost = () => T.store.set('host', host);
  const stats = T.store.get('stats', { played: 0, byGame: {} });

  let view = null, game = null, live = null, wizStep = 0, lastRecs = null, aiNote = '';
  const games = () => T.order.map(id => T.games[id]);

  /* ---------- rendering ---------- */
  function setScreen(html, cls, tone) {
    if (live && live.destroy) { try { live.destroy(); } catch (e) { console.warn(e); } live = null; }
    T.hush();
    app.querySelectorAll('.overlay,.passer,.callout,.toast,.flyer').forEach(n => n.remove());
    app.innerHTML = `<div class="scr ${cls || ''}" data-view="${view}">${html}</div>`;
    if (window.Frame) window.Frame.tone(tone || 'light');
    const s = app.querySelector('.scr'); s.scrollTop = 0;
    const h = s.querySelector('h1, h2, [data-autofocus]');
    if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { /* noop */ } }
    return s;
  }
  const go = (v, arg) => { T.sfx('tap'); view = v; ROUTES[v](arg); };
  T.go = go;

  const topbar = (title, back, right) => `<header class="topbar">
    ${back ? `<button type="button" class="icon-btn" data-nav="${back}" aria-label="Back">${icon('back')}</button>` : '<span class="icon-btn ghost"></span>'}
    <div class="topbar-t">${title}</div>${right || '<span class="icon-btn ghost"></span>'}</header>`;
  const tabbar = active => `<nav class="tabbar" aria-label="Main">
    ${[['home', 'home', 'Home'], ['library', 'grid', 'Games'], ['settings', 'gear', 'Settings']].map(([v, ic, l]) =>
      `<button type="button" data-nav="${v}" class="${active === v ? 'on' : ''}" ${active === v ? 'aria-current="page"' : ''}>${icon(ic, 24)}<span>${l}</span></button>`).join('')}</nav>`;

  const badges = g => `<span class="badge">${icon('users', 14)} ${g.players[0]}–${g.players[1]}</span>
    <span class="badge">${icon('clock', 14)} ${g.minutes[0]}–${g.minutes[1]} min</span>
    <span class="badge diff d${g.difficulty}">${['', 'Easy', 'Medium', 'Tricky'][g.difficulty]}</span>`;

  const box = (g, size) => `<div class="gbox ${size || ''}" style="--g1:${g.colors[0]};--g2:${g.colors[1]};--g3:${g.colors[2]}">
      <div class="gbox-art">${g.box()}</div>
      <div class="gbox-lid"><span class="gbox-kicker">${esc(g.kicker)}</span><span class="gbox-name">${esc(g.name)}</span></div>
      <i class="gbox-shine"></i></div>`;

  /* ---------- HOME ---------- */
  function home() {
    const crew = roster.filter(p => p.on);
    const s = setScreen(`
      <div class="home-bg" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="scroll pad-tab">
        <header class="home-top">
          <div class="logo" aria-label="TABLE"><span>T</span><span>A</span><span>B</span><span>L</span><span>E</span></div>
          <button type="button" class="icon-btn" data-nav="settings" aria-label="Settings">${icon('gear')}</button>
        </header>
        <section class="hero">
          <div class="hero-art" aria-hidden="true">${heroArt()}</div>
          <h1 class="display hero-h">Game night,<br><em>sorted.</em></h1>
          <p class="hero-p">Tell us who's here and the vibe. We'll pick the game, deal the cards and keep score — all on this one phone.</p>
          <button type="button" class="btn primary xl wide pulse" data-nav="wizard">${icon('sparkle')} Start a game night</button>
        </section>
        <section class="shelf">
          <div class="sec-h"><h2>Quick play</h2><button type="button" class="link" data-nav="library">See all</button></div>
          <div class="shelf-row" role="list">
            ${games().map(g => `<button type="button" class="shelf-item" role="listitem" data-play="${g.id}" aria-label="Play ${esc(g.name)}: ${esc(g.tagline)}">
              ${box(g)}<span class="shelf-meta">${icon('users', 13)} ${g.players[0]}–${g.players[1]} · ${g.minutes[0]}–${g.minutes[1]}m</span></button>`).join('')}
          </div>
        </section>
        <section class="crew card-panel">
          <div class="sec-h"><h2>Tonight's crew</h2><button type="button" class="link" data-edit-crew>Edit</button></div>
          <div class="crew-row">${crew.map(p => `<div class="crew-p">${T.avatar(p, 46)}<span>${esc(p.name)}</span></div>`).join('')}
            <button type="button" class="crew-add" data-edit-crew aria-label="Add players">${icon('plus', 22)}</button></div>
        </section>
        ${stats.played ? `<p class="fineprint">${stats.played} game${stats.played > 1 ? 's' : ''} played on this phone. No sign-up, nothing leaves the device.</p>` : '<p class="fineprint">No sign-up. No extra phones. Nothing leaves this device.</p>'}
      </div>${tabbar('home')}`, 'home dark');
    s.querySelectorAll('[data-edit-crew]').forEach(b => b.addEventListener('click', () => { game = null; go('players'); }));
  }

  function heroArt() {
    const C = T.Cards;
    return `<div class="ha-card c1">${C.html({ r: 1, s: 's', id: 'x1' })}</div>
      <div class="ha-card c2">${C.html({ r: 13, s: 'h', id: 'x2' })}</div>
      <div class="ha-card c3">${C.html({ r: 8, s: 'd', id: 'x3' })}</div>
      <div class="ha-die d1">${T.Dice.face(5)}</div><div class="ha-die d2">${T.Dice.face(6)}</div>
      <div class="ha-chip ch1"></div><div class="ha-chip ch2"></div><div class="ha-chip ch3"></div>`;
  }

  /* ---------- HOST WIZARD ---------- */
  const VIBES = [
    ['chill', '🛋️', 'Chill', 'Easygoing, chat while you play'],
    ['competitive', '🏆', 'Competitive', 'Keep score, crown a winner'],
    ['chaotic', '🤪', 'Chaotic', 'Loud, silly, everybody yelling'],
    ['strategic', '🧠', 'Strategic', 'Bluffs, odds and big decisions'],
  ];
  const TIMES = [[15, '15 min', 'Quick round'], [30, '30 min', 'A couple of games'], [60, '1 hour', 'Proper session'], [120, 'All night', "We're not going anywhere"]];
  const SETTINGS = [['home', '🏡', 'Home table', 'Couch, kitchen, dining room'], ['bar', '🍻', 'Bar or restaurant', 'Noisy, limited table space'], ['backyard', '🌳', 'Backyard / outdoors', 'Patio, campfire, tailgate']];

  let wizShown = -1;
  function wizard(step) {
    if (typeof step === 'number') wizStep = step;
    const anim = wizShown !== wizStep; wizShown = wizStep;
    const steps = ['How many people?', "What's the vibe?", 'How much time?', 'Where are you playing?'];
    let body = '';
    if (wizStep === 0) {
      body = `<div class="stepper-big">
        <button type="button" class="round-btn" data-inc="-1" aria-label="Fewer people">${icon('minus', 30)}</button>
        <div class="big-num" aria-live="polite"><span class="display">${host.players}</span><small>${host.players === 1 ? 'person' : 'people'}</small></div>
        <button type="button" class="round-btn" data-inc="1" aria-label="More people">${icon('plus', 30)}</button></div>
        <div class="people-viz" aria-hidden="true">${Array.from({ length: host.players }, (_, i) => `<span style="--d:${i * 40}ms;--pc:${T.COLORS[i % 12]}">${T.EMOJI[i % T.EMOJI.length]}</span>`).join('')}</div>
        <p class="hint">Including you. Short on players? Our bots are always up for cards.</p>`;
    } else if (wizStep === 1) {
      body = `<p class="hint top">Pick one or more.</p><div class="choice-grid">${VIBES.map(([k, e, l, d]) =>
        `<button type="button" class="choice ${host.vibes.includes(k) ? 'on' : ''}" data-vibe="${k}" aria-pressed="${host.vibes.includes(k)}"><span class="ch-e">${e}</span><b>${l}</b><small>${d}</small><i class="tick">${icon('check', 16)}</i></button>`).join('')}</div>`;
    } else if (wizStep === 2) {
      body = `<div class="choice-list">${TIMES.map(([m, l, d]) =>
        `<button type="button" class="choice row ${host.minutes === m ? 'on' : ''}" data-min="${m}" aria-pressed="${host.minutes === m}"><span class="ch-e">${icon('clock', 26)}</span><span><b>${l}</b><small>${d}</small></span><i class="tick">${icon('check', 16)}</i></button>`).join('')}</div>`;
    } else {
      body = `<div class="choice-list">${SETTINGS.map(([k, e, l, d]) =>
        `<button type="button" class="choice row ${host.setting === k ? 'on' : ''}" data-set="${k}" aria-pressed="${host.setting === k}"><span class="ch-e">${e}</span><span><b>${l}</b><small>${d}</small></span><i class="tick">${icon('check', 16)}</i></button>`).join('')}</div>`;
    }
    const s = setScreen(`
      <div class="wiz-bg" aria-hidden="true"></div>
      ${topbar(`<div class="dots" aria-label="Step ${wizStep + 1} of 4">${steps.map((_, i) => `<i class="${i <= wizStep ? 'on' : ''}"></i>`).join('')}</div>`, wizStep ? '' : 'home',
        '<button type="button" class="icon-btn" data-nav="home" aria-label="Close">' + icon('close') + '</button>')}
      <div class="scroll wiz">
        <p class="eyebrow">Step ${wizStep + 1} of 4</p>
        <h1 class="display wiz-h">${steps[wizStep]}</h1>
        <div class="wiz-body ${anim ? 'slide-in' : ''}">${body}</div>
      </div>
      <footer class="footbar">
        ${wizStep ? '<button type="button" class="btn ghost" data-wback>Back</button>' : ''}
        <button type="button" class="btn primary grow" data-wnext>${wizStep === 3 ? icon('sparkle') + ' Find our game' : 'Next'}</button>
      </footer>`, 'wizard dark');
    if (wizStep > 0) { const b = s.querySelector('.topbar .icon-btn.ghost'); if (b) b.outerHTML = `<button type="button" class="icon-btn" data-wback aria-label="Back">${icon('back')}</button>`; }
    s.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.inc) { host.players = Math.max(2, Math.min(12, host.players + +t.dataset.inc)); T.sfx('pop'); T.haptic(); saveHost(); wizard(); }
      else if (t.dataset.vibe) { const k = t.dataset.vibe; host.vibes = host.vibes.includes(k) ? host.vibes.filter(v => v !== k) : host.vibes.concat(k); if (!host.vibes.length) host.vibes = [k]; T.sfx('pop'); saveHost(); wizard(); }
      else if (t.dataset.min) { host.minutes = +t.dataset.min; T.sfx('pop'); saveHost(); wizard(); }
      else if (t.dataset.set) { host.setting = t.dataset.set; T.sfx('pop'); saveHost(); wizard(); }
      else if ('wnext' in t.dataset) { if (wizStep < 3) { T.sfx('tap'); wizard(wizStep + 1); } else { syncRosterCount(); go('recs'); } }
      else if ('wback' in t.dataset) { T.sfx('tap'); wizard(Math.max(0, wizStep - 1)); }
      else return;
      // keep keyboard focus on the same control after a re-render
      const key = ['inc', 'vibe', 'min', 'set'].find(k => t.dataset[k] != null);
      if (key) { const again = app.querySelector(`[data-${key}="${t.dataset[key]}"]`); if (again) again.focus(); }
    });
  }
  /* make the saved crew match the head-count from the wizard */
  function syncRosterCount() {
    let humans = roster.filter(p => !p.bot);
    humans.forEach((p, i) => { p.on = i < host.players; });
    roster.filter(p => p.bot).forEach(p => { p.on = false; });
    let n = humans.length;
    while (n < host.players) { roster.push(newPlayer(false)); n++; }
    saveRoster();
  }
  function newPlayer(bot) {
    const used = roster.map(p => p.color), usedE = roster.map(p => p.emoji), usedN = roster.map(p => p.name);
    const color = T.COLORS.find(c => !used.includes(c)) || T.pick(T.COLORS);
    const emoji = bot ? T.pick(['🤖', '👾', '🦾', '🎰', '🛸']) : (T.EMOJI.find(e => !usedE.includes(e)) || T.pick(T.EMOJI));
    let name;
    if (bot) name = T.BOT_NAMES.find(n => !usedN.includes(n)) || 'Bot ' + (roster.length + 1);
    else { let i = roster.filter(p => !p.bot).length + 1; name = 'Player ' + i; while (usedN.includes(name)) name = 'Player ' + (++i); }
    return { id: T.uid(), name, emoji, color, bot, on: true };
  }

  /* ---------- RECOMMENDATIONS ---------- */
  function score(g) {
    const n = host.players, reasons = [];
    let fit = 0, ok = true, note = '';
    if (n >= g.players[0] && n <= g.players[1]) { fit = 1; reasons.push(`Seats all ${n} of you`); }
    else if (n < g.players[0] && g.bots) { fit = 0.75; reasons.push(`Add ${g.players[0] - n} bot${g.players[0] - n > 1 ? 's' : ''} to make ${g.players[0]}`); }
    else if (n > g.players[1] && g.rotate) { fit = 0.6; reasons.push(`${g.players[1]} play at a time, rest rotate in`); note = 'rotate'; }
    else { ok = false; note = n < g.players[0] ? `Needs ${g.players[0]}+ people` : `Max ${g.players[1]} players`; }
    const v = host.vibes.reduce((a, k) => a + (g.vibes[k] || 0), 0) / host.vibes.length;
    const bestVibe = host.vibes.slice().sort((a, b) => (g.vibes[b] || 0) - (g.vibes[a] || 0))[0];
    if ((g.vibes[bestVibe] || 0) >= 0.7) reasons.push(g.vibeWhy[bestVibe]);
    const round = g.minutes[1];
    const t = round <= host.minutes ? 1 : g.minutes[0] <= host.minutes ? 0.6 : 0.2;
    if (t === 1) reasons.push(host.minutes >= 60 && round <= 20 ? `Quick rounds — play it ${Math.floor(host.minutes / round)}+ times` : `About ${g.minutes[0]}–${round} min, fits your ${host.minutes >= 120 ? 'night' : host.minutes + ' min'}`);
    else reasons.push(`Can run ${round} min — play a short version`);
    const st = g.setting[host.setting] || 0.5;
    if (st >= 0.8) reasons.push(g.settingWhy[host.setting]);
    const pct = ok ? Math.round(100 * (0.35 * fit + 0.3 * v + 0.2 * t + 0.15 * st)) : 0;
    return { g, pct: Math.min(99, pct), ok, reasons: reasons.slice(0, 3), note };
  }

  function recs() {
    const all = games().map(score).sort((a, b) => b.pct - a.pct);
    const fits = all.filter(r => r.ok), nope = all.filter(r => !r.ok);
    lastRecs = fits;
    const vibeTxt = host.vibes.map(v => VIBES.find(x => x[0] === v)[2].toLowerCase()).join(' + ');
    const setTxt = SETTINGS.find(x => x[0] === host.setting)[2].toLowerCase();
    const s = setScreen(`
      ${topbar('Your picks', 'wizard')}
      <div class="scroll recs">
        <div class="recs-head">
          <p class="eyebrow">Matched for</p>
          <h1 class="display">${host.players} people · ${esc(vibeTxt)}</h1>
          <p class="sub">${host.minutes >= 120 ? 'All night' : host.minutes + ' minutes'} at a ${esc(setTxt)} <button type="button" class="link sm" data-nav="wizard">Change</button></p>
        </div>
        <p class="ai-note" hidden></p>
        <ol class="rec-list">
        ${fits.map((r, i) => `<li class="rec ${i === 0 ? 'top' : ''}" style="--d:${i * 90}ms" data-g="${r.g.id}">
          ${i === 0 ? '<span class="ribbon">Best match</span>' : ''}
          <div class="rec-main">
            <div class="rec-box">${box(r.g, 'sm')}</div>
            <div class="rec-info"><h3>${esc(r.g.name)}</h3><p class="rec-tag">${esc(r.g.tagline)}</p>
              <div class="badges">${badges(r.g)}</div></div>
            <div class="ring" style="--p:${r.pct}" role="img" aria-label="${r.pct} percent match"><span>${r.pct}<small>%</small></span></div>
          </div>
          <ul class="why">${r.reasons.map(x => `<li>${icon('check', 14)} ${esc(x)}</li>`).join('')}</ul>
          <button type="button" class="btn ${i === 0 ? 'primary' : 'secondary'} wide" data-play="${r.g.id}">${icon('play', 18)} Play ${esc(r.g.name)}</button>
        </li>`).join('')}
        </ol>
        ${nope.length ? `<div class="nope"><h2 class="mini-h">Not for ${host.players} tonight</h2>${nope.map(r => `<div class="nope-row">${box(r.g, 'xs')}<div><b>${esc(r.g.name)}</b><small>${esc(r.note)}</small></div></div>`).join('')}</div>` : ''}
      </div>`, 'recs-scr dark');
    askAI(fits, s);
  }

  let aiAvailable = null;
  async function askAI(fits, s) {
    if (!fits.length || T.qs.has('noai')) return;
    try {
      if (aiAvailable === null) {
        try { const h = await fetch('/api/health', { cache: 'no-store' }); aiAvailable = h.ok ? !!(await h.json()).ai : false; } catch (e) { aiAvailable = false; }
      }
      if (!aiAvailable) return;
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch('/api/ai', {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctl.signal,
        body: JSON.stringify({
          task: 'table-recommend', players: host.players, scene: host.setting, minutes: host.minutes, vibe: host.vibes.join(','), mood: host.vibes[0], familiar: 'mixed', device: 'one',
          candidates: fits.slice(0, 6).map(r => ({ game_id: r.g.id, name: r.g.name, players: r.g.players.join('-'), minutes: r.g.minutes.join('-'), noise: r.g.noise, summary: r.g.tagline })),
        }),
      });
      clearTimeout(to);
      if (!r.ok) return;
      const j = await r.json();
      if (!j || j.code === 'NO_MODEL' || !Array.isArray(j.picks) || view !== 'recs' || !s.isConnected) return;
      j.picks.forEach(p => {
        const li = s.querySelector(`.rec[data-g="${CSS.escape(p.game_id)}"] .why`);
        if (li && p.reason) li.insertAdjacentHTML('afterbegin', `<li class="ai">${icon('sparkle', 14)} ${esc(p.reason)}</li>`);
      });
      if (j.note) { const n = s.querySelector('.ai-note'); n.hidden = false; n.innerHTML = icon('sparkle', 14) + ' ' + esc(j.note); }
    } catch (e) { /* offline or no model: deterministic reasons stay */ }
  }

  /* ---------- PLAYER SETUP ---------- */
  function players(gid) {
    if (gid) game = T.games[gid];
    const g = game;
    const seated = roster.filter(p => p.on && (!g || g.bots || !p.bot));
    const min = g ? g.players[0] : 1, max = g ? g.players[1] : 12;
    const n = seated.length;
    const okCount = n >= min && n <= max && (!g || seated.filter(p => !p.bot).length >= (g.minHumans || 1));
    let msg;
    if (!g) msg = 'Save your crew — names, emoji and colors stick around for next time.';
    else if (n < min) msg = `Add ${min - n} more ${g.bots ? 'player or bot' : 'player'}${min - n > 1 ? 's' : ''} (needs ${min}–${max}).`;
    else if (n > max) msg = `Too many seats — turn off ${n - max} (max ${max}).`;
    else if (!okCount) msg = 'At least one human needs to play!';
    else msg = `${n} seated · ${g.players[0]}–${g.players[1]} can play.`;
    const s = setScreen(`
      ${topbar(g ? esc(g.name) : 'Your crew', g ? 'back' : 'home')}
      <div class="scroll setup">
        ${g ? `<div class="setup-hero" style="--g1:${g.colors[0]};--g2:${g.colors[1]}">${box(g, 'sm')}<div><p class="eyebrow">Who's playing?</p><h1 class="display">Take your seats</h1><div class="badges">${badges(g)}</div></div></div>`
        : '<div class="setup-hero plain"><div><p class="eyebrow">Players</p><h1 class="display">Tonight\'s crew</h1></div></div>'}
        <p class="seat-msg ${g && !okCount ? 'warn' : ''}" role="status">${esc(msg)}</p>
        <ul class="roster">
          ${roster.map((p, i) => {
            const disabled = g && p.bot && !g.bots;
            return `<li class="pl ${p.on && !disabled ? 'on' : ''} ${disabled ? 'nobots' : ''}" style="--pc:${p.color}" data-id="${p.id}">
              <button type="button" class="seat-tog" data-act="toggle" aria-pressed="${p.on && !disabled}" aria-label="${p.on ? 'Seated' : 'Not playing'}: ${esc(p.name)}" ${disabled ? 'disabled' : ''}>${icon('check', 16)}</button>
              <button type="button" class="pl-ava" data-act="emoji" aria-label="Change avatar for ${esc(p.name)}">${T.avatar(p, 44)}</button>
              <div class="pl-mid">${p.bot ? `<span class="pl-name bot">${esc(p.name)}</span><small>${disabled ? 'Humans only in this game' : 'Computer player'}</small>`
                : `<input class="pl-name" value="${esc(p.name)}" maxlength="14" aria-label="Player ${i + 1} name" data-act="name">`}
                <button type="button" class="swatch" data-act="color" aria-label="Change color for ${esc(p.name)}"></button></div>
              <div class="pl-tools">
                <button type="button" class="mini" data-act="up" aria-label="Move ${esc(p.name)} up" ${i === 0 ? 'disabled' : ''}>${icon('up', 18)}</button>
                <button type="button" class="mini" data-act="down" aria-label="Move ${esc(p.name)} down" ${i === roster.length - 1 ? 'disabled' : ''}>${icon('down', 18)}</button>
                <button type="button" class="mini del" data-act="del" aria-label="Remove ${esc(p.name)}">${icon('trash', 18)}</button>
              </div></li>`;
          }).join('')}
        </ul>
        <div class="add-row">
          <button type="button" class="btn secondary grow" data-add="human">${icon('plus', 18)} Add player</button>
          ${!g || g.bots ? `<button type="button" class="btn secondary grow" data-add="bot">${icon('robot', 18)} Add bot</button>` : ''}
        </div>
        ${g && g.options ? `<div class="opts card-panel">${g.options.map(o => `<div class="opt"><span>${esc(o.label)}</span><div class="seg" role="group" aria-label="${esc(o.label)}">${o.choices.map(c => `<button type="button" data-opt="${o.key}" data-val="${c[0]}" aria-pressed="${optVal(g, o) == c[0]}" class="${optVal(g, o) == c[0] ? 'on' : ''}">${esc(c[1])}</button>`).join('')}</div></div>`).join('')}</div>` : ''}
      </div>
      <footer class="footbar">
        ${g ? `<button type="button" class="btn primary grow xl" data-start ${okCount ? '' : 'disabled'}>${icon('play', 20)} Deal us in</button>` : '<button type="button" class="btn primary grow" data-nav="home">Done</button>'}
      </footer>`, 'setup-scr dark');
    s.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const li = b.closest('.pl'); const p = li && roster.find(x => x.id === li.dataset.id);
      const act = b.dataset.act;
      if (p && act === 'toggle') { p.on = !p.on; T.sfx('pop'); }
      else if (p && act === 'emoji') { const set = p.bot ? ['🤖', '👾', '🦾', '🎰', '🛸'] : T.EMOJI; p.emoji = set[(set.indexOf(p.emoji) + 1) % set.length]; T.sfx('pop'); }
      else if (p && act === 'color') { p.color = T.COLORS[(T.COLORS.indexOf(p.color) + 1) % T.COLORS.length]; T.sfx('pop'); }
      else if (p && (act === 'up' || act === 'down')) { const i = roster.indexOf(p), j = i + (act === 'up' ? -1 : 1); if (j >= 0 && j < roster.length) { [roster[i], roster[j]] = [roster[j], roster[i]]; T.sfx('step'); } }
      else if (p && act === 'del') { roster = roster.filter(x => x !== p); T.sfx('pass'); }
      else if (b.dataset.add) { if (roster.length >= 14) { T.toast('That\'s a full table!'); return; } roster.push(newPlayer(b.dataset.add === 'bot')); T.sfx('pop'); }
      else if (b.dataset.opt) { gameOpts(g)[b.dataset.opt] = isNaN(+b.dataset.val) ? b.dataset.val : +b.dataset.val; T.store.set('opts.' + g.id, gameOpts(g)); T.sfx('pop'); }
      else if ('start' in b.dataset) { saveRoster(); go('rules'); return; }
      else return;
      saveRoster(); const y = s.scrollTop; players(); app.querySelector('.scr').scrollTop = y;
      const again = act && app.querySelector(`.pl[data-id="${li && li.dataset.id}"] [data-act="${act}"]`); if (again) again.focus();
    });
    s.addEventListener('change', e => {
      if (e.target.dataset.act === 'name') { const p = roster.find(x => x.id === e.target.closest('.pl').dataset.id); p.name = e.target.value.trim().slice(0, 14) || p.name; saveRoster(); }
    });
  }
  const optCache = {};
  function gameOpts(g) { if (!optCache[g.id]) { optCache[g.id] = T.store.get('opts.' + g.id, {}); (g.options || []).forEach(o => { if (optCache[g.id][o.key] == null) optCache[g.id][o.key] = o.def; }); } return optCache[g.id]; }
  function optVal(g, o) { return gameOpts(g)[o.key]; }

  /* ---------- RULES INTRO ---------- */
  function rules(i) {
    const g = game; i = i || 0;
    const r = g.rules[i];
    const s = setScreen(`
      <div class="rules-bg" style="--g1:${g.colors[0]};--g2:${g.colors[1]}" aria-hidden="true"></div>
      ${topbar(`<span class="small-t">How to play · ${esc(g.name)}</span>`, 'players', `<button type="button" class="link skip" data-play-now>Skip</button>`)}
      <div class="rules">
        <div class="rule-art" aria-hidden="true">${r.art()}</div>
        <div class="rule-txt"><span class="rule-n">${i + 1}</span><h1 class="display">${esc(r.title)}</h1><p>${r.text}</p></div>
        <div class="dots big" aria-hidden="true">${g.rules.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      </div>
      <footer class="footbar">
        ${i ? '<button type="button" class="btn ghost" data-r="-1">Back</button>' : ''}
        <button type="button" class="btn primary grow xl" data-r="1">${i === g.rules.length - 1 ? icon('play', 20) + " Let's play!" : 'Next'}</button>
      </footer>`, 'rules-scr dark');
    s.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if ('playNow' in b.dataset) go('play');
      else if (b.dataset.r) { const n = i + +b.dataset.r; if (n >= g.rules.length) go('play'); else { T.sfx('tap'); rules(Math.max(0, n)); } }
    });
    if (T.qs.has('skiprules')) go('play');
  }
  function rulesSheet(g) {
    return T.modal({
      title: 'How to play ' + g.name, cls: 'rules-sheet',
      body: `<ol class="rule-list">${g.rules.map(r => `<li><b>${esc(r.title)}</b><span>${r.text}</span></li>`).join('')}</ol>${g.more ? `<div class="more-rules">${g.more}</div>` : ''}`,
      actions: [{ label: 'Got it', kind: 'primary', value: 'ok' }],
    });
  }

  /* ---------- PLAY ---------- */
  function play() {
    const g = game;
    const seated = roster.filter(p => p.on && (g.bots || !p.bot)).slice(0, g.players[1]).map(p => Object.assign({}, p));
    const s = setScreen(`<div class="game-root g-${g.id}"></div>`, 'play-scr', 'light');
    const root = s.querySelector('.game-root');
    let ended = false;
    const ctx = {
      players: seated, opts: Object.assign({}, gameOpts(g)), paused: false,
      menuButton: () => `<button type="button" class="icon-btn glass" data-menu aria-label="Game menu">${icon('menu')}</button>`,
      end(result) {
        if (ended) return; ended = true;
        stats.played++; stats.byGame[g.id] = (stats.byGame[g.id] || 0) + 1; T.store.set('stats', stats);
        setTimeout(() => { view = 'results'; results(result); }, 300);
      },
      alive: () => !ended && view === 'play' && root.isConnected,
      waitUnpaused: () => new Promise(r => { const t = () => (!ctx.paused || !root.isConnected) ? r() : setTimeout(t, 150); t(); }),
    };
    root.addEventListener('click', e => { if (e.target.closest('[data-menu]')) menu(ctx); });
    live = g.mount(root, ctx) || {};
    live.ctx = ctx;
    const orig = live.destroy; live.destroy = () => { ended = true; if (orig) orig(); };
  }
  async function menu(ctx) {
    const g = game; ctx.paused = true; if (live && live.pause) live.pause();
    T.sfx('tap');
    const v = await T.modal({
      title: 'Paused', cls: 'pause-menu',
      body: `<div class="pause-art">${box(g, 'sm')}</div>
        <div class="menu-list">
          <button type="button" data-value="resume" class="menu-item hero-item">${icon('play')} Resume</button>
          <button type="button" data-value="rules" class="menu-item">${icon('book')} How to play</button>
          <button type="button" data-value="sound" class="menu-item">${icon('sound')} Sound: ${T.settings.sound ? 'On' : 'Off'}</button>
          <button type="button" data-value="restart" class="menu-item">${icon('redo')} Restart game</button>
          <button type="button" data-value="quit" class="menu-item danger">${icon('exit')} Quit to home</button>
        </div>`,
      actions: [],
    });
    if (v === 'rules') { await rulesSheet(g); return menu(ctx); }
    if (v === 'sound') { T.settings.sound = !T.settings.sound; T.saveSettings(); return menu(ctx); }
    if (v === 'restart') { view = 'play'; play(); return; }
    if (v === 'quit') { const ok = await T.modal({ title: 'Quit this game?', body: '<p class="center">Progress in this game will be lost.</p>', actions: [{ label: 'Keep playing', value: false }, { label: 'Quit', kind: 'danger', value: true }] }); if (ok) { go('home'); return; } }
    ctx.paused = false; if (live && live.resume) live.resume();
  }

  /* ---------- RESULTS ---------- */
  function results(r) {
    const g = game;
    const ranking = r.ranking || [];
    const top3 = ranking.slice(0, 3);
    const podiumOrder = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3.length === 2 ? [top3[1], top3[0]] : top3;
    const place = p => ranking.indexOf(p) + 1;
    const s = setScreen(`
      <div class="res-bg" style="--g1:${g.colors[0]};--g2:${g.colors[1]}" aria-hidden="true"><div class="rays"></div></div>
      <div class="scroll results">
        <p class="eyebrow center">${esc(g.name)} · Game over</p>
        <h1 class="display res-h">${esc(r.headline || 'We have a winner!')}</h1>
        ${r.sub ? `<p class="res-sub">${esc(r.sub)}</p>` : ''}
        ${r.team ? `<div class="teams">${[['Winners', r.winners], ['Better luck next time', r.losers]].map(([t, ids], gi) => `<div class="team-grp ${gi ? 'lost' : 'won'}"><h2 class="mini-h">${gi ? '' : '👑 '}${t}</h2><div class="team-row">${ranking.filter(p => ids.includes(p.id)).map((p, k) => `<div class="team-p" style="--d:${k * 80 + gi * 300}ms">${T.avatar(p, gi ? 46 : 62)}<b>${esc(p.name)}</b><span class="pod-score">${esc(p.label)}</span></div>`).join('')}</div></div>`).join('')}</div>` : ''}
        ${top3.length && !r.team ? `<div class="podium">${podiumOrder.map(p => `<div class="pod p${place(p)}" style="--pc:${p.color}">
            ${place(p) === 1 ? `<span class="crown" aria-hidden="true">👑</span>` : ''}
            ${T.avatar(p, place(p) === 1 ? 74 : 58)}
            <b class="pod-name">${esc(p.name)}</b><span class="pod-score">${esc(p.label || '')}</span>
            <div class="pod-block"><span class="display">${place(p)}</span></div></div>`).join('')}</div>` : ''}
        ${ranking.length > 3 && !r.team ? `<ol class="rank-rest" start="4">${ranking.slice(3).map(p => `<li style="--pc:${p.color}">${T.avatar(p, 32)}<b>${esc(p.name)}</b><span>${esc(p.label || '')}</span></li>`).join('')}</ol>` : ''}
        ${r.extra || ''}
        ${r.stats && r.stats.length ? `<div class="stat-grid">${r.stats.map(x => `<div class="stat"><span class="display">${esc(x.value)}</span><small>${esc(x.label)}</small></div>`).join('')}</div>` : ''}
      </div>
      <footer class="footbar col">
        <button type="button" class="btn primary xl wide" data-again>${icon('redo', 20)} Play again</button>
        <div class="row2"><button type="button" class="btn secondary grow" data-nav="recs-or-lib">Pick another game</button><button type="button" class="btn ghost" data-nav="home" aria-label="Home">${icon('home')}</button></div>
      </footer>`, 'results-scr dark');
    T.sfx('fanfare'); setTimeout(() => T.confetti(), 200); setTimeout(() => T.confetti({ y: 0.2, count: 90 }), 1000);
    s.querySelector('[data-again]').addEventListener('click', () => go('play'));
  }

  /* ---------- LIBRARY ---------- */
  function library() {
    setScreen(`
      <div class="scroll pad-tab lib">
        <header class="lib-h"><p class="eyebrow">The game shelf</p><h1 class="display">All games</h1><p class="sub">Every game runs on this one phone. Cards, dice and boards included.</p></header>
        <div class="lib-list">${games().map((g, i) => `<article class="lib-item" style="--d:${i * 60}ms;--g1:${g.colors[0]};--g2:${g.colors[1]}">
          <div class="lib-box">${box(g)}</div>
          <div class="lib-info"><h2>${esc(g.name)}</h2><p>${esc(g.blurb)}</p><div class="badges">${badges(g)}${g.bots ? `<span class="badge bot">${icon('robot', 14)} Bots</span>` : ''}</div>
          <button type="button" class="btn primary sm" data-play="${g.id}">${icon('play', 16)} Play</button></div></article>`).join('')}</div>
      </div>${tabbar('library')}`, 'lib-scr dark');
  }

  /* ---------- SETTINGS ---------- */
  function settings() {
    const row = (k, label, desc, ic) => `<div class="set-row"><span class="set-ic">${icon(ic)}</span><div><b id="lb-${k}">${label}</b><small>${desc}</small></div>
      <button type="button" class="switch ${T.settings[k] ? 'on' : ''}" role="switch" aria-checked="${!!T.settings[k]}" aria-labelledby="lb-${k}" data-set="${k}"><i></i></button></div>`;
    const s = setScreen(`
      <div class="scroll pad-tab settings">
        <header class="lib-h"><p class="eyebrow">Settings</p><h1 class="display">House rules</h1></header>
        <div class="card-panel set-list">
          ${row('sound', 'Sound effects', 'Card snaps, dice rattles, fanfares', 'sound')}
          ${row('voice', 'Narrator voice', 'Werewolf narrator reads phases aloud', 'book')}
          ${row('haptics', 'Haptics', 'Little buzzes on supported phones', 'bolt')}
          ${row('reduce', 'Reduce motion', 'Calmer animations, no confetti', 'sparkle')}
        </div>
        <div class="card-panel set-list">
          <button type="button" class="set-row btnrow" data-crew><span class="set-ic">${icon('users')}</span><div><b>Edit crew</b><small>${roster.length} saved players</small></div>${icon('back', 18)}</button>
          <button type="button" class="set-row btnrow" data-reset><span class="set-ic">${icon('trash')}</span><div><b>Reset players &amp; stats</b><small>Clears this phone's saved data</small></div></button>
        </div>
        <p class="fineprint">TABLE v2 · Everything is stored only on this device. Game names are generic; no trademarked games are reproduced.</p>
      </div>${tabbar('settings')}`, 'set-scr dark');
    s.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.set) { T.settings[b.dataset.set] = !T.settings[b.dataset.set]; T.saveSettings(); T.sfx('pop'); settings(); const n = app.querySelector(`[data-set="${b.dataset.set}"]`); if (n) n.focus(); }
      else if ('crew' in b.dataset) { game = null; go('players'); }
      else if ('reset' in b.dataset) {
        const ok = await T.modal({ title: 'Reset everything?', body: '<p class="center">Saved players and stats on this phone will be cleared.</p>', actions: [{ label: 'Cancel', value: false }, { label: 'Reset', kind: 'danger', value: true }] });
        if (ok) { roster = defaultRoster(); saveRoster(); stats.played = 0; stats.byGame = {}; T.store.set('stats', stats); T.toast('All clear!'); settings(); }
      }
    });
  }

  const ROUTES = {
    home, wizard: () => wizard(0), recs, library, settings, players: id => players(id), rules: () => rules(0), play, results,
  };

  /* global nav delegation */
  app.addEventListener('click', e => {
    const n = e.target.closest('[data-nav]');
    if (n) {
      let v = n.dataset.nav;
      if (v === 'back') v = lastRecs && lastRecs.length ? 'recs' : 'library';
      if (v === 'recs-or-lib') v = lastRecs ? 'recs' : 'library';
      if (v === 'wizard' && view === 'recs') { view = 'wizard'; T.sfx('tap'); wizard(3); return; }
      go(v); return;
    }
    const p = e.target.closest('[data-play]');
    if (p) { game = T.games[p.dataset.play]; go('players', p.dataset.play); }
  });

  /* deep links for testing / sharing: ?game=crazy8&skiprules */
  const startGame = T.qs.get('game');
  if (startGame && T.games[startGame]) { game = T.games[startGame]; view = 'players'; players(startGame); if (T.qs.has('autostart')) { view = 'rules'; rules(0); } }
  else { view = T.qs.get('view') && ROUTES[T.qs.get('view')] ? T.qs.get('view') : 'home'; ROUTES[view](); }
})();

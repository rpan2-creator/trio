/* Werewolf — 5–12 players on one phone. The app deals secret roles (tap-and-hold to peek),
   narrates night/day, collects night actions privately by passing the phone, runs a timed
   discussion and a pass-around vote, reveals eliminations and checks win conditions. */
(function () {
  'use strict';
  const T = window.Table, esc = T.esc;

  const ROLES = {
    wolf: { name: 'Werewolf', team: 'wolves', emoji: '🐺', color: '#ff4d6d', goal: 'Each night, secretly choose a villager to eliminate. Blend in by day. You win when wolves equal or outnumber everyone else.' },
    seer: { name: 'Seer', team: 'village', emoji: '🔮', color: '#9b5de5', goal: 'Each night, look into one player\'s soul to learn if they are a Werewolf. Guide the village without getting caught.' },
    doctor: { name: 'Doctor', team: 'village', emoji: '🩺', color: '#3ddc97', goal: 'Each night, protect one player (you may pick yourself). If the wolves attack them, they survive.' },
    villager: { name: 'Villager', team: 'village', emoji: '🧑‍🌾', color: '#ffd23f', goal: 'No powers — just your wits. Find the Werewolves and vote them out during the day.' },
  };

  const L = {
    ROLES,
    wolvesFor: n => (n <= 6 ? 1 : n <= 9 ? 2 : 3),
    deal(n) {
      const roles = [];
      for (let i = 0; i < L.wolvesFor(n); i++) roles.push('wolf');
      roles.push('seer'); roles.push('doctor');
      while (roles.length < n) roles.push('villager');
      return T.shuffle(roles);
    },
    winner(roles, alive) {
      const w = roles.filter((r, i) => alive[i] && r === 'wolf').length, o = roles.filter((r, i) => alive[i] && r !== 'wolf').length;
      if (w === 0) return 'village';
      if (w >= o) return 'wolves';
      return null;
    },
    /* resolve votes: majority of votes cast, ties = nobody out */
    tally(votes) {
      const c = {}; votes.forEach(v => { if (v != null && v >= 0) c[v] = (c[v] || 0) + 1; });
      const ent = Object.entries(c).sort((a, b) => b[1] - a[1]);
      if (!ent.length || (ent[1] && ent[1][1] === ent[0][1])) return { out: -1, counts: c };
      return { out: +ent[0][0], counts: c };
    },
    resolveNight(targets, save) {
      const t = L.tally(targets);
      // wolves must agree on plurality; tie → first wolf's choice
      let victim = t.out >= 0 ? t.out : targets.find(x => x >= 0);
      if (victim == null) victim = -1;
      return { victim, saved: victim >= 0 && victim === save };
    },
  };

  function mount(root, ctx) {
    const P = ctx.players.map(p => Object.assign({}, p, { bot: false }));
    const n = P.length;
    const roles = L.deal(n), alive = P.map(() => true);
    const discussSec = ctx.opts.timer || 180;
    let dead = false, night = 0, log = [], seerSeen = {}, timerId = null;
    const el = s => root.querySelector(s);
    const living = () => P.map((_, i) => i).filter(i => alive[i]);

    function shell(inner, phase) {
      root.innerHTML = `<div class="ww ${phase}">
        <div class="ww-sky" aria-hidden="true"><div class="moon"></div><div class="sun"></div><div class="stars"></div><div class="hills"></div><div class="trees"></div></div>
        <header class="g-top">${ctx.menuButton()}<div class="g-title"><span class="g-name">Werewolf</span><span class="g-sub">${phase === 'night' ? 'Night ' + night : phase === 'day' ? 'Day ' + night : 'Setup'} · ${living().length} alive</span></div><span class="icon-btn ghost"></span></header>
        <div class="ww-body">${inner}</div></div>`;
      if (window.Frame) window.Frame.tone('light');
    }
    const btnWait = sel => new Promise(res => { const b = el(sel); if (!b) return res(); b.addEventListener('click', () => { T.sfx('tap'); res(b.dataset.v); }, { once: true }); setTimeout(() => b.focus(), 50); });

    /* ---------- role reveal ---------- */
    async function revealAll() {
      shell(`<div class="ww-intro"><div class="ww-cardstack" aria-hidden="true">${[0, 1, 2].map(k => `<span class="role-back" style="--k:${k}"></span>`).join('')}</div>
        <h1 class="display">${n} players · ${L.wolvesFor(n)} werewol${L.wolvesFor(n) > 1 ? 'ves' : 'f'}</h1>
        <p>Plus a <b>Seer</b>, a <b>Doctor</b> and ${n - L.wolvesFor(n) - 2} villager${n - L.wolvesFor(n) - 2 === 1 ? '' : 's'}. Pass the phone around so everyone can secretly see their role card.</p>
        <button type="button" class="btn primary xl wide" data-go>Deal role cards</button></div>`, 'setup');
      await btnWait('[data-go]');
      for (let i = 0; i < n && !dead; i++) {
        await T.passTo(P[i], { kicker: 'Secret role for', sub: 'Make sure nobody else can see the screen.', button: "I'm alone — show me" });
        if (dead) return;
        await roleCard(i);
      }
    }
    function roleCard(i) {
      const r = ROLES[roles[i]];
      const mates = roles[i] === 'wolf' ? P.filter((_, k) => k !== i && roles[k] === 'wolf').map(p => p.name) : [];
      shell(`<div class="reveal">
        <p class="reveal-k">${esc(P[i].name)}, your role is…</p>
        <button type="button" class="role-card" data-hold aria-label="Press and hold to reveal your role" style="--rc:${r.color}">
          <span class="rc-in"><span class="rc-back"><span class="rc-sigil">?</span><span class="rc-hint">Press &amp; hold to peek</span></span>
          <span class="rc-front"><span class="rc-emoji">${r.emoji}</span><span class="rc-name display">${r.name}</span><span class="rc-team">${r.team === 'wolves' ? 'Team Wolves' : 'Team Village'}</span><span class="rc-goal">${esc(r.goal)}</span>${mates.length ? `<span class="rc-mates">Your pack: ${mates.map(esc).join(', ')}</span>` : ''}</span></span>
        </button>
        <p class="reveal-tip" role="status">Hold the card to see your role. Let go to hide it.</p>
        <button type="button" class="btn primary wide" data-done disabled>Got it — hide &amp; pass</button></div>`, 'setup');
      const card = el('[data-hold]'), done = el('[data-done]');
      let seen = false;
      const show = e => { if (e) e.preventDefault(); card.classList.add('open'); if (!seen) { T.sfx(roles[i] === 'wolf' ? 'howl' : 'flip'); } seen = true; done.disabled = false; T.announce('Your role: ' + r.name + '. ' + r.goal); };
      const hide = () => card.classList.remove('open');
      card.addEventListener('pointerdown', show); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => card.addEventListener(ev, hide));
      card.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') show(e); });
      card.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') hide(); });
      card.addEventListener('contextmenu', e => e.preventDefault());
      return new Promise(res => done.addEventListener('click', () => { hide(); T.sfx('tap'); res(); }, { once: true }));
    }

    /* ---------- night ---------- */
    async function nightPhase() {
      night++;
      shell(`<div class="narr"><div class="narr-icon">🌙</div><h1 class="display">Night ${night}</h1>
        <p class="narr-line">Everyone, close your eyes. The village sleeps…</p>
        <p class="sub">The phone will go around the circle. <b>Everyone</b> takes a turn so nobody can tell who has a power.</p>
        <button type="button" class="btn primary xl wide" data-go>Begin the night</button></div>`, 'night');
      T.say(`Night ${night}. Everyone, close your eyes. The village sleeps.`);
      T.sfx('howl');
      await btnWait('[data-go]'); if (dead) return;
      const wolfVotes = [], live = living(); let save = -1;
      for (const i of live) {
        if (dead) return;
        await T.passTo(P[i], { kicker: 'Night turn for', sub: 'Open your eyes only when you have the phone.', button: "I'm " + P[i].name });
        const role = roles[i];
        if (role === 'wolf') {
          const prior = wolfVotes.filter(v => v >= 0).map(v => P[v].name);
          const t = await choose(i, '🐺 Choose your prey', prior.length ? `Your pack leans toward: ${prior.join(', ')}` : 'Pick a villager to eliminate tonight.', live.filter(k => roles[k] !== 'wolf'), 'wolf');
          wolfVotes.push(t);
        } else if (role === 'seer') {
          const t = await choose(i, '🔮 Look into a soul', 'Choose someone to investigate.', live.filter(k => k !== i), 'seer');
          seerSeen[t] = roles[t] === 'wolf';
          await info(i, `<div class="seer-res ${seerSeen[t] ? 'bad' : 'good'}">${T.avatar(P[t], 72)}<h2 class="display">${esc(P[t].name)}</h2><p>${seerSeen[t] ? 'IS a Werewolf 🐺' : 'is NOT a Werewolf ✨'}</p></div>`);
        } else if (role === 'doctor') {
          save = await choose(i, '🩺 Protect someone', 'They will survive a wolf attack tonight.', live, 'doctor');
        } else {
          // villagers get a decoy task so timing gives nothing away
          await choose(i, '😴 Sleep tight', 'You have no night power. Tap anyone you find suspicious (it does nothing) to pass the phone along.', live.filter(k => k !== i), 'villager');
        }
      }
      const res = L.resolveNight(wolfVotes, save);
      return res;
    }
    function choose(i, title, sub, opts, kind) {
      shell(`<div class="choose ${kind}"><h1 class="display">${title}</h1><p class="sub">${esc(sub)}</p>
        <div class="pgrid">${opts.map(k => `<button type="button" class="ptile" data-v="${k}" style="--pc:${P[k].color}">${T.avatar(P[k], 52)}<b>${esc(P[k].name)}</b>${kind === 'seer' && seerSeen[k] != null ? `<small>${seerSeen[k] ? 'Wolf' : 'Clear'}</small>` : ''}</button>`).join('')}</div></div>`, 'night');
      return new Promise(res => root.querySelector('.pgrid').addEventListener('click', async e => {
        const b = e.target.closest('.ptile'); if (!b) return;
        root.querySelectorAll('.ptile').forEach(x => x.classList.toggle('picked', x === b)); T.sfx('pop'); T.haptic();
        await T.sleep(380); res(+b.dataset.v);
      }));
    }
    async function info(i, html) {
      shell(`<div class="info">${html}<button type="button" class="btn primary wide" data-ok>Got it — hide</button></div>`, 'night');
      T.sfx('flip');
      await btnWait('[data-ok]');
    }

    /* ---------- dawn + day ---------- */
    async function dawn(res) {
      shell(`<div class="narr"><div class="narr-icon sunrise">☀️</div><h1 class="display">Morning, Day ${night}</h1>
        <p class="narr-line">Gather everyone and wake up. Narrator, tap to reveal what happened.</p>
        <button type="button" class="btn primary xl wide" data-go>Reveal the night</button></div>`, 'day');
      T.say('Everybody, wake up!'); T.sfx('bell');
      await btnWait('[data-go]'); if (dead) return;
      let html;
      if (res.victim < 0 || res.saved) {
        html = `<div class="elim saved"><div class="elim-ic">🛡️</div><h1 class="display">Nobody died!</h1><p>${res.saved ? 'The Doctor made a perfect save last night.' : 'The wolves couldn\'t agree on anyone.'}</p></div>`;
        log.push(`Night ${night}: nobody died`);
        T.say('Good news. Nobody died last night.'); T.sfx('win');
      } else {
        alive[res.victim] = false;
        html = elimHTML(res.victim, 'was taken by the wolves');
        log.push(`Night ${night}: ${P[res.victim].name} (${ROLES[roles[res.victim]].name}) was killed`);
        T.say(`${P[res.victim].name} was found dead. They were a ${ROLES[roles[res.victim]].name}.`); T.sfx('capture');
      }
      shell(`${html}<button type="button" class="btn primary wide" data-ok>Continue</button>`, 'day');
      await btnWait('[data-ok]');
    }
    function elimHTML(i, how) {
      const r = ROLES[roles[i]];
      return `<div class="elim"><div class="elim-ava">${T.avatar(P[i], 90)}<span class="x">✕</span></div><h1 class="display">${esc(P[i].name)}</h1><p>${how}</p>
        <div class="elim-role" style="--rc:${r.color}"><span>${r.emoji}</span><b>${r.name}</b></div></div>`;
    }

    async function discussion() {
      let left = discussSec, paused = false;
      shell(`<div class="discuss"><h1 class="display">Discuss!</h1><p class="sub">Who's acting suspicious? Accuse, defend, bluff.</p>
        <div class="timer" role="timer" aria-live="off"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="tr-bg"/><circle cx="60" cy="60" r="52" class="tr-fg" pathLength="100"/></svg><span class="t-num">${fmt(left)}</span></div>
        <div class="alive-row">${living().map(i => `<span class="ar" title="${esc(P[i].name)}">${T.avatar(P[i], 36)}<small>${esc(P[i].name)}</small></span>`).join('')}</div>
        <div class="ctrl-row"><button type="button" class="btn ghost" data-add>+30s</button><button type="button" class="btn ghost" data-pause>Pause</button><button type="button" class="btn primary grow" data-vote>Start the vote</button></div>
        ${log.length ? `<details class="log"><summary>What's happened</summary><ul>${log.map(l => `<li>${esc(l)}</li>`).join('')}</ul></details>` : ''}</div>`, 'day');
      T.say('Discuss. Who among you is a werewolf?');
      const fg = el('.tr-fg'), num = el('.t-num');
      const upd = () => { num.textContent = fmt(left); fg.style.strokeDashoffset = 100 - (left / discussSec) * 100; el('.timer').classList.toggle('low', left <= 10); };
      upd();
      return new Promise(res => {
        timerId = setInterval(() => {
          if (paused || ctx.paused) return;
          left--; if (left <= 10 && left > 0) T.sfx('tick'); upd();
          if (left <= 0) { clearInterval(timerId); T.sfx('buzz'); res(); }
        }, 1000 * (T.speed === 1 ? 1 : 0.05));
        el('[data-add]').addEventListener('click', () => { left += 30; T.sfx('pop'); upd(); });
        el('[data-pause]').addEventListener('click', e => { paused = !paused; e.target.textContent = paused ? 'Resume' : 'Pause'; });
        el('[data-vote]').addEventListener('click', () => { clearInterval(timerId); T.sfx('tap'); res(); });
      });
    }
    const fmt = s => Math.floor(Math.max(0, s) / 60) + ':' + String(Math.max(0, s) % 60).padStart(2, '0');

    async function vote() {
      const live = living(), votes = [];
      shell(`<div class="narr"><div class="narr-icon">🗳️</div><h1 class="display">Secret vote</h1><p class="narr-line">Pass the phone. Each living player votes privately for who to banish.</p><p class="sub">Most votes is out. A tie means nobody is banished.</p>
        <button type="button" class="btn primary xl wide" data-go>Start voting</button></div>`, 'day');
      await btnWait('[data-go]'); if (dead) return;
      for (const i of live) {
        if (dead) return;
        await T.passTo(P[i], { kicker: 'Your vote,', sub: 'Vote in secret.', button: 'Vote now' });
        shell(`<div class="choose vote"><h1 class="display">Who do you banish?</h1><p class="sub">${esc(P[i].name)}, pick one — or skip.</p>
          <div class="pgrid">${live.filter(k => k !== i).map(k => `<button type="button" class="ptile" data-v="${k}" style="--pc:${P[k].color}">${T.avatar(P[k], 52)}<b>${esc(P[k].name)}</b></button>`).join('')}</div>
          <button type="button" class="btn ghost wide" data-skip>Skip vote</button></div>`, 'day');
        const v = await new Promise(res => root.querySelector('.choose').addEventListener('click', async e => {
          if (e.target.closest('[data-skip]')) { T.sfx('tap'); return res(-1); }
          const b = e.target.closest('.ptile'); if (!b) return;
          root.querySelectorAll('.ptile').forEach(x => x.classList.toggle('picked', x === b)); T.sfx('pop'); await T.sleep(300); res(+b.dataset.v);
        }));
        votes.push(v);
      }
      const t = L.tally(votes);
      shell(`<div class="narr"><div class="narr-icon">⚖️</div><h1 class="display">Votes are in</h1><p class="narr-line">Gather around for the verdict…</p><button type="button" class="btn primary xl wide" data-go>Reveal the votes</button></div>`, 'day');
      await btnWait('[data-go]');
      const bars = live.map(k => ({ k, c: t.counts[k] || 0 })).sort((a, b) => b.c - a.c);
      const max = Math.max(1, ...bars.map(b => b.c));
      shell(`<div class="tally"><h1 class="display">The verdict</h1>
        <ul class="bars">${bars.map((b, j) => `<li style="--pc:${P[b.k].color};--w:${b.c / max * 100}%;--d:${j * 120}ms">${T.avatar(P[b.k], 32)}<b>${esc(P[b.k].name)}</b><span class="bar"><i></i></span><span class="cnt">${b.c}</span></li>`).join('')}</ul>
        <button type="button" class="btn primary wide" data-ok>${t.out >= 0 ? 'Banish ' + esc(P[t.out].name) : 'Continue'}</button></div>`, 'day');
      T.sfx('chips');
      await btnWait('[data-ok]');
      if (t.out >= 0) {
        alive[t.out] = false;
        log.push(`Day ${night}: ${P[t.out].name} (${ROLES[roles[t.out]].name}) was banished`);
        shell(`${elimHTML(t.out, 'has been banished by the village')}<button type="button" class="btn primary wide" data-ok>Continue</button>`, 'day');
        T.say(`${P[t.out].name} was a ${ROLES[roles[t.out]].name}.`); T.sfx(roles[t.out] === 'wolf' ? 'win' : 'lose');
        await btnWait('[data-ok]');
      } else {
        log.push(`Day ${night}: tie — nobody banished`);
        shell(`<div class="elim saved"><div class="elim-ic">🤝</div><h1 class="display">It's a tie!</h1><p>Nobody is banished today.</p></div><button type="button" class="btn primary wide" data-ok>Continue</button>`, 'day');
        await btnWait('[data-ok]');
      }
    }

    function end(w) {
      clearInterval(timerId);
      T.say(w === 'wolves' ? 'The werewolves have taken the village!' : 'The village is safe! All werewolves are gone.');
      const winners = P.map((_, i) => i).filter(i => (roles[i] === 'wolf') === (w === 'wolves'));
      const losers = P.map((_, i) => i).filter(i => !winners.includes(i));
      ctx.end({
        team: true, winners: winners.map(i => P[i].id), losers: losers.map(i => P[i].id),
        headline: w === 'wolves' ? 'The Werewolves win!' : 'The Village wins!',
        sub: w === 'wolves' ? 'The pack outnumbered the village.' : 'Every werewolf has been found.',
        ranking: winners.concat(losers).map(i => Object.assign({}, P[i], { label: ROLES[roles[i]].emoji + ' ' + ROLES[roles[i]].name + (alive[i] ? '' : ' †') })),
        extra: `<div class="card-panel roles-reveal"><h2 class="mini-h">Everyone's role</h2>${P.map((p, i) => `<div class="rr ${winners.includes(i) ? 'win' : ''}">${T.avatar(p, 30)}<b>${esc(p.name)}</b><span style="color:${ROLES[roles[i]].color}">${ROLES[roles[i]].emoji} ${ROLES[roles[i]].name}</span></div>`).join('')}
          <h2 class="mini-h">Story of the game</h2><ul class="story">${log.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>`,
        stats: [{ value: night, label: night === 1 ? 'night' : 'nights' }, { value: alive.filter(Boolean).length, label: 'survivors' }],
      });
    }

    (async () => {
      await revealAll();
      while (!dead && ctx.alive()) {
        const res = await nightPhase(); if (dead) return;
        await dawn(res); if (dead) return;
        let w = L.winner(roles, alive); if (w) return end(w);
        await discussion(); if (dead) return;
        await vote(); if (dead) return;
        w = L.winner(roles, alive); if (w) return end(w);
      }
    })();
    return { destroy() { dead = true; clearInterval(timerId); T.hush(); } };
  }

  T.games.werewolf = {
    id: 'werewolf', name: 'Werewolf', kicker: 'Social deduction', tagline: 'Hidden wolves, one village, and a lot of finger-pointing.',
    blurb: 'The hidden-role classic (a.k.a. Mafia). The app deals secret roles and narrates. By night the wolves strike; by day everyone argues and votes. Bluff, deduce, survive.',
    players: [5, 12], minutes: [20, 45], difficulty: 2, bots: false, minHumans: 5, noise: 'high', colors: ['#3a2d6b', '#120c2b', '#ff4d6d'],
    vibes: { chill: 0.3, competitive: 0.7, chaotic: 0.95, strategic: 0.9 },
    vibeWhy: { chill: 'Low-tech: just talking', competitive: 'Team vs team showdown', chaotic: 'Accusations fly, everyone shouts', strategic: 'Deduction, bluffing and reads' },
    setting: { home: 1, bar: 0.5, backyard: 0.9 }, settingWhy: { home: 'Great with a circle on the couch', bar: 'Needs some quiet to hear each other', backyard: 'Classic around a campfire' },
    options: [{ key: 'timer', label: 'Discussion', def: 180, choices: [[90, '1:30'], [180, '3 min'], [300, '5 min']] }],
    box: () => `<svg viewBox="0 0 160 110" class="box-svg"><circle cx="112" cy="34" r="22" fill="#fff6d5"/><circle cx="104" cy="28" r="4" fill="#efe1b0"/><circle cx="118" cy="42" r="3" fill="#efe1b0"/>
      <path d="M0 110 L0 84 Q40 70 80 82 T160 76 L160 110z" fill="#0c0820"/>
      ${[[18, 80], [34, 74], [142, 78]].map(([x, y]) => `<path d="M${x} ${y + 26} l0 -10 l-10 0 l10 -14 l-7 0 l7 -12 l7 12 l-7 0 l10 14 l-10 0z" fill="#0c0820"/>`).join('')}
      <path d="M58 98 L62 66 L56 52 L64 58 L70 48 L74 58 L84 56 L80 70 L90 80 L84 98z" fill="#0c0820"/><path d="M70 64 l3 2" stroke="#ffd23f" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    rules: [
      { title: 'Secret roles', text: 'Pass the phone — each player <b>holds the card</b> to see their role. Most are <b>Villagers</b>. A few are <b>Werewolves</b>. There\'s also a <b>Seer</b> and a <b>Doctor</b>.', art: () => `<div class="art-roles">${['wolf', 'seer', 'doctor', 'villager'].map((r, i) => `<span class="mini-role" style="--rc:${ROLES[r].color};--k:${i - 1.5}"><b>${ROLES[r].emoji}</b><small>${ROLES[r].name}</small></span>`).join('')}</div>` },
      { title: 'Night falls', text: 'The phone goes around. <b>Wolves</b> pick a victim, the <b>Seer</b> checks one person, the <b>Doctor</b> protects one. Everyone takes a turn so no one can tell who\'s who.', art: () => `<div class="art-night"><span class="an-moon"></span><span class="an-wolf">🐺</span></div>` },
      { title: 'Day: argue & vote', text: 'Find out who died, then <b>discuss</b> on the timer and <b>vote secretly</b>. Village wins when all wolves are gone; wolves win when they equal the villagers.', art: () => `<div class="art-vote">🗳️<span>3</span><span>1</span><span>2</span></div>` },
    ],
    more: '<p>1 wolf for 5–6 players, 2 for 7–9, 3 for 10–12. Dead players reveal their role and stay quiet. Ties in the vote banish nobody.</p>',
    mount, logic: L,
  };
  T.order.push('werewolf');
})();

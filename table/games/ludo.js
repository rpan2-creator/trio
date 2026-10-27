/* Ludo — 2–4 players (humans and/or bots). 52-square track, 6 to leave base, safe squares,
   captures, home column, exact roll to finish, bonus roll on 6 / capture / reaching home. */
(function () {
  'use strict';
  const T = window.Table, esc = T.esc;

  /* track coordinates (col,row) on a 15x15 grid, index 0 = red start */
  const TRACK = [];
  (function build() {
    const push = (c, r) => TRACK.push([c, r]);
    for (let c = 1; c <= 5; c++) push(c, 6);
    for (let r = 5; r >= 0; r--) push(6, r);
    push(7, 0);
    for (let r = 0; r <= 5; r++) push(8, r);
    for (let c = 9; c <= 14; c++) push(c, 6);
    push(14, 7);
    for (let c = 14; c >= 9; c--) push(c, 8);
    for (let r = 9; r <= 14; r++) push(8, r);
    push(7, 14);
    for (let r = 14; r >= 9; r--) push(6, r);
    for (let c = 5; c >= 0; c--) push(c, 8);
    push(0, 7); push(0, 6);
  })();
  const COLORS = [
    { key: 'red', name: 'Red', fill: '#ef3b4f', dark: '#a3162a', light: '#ffd6db', start: 0, home: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], base: [0, 0] },
    { key: 'green', name: 'Green', fill: '#22b35e', dark: '#0f6b35', light: '#cff3dd', start: 13, home: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], base: [9, 0] },
    { key: 'yellow', name: 'Yellow', fill: '#ffc93c', dark: '#b07d00', light: '#fff1c7', start: 26, home: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]], base: [9, 9] },
    { key: 'blue', name: 'Blue', fill: '#2f7dff', dark: '#1745a6', light: '#d5e4ff', start: 39, home: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]], base: [0, 9] },
  ];
  const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
  const FINISH = 56;

  const L = {
    TRACK, SAFE, FINISH,
    abs: (color, rel) => (rel < 0 || rel > 50 ? -1 : (COLORS[color].start + rel) % 52),
    target(tok, roll) {
      if (tok.pos === FINISH) return null;
      if (tok.pos < 0) return roll === 6 ? 0 : null;
      const t = tok.pos + roll; return t > FINISH ? null : t;
    },
    legal(st, pi, roll) {
      return st.tokens[pi].map((tk, ti) => (L.target(tk, roll) == null ? -1 : ti)).filter(i => i >= 0);
    },
    /* apply a move; returns {captured:[{p,t}], finished, extra} */
    move(st, pi, ti, roll) {
      const tk = st.tokens[pi][ti], to = L.target(tk, roll);
      if (to == null) throw new Error('Illegal move');
      tk.pos = to;
      const out = { captured: [], finished: to === FINISH, extra: roll === 6 || to === FINISH };
      const a = L.abs(st.colors[pi], to);
      if (a >= 0 && !SAFE.has(a)) {
        st.tokens.forEach((arr, pj) => {
          if (pj === pi) return;
          arr.forEach((o, tj) => { if (L.abs(st.colors[pj], o.pos) === a) { o.pos = -1; out.captured.push({ p: pj, t: tj }); } });
        });
      }
      if (out.captured.length) out.extra = true;
      if (st.tokens[pi].every(t => t.pos === FINISH) && !st.finished.includes(pi)) st.finished.push(pi);
      return out;
    },
    init(n) {
      const colors = n === 2 ? [0, 2] : n === 3 ? [0, 1, 2] : [0, 1, 2, 3];
      return { colors, tokens: colors.map(() => [0, 1, 2, 3].map(() => ({ pos: -1 }))), turn: 0, finished: [], sixes: 0 };
    },
    botPick(st, pi, roll) {
      const opts = L.legal(st, pi, roll); if (!opts.length) return -1;
      let best = opts[0], bs = -1e9;
      opts.forEach(ti => {
        const tk = st.tokens[pi][ti], to = L.target(tk, roll);
        let s = 0;
        const a = L.abs(st.colors[pi], to);
        if (to === FINISH) s += 90;
        if (tk.pos < 0) s += 60;
        if (a >= 0 && !SAFE.has(a)) {
          st.tokens.forEach((arr, pj) => { if (pj !== pi) arr.forEach(o => { if (L.abs(st.colors[pj], o.pos) === a) s += 100; }); });
        }
        if (a >= 0 && SAFE.has(a)) s += 18;
        if (to > 50) s += 25;
        // danger: opponents 1-6 behind the landing square
        if (a >= 0 && !SAFE.has(a)) st.tokens.forEach((arr, pj) => { if (pj !== pi) arr.forEach(o => { const oa = L.abs(st.colors[pj], o.pos); if (oa >= 0) { const d = (a - oa + 52) % 52; if (d >= 1 && d <= 6) s -= 22; } }); });
        // leaving danger
        const cur = L.abs(st.colors[pi], tk.pos);
        if (cur >= 0 && !SAFE.has(cur)) st.tokens.forEach((arr, pj) => { if (pj !== pi) arr.forEach(o => { const oa = L.abs(st.colors[pj], o.pos); if (oa >= 0) { const d = (cur - oa + 52) % 52; if (d >= 1 && d <= 6) s += 15; } }); });
        s += tk.pos * 0.3 + Math.random() * 2;
        if (s > bs) { bs = s; best = ti; }
      });
      return best;
    },
  };

  /* cell coordinates for any token */
  function cellOf(st, pi, ti) {
    const col = st.colors[pi], tk = st.tokens[pi][ti], C0 = COLORS[col];
    if (tk.pos < 0) { const [bx, by] = C0.base; const o = [[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]][ti]; return [bx + o[0] + 0.5 - 0.5, by + o[1]]; }
    if (tk.pos <= 50) { const [c, r] = TRACK[L.abs(col, tk.pos)]; return [c + 0.5, r + 0.5]; }
    if (tk.pos < FINISH) { const [c, r] = C0.home[tk.pos - 51]; return [c + 0.5, r + 0.5]; }
    const fin = [[6.9, 7.5], [7.5, 6.9], [8.1, 7.5], [7.5, 8.1]][col];
    const off = [[-.25, -.25], [.25, -.25], [-.25, .25], [.25, .25]][ti];
    return [fin[0] + off[0] * 0.7, fin[1] + off[1] * 0.7];
  }

  function boardSVG(st) {
    const S = 24, g = [];
    g.push(`<rect x="0" y="0" width="${15 * S}" height="${15 * S}" rx="14" fill="#fffaf0"/>`);
    // bases
    COLORS.forEach((c, ci) => {
      const [bx, by] = c.base, used = st.colors.includes(ci);
      g.push(`<rect x="${bx * S + 2}" y="${by * S + 2}" width="${6 * S - 4}" height="${6 * S - 4}" rx="16" fill="${c.fill}" opacity="${used ? 1 : 0.35}"/>`);
      g.push(`<rect x="${bx * S + 2}" y="${by * S + 2}" width="${6 * S - 4}" height="${6 * S - 4}" rx="16" fill="url(#ludoShine)"/>`);
      g.push(`<rect x="${(bx + 1) * S}" y="${(by + 1) * S}" width="${4 * S}" height="${4 * S}" rx="14" fill="#fffaf0" stroke="${c.dark}" stroke-width="2"/>`);
      [[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]].forEach(([ox, oy]) => g.push(`<circle cx="${(bx + ox) * S}" cy="${(by + oy) * S}" r="${S * 0.62}" fill="${c.light}" stroke="${c.fill}" stroke-width="2.5"/>`));
    });
    // track cells
    TRACK.forEach(([c, r], i) => {
      let fill = '#ffffff';
      COLORS.forEach(cc => { if (cc.start === i) fill = cc.fill; });
      g.push(`<rect x="${c * S + 1}" y="${r * S + 1}" width="${S - 2}" height="${S - 2}" rx="4" fill="${fill}" stroke="#d9cfbd" stroke-width="1"/>`);
      if (SAFE.has(i)) {
        const isStart = COLORS.some(cc => cc.start === i);
        g.push(`<use href="#ludoStar" x="${c * S + 4}" y="${r * S + 4}" width="${S - 8}" height="${S - 8}" fill="${isStart ? 'rgba(255,255,255,.9)' : '#c9bfa8'}"/>`);
      }
    });
    // start arrows
    COLORS.forEach(cc => {
      const [c, r] = TRACK[(cc.start + 51) % 52];
      void c; void r;
    });
    // home columns
    COLORS.forEach(cc => cc.home.forEach(([c, r]) => g.push(`<rect x="${c * S + 1}" y="${r * S + 1}" width="${S - 2}" height="${S - 2}" rx="4" fill="${cc.fill}" stroke="${cc.dark}" stroke-width="1" opacity=".92"/>`)));
    // center triangles
    const cx = 7.5 * S, cy = 7.5 * S, a = 6 * S, b = 9 * S;
    g.push(`<polygon points="${a},${a} ${cx},${cy} ${a},${b}" fill="${COLORS[0].fill}"/>`);
    g.push(`<polygon points="${a},${a} ${cx},${cy} ${b},${a}" fill="${COLORS[1].fill}"/>`);
    g.push(`<polygon points="${b},${a} ${cx},${cy} ${b},${b}" fill="${COLORS[2].fill}"/>`);
    g.push(`<polygon points="${a},${b} ${cx},${cy} ${b},${b}" fill="${COLORS[3].fill}"/>`);
    g.push(`<rect x="${a}" y="${a}" width="${3 * S}" height="${3 * S}" fill="url(#ludoShine)"/>`);
    g.push(`<circle cx="${cx}" cy="${cy}" r="13" fill="#fffaf0" stroke="#e7dcc6" stroke-width="2"/><use href="#ludoStar" x="${cx - 8}" y="${cy - 8}" width="16" height="16" fill="#e2b13c"/>`);
    return `<svg class="ludo-svg" viewBox="0 0 ${15 * S} ${15 * S}" aria-hidden="true"><defs>
      <symbol id="ludoStar" viewBox="0 0 24 24"><path d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.2L12 17.6l-6.4 3.6L7 14l-5.3-5 7.2-.9z"/></symbol>
      <linearGradient id="ludoShine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient></defs>${g.join('')}</svg>`;
  }

  function mount(root, ctx) {
    const P = ctx.players.slice(0, 4), n = P.length;
    const st = L.init(n);
    let dead = false, roll = 0, rolling = false, picking = null, waiter = null;
    const stats = { captures: P.map(() => 0), sixes: P.map(() => 0), rolls: 0 };
    const el = s => root.querySelector(s);

    function render() {
      const pi = st.turn, me = P[pi], col = COLORS[st.colors[pi]];
      root.innerHTML = `
        <div class="wood ludo">
          <header class="g-top">${ctx.menuButton()}<div class="g-title"><span class="g-name">Ludo</span><span class="g-sub">Race all 4 tokens home</span></div><span class="icon-btn ghost"></span></header>
          <div class="ludo-players">${P.map((p, i) => { const c = COLORS[st.colors[i]]; const home = st.tokens[i].filter(t => t.pos === FINISH).length; return `<div class="lp ${i === pi ? 'turn' : ''} ${st.finished.includes(i) ? 'done' : ''}" style="--lc:${c.fill}">${T.avatar(Object.assign({}, p, { color: c.fill }), 32)}<span><b>${esc(p.name)}</b><small>${home}/4 home${st.finished.includes(i) ? ' · #' + (st.finished.indexOf(i) + 1) : ''}</small></span></div>`; }).join('')}</div>
          <div class="board-wrap"><div class="board" role="img" aria-label="Ludo board">
            ${boardSVG(st)}
            <div class="tokens">${st.tokens.map((arr, i) => arr.map((tk, t) => tokenHTML(i, t)).join('')).join('')}</div>
          </div></div>
          <div class="ludo-dock" style="--lc:${col.fill};--ld:${col.dark}">
            <div class="dock-who">${T.avatar(Object.assign({}, me, { color: col.fill }), 40)}<div><b>${esc(me.name)}</b><small class="dock-msg" role="status" aria-live="polite">${dockMsg()}</small></div></div>
            <button type="button" class="dice-btn" data-roll ${me.bot || rolling || picking || roll ? 'disabled' : ''} aria-label="Roll the die">${T.Dice.cube(62)}</button>
          </div>
        </div>`;
      const d = el('.die3d'); if (d) T.Dice.show(d, roll || lastShown);
      layout();
    }
    let lastShown = 6, dockText = '';
    function dockMsg() { return dockText || (P[st.turn].bot ? 'Rolling…' : 'Tap the die to roll'); }
    function tokenHTML(i, t) {
      const c = COLORS[st.colors[i]];
      const pickable = picking && picking.pi === i && picking.opts.includes(t);
      return `<button type="button" class="token ${pickable ? 'pickable' : ''}" data-tok="${i}-${t}" style="--lc:${c.fill};--ld:${c.dark}" ${pickable ? '' : 'tabindex="-1" aria-hidden="true"'} aria-label="${c.name} token ${t + 1}${pickable ? ', can move' : ''}"><i></i></button>`;
    }
    function layout() {
      // place tokens; offset tokens sharing a cell
      const groups = {};
      st.tokens.forEach((arr, i) => arr.forEach((_, t) => { const [x, y] = cellOf(st, i, t); const k = x.toFixed(2) + ',' + y.toFixed(2); (groups[k] = groups[k] || []).push([i, t, x, y]); }));
      Object.values(groups).forEach(gr => gr.forEach(([i, t, x, y], k) => {
        const e = el(`[data-tok="${i}-${t}"]`); if (!e) return;
        const st2 = st.tokens[i][t];
        const off = gr.length > 1 && st2.pos >= 0 && st2.pos < FINISH ? [(k % 2 - 0.5) * 0.36, (Math.floor(k / 2) - 0.25) * 0.36] : [0, 0];
        e.style.left = ((x + off[0]) / 15 * 100) + '%'; e.style.top = ((y + off[1]) / 15 * 100) + '%';
        e.style.zIndex = 10 + Math.round(y * 2) + k;
        e.classList.toggle('small', gr.length > 1 && st2.pos >= 0 && st2.pos < FINISH);
      }));
    }

    root.addEventListener('click', e => {
      const r = e.target.closest('[data-roll]');
      if (r && waiter && waiter.kind === 'roll') { const w = waiter; waiter = null; w.res(); return; }
      const t = e.target.closest('.token.pickable');
      if (t && waiter && waiter.kind === 'pick') { const w = waiter; waiter = null; w.res(+t.dataset.tok.split('-')[1]); }
    });
    const wait = kind => new Promise(res => { waiter = { kind, res }; });

    async function animateMove(pi, ti, from, to) {
      const tk = st.tokens[pi][ti];
      if (from < 0) { tk.pos = 0; layout(); T.sfx('pop'); await T.sleep(260); return; }
      for (let p = from + 1; p <= to; p++) { tk.pos = p; layout(); const e = el(`[data-tok="${pi}-${ti}"]`); if (e) { e.classList.remove('hop'); void e.offsetWidth; e.classList.add('hop'); } T.sfx('step'); await T.sleep(170); }
    }

    async function turn() {
      while (!dead && ctx.alive()) {
        await ctx.waitUnpaused();
        const pi = st.turn;
        if (st.finished.includes(pi)) { nextTurn(); continue; }
        roll = 0; picking = null; dockText = ''; render();
        if (P[pi].bot) await T.sleep(600); else { const b = el('[data-roll]'); if (b) b.focus(); await wait('roll'); }
        if (dead) return;
        rolling = true; const r = 1 + T.rand(6); stats.rolls++;
        const forced = T.qs.get('ludo6'); const rv = forced && st.tokens[pi].every(t => t.pos < 0) ? 6 : r;
        render(); await T.Dice.roll(el('.die3d'), rv); roll = rv; lastShown = rv; rolling = false;
        if (rv === 6) { stats.sixes[pi]++; st.sixes++; } else st.sixes = 0;
        if (st.sixes === 3) { st.sixes = 0; dockText = 'Three 6s in a row — turn lost!'; render(); T.sfx('lose'); await T.sleep(1100); nextTurn(); continue; }
        const opts = L.legal(st, pi, rv);
        if (!opts.length) { dockText = rv === 6 ? 'No moves possible' : `Rolled ${rv} — no moves${st.tokens[pi].every(t => t.pos < 0) ? '. Need a 6 to leave base!' : ''}`; render(); await T.sleep(1000); st.sixes = 0; nextTurn(); continue; }
        let ti;
        if (opts.length === 1 && P[pi].bot) ti = opts[0];
        else if (P[pi].bot) { await T.sleep(350); ti = L.botPick(st, pi, rv); }
        else {
          picking = { pi, opts }; dockText = `Rolled ${rv}! Tap a glowing token`; render();
          const f = el('.token.pickable'); if (f) f.focus();
          ti = await wait('pick'); if (dead) return;
        }
        picking = null; dockText = ''; render();
        const from = st.tokens[pi][ti].pos, to = L.target(st.tokens[pi][ti], rv);
        await animateMove(pi, ti, from, to);
        st.tokens[pi][ti].pos = from; // apply officially
        const res = L.move(st, pi, ti, rv);
        render();
        if (res.captured.length) {
          stats.captures[pi] += res.captured.length;
          T.sfx('capture'); T.haptic([20, 40, 20]);
          await T.callout(`Captured ${res.captured.map(c => P[c.p].name).join(' & ')}!`, COLORS[st.colors[pi]].fill, 1000);
        }
        if (res.finished) { T.sfx('win'); await T.callout('Token home!', COLORS[st.colors[pi]].fill, 800); }
        if (st.finished.includes(pi) && st.finished.length === 1) { T.confetti({ count: 80 }); await T.callout(`${P[pi].name} finishes 1st!`, COLORS[st.colors[pi]].fill, 1300); }
        if (st.finished.length >= n - 1) return finish();
        if (res.extra && !st.finished.includes(pi)) { dockText = rv === 6 ? 'Rolled a 6 — go again!' : 'Bonus roll!'; render(); await T.sleep(500); continue; }
        st.sixes = 0; nextTurn();
      }
    }
    function nextTurn() { st.turn = (st.turn + 1) % n; roll = 0; }

    function finish() {
      const order = st.finished.slice();
      P.forEach((_, i) => { if (!order.includes(i)) order.push(i); });
      const progress = i => st.tokens[i].reduce((a, t) => a + Math.max(0, t.pos + 1), 0);
      const rest = order.slice(st.finished.length).sort((a, b) => progress(b) - progress(a));
      const ranking = st.finished.concat(rest);
      ctx.end({
        headline: `${P[ranking[0]].name} wins Ludo!`, sub: 'All four tokens home first',
        ranking: ranking.map(i => Object.assign({}, P[i], { label: st.tokens[i].filter(t => t.pos === FINISH).length + '/4 home' })),
        stats: [{ value: stats.rolls, label: 'dice rolls' }, { value: stats.captures.reduce((a, b) => a + b, 0), label: 'captures' }, { value: stats.sixes.reduce((a, b) => a + b, 0), label: 'sixes rolled' }, { value: P[stats.captures.indexOf(Math.max(...stats.captures))].name, label: 'top hunter' }],
      });
    }

    render(); turn();
    return { destroy() { dead = true; } };
  }

  T.games.ludo = {
    id: 'ludo', name: 'Ludo', kicker: 'Board game', tagline: 'Roll, race and capture — get all four tokens home.',
    blurb: 'The cross-and-circle race game everyone grew up with. Roll a 6 to leave base, race around the board, knock rivals back to start, and bring all four tokens home.',
    players: [2, 4], minutes: [20, 40], difficulty: 1, bots: true, noise: 'medium', colors: ['#2f7dff', '#1745a6', '#ffc93c'],
    vibes: { chill: 0.8, competitive: 0.85, chaotic: 0.6, strategic: 0.6 },
    vibeWhy: { chill: 'Pure luck plus little choices — very relaxed', competitive: 'Sending someone home never gets old', chaotic: 'Captures cause instant drama', strategic: 'Choose which token to risk every roll' },
    setting: { home: 1, bar: 0.6, backyard: 0.8 }, settingWhy: { home: 'A real board game, no box to set up', bar: 'Fine at the bar', backyard: 'Board can\'t blow away' },
    box: () => `<svg viewBox="0 0 160 110" class="box-svg"><g transform="translate(80 55) rotate(-8)">
      <rect x="-42" y="-42" width="84" height="84" rx="8" fill="#fffaf0"/>
      <rect x="-40" y="-40" width="32" height="32" rx="6" fill="#ef3b4f"/><rect x="8" y="-40" width="32" height="32" rx="6" fill="#22b35e"/><rect x="8" y="8" width="32" height="32" rx="6" fill="#ffc93c"/><rect x="-40" y="8" width="32" height="32" rx="6" fill="#2f7dff"/>
      <polygon points="-8,-8 0,0 -8,8" fill="#ef3b4f"/><polygon points="-8,-8 0,0 8,-8" fill="#22b35e"/><polygon points="8,-8 0,0 8,8" fill="#ffc93c"/><polygon points="-8,8 0,0 8,8" fill="#2f7dff"/>
      ${[[-24, -24], [24, -24], [24, 24], [-24, 24]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#fffaf0"/>`).join('')}</g>
      <g transform="translate(128 78) rotate(14)"><rect x="-14" y="-14" width="28" height="28" rx="6" fill="#fff" stroke="rgba(0,0,0,.2)"/><circle cx="-6" cy="-6" r="3" fill="#1b1b2e"/><circle cx="6" cy="6" r="3" fill="#1b1b2e"/><circle cx="0" cy="0" r="3" fill="#1b1b2e"/><circle cx="6" cy="-6" r="3" fill="#1b1b2e"/><circle cx="-6" cy="6" r="3" fill="#1b1b2e"/></g></svg>`,
    rules: [
      { title: 'Roll a 6 to get out', text: 'Everyone starts with 4 tokens in base. You need a <b>6</b> to move a token onto your colored start square. Rolling a 6 also gives you <b>another roll</b>.', art: () => `<div class="art-dice">${T.Dice.cube(80)}</div>` },
      { title: 'Race & capture', text: 'Move clockwise by your roll. Land on a rival to <b>send them back to base</b> (and roll again). <b>Star squares</b> are safe — no captures there.', art: () => `<div class="art-tokens"><span class="token" style="--lc:#ef3b4f;--ld:#a3162a"><i></i></span><span class="art-pow">💥</span><span class="token" style="--lc:#2f7dff;--ld:#1745a6"><i></i></span></div>` },
      { title: 'Bring everyone home', text: 'After a lap, turn up your colored home column. You need the <b>exact roll</b> to reach the center. First to get all 4 home wins!', art: () => `<div class="art-home"><div class="art-home-col">${[0, 1, 2, 3, 4].map(() => '<i></i>').join('')}<b>★</b></div></div>` },
    ],
    more: '<p>Three 6s in a row forfeits your turn. Tokens of the same color can share a square. With 2 players, Red and Yellow play opposite corners.</p>',
    mount, logic: L,
  };
  T.order.push('ludo');
})();

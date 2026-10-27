/* Crazy Eights — standard 52-card deck, 2–6 players, humans pass-and-play and/or bots. */
(function () {
  'use strict';
  const T = window.Table, C = T.Cards, esc = T.esc;

  /* ---------- pure rules (unit-tested in node) ---------- */
  const L = {
    handSize: n => (n === 2 ? 7 : 5),
    points: c => (c.r === 8 ? 50 : c.r >= 11 ? 10 : c.r === 1 ? 1 : c.r),
    canPlay: (c, top, suit) => c.r === 8 || c.s === suit || c.r === top.r,
    newRound(n, deckIn) {
      const deck = deckIn || T.shuffle(C.deck());
      const hands = Array.from({ length: n }, () => []);
      const k = L.handSize(n);
      for (let r = 0; r < k; r++) for (let p = 0; p < n; p++) hands[p].push(deck.pop());
      // starter can't be an 8: bury it and flip again
      let top = deck.pop();
      while (top.r === 8) { deck.unshift(top); top = deck.pop(); }
      return { deck, hands, discard: [top], suit: top.s, turn: 0, dir: 1, drew: false, winner: -1 };
    },
    playable: (st, p) => st.hands[p].filter(c => L.canPlay(c, st.discard[st.discard.length - 1], st.suit)),
    reshuffle(st) {
      if (st.deck.length || st.discard.length < 2) return false;
      const top = st.discard.pop(); st.deck = T.shuffle(st.discard); st.discard = [top]; return true;
    },
    draw(st, p) {
      if (!st.deck.length) L.reshuffle(st);
      if (!st.deck.length) return null;
      const c = st.deck.pop(); st.hands[p].push(c); return c;
    },
    play(st, p, cardId, suit) {
      const h = st.hands[p], i = h.findIndex(c => c.id === cardId);
      if (i < 0) throw new Error('Card not in hand');
      const c = h[i], top = st.discard[st.discard.length - 1];
      if (!L.canPlay(c, top, st.suit)) throw new Error('Illegal play');
      h.splice(i, 1); st.discard.push(c);
      st.suit = c.r === 8 ? (suit || c.s) : c.s;
      if (!h.length) st.winner = p;
      return c;
    },
    next(st) { st.turn = (st.turn + st.dir + st.hands.length) % st.hands.length; st.drew = false; },
    blocked(st) { return !st.deck.length && st.discard.length < 2; },
    /* bot: keep 8s for last, prefer cards matching our longest suit, dump high cards */
    botChoose(st, p) {
      const opts = L.playable(st, p); if (!opts.length) return null;
      const h = st.hands[p];
      const count = s => h.filter(c => c.s === s && c.r !== 8).length;
      const non8 = opts.filter(c => c.r !== 8);
      let card;
      if (non8.length) card = non8.slice().sort((a, b) => (count(b.s) * 3 + L.points(b) / 4) - (count(a.s) * 3 + L.points(a) / 4))[0];
      else card = opts[0];
      let suit = null;
      if (card.r === 8) {
        suit = ['s', 'h', 'd', 'c'].sort((a, b) => count(b) - count(a))[0];
        if (!h.some(c => c.s === suit && c.r !== 8)) suit = card.s;
      }
      return { card, suit };
    },
    penalty: hand => hand.reduce((a, c) => a + L.points(c), 0),
  };

  /* ---------- UI ---------- */
  function mount(root, ctx) {
    const P = ctx.players, n = P.length;
    const humans = P.filter(p => !p.bot).length;
    const target = ctx.opts.length === 'classic' ? 100 : 0;
    const scores = P.map(() => 0);
    const stats = { cardsPlayed: 0, eights: 0, drawn: 0, rounds: 0 };
    let st, viewer = P.findIndex(p => !p.bot), busy = false, dead = false, roundNo = 0, concealed = false;

    function seatPos(i) {
      // opponents spread across the top arc, relative to bottom viewer
      const others = P.map((_, k) => k).filter(k => k !== viewer);
      return others.indexOf(i);
    }

    function render() {
      if (dead) return;
      const top = st.discard[st.discard.length - 1];
      const others = P.map((p, i) => i).filter(i => i !== viewer);
      const me = P[viewer], meTurn = st.turn === viewer && !P[viewer].bot;
      const playable = meTurn ? new Set(L.playable(st, viewer).map(c => c.id)) : new Set();
      const hand = st.hands[viewer];
      root.innerHTML = `
        <div class="felt c8">
          <div class="felt-glow"></div>
          <header class="g-top">
            ${ctx.menuButton()}
            <div class="g-title"><span class="g-name">Crazy Eights</span><span class="g-sub">${target ? `Round ${roundNo} · first to ${target}` : 'Quick game · 1 round'}</span></div>
            <span class="icon-btn ghost"></span>
          </header>
          <div class="opps n${others.length}">
            ${others.map(i => { const p = P[i], c = st.hands[i].length; return `<div class="opp ${st.turn === i ? 'turn' : ''}" data-seat="${i}" style="--pc:${p.color}">
              <div class="opp-fan" aria-hidden="true">${Array.from({ length: Math.min(c, 9) }, (_, k) => `<span style="--k:${k - (Math.min(c, 9) - 1) / 2}">${C.back('mini')}</span>`).join('')}</div>
              ${T.avatar(p, 46)}<span class="opp-name">${esc(p.name)}</span>
              <span class="opp-count" aria-label="${c} cards">${c}</span>${c === 1 ? '<span class="last-card">LAST CARD</span>' : ''}${target ? `<span class="opp-score">${scores[i]} pts</span>` : ''}</div>`; }).join('')}
          </div>
          <div class="pile-zone">
            <button type="button" class="deck-btn ${meTurn && !st.drew ? 'can' : ''}" data-draw ${meTurn && !st.drew ? '' : 'disabled'} aria-label="Draw a card. ${st.deck.length} left">
              <span class="deck-stack" aria-hidden="true">${[2, 1, 0].map(k => `<span style="--k:${k}">${C.back()}</span>`).join('')}</span>
              <span class="deck-n">${st.deck.length}</span>
            </button>
            <div class="discard" aria-label="Top card ${C.name(top)}">
              ${st.discard.slice(-4).map((c, k, arr) => `<span class="disc-c" style="--r:${((c.id.charCodeAt(0) * 37 + c.id.length * 11) % 24) - 12}deg;--k:${k}">${C.html(c, { label: k === arr.length - 1 ? 'Top card: ' + C.name(c) : C.name(c) })}</span>`).join('')}
            </div>
            <div class="suit-now ${st.suit !== top.s ? 'called' : ''}" aria-label="Suit to match: ${C.SUIT_NAME[st.suit]}">
              ${C.suitSVG(st.suit, 30)}<small>${st.suit !== top.s ? 'Called' : 'Match'}</small></div>
          </div>
          <div class="turn-banner" role="status" aria-live="polite">${concealed ? 'Hands are hidden between players' : st.turn === viewer ? (meTurn ? (st.drew ? 'Play the card you drew — or keep it' : playable.size ? 'Your turn — tap a glowing card' : 'No match. Draw a card!') : '') : `${esc(P[st.turn].name)} is thinking…`}</div>
          <div class="me-zone ${meTurn ? 'active' : ''}" style="--pc:${me.color}">
            <div class="me-tag">${T.avatar(me, 34)}<b>${esc(me.name)}</b><span>${hand.length} card${hand.length === 1 ? '' : 's'}</span>${target ? `<span class="pts">${scores[viewer]} pts</span>` : ''}
              ${meTurn && st.drew ? '<button type="button" class="btn sm secondary" data-keep>Keep it &amp; pass</button>' : ''}</div>
            <div class="hand ${concealed ? 'hidden-hand' : ''}" style="--n:${hand.length}" role="group" aria-label="Your hand">
              ${sortHand(hand).map((c, k) => { const ok = playable.has(c.id); const mid = (hand.length - 1) / 2; return `<span class="hand-slot" style="--k:${k - mid};--a:${Math.abs(k - mid)}">${C.html(c, { tag: 'button', cls: ok ? 'playable' : meTurn ? 'dim' : '', attrs: `data-play-card="${c.id}" ${meTurn && ok ? '' : 'aria-disabled="true"'}`, label: C.name(c) + (ok ? ', playable' : '') })}</span>`; }).join('')}
            </div>
          </div>
        </div>`;
    }
    const sortHand = h => h.slice().sort((a, b) => 'shdc'.indexOf(a.s) - 'shdc'.indexOf(b.s) || a.r - b.r);

    const el = sel => root.querySelector(sel);

    async function deal() {
      roundNo++; stats.rounds++;
      st = L.newRound(n); concealed = humans > 1;
      st.turn = (roundNo - 1) % n;
      render();
      if (T.motion()) {
        // hide hands, then fly backs to each seat
        root.querySelectorAll('.hand-slot,.opp-fan span').forEach(e => { e.style.opacity = 0; });
        const deckEl = el('.deck-btn'); const k = L.handSize(n);
        const flights = [];
        for (let r = 0; r < k; r++) for (let p = 0; p < n; p++) {
          const target = p === viewer ? el('.hand') : el(`.opp[data-seat="${p}"] .ava`);
          if (!target) continue;
          flights.push(T.sleep((r * n + p) * 55).then(() => { T.sfx('deal'); return C.fly(deckEl, target, C.back(), { w: 60, h: 84, dur: 320 }); }));
        }
        await Promise.all(flights);
        root.querySelectorAll('.hand-slot,.opp-fan span').forEach((e, i) => { e.style.opacity = ''; e.style.animationDelay = (i * 25) + 'ms'; e.classList.add('pop-in'); });
        T.sfx('flip');
      }
      await T.callout(`${P[st.turn].name} starts!`, P[st.turn].color, 900);
      loop();
    }

    async function loop() {
      while (!dead && ctx.alive()) {
        await ctx.waitUnpaused();
        if (dead) return;
        if (st.winner >= 0) return roundOver();
        if (L.blocked(st) && P.every((_, i) => !L.playable(st, i).length)) return roundOver(true);
        const p = P[st.turn];
        if (p.bot) { await botTurn(st.turn); continue; }
        // human turn
        if (humans > 1 && (viewer !== st.turn || concealed)) {
          viewer = st.turn; concealed = true; render();
          await T.passTo(p, { sub: 'Hand the phone over. Others, look away!' });
          if (dead) return;
          concealed = false;
        } else if (viewer !== st.turn) viewer = st.turn;
        render();
        await humanTurn();
        if (humans > 1 && st.winner < 0) { concealed = true; render(); }
      }
    }

    let resolveHuman = null;
    function humanTurn() {
      return new Promise(res => { resolveHuman = res; });
    }
    root.addEventListener('click', async e => {
      if (!resolveHuman || busy) return;
      const cardBtn = e.target.closest('[data-play-card]');
      if (cardBtn) {
        const c = st.hands[viewer].find(x => x.id === cardBtn.dataset.playCard);
        const top = st.discard[st.discard.length - 1];
        if (!c) return;
        if (!L.canPlay(c, top, st.suit)) { T.sfx('buzz'); cardBtn.classList.remove('shake'); void cardBtn.offsetWidth; cardBtn.classList.add('shake'); T.announce(`Can't play ${C.name(c)}. Match ${C.SUIT_NAME[st.suit]} or ${C.label(top)}.`); return; }
        if (st.drew && st.drawnId && c.id !== st.drawnId) { T.toast('After drawing you can only play the card you drew'); return; }
        busy = true;
        let suit = null;
        if (c.r === 8) { suit = await suitPicker(); if (!suit) { busy = false; return; } }
        await animatePlay(cardBtn, c);
        doPlay(viewer, c, suit);
        busy = false; finishHuman();
        return;
      }
      if (e.target.closest('[data-draw]') && !st.drew) {
        busy = true;
        const c = L.draw(st, viewer); stats.drawn++;
        if (!c) { T.toast('No cards left to draw — pass'); busy = false; L.next(st); finishHuman(); return; }
        await C.fly(el('.deck-btn'), el('.hand'), C.html(c, { down: true }), { w: 70, h: 98, flipTo: true, dur: 420 });
        T.sfx('deal');
        const playableNow = L.canPlay(c, st.discard[st.discard.length - 1], st.suit);
        if (playableNow) { st.drew = true; st.drawnId = c.id; render(); const b = root.querySelector(`[data-play-card="${c.id}"]`); if (b) { b.classList.add('just-drawn'); b.focus(); } }
        else { render(); const b = root.querySelector(`[data-play-card="${c.id}"]`); if (b) b.classList.add('just-drawn'); T.announce(`You drew ${C.name(c)}. No match, turn passes.`); await T.sleep(700); L.next(st); finishHuman(); }
        busy = false;
        return;
      }
      if (e.target.closest('[data-keep]')) { T.sfx('pass'); L.next(st); finishHuman(); }
    });
    function finishHuman() { st.drawnId = null; const r = resolveHuman; resolveHuman = null; render(); if (r) r(); }

    function suitPicker() {
      T.sfx('pop');
      return T.modal({
        title: 'Crazy eight! Pick a suit', cls: 'suit-pick', dismiss: true,
        body: `<div class="suit-grid">${['h', 's', 'd', 'c'].map(s => `<button type="button" class="suit-btn ${C.red(s) ? 'red' : ''}" data-value="${s}" aria-label="${C.SUIT_NAME[s]}">${C.suitSVG(s, 54)}<span>${C.SUIT_NAME[s]}</span></button>`).join('')}</div>`,
        actions: [{ label: 'Cancel', value: null }],
      });
    }

    async function animatePlay(fromEl, c) {
      const d = el('.discard');
      fromEl.style.visibility = 'hidden';
      await C.fly(fromEl, d, C.html(c), { w: 76, h: 106, dur: 360, rot: (Math.random() * 20 - 10) });
    }
    function doPlay(pi, c, suit) {
      L.play(st, pi, c.id, suit); stats.cardsPlayed++;
      T.sfx('play'); T.haptic();
      if (c.r === 8) { stats.eights++; T.callout(`Crazy 8! ${C.SUIT_CHAR[st.suit]} ${C.SUIT_NAME[st.suit]}`, C.red(st.suit) ? '#ff4d6d' : '#4cc9f0', 1000); }
      else if (st.hands[pi].length === 1) T.callout(`${P[pi].name}: last card!`, '#ffd23f', 900);
      if (st.winner < 0) L.next(st);
      render();
    }

    async function botTurn(i) {
      render();
      await T.sleep(650 + Math.random() * 500);
      if (dead) return;
      await ctx.waitUnpaused();
      let ch = L.botChoose(st, i);
      if (!ch) {
        const c = L.draw(st, i); stats.drawn++;
        if (c) { T.sfx('deal'); await C.fly(el('.deck-btn'), el(`.opp[data-seat="${i}"] .ava`) || el('.hand'), C.back(), { w: 50, h: 70, dur: 320 }); render(); await T.sleep(350); }
        ch = c && L.canPlay(c, st.discard[st.discard.length - 1], st.suit) ? L.botChoose(st, i) : null;
        if (ch && ch.card.id !== c.id) ch = { card: c, suit: c.r === 8 ? L.botChoose(st, i).suit || c.s : null };
        if (!ch) { T.announce(P[i].name + ' passes'); L.next(st); render(); return; }
      }
      const src = el(`.opp[data-seat="${i}"] .ava`) || el('.hand');
      await C.fly(src, el('.discard'), C.html(ch.card, { down: true }), { w: 76, h: 106, flipTo: true, dur: 420, rot: Math.random() * 20 - 10 });
      doPlay(i, ch.card, ch.suit);
      T.announce(`${P[i].name} played ${C.name(ch.card)}`);
    }

    async function roundOver(blocked) {
      let w = st.winner;
      const pens = st.hands.map(L.penalty);
      if (blocked) w = pens.indexOf(Math.min(...pens));
      const gain = pens.reduce((a, v, k) => a + (k === w ? 0 : v), 0);
      scores[w] += gain;
      T.sfx('win');
      await T.callout(blocked ? 'Deck blocked!' : `${P[w].name} goes out!`, P[w].color, 1300);
      if (dead) return;
      if (target && scores[w] < target) {
        await T.modal({
          title: `Round ${roundNo}: ${P[w].name} +${gain}`, dismiss: false,
          body: `<div class="score-table">${P.map((p, k) => `<div class="st-row ${k === w ? 'win' : ''}">${T.avatar(p, 30)}<b>${esc(p.name)}</b><small>${k === w ? 'went out' : `${st.hands[k].length} left · ${pens[k]} pts`}</small><span>${scores[k]}</span></div>`).join('')}</div><p class="center hint">First to ${target} wins. Points come from cards left in other hands (8 = 50, faces = 10).</p>`,
          actions: [{ label: 'Next round', kind: 'primary', value: 1 }],
        });
        if (!dead) deal();
        return;
      }
      const order = P.map((p, k) => k).sort((a, b) => target ? scores[b] - scores[a] : (a === w ? -1 : b === w ? 1 : st.hands[a].length - st.hands[b].length || pens[a] - pens[b]));
      ctx.end({
        headline: `${P[w].name} wins!`, sub: target ? `First to ${target} points` : (blocked ? 'Lowest hand when the deck ran dry' : 'First to empty their hand'),
        ranking: order.map(k => Object.assign({}, P[k], { label: target ? scores[k] + ' pts' : k === w ? '0 cards' : st.hands[k].length + ' card' + (st.hands[k].length === 1 ? '' : 's') })),
        stats: [{ value: stats.cardsPlayed, label: 'cards played' }, { value: stats.eights, label: 'crazy eights' }, { value: stats.drawn, label: 'cards drawn' }, { value: target ? stats.rounds : gain, label: target ? 'rounds' : 'points scored' }],
      });
    }

    deal();
    return { destroy() { dead = true; } };
  }

  /* ---------- box art + rules art ---------- */
  const fanArt = () => `<div class="art-fan">${[{ r: 8, s: 'h' }, { r: 8, s: 's' }, { r: 8, s: 'd' }, { r: 8, s: 'c' }].map((c, i) => `<span style="--k:${i - 1.5}">${C.html(c)}</span>`).join('')}</div>`;
  T.games.crazy8 = {
    id: 'crazy8', name: 'Crazy Eights', kicker: 'Card game', tagline: 'Match suit or number. 8s are wild. Empty your hand first.',
    blurb: 'The classic shedding card game that inspired the color-card craze. Match the top card by suit or rank, slam down wild 8s to switch suits, and be first to go out.',
    players: [2, 6], minutes: [10, 20], difficulty: 1, bots: true, noise: 'medium', colors: ['#ff4d6d', '#c9184a', '#ffd23f'],
    vibes: { chill: 0.9, competitive: 0.8, chaotic: 0.6, strategic: 0.5 },
    vibeWhy: { chill: 'Easy to learn, easy to chat over', competitive: 'Keeps score across rounds', chaotic: 'Wild 8s flip the game fast', strategic: 'Save your 8s for the right moment' },
    setting: { home: 1, bar: 0.9, backyard: 0.7 }, settingWhy: { home: 'Perfect at the kitchen table', bar: 'One phone, no deck to lose at the bar', backyard: 'No cards blowing away in the wind' },
    options: [{ key: 'length', label: 'Game length', def: 'quick', choices: [['quick', 'Quick · 1 round'], ['classic', 'Classic · to 100']] }],
    box: () => `<svg viewBox="0 0 160 110" class="box-svg"><g transform="translate(80 62)">
        ${[-26, -9, 9, 26].map((a, i) => `<g transform="rotate(${a}) translate(0 -8)"><rect x="-22" y="-34" width="44" height="62" rx="5" fill="#fff" stroke="rgba(0,0,0,.15)"/><text x="-15" y="-19" font-size="13" font-weight="900" font-family="Inter,Arial" fill="${i % 2 ? '#17172b' : '#e0193a'}">8</text><use href="#su-${'hsdc'[i]}" x="-10" y="-8" width="20" height="20" fill="${i % 2 ? '#17172b' : '#e0193a'}"/></g>`).join('')}
      </g></svg>`,
    rules: [
      { title: 'Match the top card', text: 'On your turn, play one card that matches the top card by <b>suit</b> or <b>number</b>. A 7 of hearts can take any heart — or any 7.', art: () => `<div class="art-match"><span class="am-top">${C.html({ r: 7, s: 'h' })}</span><span class="am-arrow">→</span><span class="am-ok">${C.html({ r: 7, s: 'c' })}<i>✓</i></span><span class="am-ok">${C.html({ r: 12, s: 'h' })}<i>✓</i></span></div>` },
      { title: 'Eights are wild', text: 'Play an <b>8</b> on anything, then <b>call a new suit</b>. Save them — they get you out of jams.', art: fanArt },
      { title: 'Stuck? Draw one', text: 'No match? Tap the deck to draw. If it fits you may play it; if not, your turn ends. <b>First to empty their hand wins</b> and scores the cards left in everyone else\'s.', art: () => `<div class="art-draw">${C.back('big')}<span class="ad-c">${C.html({ r: 1, s: 's' })}</span></div>` },
    ],
    more: '<p><b>Scoring (Classic):</b> 8 = 50, K/Q/J = 10, Ace = 1, others face value. First to 100 wins. With 2 players each gets 7 cards; with 3+ players, 5.</p>',
    mount, logic: L,
  };
  T.order.push('crazy8');
})();

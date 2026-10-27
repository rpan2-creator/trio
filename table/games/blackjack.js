/* Blackjack — up to 5 seats vs the dealer. 6-deck shoe, dealer stands on soft 17,
   blackjack pays 3:2, double on any two cards, split once per hand (split aces get one card). */
(function () {
  'use strict';
  const T = window.Table, C = T.Cards, esc = T.esc, Chips = T.Chips;

  const L = {
    value(cards) {
      let total = 0, aces = 0;
      cards.forEach(c => { if (c.r === 1) { aces++; total += 11; } else total += Math.min(10, c.r); });
      while (total > 21 && aces) { total -= 10; aces--; }
      return { total, soft: aces > 0 };
    },
    isBJ: cards => cards.length === 2 && L.value(cards).total === 21,
    shoe(decks) { let s = []; for (let i = 0; i < decks; i++) s = s.concat(C.deck().map(c => Object.assign({}, c, { id: c.id + '-' + i }))); return T.shuffle(s); },
    dealerHits: cards => { const v = L.value(cards); return v.total < 17; }, // stands on all 17s incl. soft 17
    canSplit: (h, bank) => h.cards.length === 2 && Math.min(10, h.cards[0].r) === Math.min(10, h.cards[1].r) && !h.split && bank >= h.bet,
    canDouble: (h, bank) => h.cards.length === 2 && bank >= h.bet && !h.splitAces,
    settle(h, dealer) {
      const pv = L.value(h.cards).total, dv = L.value(dealer).total;
      const pbj = L.isBJ(h.cards) && !h.split, dbj = L.isBJ(dealer);
      if (pv > 21) return { res: 'bust', pay: 0 };
      if (pbj && !dbj) return { res: 'blackjack', pay: h.bet + Math.floor(h.bet * 1.5) };
      if (dbj && !pbj) return { res: 'lose', pay: 0 };
      if (pbj && dbj) return { res: 'push', pay: h.bet };
      if (dv > 21 || pv > dv) return { res: 'win', pay: h.bet * 2 };
      if (pv === dv) return { res: 'push', pay: h.bet };
      return { res: 'lose', pay: 0 };
    },
    /* basic-strategy-lite for bots */
    botMove(h, up, bank) {
      const v = L.value(h.cards), d = Math.min(10, up.r) === 1 ? 11 : Math.min(10, up.r);
      if (L.canSplit(h, bank) && (h.cards[0].r === 1 || h.cards[0].r === 8)) return 'split';
      if (L.canDouble(h, bank) && !v.soft && (v.total === 11 || (v.total === 10 && d < 10))) return 'double';
      if (v.soft) return v.total >= 19 || (v.total === 18 && d < 9) ? 'stand' : 'hit';
      if (v.total >= 17) return 'stand';
      if (v.total >= 13 && d <= 6) return 'stand';
      if (v.total === 12 && d >= 4 && d <= 6) return 'stand';
      return 'hit';
    },
  };

  function mount(root, ctx) {
    const P = ctx.players.slice(0, 5);
    const startBank = 1000, rounds = ctx.opts.rounds || 5;
    const bank = P.map(() => startBank);
    const stats = { hands: 0, blackjacks: 0, busts: 0, biggest: 0 };
    let shoe = L.shoe(6), dealer = [], seats = [], round = 0, dead = false, holeUp = false, phase = 'bet', active = -1, activeHand = 0, msg = '';
    const draw = () => { if (shoe.length < 60) { shoe = L.shoe(6); T.toast('Shuffling a fresh shoe'); } return shoe.pop(); };
    const el = s => root.querySelector(s);
    const lastBet = P.map(() => 50);

    function handHTML(h, si, hi) {
      const v = L.value(h.cards);
      const isActive = phase === 'play' && active === si && activeHand === hi;
      return `<div class="bj-hand ${isActive ? 'active' : ''} ${h.result ? 'res-' + h.result : ''}" data-hand="${si}-${hi}">
        <div class="bj-cards">${h.cards.map((c, k) => `<span class="bj-c" style="--k:${k}">${C.html(c)}</span>`).join('')}</div>
        ${h.cards.length ? `<span class="bj-total ${v.total > 21 ? 'bust' : v.total === 21 ? 'tw' : ''}">${v.soft && v.total < 21 ? (v.total - 10) + '/' : ''}${v.total}</span>` : ''}
        ${h.result ? `<span class="bj-res">${{ win: 'WIN', lose: 'LOSE', push: 'PUSH', bust: 'BUST', blackjack: 'BLACKJACK' }[h.result]}</span>` : ''}
        <div class="bj-bet">${Chips.stack(h.bet)}<small>${h.bet ? '$' + h.bet : ''}</small></div></div>`;
    }

    function render() {
      if (dead) return;
      const dv = L.value(holeUp ? dealer : dealer.slice(0, 1));
      const curP = active >= 0 ? P[active] : null;
      const h = curP ? seats[active].hands[activeHand] : null;
      root.innerHTML = `
        <div class="felt bj">
          <header class="g-top">${ctx.menuButton()}<div class="g-title"><span class="g-name">Blackjack</span><span class="g-sub">Hand ${Math.max(1, round)} of ${rounds}</span></div><div class="shoe" aria-label="Card shoe">${C.back('mini')}</div></header>
          <div class="dealer">
            <div class="dealer-tag"><span class="dealer-ava" aria-hidden="true">🎩</span><b>Dealer</b>${dealer.length ? `<span class="bj-total d">${holeUp ? dv.total : dv.total + ' + ?'}</span>` : ''}</div>
            <div class="bj-cards dealer-cards">${dealer.map((c, k) => `<span class="bj-c" style="--k:${k}">${C.html(c, { down: k === 1 && !holeUp })}</span>`).join('')}</div>
          </div>
          <div class="bj-msg" role="status" aria-live="polite">${msg}</div>
          <div class="bj-arc" aria-hidden="true"><svg viewBox="0 0 400 100"><path id="arcp" d="M30 10 Q200 110 370 10" fill="none"/><path id="arcp2" d="M84 50 Q200 128 316 50" fill="none"/>
            <path d="M30 10 Q200 110 370 10" fill="none" stroke="rgba(255,230,160,.25)" stroke-width="1.5" transform="translate(0 14)"/>
            <text font-size="14" font-weight="900" letter-spacing="3" fill="rgba(255,230,160,.6)" font-family="Inter,Arial"><textPath href="#arcp" startOffset="50%" text-anchor="middle">BLACKJACK PAYS 3 TO 2</textPath></text>
            <text font-size="9.5" font-weight="700" letter-spacing="2.5" fill="rgba(255,230,160,.45)" font-family="Inter,Arial"><textPath href="#arcp2" startOffset="50%" text-anchor="middle">DEALER STANDS ON ALL 17s</textPath></text></svg></div>
          <div class="seats n${P.length}">
            ${P.map((p, i) => `<div class="seat ${active === i ? 'turn' : ''} ${phase === 'bet' && betting === i ? 'turn' : ''}" style="--pc:${p.color}" data-seat="${i}">
              <div class="seat-hands">${(seats[i] ? seats[i].hands : [{ cards: [], bet: 0 }]).map((h2, hi) => handHTML(h2, i, hi)).join('')}</div>
              <div class="seat-tag">${T.avatar(p, 30)}<span><b>${esc(p.name)}</b><small class="bank">$${bank[i]}</small></span></div>
            </div>`).join('')}
          </div>
          <div class="bj-controls">${controls(h)}</div>
        </div>`;
    }
    let betting = -1, betAmt = 50;
    function controls(h) {
      if (phase === 'bet' && betting >= 0 && !P[betting].bot) {
        const p = P[betting];
        return `<div class="bet-panel"><div class="bet-who">${T.avatar(p, 28)} <b>${esc(p.name)}</b>, place your bet <span class="bet-amt">$${betAmt}</span></div>
          <div class="chip-tray">${[5, 25, 100, 500].map(v => `<button type="button" class="chip-btn" data-chip="${v}" ${bank[betting] < betAmt + v ? 'disabled' : ''} aria-label="Add ${v}">${Chips.chip(v)}</button>`).join('')}</div>
          <div class="ctrl-row"><button type="button" class="btn ghost sm" data-clear>Clear</button><button type="button" class="btn primary grow" data-deal ${betAmt < 5 ? 'disabled' : ''}>Bet $${betAmt}</button></div></div>`;
      }
      if (phase === 'play' && h && !P[active].bot && !h.splitAces && L.value(h.cards).total < 21 && h.cards.length >= 2) {
        const b = bank[active];
        return `<div class="act-row">
          <button type="button" class="act hit" data-act="hit"><b>Hit</b><small>Take a card</small></button>
          <button type="button" class="act stand" data-act="stand"><b>Stand</b><small>Keep it</small></button>
          <button type="button" class="act dbl" data-act="double" ${L.canDouble(h, b) ? '' : 'disabled'}><b>Double</b><small>2× bet, 1 card</small></button>
          <button type="button" class="act split" data-act="split" ${L.canSplit(h, b) ? '' : 'disabled'}><b>Split</b><small>Two hands</small></button></div>`;
      }
      return '<div class="ctrl-wait"></div>';
    }

    async function dealCardTo(target, c, down) {
      T.sfx('deal');
      await C.fly(el('.shoe'), target, C.html(c, { down: true }), { w: 58, h: 81, dur: 330, flipTo: !down });
    }

    let waiter = null;
    const waitInput = () => new Promise(r => { waiter = r; });
    root.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !waiter) return;
      if (b.dataset.chip) { const v = +b.dataset.chip; if (bank[betting] >= betAmt + v) { betAmt += v; T.sfx('chip'); render(); } return; }
      if ('clear' in b.dataset) { betAmt = 0; T.sfx('tap'); render(); return; }
      if ('deal' in b.dataset) { const w = waiter; waiter = null; w('bet'); return; }
      if (b.dataset.act && !b.disabled) { const w = waiter; waiter = null; w(b.dataset.act); }
    });

    async function playRound() {
      round++; stats.hands++;
      dealer = []; holeUp = false; seats = P.map(() => ({ hands: [] })); active = -1;
      phase = 'bet';
      for (let i = 0; i < P.length; i++) {
        if (bank[i] < 5) { seats[i].out = true; continue; }
        betting = i;
        if (P[i].bot) {
          const amt = Math.max(5, Math.min(bank[i], [25, 50, 50, 100, 25][T.rand(5)]));
          msg = `${esc(P[i].name)} bets $${amt}`; seats[i].hands = [{ cards: [], bet: amt }]; bank[i] -= amt;
          render(); T.sfx('chips'); await T.sleep(500);
        } else {
          betAmt = Math.min(lastBet[i], bank[i]); msg = 'Place your bets';
          render(); const bb = el('[data-deal]'); if (bb) bb.focus();
          await waitInput(); if (dead) return;
          lastBet[i] = betAmt; seats[i].hands = [{ cards: [], bet: betAmt }]; bank[i] -= betAmt; T.sfx('chips');
        }
        await ctx.waitUnpaused();
      }
      betting = -1; phase = 'deal'; msg = ''; render();
      // deal two rounds
      for (let r = 0; r < 2; r++) {
        for (let i = 0; i < P.length; i++) {
          if (seats[i].out) continue;
          const c = draw(); await dealCardTo(el(`[data-hand="${i}-0"] .bj-cards`), c);
          seats[i].hands[0].cards.push(c); render();
        }
        const c = draw(); await dealCardTo(el('.dealer-cards'), c, r === 1);
        dealer.push(c); render();
      }
      // dealer peek for blackjack when showing ace or ten
      const up = dealer[0];
      if ((up.r === 1 || up.r >= 10) && L.isBJ(dealer)) {
        msg = 'Dealer checks…'; render(); await T.sleep(700);
        holeUp = true; T.sfx('flip'); render();
        await T.callout('Dealer blackjack!', '#ff4d6d', 1100);
        return settle();
      }
      phase = 'play';
      for (let i = 0; i < P.length; i++) {
        if (seats[i].out) continue;
        active = i;
        for (activeHand = 0; activeHand < seats[i].hands.length; activeHand++) {
          await playHand(i, activeHand); if (dead) return;
        }
      }
      active = -1;
      // dealer
      phase = 'dealer'; holeUp = true; T.sfx('flip'); msg = 'Dealer reveals'; render(); await T.sleep(600);
      const anyLive = seats.some(s => !s.out && s.hands.some(h => L.value(h.cards).total <= 21 && !(L.isBJ(h.cards) && !h.split)));
      while (anyLive && L.dealerHits(dealer)) {
        await ctx.waitUnpaused();
        const c = draw(); await dealCardTo(el('.dealer-cards'), c); dealer.push(c);
        msg = 'Dealer hits'; render(); await T.sleep(450);
      }
      const dv = L.value(dealer).total;
      if (dv > 21) { msg = 'Dealer busts!'; render(); await T.callout('Dealer busts!', '#3ddc97', 1000); }
      else { msg = `Dealer stands on ${dv}`; render(); }
      await T.sleep(400);
      return settle();
    }

    async function playHand(i, hi) {
      const h = seats[i].hands[hi];
      if (h.cards.length === 1) { const c = draw(); await dealCardTo(el(`[data-hand="${i}-${hi}"] .bj-cards`), c); h.cards.push(c); }
      if (L.isBJ(h.cards) && !h.split) { stats.blackjacks++; render(); T.sfx('win'); await T.callout(`${P[i].name}: Blackjack!`, '#ffd23f', 1000); return; }
      if (h.splitAces) { render(); await T.sleep(400); return; }
      while (!dead) {
        const v = L.value(h.cards).total;
        if (v >= 21) { if (v > 21) { stats.busts++; T.sfx('lose'); msg = `${esc(P[i].name)} busts with ${v}`; render(); await T.sleep(700); } return; }
        msg = P[i].bot ? `${esc(P[i].name)} is thinking…` : `${esc(P[i].name)}: ${v}${L.value(h.cards).soft ? ' (soft)' : ''} vs dealer ${Math.min(10, dealer[0].r) === 1 ? 'A' : C.label(dealer[0])}`;
        render();
        let move;
        if (P[i].bot) { await T.sleep(750); await ctx.waitUnpaused(); move = L.botMove(h, dealer[0], bank[i]); }
        else { const f = el('[data-act="hit"]'); if (f) f.focus(); move = await waitInput(); }
        if (dead) return;
        if (move === 'stand') { T.sfx('tap'); return; }
        if (move === 'hit') { const c = draw(); await dealCardTo(el(`[data-hand="${i}-${hi}"] .bj-cards`), c); h.cards.push(c); continue; }
        if (move === 'double' && L.canDouble(h, bank[i])) {
          bank[i] -= h.bet; h.bet *= 2; T.sfx('chips'); render();
          const c = draw(); await dealCardTo(el(`[data-hand="${i}-${hi}"] .bj-cards`), c); h.cards.push(c); render();
          const v2 = L.value(h.cards).total; if (v2 > 21) { stats.busts++; T.sfx('lose'); }
          await T.sleep(500); return;
        }
        if (move === 'split' && L.canSplit(h, bank[i])) {
          bank[i] -= h.bet; T.sfx('chips');
          const aces = h.cards[0].r === 1;
          const h2 = { cards: [h.cards.pop()], bet: h.bet, split: true, splitAces: aces };
          h.split = true; h.splitAces = aces;
          seats[i].hands.splice(hi + 1, 0, h2); render();
          const c = draw(); await dealCardTo(el(`[data-hand="${i}-${hi}"] .bj-cards`), c); h.cards.push(c); render();
          if (aces) { await T.sleep(400); return; }
          continue;
        }
      }
    }

    async function settle() {
      phase = 'settle';
      let anyWin = false;
      seats.forEach((s, i) => {
        if (s.out) return;
        s.hands.forEach(h => {
          const r = L.settle(h, dealer); h.result = r.res; bank[i] += r.pay;
          const net = r.pay - h.bet; if (net > stats.biggest) stats.biggest = net;
          if (net > 0 && !P[i].bot) anyWin = true;
        });
      });
      msg = 'Payouts'; render(); T.sfx(anyWin ? 'chips' : 'tap');
      if (anyWin) T.confetti({ count: 60, y: 0.6 });
      await T.sleep(1700);
      if (dead) return;
      const alive = bank.some(b => b >= 5);
      if (round >= rounds || !alive) return finish();
      await ctx.waitUnpaused();
      playRound();
    }

    function finish() {
      const order = P.map((_, i) => i).sort((a, b) => bank[b] - bank[a]);
      const w = order[0];
      ctx.end({
        headline: bank[w] > startBank ? `${P[w].name} beat the house!` : 'The house wins tonight',
        sub: `${rounds} hands · everyone started with $${startBank}`,
        ranking: order.map(i => Object.assign({}, P[i], { label: bank[i] === startBank ? 'Even' : (bank[i] > startBank ? '+' : '−') + '$' + Math.abs(bank[i] - startBank) })),
        stats: [{ value: stats.hands, label: 'hands dealt' }, { value: stats.blackjacks, label: 'blackjacks' }, { value: stats.busts, label: 'busts' }, { value: '$' + stats.biggest, label: 'biggest win' }],
      });
    }

    render(); playRound();
    return { destroy() { dead = true; if (waiter) waiter('stand'); } };
  }

  T.games.blackjack = {
    id: 'blackjack', name: 'Blackjack', kicker: 'Casino night', tagline: 'Beat the dealer to 21 without going bust.',
    blurb: 'Casino night at home. Everyone gets $1,000 in chips and plays against the dealer: hit, stand, double down or split. Most chips after the last hand wins.',
    players: [1, 5], minutes: [10, 25], difficulty: 1, bots: true, noise: 'low', colors: ['#2a9d8f', '#0b5d4e', '#ffd23f'],
    vibes: { chill: 0.8, competitive: 0.7, chaotic: 0.4, strategic: 0.85 },
    vibeWhy: { chill: 'Low-key — everyone plays the dealer, not each other', competitive: 'Biggest stack at the end wins', chaotic: 'Big bets, big swings', strategic: 'Real odds: double, split, know when to stand' },
    setting: { home: 0.9, bar: 1, backyard: 0.7 }, settingWhy: { home: 'Casino night without the casino', bar: 'Perfect bar-top game, no real money', backyard: 'Deal it on the patio table' },
    options: [{ key: 'rounds', label: 'Hands', def: 5, choices: [[3, '3'], [5, '5'], [10, '10']] }],
    box: () => `<svg viewBox="0 0 160 110" class="box-svg"><g transform="translate(62 58) rotate(-12)"><rect x="-24" y="-34" width="48" height="68" rx="5" fill="#fff"/><text x="-17" y="-18" font-size="14" font-weight="900" font-family="Inter,Arial" fill="#17172b">A</text><use href="#su-s" x="-13" y="-10" width="26" height="26" fill="#17172b"/></g>
      <g transform="translate(96 56) rotate(10)"><rect x="-24" y="-34" width="48" height="68" rx="5" fill="#fff"/><text x="-17" y="-18" font-size="14" font-weight="900" font-family="Inter,Arial" fill="#e0193a">K</text><use href="#su-h" x="-13" y="-10" width="26" height="26" fill="#e0193a"/></g>
      ${[0, 1, 2, 3].map(i => `<g transform="translate(130 ${92 - i * 5})"><ellipse rx="16" ry="6" fill="#b5172f"/><ellipse rx="16" ry="6" cy="-2" fill="#e63946" stroke="#fff" stroke-width="2" stroke-dasharray="4 4"/></g>`).join('')}
      <text x="80" y="104" text-anchor="middle" font-size="15" font-weight="900" font-family="Inter,Arial" fill="#ffd23f" opacity=".95">21</text></svg>`,
    rules: [
      { title: 'Get closer to 21', text: 'Number cards count their value, faces count <b>10</b>, aces count <b>1 or 11</b>. Beat the dealer\'s total without going over 21.', art: () => `<div class="art-bj">${C.html({ r: 1, s: 's' })}${C.html({ r: 13, s: 'h' })}<span class="art-21">21</span></div>` },
      { title: 'Hit, stand, double, split', text: '<b>Hit</b> for another card, <b>Stand</b> to stop. <b>Double</b> your bet for exactly one more card, or <b>Split</b> a pair into two hands.', art: () => `<div class="art-btns"><span class="act hit"><b>Hit</b></span><span class="act stand"><b>Stand</b></span><span class="act dbl"><b>Double</b></span><span class="act split"><b>Split</b></span></div>` },
      { title: 'The dealer plays last', text: 'Dealer hits until 17 and stands on all 17s. Wins pay 1:1, <b>Blackjack pays 3:2</b>. Biggest stack after the last hand wins.', art: () => `<div class="art-chips">${Chips.stack(650)}${Chips.stack(130)}${Chips.stack(35)}</div>` },
    ],
    more: '<p>Six-deck shoe. Dealer peeks for blackjack with an ace or ten showing. Split once per hand; split aces get one card each. No insurance or surrender.</p>',
    mount, logic: L,
  };
  T.order.push('blackjack');
})();

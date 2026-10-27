/* Virtual playing cards: full 52-card deck drawn as SVG (pips, court cards, aces),
   card backs, flight/flip animation helpers. */
(function () {
  'use strict';
  const T = window.Table;
  const SUITS = ['s', 'h', 'd', 'c'];
  const SUIT_NAME = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
  const SUIT_CHAR = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const RANK_LABEL = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  const RANK_NAME = { 1: 'ace', 11: 'jack', 12: 'queen', 13: 'king' };
  const red = s => s === 'h' || s === 'd';

  /* suit shapes on a 100x100 box */
  const SUIT_PATH = {
    h: '<path d="M50 92C22 68 4 52 4 31 4 16 15 5 29 5c9 0 17 5 21 13 4-8 12-13 21-13 14 0 25 11 25 26 0 21-18 37-46 61z"/>',
    d: '<path d="M50 3 86 50 50 97 14 50z"/>',
    s: '<path d="M50 3C40 22 6 38 6 61c0 14 10 23 23 23 8 0 14-4 18-10-1 10-5 16-13 23h32c-8-7-12-13-13-23 4 6 10 10 18 10 13 0 23-9 23-23C94 38 60 22 50 3z"/>',
    c: '<circle cx="50" cy="27" r="20"/><circle cx="27" cy="58" r="20"/><circle cx="73" cy="58" r="20"/><circle cx="50" cy="50" r="12"/><path d="M45 55c0 20-4 31-13 42h36c-9-11-13-22-13-42z"/>',
  };

  function sprite() {
    if (document.getElementById('card-sprite')) return;
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML = `<svg id="card-sprite" xmlns="http://www.w3.org/2000/svg"><defs>
      ${SUITS.map(s => `<symbol id="su-${s}" viewBox="0 0 100 100">${SUIT_PATH[s]}</symbol>`).join('')}
      <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9a3"/><stop offset=".5" stop-color="#e2b13c"/><stop offset="1" stop-color="#a87414"/></linearGradient>
      <linearGradient id="robeR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5468"/><stop offset="1" stop-color="#b3122d"/></linearGradient>
      <linearGradient id="robeB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b5bd6"/><stop offset="1" stop-color="#1c2470"/></linearGradient>
      <pattern id="diamondsPat" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M4 0 8 4 4 8 0 4z" fill="rgba(255,255,255,.18)"/></pattern>
    </defs></svg>`;
    document.body.appendChild(d);
  }

  const deck = () => { const out = []; SUITS.forEach(s => { for (let r = 1; r <= 13; r++) out.push({ r, s, id: r + s }); }); return out; };
  const label = c => RANK_LABEL[c.r] || String(c.r);
  const name = c => (RANK_NAME[c.r] || String(c.r)) + ' of ' + SUIT_NAME[c.s];

  /* pip layouts on the 100x140 face (x,y, flipped) */
  const COLS = [30, 50, 70];
  const PIPS = {
    2: [[50, 28], [50, 112, 1]],
    3: [[50, 28], [50, 70], [50, 112, 1]],
    4: [[31, 28], [69, 28], [31, 112, 1], [69, 112, 1]],
    5: [[31, 28], [69, 28], [50, 70], [31, 112, 1], [69, 112, 1]],
    6: [[31, 28], [69, 28], [31, 70], [69, 70], [31, 112, 1], [69, 112, 1]],
    7: [[31, 28], [69, 28], [50, 49], [31, 70], [69, 70], [31, 112, 1], [69, 112, 1]],
    8: [[31, 28], [69, 28], [50, 49], [31, 70], [69, 70], [50, 91, 1], [31, 112, 1], [69, 112, 1]],
    9: [[31, 26], [69, 26], [31, 55], [69, 55], [50, 70], [31, 85, 1], [69, 85, 1], [31, 114, 1], [69, 114, 1]],
    10: [[31, 26], [69, 26], [50, 41], [31, 55], [69, 55], [31, 85, 1], [69, 85, 1], [50, 99, 1], [31, 114, 1], [69, 114, 1]],
  };
  void COLS;

  function pip(s, x, y, size, flip) {
    const h = size / 2;
    return `<use href="#su-${s}" x="${x - h}" y="${y - h}" width="${size}" height="${size}"${flip ? ` transform="rotate(180 ${x} ${y})"` : ''}/>`;
  }

  function court(c) {
    const isRed = red(c.s), robe = isRed ? 'url(#robeR)' : 'url(#robeB)', trim = isRed ? '#1c2470' : '#c8102e';
    const skin = '#ffd7b0', hair = c.r === 12 ? '#f3c04a' : c.r === 11 ? '#7a4520' : '#e9e9e9';
    let head;
    if (c.r === 13) head = `<path d="M37 31l4-12 5 8 4-11 4 11 5-8 4 12z" fill="url(#gold)" stroke="#7a5200" stroke-width=".8"/><circle cx="50" cy="16" r="1.8" fill="${trim}"/>`;
    else if (c.r === 12) head = `<path d="M39 30c2-6 5-9 11-10 6 1 9 4 11 10z" fill="url(#gold)" stroke="#7a5200" stroke-width=".8"/><circle cx="44" cy="25" r="1.5" fill="${trim}"/><circle cx="50" cy="22" r="1.8" fill="${trim}"/><circle cx="56" cy="25" r="1.5" fill="${trim}"/>`;
    else head = `<path d="M37 31c1-7 6-11 13-11s12 4 13 11z" fill="${trim}"/><path d="M60 24c5-3 9-1 11 2-4 0-7 1-10 3z" fill="#fff" stroke="#999" stroke-width=".5"/>`;
    const beard = c.r === 13 ? `<path d="M43 42c2 7 12 7 14 0-2 3-12 3-14 0z" fill="${hair}"/>` : '';
    const hairBack = c.r === 12 ? `<path d="M40 33c-3 8-2 13 1 16l4-6zM60 33c3 8 2 13-1 16l-4-6z" fill="${hair}"/>` : '';
    const half = `<g>
      ${hairBack}
      <path d="M30 70c2-14 9-20 20-21 11 1 18 7 20 21z" fill="${robe}" stroke="#222" stroke-width=".8"/>
      <path d="M30 70c2-14 9-20 20-21 11 1 18 7 20 21z" fill="url(#diamondsPat)"/>
      <path d="M50 49v21" stroke="url(#gold)" stroke-width="3"/>
      <path d="M38 52c4 3 20 3 24 0" stroke="url(#gold)" stroke-width="2" fill="none"/>
      <circle cx="50" cy="38" r="8.5" fill="${skin}" stroke="#7a4b2a" stroke-width=".8"/>
      <circle cx="47" cy="37" r="1" fill="#222"/><circle cx="53" cy="37" r="1" fill="#222"/>
      <path d="M47.5 41.5c1.5 1 3.5 1 5 0" stroke="#a33" stroke-width=".9" fill="none" stroke-linecap="round"/>
      ${beard}${head}
      ${pip(c.s, 64, 60, 10)}
    </g>`;
    return `<rect x="21" y="17" width="58" height="106" rx="4" fill="#fff8e6" stroke="url(#gold)" stroke-width="2.2"/>
      <rect x="24" y="20" width="52" height="100" rx="3" fill="none" stroke="${isRed ? '#c8102e' : '#1b1b3a'}" stroke-width=".6" stroke-dasharray="2 1.5"/>
      <svg x="21" y="17" width="58" height="53" viewBox="21 17 58 53">${half}</svg>
      <g transform="rotate(180 50 70)"><svg x="21" y="17" width="58" height="53" viewBox="21 17 58 53">${half}</svg></g>
      <path d="M22 70h56" stroke="url(#gold)" stroke-width="1.4"/>
      <text x="50" y="74" text-anchor="middle" font-size="9" font-weight="900" fill="${isRed ? '#c8102e' : '#1b1b3a'}" opacity=".0">${label(c)}</text>`;
  }

  function faceSVG(c) {
    const col = red(c.s) ? '#d0102f' : '#17172b';
    const L = label(c);
    let center = '';
    if (c.r === 1) {
      const big = c.s === 's' ? 52 : 40;
      center = (c.s === 's' ? `<circle cx="50" cy="70" r="31" fill="none" stroke="url(#gold)" stroke-width="1.5"/>` : '') + pip(c.s, 50, 70, big);
    } else if (c.r >= 11) center = court(c);
    else center = PIPS[c.r].map(p => pip(c.s, p[0], p[1], c.r >= 9 ? 19 : 21, p[2])).join('');
    const corner = `<text x="10.5" y="21" text-anchor="middle" font-size="${L.length > 1 ? 15 : 17}" font-weight="800" font-family="Inter,Arial,sans-serif" letter-spacing="${L.length > 1 ? -1.5 : 0}">${L}</text>${pip(c.s, 10.5, 31, 11)}`;
    return `<svg class="pc-svg" viewBox="0 0 100 140" aria-hidden="true" fill="${col}">
      ${corner}<g transform="rotate(180 50 70)">${corner}</g>${center}</svg>`;
  }

  /* HTML for a card. opts: {down, tag ('div'|'button'), cls, attrs, playable} */
  function html(c, opts) {
    opts = opts || {};
    const tag = opts.tag || 'div';
    const lbl = opts.down ? 'Face-down card' : name(c);
    const role = tag === 'div' ? ' role="img"' : ' type="button"';
    return `<${tag} class="pcard ${opts.down ? 'down' : ''} ${red(c.s) ? 'red' : 'black'} ${opts.cls || ''}" data-card="${c.id || ''}" aria-label="${T.esc(opts.label || lbl)}"${role} ${opts.attrs || ''}>
      <span class="pc-in"><span class="pc-face pc-front">${faceSVG(c)}</span><span class="pc-face pc-back">${backInner()}</span></span></${tag}>`;
  }
  function backInner() { return '<span class="pc-back-art"><span class="pc-logo">T</span></span>'; }
  const back = (cls, attrs) => `<div class="pcard down ${cls || ''}" role="img" aria-label="Face-down card" ${attrs || ''}><span class="pc-in"><span class="pc-face pc-front"></span><span class="pc-face pc-back">${backInner()}</span></span></div>`;

  /* Flip a rendered card element face-up */
  function flip(el, up) {
    if (!el) return;
    T.sfx('flip');
    el.classList.toggle('down', !up);
  }

  /* Fly an element's clone from one element/rect to another inside #app. */
  function fly(from, to, innerHTML, opts) {
    opts = opts || {};
    const app = T.app();
    const fr = T.local(from.getBoundingClientRect ? from.getBoundingClientRect() : from);
    const tr = T.local(to.getBoundingClientRect ? to.getBoundingClientRect() : to);
    if (!T.motion()) return Promise.resolve();
    const w = opts.w || tr.w, h = opts.h || tr.h;
    const d = document.createElement('div'); d.className = 'flyer'; d.setAttribute('aria-hidden', 'true');
    d.style.cssText = `width:${w}px;height:${h}px;left:0;top:0;--cw:${w}px`;
    d.innerHTML = innerHTML; app.appendChild(d);
    const sx = fr.x + fr.w / 2 - w / 2, sy = fr.y + fr.h / 2 - h / 2, ex = tr.x + tr.w / 2 - w / 2, ey = tr.y + tr.h / 2 - h / 2;
    const s0 = opts.fromScale || Math.max(0.3, fr.w / w), rot = opts.rot || 0;
    const dur = opts.dur || 380;
    if (opts.flipTo) setTimeout(() => { const c = d.querySelector('.pcard'); if (c) c.classList.remove('down'); }, dur * 0.35);
    const anim = d.animate([
      { transform: `translate(${sx}px,${sy}px) scale(${s0}) rotate(${opts.rot0 || 0}deg)` },
      { transform: `translate(${(sx + ex) / 2}px,${Math.min(sy, ey) - (opts.arc || 30)}px) scale(${(s0 + 1) / 2 * 1.06}) rotate(${rot / 2}deg)`, offset: 0.5 },
      { transform: `translate(${ex}px,${ey}px) scale(1) rotate(${rot}deg)` },
    ], { duration: dur, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' });
    return new Promise(r => { anim.onfinish = () => { d.remove(); r(); }; setTimeout(() => { if (d.isConnected) { d.remove(); r(); } }, dur + 400); });
  }

  T.Cards = { SUITS, SUIT_NAME, SUIT_CHAR, deck, label, name, red, html, back, flip, fly, sprite, faceSVG, suitSVG: (s, size) => `<svg viewBox="0 0 100 100" width="${size || 20}" height="${size || 20}" fill="${red(s) ? '#e0193a' : '#17172b'}" aria-hidden="true"><use href="#su-${s}"/></svg>` };
})();

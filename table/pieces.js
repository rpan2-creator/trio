/* Shared table pieces: 3D-ish dice and casino chips. */
(function () {
  'use strict';
  const T = window.Table;
  const PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[28, 28], [50, 50], [72, 72]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]], 6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]] };
  const face = n => `<svg viewBox="0 0 100 100" class="die-face" aria-hidden="true"><rect x="3" y="3" width="94" height="94" rx="20" fill="url(#dieg)"/><rect x="3" y="3" width="94" height="94" rx="20" fill="none" stroke="rgba(0,0,0,.12)" stroke-width="2"/>
    <defs><radialGradient id="dieg" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#f1efe9"/><stop offset="1" stop-color="#d7d2c6"/></radialGradient></defs>
    ${PIPS[n].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9.5" fill="${n === 1 ? '#e0193a' : '#1b1b2e'}"/><circle cx="${x - 2.5}" cy="${y - 2.5}" r="3" fill="rgba(255,255,255,.25)"/>`).join('')}</svg>`;

  /* A CSS-3D cube. Faces placed so that "show n" rotation works. */
  const ROT = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [180, 0] };
  const cube = (size) => `<div class="die3d" style="--ds:${size || 64}px" role="img" aria-label="Die"><div class="cube">
      <div class="cf f1">${face(1)}</div><div class="cf f2">${face(2)}</div><div class="cf f3">${face(3)}</div>
      <div class="cf f4">${face(4)}</div><div class="cf f5">${face(5)}</div><div class="cf f6">${face(6)}</div></div><i class="die-shadow"></i></div>`;
  function show(el, n, spins) {
    const c = el.querySelector('.cube'); const [x, y] = ROT[n];
    const sx = 360 * (spins || 0), sy = 360 * (spins || 0);
    c.style.transform = `rotateX(${x + sx}deg) rotateY(${y + sy}deg)`;
    el.setAttribute('aria-label', 'Die showing ' + n);
  }
  let spinCount = 0;
  function roll(el, n) {
    T.sfx('dice'); T.haptic([10, 30, 10]);
    if (!T.motion()) { show(el, n, 0); return T.sleep(150); }
    spinCount += 2;
    el.classList.remove('rolling'); void el.offsetWidth; el.classList.add('rolling');
    const c = el.querySelector('.cube');
    c.style.transition = 'transform .9s cubic-bezier(.2,.7,.25,1)';
    show(el, n, spinCount);
    return new Promise(r => setTimeout(() => { el.classList.remove('rolling'); r(); }, 950));
  }

  /* chips */
  const CHIP = { 5: ['#e63946', 'red'], 25: ['#2a9d8f', 'green'], 100: ['#1d1d2b', 'black'], 500: ['#7b2cbf', 'purple'] };
  const chip = (v, extra) => `<span class="chip c${v} ${extra || ''}" style="--cc:${CHIP[v][0]}" aria-hidden="true"><b>${v}</b></span>`;
  function breakdown(amount) {
    const out = []; [500, 100, 25, 5].forEach(v => { while (amount >= v && out.length < 12) { out.push(v); amount -= v; } });
    return out;
  }
  const stack = (amount, cls) => amount > 0 ? `<span class="chip-stack ${cls || ''}" aria-label="${amount} in chips">${breakdown(amount).reverse().map((v, i) => `<span class="chip-wrap" style="--i:${i}">${chip(v)}</span>`).join('')}</span>` : '';

  T.Dice = { face, cube, show, roll };
  T.Chips = { chip, stack, breakdown, CHIP };
})();

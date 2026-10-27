/* TABLE core: storage, settings, sound, haptics, confetti, overlays, helpers.
   Everything hangs off window.Table so the game files can share it. */
(function () {
  'use strict';
  const T = (window.Table = window.Table || {});
  T.games = T.games || {};
  T.order = T.order || [];

  /* ---------- tiny helpers ---------- */
  T.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  T.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  T.rand = n => Math.floor(Math.random() * n);
  T.pick = a => a[T.rand(a.length)];
  T.shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = T.rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const qs = new URLSearchParams(location.search);
  T.speed = qs.has('fast') ? 0.04 : 1; // test hook: ?fast speeds up bots and animations
  T.sleep = ms => new Promise(r => setTimeout(r, Math.max(0, ms * T.speed)));
  T.qs = qs;

  /* ---------- storage ---------- */
  T.store = {
    get(k, d) { try { const v = localStorage.getItem('table.v2.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('table.v2.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  let prefersReduce = false;
  try { prefersReduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* noop */ }
  T.settings = Object.assign({ sound: true, reduce: prefersReduce, haptics: true, voice: true }, T.store.get('settings', {}));
  T.applySettings = () => {
    document.documentElement.classList.toggle('reduce-motion', !!T.settings.reduce);
  };
  T.saveSettings = () => { T.store.set('settings', T.settings); T.applySettings(); };
  T.motion = () => !T.settings.reduce && T.speed === 1;
  T.applySettings();

  /* ---------- sound (WebAudio synth, no files) ---------- */
  let ac = null, master = null, gestured = false;
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, () => { gestured = true; }, { capture: true, passive: true }));
  function audio() {
    if (!T.settings.sound || !gestured) return null;
    try {
      if (!ac) {
        const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
        ac = new C(); master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
      }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    } catch (e) { return null; }
  }
  function tone(f, dur, type, vol, when, slide) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + (when || 0);
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq, when, q) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + (when || 0);
    const len = Math.max(1, Math.floor(a.sampleRate * dur));
    const buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 3000; f.Q.value = q || 0.8;
    const g = a.createGain(); g.gain.value = vol || 0.2;
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }
  const SFX = {
    tap: () => tone(700, 0.06, 'triangle', 0.08),
    pop: () => { tone(520, 0.08, 'sine', 0.12, 0, 900); },
    deal: () => noise(0.07, 0.25, 4200, 0, 1.2),
    flip: () => { noise(0.05, 0.2, 6000); tone(1200, 0.04, 'triangle', 0.04, 0.01); },
    play: () => { noise(0.06, 0.25, 2500); tone(330, 0.07, 'triangle', 0.06); },
    chip: () => { tone(2600, 0.05, 'square', 0.03); tone(3400, 0.08, 'sine', 0.05, 0.03); },
    chips: () => { for (let i = 0; i < 4; i++) { tone(2400 + Math.random() * 1200, 0.05, 'sine', 0.05, i * 0.05); } },
    dice: () => { for (let i = 0; i < 7; i++) noise(0.04, 0.3, 1800 + Math.random() * 1500, i * 0.06 + Math.random() * 0.02, 2); },
    step: () => tone(620, 0.05, 'triangle', 0.07),
    capture: () => { tone(160, 0.25, 'sawtooth', 0.12, 0, 60); noise(0.2, 0.3, 800); },
    win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, i * 0.09)); },
    fanfare: () => { [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'square', 0.05, i * 0.11)); },
    lose: () => { tone(330, 0.3, 'triangle', 0.12, 0, 160); tone(220, 0.4, 'triangle', 0.1, 0.25, 110); },
    correct: () => { tone(880, 0.1, 'sine', 0.14); tone(1320, 0.18, 'sine', 0.14, 0.09); },
    pass: () => { tone(200, 0.18, 'square', 0.06, 0, 140); },
    tick: () => tone(1500, 0.025, 'square', 0.03),
    bell: () => { tone(1046, 0.9, 'sine', 0.1); tone(1568, 0.7, 'sine', 0.05, 0.01); },
    howl: () => {
      const a = audio(); if (!a) return; const t = a.currentTime;
      const o = a.createOscillator(), g = a.createGain(), l = a.createOscillator(), lg = a.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(560, t + 0.6); o.frequency.exponentialRampToValueAtTime(380, t + 1.6);
      l.frequency.value = 6; lg.gain.value = 12; l.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
      o.connect(g); g.connect(master); o.start(t); l.start(t); o.stop(t + 1.8); l.stop(t + 1.8);
    },
    whoosh: () => noise(0.3, 0.18, 1200, 0, 0.5),
    buzz: () => { tone(110, 0.5, 'sawtooth', 0.09); tone(116, 0.5, 'sawtooth', 0.07); },
  };
  T.sfx = name => { try { if (T.settings.sound && SFX[name]) SFX[name](); } catch (e) { /* audio not available */ } };
  T.haptic = p => { try { if (T.settings.haptics && navigator.vibrate) navigator.vibrate(p || 12); } catch (e) { /* noop */ } };

  /* narrator voice (Werewolf) */
  T.say = text => {
    try {
      if (!T.settings.sound || !T.settings.voice || !window.speechSynthesis || T.speed !== 1) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.rate = 0.95; u.pitch = 0.85; speechSynthesis.speak(u);
    } catch (e) { /* noop */ }
  };
  T.hush = () => { try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) { /* noop */ } };

  /* ---------- DOM roots ---------- */
  T.app = () => document.getElementById('app');
  T.announce = msg => {
    const sr = document.getElementById('sr'); if (!sr) return;
    sr.textContent = ''; setTimeout(() => { sr.textContent = msg; }, 30);
  };
  /* convert a viewport rect into #app-local coordinates (the drawn phone is CSS-scaled) */
  T.local = rect => {
    const app = T.app(), ar = app.getBoundingClientRect(), s = ar.width / app.offsetWidth || 1;
    return { x: (rect.left - ar.left) / s, y: (rect.top - ar.top) / s, w: rect.width / s, h: rect.height / s };
  };

  T.toast = (msg, kind) => {
    const app = T.app(); app.querySelectorAll('.toast').forEach(t => t.remove());
    const d = document.createElement('div'); d.className = 'toast ' + (kind || ''); d.setAttribute('role', 'status'); d.textContent = msg;
    app.appendChild(d); setTimeout(() => d.classList.add('out'), 2200); setTimeout(() => d.remove(), 2600);
  };

  /* Big centered callout ("LAST CARD!", "BLACKJACK!") */
  T.callout = (text, color, ms) => {
    const app = T.app(); const d = document.createElement('div');
    d.className = 'callout'; d.style.setProperty('--c', color || '#ffd23f'); d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<span>' + T.esc(text) + '</span>'; app.appendChild(d);
    T.announce(text);
    return new Promise(r => setTimeout(() => { d.remove(); r(); }, Math.max(300, (ms || 1100) * (T.speed === 1 ? 1 : 0.1))));
  };

  /* Modal: resolves with the clicked action's value */
  T.modal = ({ title, body, actions, cls, dismiss }) => new Promise(resolve => {
    const app = T.app(); const prevFocus = document.activeElement;
    const ov = document.createElement('div'); ov.className = 'overlay ' + (cls || '');
    ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${T.esc(title || 'Dialog')}">
      ${title ? `<h2 class="sheet-title">${T.esc(title)}</h2>` : ''}<div class="sheet-body">${body || ''}</div>
      <div class="sheet-actions">${(actions || []).map((a, i) => `<button type="button" class="btn ${a.kind || 'ghost'} ${a.cls || ''}" data-i="${i}">${a.html || T.esc(a.label)}</button>`).join('')}</div></div>`;
    const close = v => { ov.classList.add('closing'); setTimeout(() => ov.remove(), 180); if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) { /* noop */ } resolve(v); };
    ov.addEventListener('click', e => {
      const b = e.target.closest('[data-i]');
      if (b && b.closest('.sheet-actions')) { T.sfx('tap'); close(actions[+b.dataset.i].value); return; }
      const v = e.target.closest('[data-value]');
      if (v) { T.sfx('tap'); close(v.dataset.value); return; }
      if (e.target === ov && dismiss !== false) close(undefined);
    });
    ov.addEventListener('keydown', e => { if (e.key === 'Escape' && dismiss !== false) close(undefined); });
    app.appendChild(ov);
    const f = ov.querySelector('[data-value],.sheet-actions .btn'); if (f) setTimeout(() => f.focus(), 30);
  });

  T.avatar = (p, size, extra) => `<span class="ava ${extra || ''}" style="--pc:${p.color};--s:${size || 44}px" aria-hidden="true"><span>${T.esc(p.emoji)}</span>${p.bot ? '<i class="bot-badge">BOT</i>' : ''}</span>`;

  /* Pass-the-phone privacy screen */
  T.passTo = (p, opts) => new Promise(resolve => {
    opts = opts || {};
    const app = T.app();
    const ov = document.createElement('div'); ov.className = 'passer'; ov.style.setProperty('--pc', p.color);
    ov.innerHTML = `<div class="passer-in" role="dialog" aria-modal="true" aria-label="Pass the phone to ${T.esc(p.name)}">
      <div class="passer-hand" aria-hidden="true">${phoneSVG()}</div>
      <p class="passer-k">${T.esc(opts.kicker || 'Pass the phone to')}</p>
      ${T.avatar(p, 96, 'big')}
      <h2 class="passer-name">${T.esc(p.name)}</h2>
      <p class="passer-sub">${T.esc(opts.sub || 'Everyone else, no peeking!')}</p>
      <button type="button" class="btn primary xl" data-go>${T.esc(opts.button || "I'm " + p.name + ' — show me')}</button></div>`;
    app.appendChild(ov); T.sfx('whoosh');
    const b = ov.querySelector('[data-go]'); setTimeout(() => b.focus(), 40);
    b.addEventListener('click', () => { T.sfx('pop'); ov.classList.add('closing'); setTimeout(() => ov.remove(), 220); resolve(); });
  });
  function phoneSVG() {
    return `<svg viewBox="0 0 120 80" width="120" height="80"><path d="M14 60 C30 52 40 50 52 52" stroke="#ffd9b8" stroke-width="12" stroke-linecap="round" fill="none"/><rect x="48" y="12" width="34" height="58" rx="7" fill="#151525" stroke="#fff" stroke-width="3" transform="rotate(14 65 41)"/><path d="M92 26 l10 -6 M94 38 l12 0 M92 50 l10 6" stroke="#ffd23f" stroke-width="4" stroke-linecap="round"/></svg>`;
  }

  /* ---------- confetti ---------- */
  T.confetti = (opts) => {
    if (!T.motion()) return;
    opts = opts || {};
    const app = T.app();
    const c = document.createElement('canvas'); c.className = 'confetti'; c.setAttribute('aria-hidden', 'true');
    const W = app.offsetWidth, H = app.offsetHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = W * dpr; c.height = H * dpr; app.appendChild(c);
    const g = c.getContext('2d'); g.scale(dpr, dpr);
    const cols = opts.colors || ['#ffd23f', '#ff4d6d', '#3ddc97', '#4cc9f0', '#9b5de5', '#ff9f1c', '#ffffff'];
    const N = opts.count || 160;
    const ps = Array.from({ length: N }, (_, i) => ({
      x: W / 2 + (Math.random() - 0.5) * 60, y: H * (opts.y || 0.35),
      vx: (Math.random() - 0.5) * 13, vy: -Math.random() * 15 - 4,
      w: 6 + Math.random() * 7, h: 4 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.35,
      c: cols[i % cols.length], shape: Math.random() < 0.25 ? 1 : 0,
    }));
    let t0 = performance.now();
    (function frame(now) {
      const t = now - t0; g.clearRect(0, 0, W, H);
      ps.forEach(p => {
        p.vy += 0.38; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c;
        g.globalAlpha = Math.max(0, 1 - t / 3200);
        if (p.shape) { g.beginPath(); g.arc(0, 0, p.w / 2.4, 0, 7); g.fill(); } else g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 1);
        g.restore();
      });
      if (t < 3300) requestAnimationFrame(frame); else c.remove();
    })(t0);
  };

  /* ---------- icons ---------- */
  const I = {
    home: '<path d="M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    grid: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
    gear: '<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm9 4.6v-2.2l-2.4-.6a7 7 0 0 0-.7-1.7l1.3-2.1-1.6-1.6-2.1 1.3a7 7 0 0 0-1.7-.7L13.1 3h-2.2l-.6 2.4a7 7 0 0 0-1.7.7L6.5 4.8 4.9 6.4l1.3 2.1a7 7 0 0 0-.7 1.7L3 10.9v2.2l2.4.6c.2.6.4 1.2.7 1.7l-1.3 2.1 1.6 1.6 2.1-1.3c.5.3 1.1.6 1.7.7l.6 2.4h2.2l.6-2.4c.6-.2 1.2-.4 1.7-.7l2.1 1.3 1.6-1.6-1.3-2.1c.3-.5.6-1.1.7-1.7z"/>',
    back: '<path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    close: '<path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    menu: '<rect x="7" y="5" width="3.5" height="14" rx="1.2"/><rect x="13.5" y="5" width="3.5" height="14" rx="1.2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 3.2-6 6.5-6s6 2 6.5 6z"/><circle cx="17" cy="9" r="2.8"/><path d="M15.5 14.2c3 .1 5.4 1.9 6 5.8h-4.6c-.2-2.4-.7-4.2-1.4-5.8z"/>',
    clock: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    plus: '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
    minus: '<path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
    up: '<path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    down: '<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    trash: '<path d="M5 7h14M10 4h4M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    robot: '<rect x="4" y="8" width="16" height="11" rx="3"/><circle cx="9" cy="13.5" r="1.6" fill="#000" fill-opacity=".55"/><circle cx="15" cy="13.5" r="1.6" fill="#000" fill-opacity=".55"/><path d="M12 8V4.5" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="4" r="1.6"/>',
    play: '<path d="M7 4.5v15l13-7.5z"/>',
    star: '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6L2.5 9.3l6.6-.8z"/>',
    sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
    redo: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M18 2v5h-5M6 22v-5h5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    exit: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    sparkle: '<path d="M12 2c.7 4.6 2.4 6.3 7 7-4.6.7-6.3 2.4-7 7-.7-4.6-2.4-6.3-7-7 4.6-.7 6.3-2.4 7-7zM19 15c.3 2 1 2.7 3 3-2 .3-2.7 1-3 3-.3-2-1-2.7-3-3 2-.3 2.7-1 3-3z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    trophy: '<path d="M7 3h10v5a5 5 0 0 1-10 0zM5 4H2.5v2a4 4 0 0 0 4 4M19 4h2.5v2a4 4 0 0 1-4 4M10 14h4v3h3v4H7v-4h3z"/>',
  };
  T.icon = (n, s) => `<svg class="ic" viewBox="0 0 24 24" width="${s || 22}" height="${s || 22}" fill="currentColor" aria-hidden="true">${I[n] || ''}</svg>`;

  /* ---------- player palette ---------- */
  T.COLORS = ['#ff4d6d', '#4cc9f0', '#ffd23f', '#3ddc97', '#9b5de5', '#ff9f1c', '#f15bb5', '#00bbf9', '#a3e635', '#ff7b54', '#7c83fd', '#2ec4b6'];
  T.EMOJI = ['🦊', '🐻', '🐼', '🦁', '🐸', '🐙', '🦄', '🐯', '🐨', '🐵', '🦉', '🐧', '🐶', '🐱', '🦖', '🐝', '🌵', '🍕', '🎸', '🚀', '👑', '🍩', '🌮', '⚡'];
  T.BOT_NAMES = ['Ace Bot', 'Lucky', 'Dot', 'Penny', 'Rex', 'Ziggy', 'Moxie', 'Bingo', 'Pixel', 'Domino', 'Sprocket', 'Nugget'];
})();

/* INK STUDY — original flash library + Tattoo Builder parts.
   Every piece is drawn here as parametric SVG (no copied artwork). Motifs take a colour mode:
   'color' (traditional palette), 'bw' (black & grey) or 'fine' (single-needle line work). */
(function () {
'use strict';
const K = '#141110';
const COLORS = { R: '#c8261c', R2: '#8e1712', G: '#2e7b3a', G2: '#1b4f27', Y: '#f2b928', Y2: '#d48a12', B: '#25568f', B2: '#173a66', O: '#e2601e', P: '#e58aa3', P2: '#c25878', W: '#fbf7ee', T: '#a86b32', S: '#b9c2c6' };
const GREYS  = { R: '#8d8781', R2: '#5d5853', G: '#77716b', G2: '#5a5550', Y: '#c9c3bb', Y2: '#a39d96', B: '#6b6661', B2: '#4f4a46', O: '#a8a29b', P: '#c4beb6', P2: '#99938c', W: '#fbf7ee', T: '#8a847e', S: '#bdb8b2' };
let SEQ = 0;

function Ctx(mode, sw) {
  const fine = mode === 'fine';
  const pal = mode === 'bw' ? GREYS : COLORS;
  const uid = 'u' + (++SEQ) + '_'; let n = 0;
  const defs = [];
  const c = {
    mode, fine, pal, defs, sw: sw || (fine ? 3.4 : 9),
    id() { return uid + (n++); },
    fill(k) { return fine ? 'none' : (pal[k] || k); },
    // filled shape + optional shading + outline on top
    P(d, k, shade, o) {
      o = o || {};
      const w = o.sw || c.sw;
      let s = '';
      if (!fine && k) s += `<path d="${d}" fill="${c.fill(k)}"/>`;
      if (!fine && shade) s += shade;
      if (o.noStroke) return s;
      s += `<path d="${d}" fill="none" stroke="${K}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
      return s;
    },
    // outline only
    L(d, w, extra) { return `<path d="${d}" fill="none" stroke="${K}" stroke-width="${w || c.sw}" stroke-linejoin="round" stroke-linecap="round" ${extra || ''}/>`; },
    // solid black
    Kf(d) { return `<path d="${d}" fill="${K}"/>`; },
    // black gradient shading clipped to a shape: dark at (x1,y1) fading to clear at (x2,y2)
    sh(clip, x1, y1, x2, y2, a, mid) {
      if (fine) return '';
      const g = c.id(), cp = c.id();
      defs.push(`<linearGradient id="${g}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${K}" stop-opacity="${a == null ? .92 : a}"/><stop offset="${mid || .38}" stop-color="${K}" stop-opacity="${(a == null ? .92 : a) * .55}"/><stop offset="1" stop-color="${K}" stop-opacity="0"/></linearGradient>`);
      defs.push(`<clipPath id="${cp}"><path d="${clip}"/></clipPath>`);
      return `<g clip-path="url(#${cp})"><path d="${clip}" fill="url(#${g})"/></g>`;
    },
    // radial shading
    shr(clip, cx, cy, r, a, inner) {
      if (fine) return '';
      const g = c.id(), cp = c.id();
      defs.push(`<radialGradient id="${g}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}"><stop offset="${inner || 0}" stop-color="${K}" stop-opacity="${a == null ? .9 : a}"/><stop offset="1" stop-color="${K}" stop-opacity="0"/></radialGradient>`);
      defs.push(`<clipPath id="${cp}"><path d="${clip}"/></clipPath>`);
      return `<g clip-path="url(#${cp})"><rect x="-50" y="-50" width="1200" height="1200" fill="url(#${g})"/></g>`;
    },
    // stipple (dotwork) shading clipped to a shape, density fading along a direction
    dots(clip, x1, y1, x2, y2, step, r) {
      const cp = c.id(), g = c.id(), m = c.id(), pt = c.id();
      step = step || 7; r = r || 1.6;
      defs.push(`<pattern id="${pt}" width="${step}" height="${step}" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="${step/2}" cy="${step/2}" r="${r}" fill="${K}"/><circle cx="0" cy="0" r="${r*.8}" fill="${K}"/></pattern>`);
      defs.push(`<linearGradient id="${g}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`);
      defs.push(`<mask id="${m}"><rect x="-50" y="-50" width="1200" height="1200" fill="url(#${g})"/></mask>`);
      defs.push(`<clipPath id="${cp}"><path d="${clip}"/></clipPath>`);
      return `<g clip-path="url(#${cp})"><rect x="-50" y="-50" width="1200" height="1200" fill="url(#${pt})" mask="url(#${m})"/></g>`;
    },
    // white highlight stroke
    hl(d, w) { return c.fine ? '' : `<path d="${d}" fill="none" stroke="${c.pal.W}" stroke-width="${w || 6}" stroke-linecap="round" stroke-linejoin="round"/>`; },
    text(x, y, str, size, o) {
      o = o || {};
      return `<text x="${x}" y="${y}" text-anchor="middle" font-family="${o.font || "'Playfair Display','DejaVu Serif',Georgia,'Times New Roman',serif"}" font-weight="${o.weight || 800}" font-size="${size}" letter-spacing="${o.ls || 2}" fill="${o.fill || K}" ${o.extra || ''}>${str}</text>`;
    }
  };
  return c;
}
const wrapSVG = (w, h, c, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${c.defs.join('')}</defs>${body}</svg>`;
const f = n => Math.round(n * 10) / 10;
function pol(cx, cy, r, a) { return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }

/* ---------------- motif generators (local box ~ 0..600) ---------------- */
function leaf(c, x, y, ang, len, wid, flip) {
  const s = flip ? -1 : 1, w = wid;
  const d = `M0 0 C${f(len*.25)} ${f(-w*1.1*s)} ${f(len*.7)} ${f(-w*.95*s)} ${len} 0 C${f(len*.72)} ${f(w*.5*s)} ${f(len*.42)} ${f(w*.62*s)} ${f(len*.3)} ${f(w*.42*s)} C${f(len*.2)} ${f(w*.5*s)} ${f(len*.1)} ${f(w*.35*s)} 0 0Z`;
  const vein = `M${f(len*.05)} 0 Q${f(len*.5)} ${f(-w*.28*s)} ${f(len*.9)} ${f(-w*.04*s)}`;
  return `<g transform="translate(${x} ${y}) rotate(${ang})">${c.P(d, 'G', c.sh(d, 0, 0, len*.7, -w*.2*s, .95, .3) + c.sh(d, len*.4, w*.6*s, len*.4, -w*.2*s, .6, .3))}${c.L(vein, c.sw*.6)}${c.hl(`M${f(len*.35)} ${f(-w*.62*s)} Q${f(len*.55)} ${f(-w*.7*s)} ${f(len*.72)} ${f(-w*.5*s)}`, 5)}</g>`;
}

function rose(c, cx, cy, sc, rot) {
  const t = `translate(${cx} ${cy}) scale(${sc}) rotate(${rot || 0}) translate(-300 -300)`;
  const back = 'M168 262C142 200 176 134 236 132C258 98 342 96 366 132C428 132 462 200 434 262C410 236 380 224 300 222C222 224 190 236 168 262Z';
  const bowl = 'M154 258C150 352 222 410 300 410C380 410 452 352 446 258C412 300 362 316 300 316C238 316 188 300 154 258Z';
  const lipL = 'M154 258C176 238 214 230 248 236C226 252 214 278 222 312C188 302 166 284 154 258Z';
  const lipR = 'M446 258C424 238 386 230 352 236C374 252 386 278 378 312C412 302 434 284 446 258Z';
  const cup = 'M196 240C206 196 252 176 300 176C350 176 394 196 404 240C372 266 334 274 300 274C264 274 228 266 196 240Z';
  const swirl = 'M300 252C262 254 246 226 268 206C290 188 332 196 334 222C336 242 314 250 300 240C290 232 298 218 310 222';
  const petalF = 'M226 312C214 268 244 244 300 246C356 244 386 268 374 312C350 330 326 336 300 336C274 336 250 330 226 312Z';
  let s = '';
  s += c.P(back, 'R', c.sh(back, 300, 230, 300, 120, .95, .35) + c.sh(back, 168, 262, 240, 190, .7));
  s += c.P(bowl, 'R', c.sh(bowl, 300, 420, 300, 300, .95, .42) + c.sh(bowl, 154, 300, 260, 320, .5));
  s += c.P(cup, 'R2', c.shr(cup, 300, 230, 120, .95, .1));
  s += c.L(swirl, c.sw * .85);
  s += c.P(lipL, 'R', c.sh(lipL, 220, 312, 190, 250, .9));
  s += c.P(lipR, 'R', c.sh(lipR, 380, 312, 410, 250, .9));
  s += c.P(petalF, 'R', c.sh(petalF, 300, 340, 300, 270, .9, .3));
  s += c.hl('M180 160C196 144 214 140 230 142', 6) + c.hl('M372 150C384 160 396 172 402 188', 5) + c.hl('M252 262C268 256 290 254 312 256', 5) + c.hl('M176 286C184 296 192 302 204 306', 4);
  return `<g transform="${t}">${s}</g>`;
}

function trad_rose(mode) {
  const c = Ctx(mode);
  let s = '';
  s += c.L('M300 380C304 450 296 510 280 572', c.sw * 1.7);
  s += c.L('M297 492C320 486 336 478 350 466', c.sw * 1.1);
  s += leaf(c, 350, 466, -20, 96, 38, true);
  s += leaf(c, 270, 372, 168, 196, 70, false);
  s += leaf(c, 330, 372, 12, 196, 70, true);
  s += rose(c, 300, 250, .92);
  return wrapSVG(600, 600, c, s);
}

function swallow(c, cx, cy, sc, mir) {
  let s = '';
  const wingT = 'M262 250C300 170 380 100 520 70C500 110 480 128 452 142C470 150 476 162 470 176C440 170 420 176 404 190C414 202 414 214 404 226C380 222 354 236 336 256C314 262 286 262 262 250Z';
  const wingB = 'M232 300C192 360 140 420 70 460C112 470 140 468 168 458C164 476 168 490 182 498C200 476 224 466 244 462C246 480 256 490 270 494C276 460 290 430 300 400C290 370 268 330 232 300Z';
  const body = 'M140 228C164 196 210 196 252 216C300 238 340 270 384 312C404 330 420 350 430 370C394 362 360 350 330 336C280 314 230 290 196 270C170 256 150 244 140 228Z';
  const back = 'M140 228C164 196 210 196 252 216C300 238 340 270 384 312C404 330 420 350 430 370C394 350 360 320 330 300C290 272 240 252 200 244C176 238 156 236 140 228Z';
  const throat = 'M140 228C150 246 168 258 194 268C206 252 204 232 196 214C176 206 156 210 140 228Z';
  const tail = 'M392 330C430 360 470 410 520 470C490 454 466 434 446 416C456 452 464 486 470 530C446 490 420 440 396 380Z';
  const beak = 'M142 224L104 236L142 236Z';
  s += c.P(wingT, 'B', c.sh(wingT, 300, 240, 470, 110, .95, .45));
  s += c.L('M336 256C370 210 420 160 470 120', c.sw * .5) + c.L('M380 220C420 190 452 166 480 150', c.sw * .45);
  s += c.P(tail, 'B', c.sh(tail, 400, 350, 480, 470, .9));
  s += c.P(body, 'W', c.sh(body, 330, 340, 300, 250, .45));
  s += c.P(back, 'B', c.sh(back, 260, 220, 400, 340, .85));
  s += c.P(throat, 'R', c.sh(throat, 196, 266, 170, 220, .7));
  s += c.P(wingB, 'B', c.sh(wingB, 250, 320, 120, 450, .95, .45));
  s += c.L('M244 330C210 380 170 420 120 452', c.sw * .5) + c.L('M268 380C246 420 220 446 190 470', c.sw * .45);
  s += c.P(beak, 'Y');
  s += `<circle cx="168" cy="222" r="${c.fine ? 5 : 8}" fill="${K}"/>` + (c.fine ? '' : `<circle cx="166" cy="219" r="2.6" fill="#fff"/>`);
  s += c.hl('M300 200C340 160 390 126 440 104', 5) + c.hl('M210 236C240 238 270 250 296 266', 4);
  return `<g transform="translate(${cx} ${cy}) scale(${mir ? -sc : sc} ${sc}) translate(-300 -300)">${s}</g>`;
}

function banner(c, cx, cy, w, txt, o) {
  o = o || {};
  const h = o.h || 64, x0 = cx - w / 2, x1 = cx + w / 2, bend = o.bend == null ? 22 : o.bend;
  const main = `M${x0} ${cy - h/2}Q${cx} ${cy - h/2 + bend} ${x1} ${cy - h/2}L${x1} ${cy + h/2}Q${cx} ${cy + h/2 + bend} ${x0} ${cy + h/2}Z`;
  const tl = `M${x0} ${cy - h/2 + 18}L${x0 - 60} ${cy - h/2 + 14}L${x0 - 34} ${cy + 6}L${x0 - 64} ${cy + h/2 + 22}L${x0 + 6} ${cy + h/2 + 26}Z`;
  const tr = `M${x1} ${cy - h/2 + 18}L${x1 + 60} ${cy - h/2 + 14}L${x1 + 34} ${cy + 6}L${x1 + 64} ${cy + h/2 + 22}L${x1 - 6} ${cy + h/2 + 26}Z`;
  const foldL = `M${x0} ${cy + h/2}L${x0 + 6} ${cy + h/2 + 26}L${x0 - 6} ${cy + h/2 - 2}Z`;
  const fill = o.fill || 'W';
  let s = c.P(tl, fill, c.sh(tl, x0, cy, x0 - 60, cy, .7)) + c.P(tr, fill, c.sh(tr, x1, cy, x1 + 60, cy, .7));
  s += c.Kf(`M${x0} ${cy + h/2}L${x0 + 6} ${cy + h/2 + 26}L${x0 - 4} ${cy + h/2 + 8}Z`) + c.Kf(`M${x1} ${cy + h/2}L${x1 - 6} ${cy + h/2 + 26}L${x1 + 4} ${cy + h/2 + 8}Z`);
  s += c.P(main, fill, c.sh(main, cx, cy + h/2 + bend, cx, cy - h/2, .25));
  if (txt) {
    const pid = c.id();
    c.defs.push(`<path id="${pid}" d="M${x0 + 10} ${cy + 14}Q${cx} ${cy + 14 + bend} ${x1 - 10} ${cy + 14}"/>`);
    const size = o.size || Math.min(42, (w - 44) / Math.max(3, txt.length) * 1.22);
    s += `<text font-family="'Playfair Display','DejaVu Serif',Georgia,serif" font-weight="800" font-size="${size}" letter-spacing="3" fill="${K}" text-anchor="middle"><textPath href="#${pid}" startOffset="50%">${txt}</textPath></text>`;
  }
  return s;
}

function dagger(c, cx, cy, sc, rot, txt) {
  let s = '';
  const blade = 'M272 250L328 250L324 520L300 590L276 520Z';
  const bladeL = 'M272 250L300 250L300 590L276 520Z';
  const guard = 'M190 236C210 224 240 230 300 230C360 230 390 224 410 236C420 250 412 266 396 264C380 262 360 256 300 256C240 256 220 262 204 264C188 266 180 250 190 236Z';
  const grip = 'M278 120L322 120L326 230L274 230Z';
  const pomm = 'M300 70C322 70 334 86 334 102C334 118 320 128 300 128C280 128 266 118 266 102C266 86 278 70 300 70Z';
  s += c.P(blade, 'S', c.sh(bladeL, 276, 400, 300, 400, .95, .6) + c.hl('M312 270L310 500', 6));
  s += c.L('M300 260L300 560', c.sw * .5);
  s += c.P(grip, 'T', c.sh(grip, 274, 170, 324, 170, .8));
  for (let y = 136; y < 226; y += 18) s += c.L(`M276 ${y}Q300 ${y + 12} 324 ${y}`, c.sw * .55);
  s += c.P(guard, 'Y', c.sh(guard, 300, 266, 300, 230, .7));
  s += `<circle cx="196" cy="246" r="12" fill="${c.fill('R')}" stroke="${K}" stroke-width="${c.sw*.8}"/><circle cx="404" cy="246" r="12" fill="${c.fill('R')}" stroke="${K}" stroke-width="${c.sw*.8}"/>`;
  s += c.P(pomm, 'R', c.shr(pomm, 312, 112, 46, .85, .2) + c.hl('M286 88C290 82 296 80 302 80', 5));
  // blood drops
  s += c.P('M300 600C292 614 290 624 300 630C310 624 308 614 300 600Z', 'R') + c.P('M286 650C280 660 280 668 286 672C292 668 292 660 286 650Z', 'R');
  if (txt != null) s += banner(c, 300, 410, 320, txt, { h: 62, bend: 26 });
  return `<g transform="translate(${cx} ${cy}) scale(${sc}) rotate(${rot || 0}) translate(-300 -360)">${s}</g>`;
}

function anchor(c, cx, cy, sc, txt) {
  let s = '';
  const ring = 'M300 60a42 42 0 1 1 -0.1 0ZM300 86a16 16 0 1 0 0.1 0Z';
  const shank = 'M284 120L316 120L318 470L282 470Z';
  const stock = 'M190 150L410 150C424 150 430 172 410 176L190 176C170 172 176 150 190 150Z';
  const arms = 'M300 520C230 520 170 480 140 410L112 430L118 360L184 376L160 392C186 444 236 474 286 478L314 478C364 474 414 444 440 392L416 376L482 360L488 430L460 410C430 480 370 520 300 520Z';
  s += c.P(ring, 'B', c.sh(ring, 270, 60, 330, 120, .8));
  s += c.P(stock, 'T', c.sh(stock, 300, 176, 300, 150, .7));
  s += c.P(shank, 'B', c.sh(shank, 282, 300, 318, 300, .9, .5));
  s += c.P(arms, 'B', c.sh(arms, 300, 530, 300, 420, .9, .4) + c.hl('M170 420C200 460 240 486 280 494', 5));
  s += c.hl('M308 140L310 440', 5);
  // rope: braided S-curve around the shank
  const rope = 'M290 110C240 150 230 190 300 220C370 250 370 300 300 320C230 340 220 390 300 410C360 426 380 470 330 500';
  s += `<path d="${rope}" fill="none" stroke="${K}" stroke-width="${c.fine ? 7 : 26}" stroke-linecap="round"/>`;
  if (!c.fine) s += `<path d="${rope}" fill="none" stroke="${c.pal.Y}" stroke-width="16" stroke-linecap="round"/><path d="${rope}" fill="none" stroke="${K}" stroke-width="16" stroke-dasharray="3 12" stroke-linecap="butt"/>`;
  if (txt != null) s += banner(c, 300, 300, 300, txt, { h: 60, bend: 24 });
  return `<g transform="translate(${cx} ${cy}) scale(${sc}) translate(-300 -300)">${s}</g>`;
}

function heart(c, cx, cy, sc, txt) {
  let s = '';
  const H = 'M300 520C230 460 120 390 112 270C106 190 160 140 218 142C258 144 286 168 300 196C314 168 342 144 382 142C440 140 494 190 488 270C480 390 370 460 300 520Z';
  s += c.P(H, 'R', c.sh(H, 300, 540, 300, 360, .9, .4) + c.sh(H, 470, 300, 380, 280, .7) + c.hl('M160 230C164 200 186 180 212 178', 9) + c.hl('M180 268C182 260 184 254 188 250', 7));
  if (c.fine) s += c.dots(H, 300, 520, 300, 300, 6, 1.6) + c.dots(H, 480, 280, 380, 280, 6, 1.6);
  s += c.L('M300 196C306 240 320 270 352 290', c.sw * .5);
  // flames on top
  const fl = 'M300 196C280 160 286 120 310 96C304 124 322 132 330 112C344 140 336 170 318 190Z';
  s = c.P(fl, 'Y', c.sh(fl, 310, 190, 310, 110, .5)) + c.P('M306 180C298 160 304 140 316 130C318 150 326 156 322 176Z', 'O') + s;
  if (txt != null) s += banner(c, 300, 340, 400, txt, { h: 64, bend: 26 });
  return `<g transform="translate(${cx} ${cy}) scale(${sc}) translate(-300 -320)">${s}</g>`;
}

function skull(c, cx, cy, sc) {
  let s = '';
  const head = 'M300 110C200 110 150 180 154 260C156 310 180 340 200 356L204 410C210 428 228 436 250 436L350 436C372 436 390 428 396 410L400 356C420 340 444 310 446 260C450 180 400 110 300 110Z';
  const eyeL = 'M218 270C222 240 256 232 276 248C292 262 284 300 254 306C228 310 214 292 218 270Z';
  const eyeR = 'M382 270C378 240 344 232 324 248C308 262 316 300 346 306C372 310 386 292 382 270Z';
  const nose = 'M300 318L284 352C292 358 308 358 316 352Z';
  const jaw = 'M226 400L374 400';
  s += c.P(head, 'W', c.sh(head, 154, 300, 250, 300, .75) + c.sh(head, 446, 300, 360, 300, .55) + c.sh(head, 300, 436, 300, 360, .7) + c.shr(head, 300, 160, 70, .0));
  s += c.Kf(eyeL) + c.Kf(eyeR) + c.Kf(nose);
  s += c.L(jaw, c.sw * .8);
  for (let x = 236; x <= 364; x += 21) s += c.L(`M${x} 378L${x} 430`, c.sw * .6);
  s += c.L('M226 380C260 372 340 372 374 380', c.sw * .7);
  s += c.L('M246 180C262 196 270 212 268 230', c.sw * .45) + c.L('M380 200C366 214 362 226 364 240', c.sw * .45);
  return `<g transform="translate(${cx} ${cy}) scale(${sc}) translate(-300 -280)">${s}</g>`;
}

function snake(c, cx, cy, sc) {
  const spine = 'M150 560C90 470 160 420 260 410C380 398 450 340 400 270C350 200 220 240 210 170C202 116 260 90 320 96';
  const fine = c.fine;
  let s = '';
  s += `<path d="${spine}" fill="none" stroke="${K}" stroke-width="${fine ? 52 : 66}" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<path d="${spine}" fill="none" stroke="${fine ? '#ffffff00' : c.pal.G}" stroke-width="${fine ? 44 : 50}" stroke-linecap="round"/>`;
  if (fine) s = `<path d="${spine}" fill="none" stroke="${K}" stroke-width="54" stroke-linecap="round"/><path d="${spine}" fill="none" stroke="#fff" stroke-width="47" stroke-linecap="round"/>`;
  if (!fine) {
    s += `<path d="${spine}" fill="none" stroke="${c.pal.Y}" stroke-width="18" stroke-linecap="round" transform="translate(-6 6)"/>`;
    s += `<path d="${spine}" fill="none" stroke="${K}" stroke-width="50" stroke-dasharray="4 16" stroke-linecap="butt"/>`;
    s += `<path d="${spine}" fill="none" stroke="${K}" stroke-opacity=".55" stroke-width="12" stroke-linecap="round" transform="translate(10 -10)"/>`;
  } else {
    s += `<path d="${spine}" fill="none" stroke="${K}" stroke-width="40" stroke-dasharray="1.6 14" stroke-linecap="butt"/>`;
  }
  // head
  const head = 'M300 70C340 52 400 58 430 84C446 98 444 118 428 126C400 140 350 140 316 128C296 120 286 84 300 70Z';
  s += c.P(head, 'G', c.sh(head, 360, 130, 360, 70, .85));
  s += `<circle cx="402" cy="90" r="${fine ? 5 : 9}" fill="${c.fine ? K : c.pal.Y}" stroke="${K}" stroke-width="${c.sw * .6}"/>` + `<path d="M402 82L402 98" stroke="${K}" stroke-width="4"/>`;
  s += c.L('M330 110C360 118 400 118 426 112', c.sw * .45);
  // tongue
  s += `<path d="M440 108L486 112L500 100M486 112L500 124" fill="none" stroke="${fine ? K : c.pal.R}" stroke-width="${fine ? 3 : 7}" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (!fine) s += `<path d="M440 108L486 112L500 100M486 112L500 124" fill="none" stroke="${K}" stroke-width="2" stroke-linecap="round"/>`;
  return `<g transform="translate(${cx} ${cy}) scale(${sc}) translate(-300 -320)">${s}</g>`;
}

function butterfly(c, cx, cy, sc) {
  let s = '';
  const mirrorD = d => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (m, x, y) => (600 - +x) + ' ' + y);
  const fore = 'M296 270C262 196 206 116 128 104C74 96 52 146 74 190C96 234 196 270 296 286Z';
  const hind = 'M296 292C236 292 168 318 152 378C140 430 190 462 236 436C270 416 290 356 300 302Z';
  const vF = 'M292 274C250 230 196 170 140 130M290 280C230 252 160 226 96 196M286 268C230 190 200 150 186 112';
  const vH = 'M294 300C250 330 214 370 194 420M292 298C240 310 196 340 166 380';
  for (const [d, x2, y2] of [[fore, 130, 130], [hind, 180, 420]]) {
    for (const dd of [d, mirrorD(d)]) {
      const mx = dd === d ? x2 : 600 - x2;
      s += c.P(dd, d === fore ? 'B' : 'B2', c.sh(dd, 300, 290, mx, y2, .95, .55));
      if (c.fine) s += c.dots(dd, 300, 290, mx, y2, 5.5, 1.25);
    }
  }
  s += c.L(vF, c.sw * .45) + c.L(mirrorD(vF), c.sw * .45) + c.L(vH, c.sw * .45) + c.L(mirrorD(vH), c.sw * .45);
  // wing-edge spots
  [[96, 150, 9], [118, 120, 6], [84, 182, 6], [170, 432, 8], [156, 404, 5]].forEach(([x, y, r]) => {
    for (const xx of [x, 600 - x]) s += `<circle cx="${xx}" cy="${y}" r="${r}" fill="${c.fine ? 'none' : c.pal.W}" stroke="${K}" stroke-width="${c.sw * .5}"/>`;
  });
  const bodyD = 'M300 236C314 236 316 266 314 300C312 360 308 404 300 418C292 404 288 360 286 300C284 266 286 236 300 236Z';
  s += c.fine ? c.L(bodyD, c.sw) + c.dots(bodyD, 300, 420, 300, 236, 4, 1.4) : `<path d="${bodyD}" fill="${K}"/>`;
  s += `<circle cx="300" cy="230" r="11" fill="${c.fine ? 'none' : K}" stroke="${K}" stroke-width="${c.sw*.7}"/>`;
  s += c.L('M296 222C288 190 270 168 246 156M304 222C312 190 330 168 354 156', c.sw * .5);
  s += `<circle cx="246" cy="156" r="4.5" fill="${K}"/><circle cx="354" cy="156" r="4.5" fill="${K}"/>`;
  return `<g transform="translate(${cx} ${cy}) scale(${sc}) translate(-300 -290)">${s}</g>`;
}

function crescent(c, cx, cy, sc) {
  let s = '';
  const moon = 'M340 110C250 120 180 200 180 300C180 400 260 480 360 486C300 450 262 380 262 300C262 216 300 146 340 110Z';
  s += c.P(moon, 'Y', c.sh(moon, 200, 300, 300, 300, .85) + c.dots(moon, 190, 320, 280, 300, 6, 1.5));
  if (!c.fine) s += c.L('M220 380C236 420 268 450 304 466', c.sw * .5);
  // face profile hints
  s += c.L('M262 268C270 262 280 264 286 270', c.sw * .45);
  return `<g transform="translate(${cx} ${cy}) scale(${sc}) translate(-300 -300)">${s}</g>`;
}

function star(c, cx, cy, r, k, rot) {
  let d = '';
  for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * .42 : r; const a = -Math.PI / 2 + i * Math.PI / 5 + (rot || 0); const p = pol(cx, cy, rr, a); d += (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1]); }
  d += 'Z';
  const sh = c.sh(`M${cx} ${cy}L${cx + r} ${cy - r}L${cx + r} ${cy + r}Z`, cx + r, cy, cx, cy, .0);
  return c.P(d, k || 'Y', c.sh(d, cx + r * .5, cy + r * .5, cx - r * .2, cy - r * .2, .7, .3), { sw: Math.max(2.5, c.sw * .7) });
}
function sparkle(c, cx, cy, r, filled) {
  const q = r * .16;
  const d = `M${cx} ${cy - r}C${cx + q} ${cy - q} ${cx + q} ${cy - q} ${cx + r} ${cy}C${cx + q} ${cy + q} ${cx + q} ${cy + q} ${cx} ${cy + r}C${cx - q} ${cy + q} ${cx - q} ${cy + q} ${cx - r} ${cy}C${cx - q} ${cy - q} ${cx - q} ${cy - q} ${cx} ${cy - r}Z`;
  return filled ? `<path d="${d}" fill="${K}"/>` : c.L(d, Math.max(2.4, c.sw * .45));
}

function koi(c, cx, cy, sc) {
  let s = '';
  const body = 'M150 300C170 230 250 190 330 200C390 208 430 240 450 280C430 300 400 320 340 336C270 354 200 350 150 300Z';
  const tail = 'M440 270C480 230 520 190 570 180C552 220 540 250 548 300C540 340 560 380 580 410C520 400 480 360 446 300Z';
  const finT = 'M260 206C280 160 330 140 380 150C360 170 352 190 350 206Z';
  const finB = 'M250 340C240 380 210 410 170 420C190 390 196 368 196 346Z';
  const finB2 = 'M360 330C370 360 390 380 420 390C410 366 404 344 402 322Z';
  s += c.P(tail, 'O', c.sh(tail, 446, 290, 560, 290, .8) + c.hl('M480 250C500 230 520 214 540 204', 4));
  s += c.L('M450 290C490 270 520 270 560 240M452 300C500 300 530 320 560 360', c.sw * .45);
  s += c.P(finT, 'O', c.sh(finT, 300, 206, 340, 160, .7));
  s += c.P(finB, 'O', c.sh(finB, 240, 340, 190, 410, .7));
  s += c.P(finB2, 'O', c.sh(finB2, 370, 330, 410, 380, .6));
  s += c.P(body, 'O', c.sh(body, 300, 350, 300, 260, .75, .45) + c.sh(body, 450, 280, 380, 280, .6));
  // white patch on head + scales
  if (!c.fine) s += `<path d="M150 300C170 240 220 214 262 216C250 260 236 300 210 330C186 326 166 316 150 300Z" fill="${c.pal.W}"/>`;
  for (let row = 0; row < 3; row++) for (let i = 0; i < 6 - row; i++) {
    const x = 262 + i * 30 + row * 16, y = 240 + row * 26;
    s += c.L(`M${x} ${y}a16 16 0 0 1 0 28`, c.sw * .4);
  }
  s += c.L(body, c.sw);
  s += `<circle cx="188" cy="268" r="${c.fine ? 5 : 8}" fill="${K}"/>`;
  s += c.L('M160 300C176 304 190 304 200 300', c.sw * .5) + c.L('M170 304C160 322 150 336 136 344', c.sw * .45);
  return `<g transform="translate(${cx} ${cy}) scale(${sc}) translate(-360 -300)">${s}</g>`;
}

function bez(p0, p1, p2, p3, t) { const u = 1 - t; return [u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0], u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1]]; }
function wave(c, cx, cy, sc) {
  let s = '';
  const A = [[60, 470], [70, 330], [170, 210], [310, 196]], B = [[310, 196], [430, 186], [510, 250], [500, 320]];
  const body = 'M60 470C70 330 170 210 310 196C430 186 510 250 500 320C494 366 452 384 420 366C392 350 392 314 414 302C380 296 350 318 344 354C336 410 380 450 440 456C480 460 512 452 540 446L540 520L60 520Z';
  s += c.P(body, 'B', c.sh(body, 300, 520, 300, 330, .8, .35) + c.sh(body, 70, 500, 260, 280, .55));
  // inner flow lines
  for (let i = 0; i < 6; i++) s += c.L(`M${96 + i * 26} ${500 - i * 2}C${120 + i * 22} ${400 - i * 22} ${200 + i * 12} ${300 - i * 10} ${300 + i * 6} ${270 - i * 8}`, c.sw * .42);
  // foam lip along the crest
  const crest = `M${A[0]} C${A[1]} ${A[2]} ${A[3]} C${B[1]} ${B[2]} ${B[3]}`;
  s += `<path d="${crest}" fill="none" stroke="${K}" stroke-width="${c.fine ? 14 : 40}" stroke-linecap="round"/>`;
  s += `<path d="${crest}" fill="none" stroke="${c.fine ? '#fff' : c.pal.W}" stroke-width="${c.fine ? 8 : 26}" stroke-linecap="round"/>`;
  // claw-like foam fingers reaching forward over the crest
  const pts = []; for (let i = 0; i < 9; i++) pts.push(bez(A[0], A[1], A[2], A[3], .35 + i * .08)); for (let i = 1; i < 7; i++) pts.push(bez(B[0], B[1], B[2], B[3], i * .12));
  pts.forEach((p, i) => {
    const q = i < pts.length - 1 ? pts[i + 1] : [p[0] + 2, p[1] + 10];
    let tx = q[0] - p[0], ty = q[1] - p[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const nx = ty, ny = -tx; const L = 26 + (i % 3) * 6;
    const tip = [p[0] + nx * L + tx * L * .9, p[1] + ny * L + ty * L * .9];
    const d = `M${f(p[0] - tx * 14)} ${f(p[1] - ty * 14)}C${f(p[0] + nx * L * 1.1 - tx * 6)} ${f(p[1] + ny * L * 1.1 - ty * 6)} ${f(tip[0] - tx * 8)} ${f(tip[1] - ty * 8)} ${f(tip[0])} ${f(tip[1])}C${f(p[0] + nx * L * .5 + tx * 10)} ${f(p[1] + ny * L * .5 + ty * 10)} ${f(p[0] + tx * 12)} ${f(p[1] + ty * 6)} ${f(p[0] + tx * 14)} ${f(p[1] + ty * 14)}Z`;
    s += `<path d="${d}" fill="${c.fine ? '#fff' : c.pal.W}" stroke="${K}" stroke-width="${c.sw * .7}" stroke-linejoin="round"/>`;
  });
  s += c.L('M60 520L540 520', c.sw);
  if (!c.fine) for (let i = 0; i < 10; i++) { const p = pol(470, 240, 70 + (i * 37) % 50, -1.5 + i * .2); s += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${3 + i % 3 * 2}" fill="${c.pal.W}" stroke="${K}" stroke-width="3"/>`; }
  return `<g transform="translate(${cx} ${cy}) scale(${sc}) translate(-300 -360)">${s}</g>`;
}

function blossom(c, cx, cy, r, rot) {
  let s = '';
  for (let i = 0; i < 5; i++) {
    const a = rot + i * Math.PI * 2 / 5, p = pol(cx, cy, r, a), l = pol(cx, cy, r * .8, a - .55), rr = pol(cx, cy, r * .8, a + .55);
    const tip1 = pol(cx, cy, r * 1.05, a - .12), tip2 = pol(cx, cy, r * 1.05, a + .12);
    const d = `M${cx} ${cy}C${f(l[0])} ${f(l[1])} ${f(tip1[0])} ${f(tip1[1])} ${f(p[0])} ${f(p[1] + 0)}C${f(tip2[0])} ${f(tip2[1])} ${f(rr[0])} ${f(rr[1])} ${cx} ${cy}Z`;
    s += c.P(d, 'P', c.sh(d, cx, cy, p[0], p[1], .55, .5), { sw: c.sw * .8 });
  }
  s += `<circle cx="${cx}" cy="${cy}" r="${r * .16}" fill="${c.fine ? 'none' : c.pal.Y}" stroke="${K}" stroke-width="${c.sw * .6}"/>`;
  return s;
}

/* ---------------- fine-line pieces ---------------- */
function sprig(c) {
  let s = '';
  s += c.L('M300 560C296 440 300 300 330 60', c.sw);
  const pairs = 9;
  for (let i = 0; i < pairs; i++) {
    const t = i / pairs, y = 520 - t * 420, x = 300 + Math.pow(t, 1.6) * 28, len = 120 - t * 70, w = 34 - t * 16;
    s += leafLine(c, x, y, -150 + t * 10, len, w) + leafLine(c, x + 2, y - 18, -30 - t * 10, len * .95, w);
  }
  s += c.L('M330 60C334 44 340 34 350 28', c.sw);
  for (let i = 0; i < 5; i++) { const p = pol(334, 70, 18 + i * 3, -1.2 + i * .5); s += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="3.2" fill="${K}"/>`; }
  return s;
}
function leafLine(c, x, y, ang, len, w) {
  const d = `M0 0C${f(len*.3)} ${f(-w)} ${f(len*.75)} ${f(-w*.8)} ${len} 0C${f(len*.75)} ${f(w*.7)} ${f(len*.3)} ${f(w*.8)} 0 0Z`;
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(ang)})">${c.L(d, c.sw)}${c.L(`M${f(len*.1)} 0L${f(len*.82)} 0`, c.sw * .6)}</g>`;
}
function moonPhases(c) {
  let s = '';
  const n = 7, r = 30, y = 100;
  for (let i = 0; i < n; i++) {
    const x = 60 + i * 80, k = i / (n - 1); // 0 new .. .5 full .. 1 new
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${K}" stroke-width="${c.sw}"/>`;
    const ph = Math.cos(k * Math.PI * 2); // 1 new, -1 full
    if (i === 3) { s += `<circle cx="${x}" cy="${y}" r="${r - 6}" fill="none" stroke="${K}" stroke-width="1.6" stroke-dasharray="1.5 5"/>`; continue; }
    const waxing = k < .5; const rx = Math.abs(ph) * r;
    const sweepLit = waxing ? 1 : 0;
    const d = `M${x} ${y - r}A${r} ${r} 0 0 ${waxing ? 0 : 1} ${x} ${y + r}A${f(rx)} ${r} 0 0 ${(ph > 0) === waxing ? 1 : 0} ${x} ${y - r}Z`;
    s += `<path d="${d}" fill="${K}"/>`;
  }
  s += c.L('M20 100L28 100M572 100L580 100', c.sw * .6);
  for (let i = 0; i < 6; i++) s += sparkle(c, 100 + i * 80, 38 + (i % 2) * 124, 6 + (i % 3) * 2, true);
  return s;
}
function constellation(c) {
  let s = '';
  const pts = [[160, 160], [230, 220], [300, 200], [360, 260], [420, 230], [460, 330], [380, 380], [300, 420], [250, 340]];
  s += `<circle cx="300" cy="300" r="250" fill="none" stroke="${K}" stroke-width="${c.sw * .6}"/><circle cx="300" cy="300" r="236" fill="none" stroke="${K}" stroke-width="1.6" stroke-dasharray="2 9"/>`;
  s += c.L('M' + pts.map(p => p.join(' ')).join('L'), c.sw * .55);
  s += c.L(`M300 200L250 340M360 260L380 380`, c.sw * .55, 'stroke-dasharray="4 7"');
  pts.forEach((p, i) => { s += i % 3 === 0 ? sparkle(c, p[0], p[1], 16, true) : `<circle cx="${p[0]}" cy="${p[1]}" r="${i % 2 ? 5 : 7}" fill="${K}"/>`; });
  for (let i = 0; i < 26; i++) { const a = i * 2.399, rr = 60 + (i * 53) % 170; const p = pol(300, 300, rr, a); s += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="1.8" fill="${K}"/>`; }
  // crescent at top
  s += `<path d="M300 40a26 26 0 1 0 22 40a20 20 0 1 1 -22 -40Z" fill="${K}"/>`;
  return s;
}
function lineWave(c) {
  let s = '';
  s += `<circle cx="300" cy="300" r="230" fill="none" stroke="${K}" stroke-width="${c.sw}"/>`;
  const cp = c.id(); c.defs.push(`<clipPath id="${cp}"><circle cx="300" cy="300" r="226"/></clipPath>`);
  let g = '';
  g += c.L('M40 380C120 380 160 300 230 260C320 210 420 240 420 310C420 360 360 380 330 350C306 326 320 290 352 296', c.sw);
  for (let i = 0; i < 6; i++) g += c.L(`M40 ${410 + i * 22}C140 ${400 + i * 22} 200 ${430 + i * 22} 300 ${414 + i * 22}S470 ${402 + i * 22} 560 ${416 + i * 22}`, c.sw * .8);
  g += c.L('M150 360C190 310 230 290 280 280M170 380C210 340 250 320 300 312', c.sw * .6);
  // sun
  g += `<circle cx="420" cy="170" r="44" fill="none" stroke="${K}" stroke-width="${c.sw}"/>`;
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, p = pol(420, 170, 56, a), q = pol(420, 170, 70, a); g += c.L(`M${f(p[0])} ${f(p[1])}L${f(q[0])} ${f(q[1])}`, c.sw * .7); }
  s += `<g clip-path="url(#${cp})">${g}</g>`;
  return s;
}

/* ---------------- blackwork & geometric ---------------- */
function mandala(c, seed) {
  let s = '';
  const cx = 300, cy = 300;
  const ring = (r, w) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${K}" stroke-width="${w}"/>`;
  // outer lotus petals
  const N = 16;
  for (let i = 0; i < N; i++) {
    const a = i * Math.PI * 2 / N, a1 = a - Math.PI / N, a2 = a + Math.PI / N;
    const p1 = pol(cx, cy, 200, a1), p2 = pol(cx, cy, 200, a2), tip = pol(cx, cy, 282, a), c1 = pol(cx, cy, 262, a - .15), c2 = pol(cx, cy, 262, a + .15);
    const d = `M${f(p1[0])} ${f(p1[1])}Q${f(c1[0])} ${f(c1[1])} ${f(tip[0])} ${f(tip[1])}Q${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}Z`;
    s += `<path d="${d}" fill="none" stroke="${K}" stroke-width="5"/>`;
    const ip1 = pol(cx, cy, 212, a - .1), ip2 = pol(cx, cy, 212, a + .1), it = pol(cx, cy, 258, a);
    s += `<path d="M${f(ip1[0])} ${f(ip1[1])}Q${f(cx + (it[0] - cx) * .98)} ${f(cy + (it[1] - cy) * .98)} ${f(it[0])} ${f(it[1])}Q${f(cx + (it[0] - cx) * .98)} ${f(cy + (it[1] - cy) * .98)} ${f(ip2[0])} ${f(ip2[1])}Z" fill="${K}"/>`;
    const dp = pol(cx, cy, 294, a2); s += `<circle cx="${f(dp[0])}" cy="${f(dp[1])}" r="4" fill="${K}"/>`;
  }
  s += ring(200, 7) + ring(188, 2.5);
  // dotted band
  for (let i = 0; i < 64; i++) { const p = pol(cx, cy, 176, i * Math.PI / 32); s += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="3.4" fill="${K}"/>`; }
  s += ring(164, 3);
  // solid black band with negative triangles
  let band = '';
  const M2 = 24;
  for (let i = 0; i < M2; i++) {
    const a = i * Math.PI * 2 / M2, a2 = (i + 1) * Math.PI * 2 / M2, am = (a + a2) / 2;
    const o1 = pol(cx, cy, 160, a), o2 = pol(cx, cy, 160, a2), i1 = pol(cx, cy, 118, am);
    band += `M${f(o1[0])} ${f(o1[1])}L${f(o2[0])} ${f(o2[1])}L${f(i1[0])} ${f(i1[1])}Z`;
  }
  s += `<path d="${band}" fill="${K}"/>`;
  s += ring(114, 4);
  // inner petals (scalloped)
  const N3 = 12;
  for (let i = 0; i < N3; i++) {
    const a = i * Math.PI * 2 / N3, p1 = pol(cx, cy, 52, a - .26), p2 = pol(cx, cy, 52, a + .26), t = pol(cx, cy, 108, a);
    const d = `M${f(p1[0])} ${f(p1[1])}C${f(pol(cx, cy, 90, a - .38)[0])} ${f(pol(cx, cy, 90, a - .38)[1])} ${f(pol(cx, cy, 104, a - .1)[0])} ${f(pol(cx, cy, 104, a - .1)[1])} ${f(t[0])} ${f(t[1])}C${f(pol(cx, cy, 104, a + .1)[0])} ${f(pol(cx, cy, 104, a + .1)[1])} ${f(pol(cx, cy, 90, a + .38)[0])} ${f(pol(cx, cy, 90, a + .38)[1])} ${f(p2[0])} ${f(p2[1])}Z`;
    s += `<path d="${d}" fill="none" stroke="${K}" stroke-width="4"/>`;
    const l1 = pol(cx, cy, 60, a), l2 = pol(cx, cy, 94, a);
    s += c.L(`M${f(l1[0])} ${f(l1[1])}L${f(l2[0])} ${f(l2[1])}`, 2.5);
  }
  s += `<circle cx="${cx}" cy="${cy}" r="48" fill="${K}"/>` + `<circle cx="${cx}" cy="${cy}" r="30" fill="none" stroke="#fff" stroke-width="3"/>`;
  for (let i = 0; i < 8; i++) { const p = pol(cx, cy, 39, i * Math.PI / 4); s += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="3" fill="#fff"/>`; }
  s += `<circle cx="${cx}" cy="${cy}" r="10" fill="#fff"/>`;
  return s;
}
function sacred(c) {
  let s = '';
  const cx = 300, cy = 300, r = 60;
  const circ = (x, y, rr, w) => `<circle cx="${f(x)}" cy="${f(y)}" r="${rr}" fill="none" stroke="${K}" stroke-width="${w}"/>`;
  s += circ(cx, cy, 262, 6) + circ(cx, cy, 250, 2);
  // flower of life (19 circles)
  const centers = [[0, 0]];
  for (let ring = 1; ring <= 2; ring++) for (let i = 0; i < 6; i++) for (let k = 0; k < ring; k++) {
    const a = i * Math.PI / 3, b = (i + 2) * Math.PI / 3;
    centers.push([ring * Math.cos(a) + k * Math.cos(b), ring * Math.sin(a) + k * Math.sin(b)]);
  }
  centers.forEach(([x, y]) => s += circ(cx + x * r, cy + y * r, r, 3));
  s += circ(cx, cy, r * 3, 5);
  // triangles
  const tri = (rr, rot) => { let d = ''; for (let i = 0; i < 3; i++) { const p = pol(cx, cy, rr, rot + i * Math.PI * 2 / 3); d += (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1]); } return d + 'Z'; };
  s += c.L(tri(250, -Math.PI / 2), 5) + c.L(tri(250, Math.PI / 2), 5);
  // solid black corners of hexagram to give weight
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3, p = pol(cx, cy, 250, a), q1 = pol(cx, cy, 144.3, a - Math.PI / 6), q2 = pol(cx, cy, 144.3, a + Math.PI / 6); s += `<path d="M${f(p[0])} ${f(p[1])}L${f(q1[0])} ${f(q1[1])}L${f(q2[0])} ${f(q2[1])}Z" fill="${K}" fill-opacity=".9"/>`; }
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3, p = pol(cx, cy, 214, a); s += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="9" fill="#fff" stroke="${K}" stroke-width="3"/>`; }
  for (let i = 0; i < 48; i++) { const p = pol(cx, cy, 276, i * Math.PI / 24); s += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${i % 4 ? 2.4 : 4.4}" fill="${K}"/>`; }
  s += `<circle cx="${cx}" cy="${cy}" r="14" fill="${K}"/>`;
  return s;
}
function dotSun(c) {
  let s = '';
  const cx = 300, cy = 300;
  // stippled sun with a crescent eclipse
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12, long = i % 2 === 0, r1 = 150, r2 = long ? 270 : 220;
    const p1 = pol(cx, cy, r1, a - (long ? .1 : .07)), p2 = pol(cx, cy, r1, a + (long ? .1 : .07)), t = pol(cx, cy, r2, a);
    const d = `M${f(p1[0])} ${f(p1[1])}L${f(t[0])} ${f(t[1])}L${f(p2[0])} ${f(p2[1])}Z`;
    s += long ? `<path d="${d}" fill="${K}"/>` : `<path d="${d}" fill="none" stroke="${K}" stroke-width="3"/>` + c.dots(d, f(p1[0]), f(p1[1]), f(t[0]), f(t[1]), 5, 1.3);
  }
  const disc = 'M300 160a140 140 0 1 1 -0.1 0Z';
  s += `<path d="${disc}" fill="#fff" stroke="${K}" stroke-width="6"/>`;
  s += c.dots(disc, 180, 300, 420, 300, 5.4, 1.5);
  // crescent overlay
  const cres = 'M300 186a114 114 0 1 0 0.1 0ZM340 196a100 100 0 1 1 -0.1 0Z';
  s += `<path d="M300 186A114 114 0 1 0 380 380A100 100 0 1 1 300 186Z" fill="${K}"/>`;
  for (let i = 0; i < 30; i++) { const p = pol(cx, cy, 128, i * Math.PI / 15); s += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="2.6" fill="${K}"/>`; }
  return s;
}

/* ---------------- library ---------------- */
const LIB = [
  { id: 'rose', name: 'Traditional Rose', style: 'traditional', size: 9, line: 'bold', tags: ['Love', 'Classic'], artist: 'House flash · No. 01', build: m => trad_rose(m || 'color') },
  { id: 'swallow', name: 'Homeward Swallow', style: 'traditional', size: 10, line: 'bold', tags: ['Travel'], artist: 'House flash · No. 02', build: m => { const c = Ctx(m || 'color'); return wrapSVG(600, 600, c, swallow(c, 300, 300, 1)); } },
  { id: 'dagger', name: 'Dagger & Banner', style: 'traditional', size: 13, line: 'bold', tags: ['Courage'], artist: 'House flash · No. 03', w: 420, h: 700, build: m => { const c = Ctx(m || 'color'); return wrapSVG(420, 700, c, dagger(c, 210, 350, 1, 0, 'TRUE')); } },
  { id: 'anchor', name: 'Hold Fast Anchor', style: 'traditional', size: 10, line: 'bold', tags: ['Sea', 'Classic'], artist: 'House flash · No. 04', build: m => { const c = Ctx(m || 'color'); return wrapSVG(600, 600, c, anchor(c, 300, 300, 1, 'HOLD FAST')); } },
  { id: 'snake', name: 'Garden Snake', style: 'traditional', size: 12, line: 'bold', tags: ['Rebirth'], artist: 'House flash · No. 05', build: m => { const c = Ctx(m || 'color'); return wrapSVG(600, 640, c, snake(c, 300, 320, 1)); }, w: 600, h: 640 },
  { id: 'skull', name: 'Skull & Roses', style: 'traditional', size: 11, line: 'bold', tags: ['Memento mori'], artist: 'House flash · No. 06', build: m => { const c = Ctx(m || 'color'); let s = leaf(c, 150, 470, 160, 120, 44) + leaf(c, 450, 470, 20, 120, 44, true) + rose(c, 160, 420, .5, -15) + rose(c, 440, 420, .5, 15) + skull(c, 300, 270, .92); return wrapSVG(600, 600, c, s); } },
  { id: 'heart', name: 'True Love Heart', style: 'traditional', size: 10, line: 'bold', tags: ['Love'], artist: 'House flash · No. 07', build: m => { const c = Ctx(m || 'color'); return wrapSVG(600, 600, c, heart(c, 300, 300, .98, 'TRUE LOVE')); } },
  { id: 'sprig', name: 'Olive Sprig', style: 'fineline', size: 11, line: 'fine', tags: ['Botanical'], artist: 'Single needle', build: () => { const c = Ctx('fine', 3.2); return wrapSVG(600, 600, c, sprig(c)); } },
  { id: 'phases', name: 'Moon Phases', style: 'fineline', size: 12, line: 'fine', tags: ['Celestial'], artist: 'Single needle', w: 600, h: 200, build: () => { const c = Ctx('fine', 3.2); return wrapSVG(600, 200, c, moonPhases(c)); } },
  { id: 'constellation', name: 'Night Constellation', style: 'fineline', size: 8, line: 'fine', tags: ['Celestial'], artist: 'Single needle', build: () => { const c = Ctx('fine', 3); return wrapSVG(600, 600, c, constellation(c)); } },
  { id: 'butterfly', name: 'Dotwork Butterfly', style: 'fineline', size: 8, line: 'fine', tags: ['Change'], artist: 'Fine line + stipple', build: m => { const c = Ctx(m || 'fine', 3.4); let s = butterfly(c, 300, 290, 1); if ((m || 'fine') === 'fine') { /* add stipple wings in fine mode */ } return wrapSVG(600, 560, c, s); }, w: 600, h: 560 },
  { id: 'linewave', name: 'Tide Line', style: 'fineline', size: 7, line: 'fine', tags: ['Sea', 'Minimal'], artist: 'Single needle', build: () => { const c = Ctx('fine', 3.4); return wrapSVG(600, 600, c, lineWave(c)); } },
  { id: 'mandala', name: 'Lotus Mandala', style: 'blackwork', size: 10, line: 'bold', tags: ['Geometric'], artist: 'Blackwork', build: () => { const c = Ctx('bw'); return wrapSVG(600, 600, c, mandala(c)); } },
  { id: 'sacred', name: 'Seed of Life', style: 'blackwork', size: 10, line: 'bold', tags: ['Geometric'], artist: 'Blackwork', build: () => { const c = Ctx('bw'); return wrapSVG(600, 600, c, sacred(c)); } },
  { id: 'eclipse', name: 'Dotwork Eclipse', style: 'blackwork', size: 9, line: 'bold', tags: ['Dotwork', 'Celestial'], artist: 'Dotwork', build: () => { const c = Ctx('bw'); return wrapSVG(600, 600, c, dotSun(c)); } },
  { id: 'wave', name: 'Great Swell', style: 'japanese', size: 13, line: 'bold', tags: ['Sea'], artist: 'Irezumi-inspired', w: 600, h: 440, build: m => { const c = Ctx(m || 'color'); return wrapSVG(600, 440, c, wave(c, 300, 230, 1)); } },
  { id: 'koi', name: 'Rising Koi', style: 'japanese', size: 13, line: 'bold', tags: ['Perseverance'], artist: 'Irezumi-inspired', w: 640, h: 480, build: m => { const c = Ctx(m || 'color'); let s = koi(c, 320, 240, 1); for (let i = 0; i < 3; i++) s += c.L(`M${60 + i * 30} ${420 - i * 10}c30 -20 60 -20 90 0s60 20 90 0`, c.sw * .6); return wrapSVG(640, 480, c, s); } },
  { id: 'sakura', name: 'Sakura Branch', style: 'japanese', size: 12, line: 'bold', tags: ['Ephemeral'], artist: 'Irezumi-inspired', build: m => { const c = Ctx(m || 'color'); let s = c.P('M60 520C140 440 220 420 300 360C380 300 420 220 540 120L548 130C440 230 400 320 320 380C250 432 160 470 74 534Z', 'T', c.sh('M60 520C140 440 220 420 300 360C380 300 420 220 540 120L548 130C440 230 400 320 320 380C250 432 160 470 74 534Z', 300, 380, 290, 360, .7)); s += c.P('M300 368C320 410 330 440 320 480L330 484C344 440 334 404 312 362Z', 'T'); s += blossom(c, 330, 300, 62, .3) + blossom(c, 460, 190, 50, 1.1) + blossom(c, 180, 450, 54, .8) + blossom(c, 324, 470, 38, .2); [[410, 280], [240, 380], [520, 160]].forEach(([x, y]) => s += c.P(`M${x} ${y}c-14 -22 -4 -40 10 -40c14 0 22 20 -10 40Z`, 'P')); for (let i = 0; i < 4; i++) s += c.P(`M${120 + i * 110} ${120 + (i % 2) * 60}c10 -16 26 -10 22 4c-4 12 -16 14 -22 -4Z`, 'P', '', { sw: 4 }); return wrapSVG(600, 600, c, s); } },
  { id: 'amorfati', name: 'Amor Fati', style: 'script', size: 12, line: 'fine', tags: ['Lettering'], artist: 'Script', w: 900, h: 300, text: { str: 'Amor Fati', font: 'script', curve: 0, flourish: true } },
  { id: 'family', name: 'Family — Blackletter', style: 'script', size: 13, line: 'bold', tags: ['Lettering'], artist: 'Blackletter', w: 900, h: 300, text: { str: 'Family', font: 'blackletter', curve: 0.18 } },
  { id: 'stillhere', name: 'still here', style: 'script', size: 7, line: 'fine', tags: ['Lettering', 'Minimal'], artist: 'Typewriter', w: 900, h: 260, text: { str: 'still here', font: 'typewriter', curve: 0 } }
];

const STYLES = [
  { id: 'all', label: 'All' }, { id: 'traditional', label: 'Traditional' }, { id: 'fineline', label: 'Fine line' },
  { id: 'blackwork', label: 'Blackwork' }, { id: 'japanese', label: 'Japanese' }, { id: 'script', label: 'Script' }
];

const FONTS = {
  script: { label: 'Script', css: "'Ink Script','Pinyon Script','Snell Roundhand',cursive", weight: 400, size: 1.05 },
  blackletter: { label: 'Blackletter', css: "'Ink Blackletter','UnifrakturMaguntia','Old English Text MT',serif", weight: 400, size: .9 },
  serif: { label: 'Serif caps', css: "'Playfair Display','Fraunces','Lora','DejaVu Serif',Georgia,serif", weight: 700, size: .62, caps: true, ls: .12 },
  typewriter: { label: 'Typewriter', css: "'Special Elite','Courier Prime','Courier 10 Pitch','Courier New',monospace", weight: 400, size: .62 }
};

/* draw text along an arc on a 2D canvas (curve: -1..1, + = smile) */
function drawText(ctx, str, o) {
  const F = FONTS[o.font] || FONTS.script;
  const txt = F.caps ? str.toUpperCase() : str;
  let size = o.size || 140;
  ctx.save();
  ctx.fillStyle = o.color || K;
  ctx.textBaseline = 'middle';
  const font = s => `${F.weight} ${s}px ${F.css}`;
  ctx.font = font(size);
  const ls = (F.ls || 0) * size;
  const widthOf = () => [...txt].reduce((w, ch) => w + ctx.measureText(ch).width + ls, -ls);
  let total = widthOf();
  if (o.maxW && total > o.maxW) { size *= o.maxW / total; ctx.font = font(size); total = widthOf(); }
  const curve = o.curve || 0;
  if (Math.abs(curve) < .02) {
    let x = o.x - total / 2;
    for (const ch of txt) { ctx.fillText(ch, x, o.y); x += ctx.measureText(ch).width + ls; }
  } else {
    const R = total / (Math.abs(curve) * Math.PI * 1.2);
    const cy = curve > 0 ? o.y - R : o.y + R;
    let ang = -total / (2 * R);
    for (const ch of txt) {
      const w = ctx.measureText(ch).width;
      const a = ang + w / (2 * R);
      ctx.save();
      if (curve > 0) { ctx.translate(o.x + R * Math.sin(-a) * -1, cy + R * Math.cos(a)); ctx.rotate(-a); }
      else { ctx.translate(o.x + R * Math.sin(a), cy - R * Math.cos(a)); ctx.rotate(a); }
      ctx.fillText(ch, -w / 2, 0);
      ctx.restore();
      ang += (w + ls) / R;
    }
  }
  ctx.restore();
  return size;
}

function svgImage(svg) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img); img.onerror = () => rej(new Error('SVG failed to load'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

async function fontsReady() { try { if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch (e) {} }

/* rasterize a library design (or a built design spec) to a canvas, trimmed to content with padding */
async function raster(d, px, mode) {
  px = px || 1024;
  const w = d.w || 600, h = d.h || 600;
  const sc = px / Math.max(w, h);
  const cv = document.createElement('canvas'); cv.width = Math.round(w * sc); cv.height = Math.round(h * sc);
  const ctx = cv.getContext('2d');
  if (d.text) {
    await fontsReady();
    const T = d.text;
    const fs = drawText(ctx, T.str, { font: T.font, x: cv.width / 2, y: cv.height * (T.curve > 0 ? .62 : .5), size: cv.height * .5 * (FONTS[T.font] || FONTS.script).size, maxW: cv.width * .9, curve: T.curve });
    if (T.flourish) {
      ctx.save(); ctx.strokeStyle = K; ctx.lineWidth = Math.max(2, cv.width * .004); ctx.lineCap = 'round';
      ctx.beginPath(); const y = cv.height * .78; ctx.moveTo(cv.width * .2, y); ctx.bezierCurveTo(cv.width * .4, y + cv.height * .08, cv.width * .6, y - cv.height * .06, cv.width * .82, y + cv.height * .02); ctx.stroke();
      ctx.beginPath(); ctx.arc(cv.width * .84, y + cv.height * .01, cv.width * .006, 0, 7); ctx.fillStyle = K; ctx.fill(); ctx.restore();
    }
  } else if (d.svg || d.build) {
    const svg = d.svg || d.build(mode);
    const img = await svgImage(svg);
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
  } else if (d.image) {
    const img = await svgImage(d.image).catch(() => null) || await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = d.image; });
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
  }
  return cv;
}

/* ---------------- Tattoo Builder ---------------- */
const MOTIFS = [
  { id: 'rose', label: 'Rose', draw: (c) => c.L('M300 380C304 440 298 500 286 552', c.sw * 1.5) + leaf(c, 272, 372, 168, 170, 60) + leaf(c, 328, 372, 12, 170, 60, true) + rose(c, 300, 262, .86) },
  { id: 'swallow', label: 'Swallow', draw: c => swallow(c, 300, 300, .9) },
  { id: 'dagger', label: 'Dagger', draw: c => dagger(c, 300, 300, .8, 0, null) },
  { id: 'heart', label: 'Heart', draw: c => heart(c, 300, 316, .82, null) },
  { id: 'anchor', label: 'Anchor', draw: c => anchor(c, 300, 300, .9, null) },
  { id: 'skull', label: 'Skull', draw: c => skull(c, 300, 300, .95) },
  { id: 'butterfly', label: 'Butterfly', draw: c => butterfly(c, 300, 300, .88) },
  { id: 'moon', label: 'Moon', draw: c => crescent(c, 300, 300, .9) },
  { id: 'koi', label: 'Koi', draw: c => koi(c, 300, 300, .82) },
  { id: 'snake', label: 'Snake', draw: c => snake(c, 300, 300, .82) },
  { id: 'blossom', label: 'Blossom', draw: c => blossom(c, 300, 300, 150, -Math.PI / 2) }
];
const FRAMES = [
  { id: 'none', label: 'None', back: () => '', front: () => '' },
  { id: 'ring', label: 'Ring', back: () => '', front: c => `<circle cx="300" cy="300" r="268" fill="none" stroke="${K}" stroke-width="${c.fine ? 3 : 10}"/><circle cx="300" cy="300" r="252" fill="none" stroke="${K}" stroke-width="${c.fine ? 1.6 : 3}" ${c.fine ? 'stroke-dasharray="2 8"' : ''}/>` },
  { id: 'rays', label: 'Sunburst', back: c => { let s = ''; for (let i = 0; i < 36; i++) { const a = i * Math.PI / 18, p1 = pol(300, 300, 190, a - .035), p2 = pol(300, 300, 190, a + .035), t = pol(300, 300, i % 2 ? 250 : 290, a); s += c.fine ? c.L(`M${f(pol(300, 300, 200, a)[0])} ${f(pol(300, 300, 200, a)[1])}L${f(t[0])} ${f(t[1])}`, 2.4) : `<path d="M${f(p1[0])} ${f(p1[1])}L${f(t[0])} ${f(t[1])}L${f(p2[0])} ${f(p2[1])}Z" fill="${K}"/>`; } return s; }, front: () => '' },
  { id: 'diamond', label: 'Diamond', back: c => c.fine ? '' : `<path d="M300 28L572 300L300 572L28 300Z" fill="none" stroke="${K}" stroke-width="3" stroke-dasharray="2 10"/>`, front: c => `<path d="M300 40L560 300L300 560L40 300Z" fill="none" stroke="${K}" stroke-width="${c.fine ? 3 : 9}" stroke-linejoin="round"/>` },
  { id: 'laurel', label: 'Laurel', back: () => '', front: c => { let s = ''; for (const side of [-1, 1]) { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10, a = Math.PI / 2 + side * (0.25 + t * 2.3); pts.push(pol(300, 300, 262, a)); } s += c.L('M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L'), c.fine ? 3 : 6); for (let i = 1; i < 10; i++) { const p = pts[i], q = pts[i + 1]; const tang = Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI; for (const off of [-38, 38]) { s += c.fine ? leafLine(c, p[0], p[1], tang + off, 46 - i * 2, 15) : leaf(c, f(p[0]), f(p[1]), f(tang + off), 54 - i * 2.4, 19, off < 0); } } } return s; } },
  { id: 'banner', label: 'Banner', back: () => '', front: () => '' }
];
const ACCENTS = [
  { id: 'stars', label: 'Stars', draw: c => star(c, 92, 120, 30, 'Y') + star(c, 510, 150, 22, 'Y', .3) + star(c, 520, 470, 16, 'Y', .2) },
  { id: 'sparkles', label: 'Sparkles', draw: c => sparkle(c, 100, 200, 26, !c.fine) + sparkle(c, 500, 100, 20, !c.fine) + sparkle(c, 490, 420, 16, !c.fine) + sparkle(c, 140, 470, 12, !c.fine) },
  { id: 'dots', label: 'Dot trail', draw: c => { let s = ''; for (let i = 0; i < 14; i++) { const p = pol(300, 300, 282, Math.PI * .65 + i * .12); s += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${2 + (7 - Math.abs(i - 7)) * .9}" fill="${K}"/>`; } return s; } },
  { id: 'leaves', label: 'Leaves', draw: c => c.fine ? leafLine(c, 120, 470, -40, 80, 26) + leafLine(c, 470, 470, -140, 80, 26) : leaf(c, 110, 480, -40, 90, 34) + leaf(c, 490, 480, -140, 90, 34, true) },
  { id: 'swirls', label: 'Swirls', draw: c => c.L('M70 300C70 240 120 210 150 236C176 258 160 290 136 284M530 300C530 360 480 390 450 364C424 342 440 310 464 316', c.fine ? 3 : 7) },
  { id: 'flames', label: 'Flames', draw: c => { let s = ''; for (const x of [150, 450]) { const d = `M${x} 140C${x - 30} 100 ${x - 10} 60 ${x + 10} 30C${x + 6} 66 ${x + 30} 70 ${x + 32} 50C${x + 48} 90 ${x + 30} 130 ${x} 140Z`; s += c.P(d, 'O', c.sh(d, x, 140, x, 60, .5)); } return s; } }
];

function buildSVG(spec) {
  const mode = spec.mode || 'color';
  const c = Ctx(mode);
  const M = spec.motif === 'none' ? { draw: () => '' } : (MOTIFS.find(m => m.id === spec.motif) || MOTIFS[0]);
  const F = FRAMES.find(x => x.id === spec.frame) || FRAMES[0];
  let s = F.back(c);
  const sc = spec.frame && spec.frame !== 'none' && spec.frame !== 'banner' ? .74 : .92;
  s += `<g transform="translate(300 300) scale(${sc}) translate(-300 -300)">${M.draw(c)}</g>`;
  s += F.front(c);
  (spec.accents || []).forEach(id => { const A = ACCENTS.find(a => a.id === id); if (A) s += A.draw(c); });
  if (spec.frame === 'banner') s += banner(c, 300, 470, 340, (spec.bannerText || '').toUpperCase().slice(0, 14), { h: 64, bend: 24 });
  return wrapSVG(600, 600, c, s);
}

async function rasterBuilt(spec, px) {
  px = px || 1024;
  const hasText = spec.text && spec.text.str && spec.text.pos !== 'none';
  const H = hasText && spec.text.pos !== 'over' ? 760 : 600;
  const sc = px / H;
  const cv = document.createElement('canvas'); cv.width = Math.round(600 * sc); cv.height = Math.round(H * sc);
  const ctx = cv.getContext('2d');
  const img = await svgImage(buildSVG(spec));
  const top = hasText && spec.text.pos === 'above' ? 160 : 0;
  ctx.drawImage(img, 0, top * sc, 600 * sc, 600 * sc);
  if (hasText) {
    await fontsReady();
    const F = FONTS[spec.text.font] || FONTS.script;
    const yy = spec.text.pos === 'above' ? 92 : spec.text.pos === 'over' ? 300 : 680;
    const curve = (spec.text.curve || 0) * (spec.text.pos === 'above' ? -1 : 1);
    drawText(ctx, spec.text.str, { font: spec.text.font, x: 300 * sc, y: yy * sc, size: 120 * sc * F.size, maxW: 560 * sc, curve, color: K });
  }
  return cv;
}

window.InkDesigns = { LIB, STYLES, FONTS, MOTIFS, FRAMES, ACCENTS, raster, rasterBuilt, buildSVG, svgImage, drawText, K };
})();

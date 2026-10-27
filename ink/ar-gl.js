/* INK STUDY — simulated AR camera.
   Raw WebGL2 (falls back to WebGL1): a procedural limb mesh with skin shading, a depth-of-field room (or webcam)
   behind it, and a tattoo wrapped onto the curved surface with per-pixel healing + aging.
   No libraries. One mesh draw + one background quad per frame. */
(function () {
'use strict';

/* ---------------- small mat4 helpers (column-major) ---------------- */
const M = {
  id() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; },
  mul(a, b) { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k*4+r] * b[c*4+k]; o[c*4+r] = s; } return o; },
  persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2); return [t/asp,0,0,0, 0,t,0,0, 0,0,(f+n)/(n-f),-1, 0,0,2*f*n/(n-f),0]; },
  rx(a) { const c = Math.cos(a), s = Math.sin(a); return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]; },
  ry(a) { const c = Math.cos(a), s = Math.sin(a); return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]; },
  rz(a) { const c = Math.cos(a), s = Math.sin(a); return [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]; },
  tr(x, y, z) { return [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]; },
  xf(m, v) { const x=v[0],y=v[1],z=v[2],w=v.length>3?v[3]:1; return [m[0]*x+m[4]*y+m[8]*z+m[12]*w, m[1]*x+m[5]*y+m[9]*z+m[13]*w, m[2]*x+m[6]*y+m[10]*z+m[14]*w, m[3]*x+m[7]*y+m[11]*z+m[15]*w]; }
};

/* ---------------- body parts: anatomical radius profiles (cm) ---------------- */
// keys: [z, halfWidth a, halfDepth b]; bumps: [z, phi, sigmaZ, sigmaPhi, amp]
// phi = 0 faces the camera at roll 0, +phi toward screen-right.
const BODIES = {
  forearm: {
    label: 'Forearm', z: [-34, 32], phiFace: 0, zLim: [-13, 10], tilt: -0.30, dist: 37, skinTan: 0.10,
    keys: [[-20,4.5,4.0],[-14,4.45,3.95],[-9,4.25,3.65],[-3,3.85,3.15],[3,3.4,2.65],[8,3.05,2.15],[12,2.95,1.95],[15,3.25,1.75],[20,3.9,1.55]],
    bumps: [[-8,1.25,4.5,0.75,0.075],[-6,-0.25,5,0.8,0.045],[-9,-1.6,4,0.6,0.03],[10.5,0.22,2.6,0.09,0.012],[10.8,-0.18,2.4,0.08,0.009],[12.2,1.45,1.4,0.3,0.03]],
    sides: [{ name: 'Inner forearm', from: -1.1, to: 1.1, mult: 1.0 }, { name: 'Outer forearm', mult: 1.25 }],
    defaultRoll: 0, defaultZ: 0.5
  },
  upper: {
    label: 'Upper arm', z: [-34, 32], phiFace: 1.25, zLim: [-12, 12], tilt: -0.08, dist: 36, skinTan: 0.04,
    keys: [[-20,4.2,4.1],[-14,4.0,3.9],[-8,4.55,4.4],[-1,4.95,4.75],[6,5.1,4.9],[12,5.6,5.2],[17,6.2,5.6],[20,6.6,5.8]],
    bumps: [[-2,0.35,6,0.75,0.07],[11,1.7,5,0.9,0.06],[-3,-1.7,7,0.8,0.035]],
    sides: [{ name: 'Outer upper arm', from: 0.45, to: 2.5, mult: 0.95 }, { name: 'Front / inner upper arm', mult: 0.8 }],
    defaultRoll: -0.9, defaultZ: 0.5
  },
  calf: {
    label: 'Calf', z: [-40, 38], phiFace: Math.PI, zLim: [-14, 14], tilt: 0.05, dist: 42, skinTan: 0.06,
    keys: [[-20,3.0,3.2],[-15,3.05,3.15],[-10,3.6,3.7],[-4,4.6,4.8],[2,5.3,5.6],[8,5.45,5.8],[14,5.0,5.2],[20,4.9,5.0]],
    bumps: [[5,Math.PI-0.45,6.5,0.6,0.07],[5.5,Math.PI+0.5,6,0.6,0.06],[-12,Math.PI,4,0.25,0.03],[-2,0.15,10,0.25,0.02]],
    sides: [{ name: 'Back of calf', from: Math.PI/2, to: Math.PI*1.5, mult: 0.85 }, { name: 'Shin side', mult: 1.0 }],
    defaultRoll: Math.PI, defaultZ: 1.5
  }
};

function catmull(keys, z, idx) {
  if (z <= keys[0][0]) return keys[0][idx];
  const n = keys.length; if (z >= keys[n-1][0]) return keys[n-1][idx];
  let i = 0; while (keys[i+1][0] < z) i++;
  const p0 = keys[Math.max(0,i-1)][idx], p1 = keys[i][idx], p2 = keys[i+1][idx], p3 = keys[Math.min(n-1,i+2)][idx];
  const t = (z - keys[i][0]) / (keys[i+1][0] - keys[i][0]);
  const t2 = t*t, t3 = t2*t;
  return 0.5*((2*p1) + (-p0+p2)*t + (2*p0-5*p1+4*p2-p3)*t2 + (-p0+3*p1-3*p2+p3)*t3);
}
function angDiff(a, b) { let d = a - b; d = ((d + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI; return d; }
function surf(body, z, phi) {
  const a = catmull(body.keys, z, 1), b = catmull(body.keys, z, 2);
  let r = 1;
  for (const k of body.bumps) { const dz = (z-k[0])/k[2], dp = angDiff(phi,k[1])/k[3]; r += k[4]*Math.exp(-0.5*(dz*dz+dp*dp)); }
  return [a*Math.sin(phi)*r, z, b*Math.cos(phi)*r];
}

function buildMesh(body) {
  const NZ = 170, NP = 144; // rings, segments
  const z0 = body.z[0], z1 = body.z[1];
  const verts = (NZ+1)*(NP+1);
  const pos = new Float32Array(verts*3), nrm = new Float32Array(verts*3), par = new Float32Array(verts*4);
  // arc length lookup per ring
  for (let i = 0; i <= NZ; i++) {
    const z = z0 + (z1-z0)*i/NZ;
    const ring = []; for (let j = 0; j <= NP; j++) ring.push(surf(body, z, (j/NP)*Math.PI*2 - Math.PI));
    const arc = [0]; for (let j = 1; j <= NP; j++) { const p = ring[j], q = ring[j-1]; arc.push(arc[j-1] + Math.hypot(p[0]-q[0], p[2]-q[2])); }
    const per = arc[NP]; const mid = arc[NP/2]; // arc at phi = 0
    for (let j = 0; j <= NP; j++) {
      const phi = (j/NP)*Math.PI*2 - Math.PI, v = i*(NP+1)+j, p = ring[j];
      pos.set(p, v*3);
      const e = 0.02, dz = 0.05;
      const pa = surf(body, z, phi+e), pb = surf(body, z, phi-e), pc = surf(body, z+dz, phi), pd = surf(body, z-dz, phi);
      const tu = [pa[0]-pb[0], pa[1]-pb[1], pa[2]-pb[2]], tv = [pc[0]-pd[0], pc[1]-pd[1], pc[2]-pd[2]];
      let n = [tv[1]*tu[2]-tv[2]*tu[1], tv[2]*tu[0]-tv[0]*tu[2], tv[0]*tu[1]-tv[1]*tu[0]];
      const l = Math.hypot(n[0],n[1],n[2]) || 1; n = n.map(x => x/l);
      if (n[0]*p[0] + n[2]*p[2] < 0) n = n.map(x => -x);
      nrm.set(n, v*3);
      par.set([arc[j]-mid, per, z, phi], v*4); // s (signed arc from phi=0), perimeter, z, phi
    }
  }
  const idx = new Uint32Array(NZ*NP*6); let k = 0;
  for (let i = 0; i < NZ; i++) for (let j = 0; j < NP; j++) {
    const a = i*(NP+1)+j, b = a+1, c = a+NP+1, d = c+1;
    idx[k++] = a; idx[k++] = b; idx[k++] = c; idx[k++] = b; idx[k++] = d; idx[k++] = c;
  }
  return { pos, nrm, par, idx, count: k };
}

/* ---------------- shaders ---------------- */
const NOISE = `
float h13(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
float h12(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec2 h22(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy);}
float vn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(h13(i),h13(i+vec3(1,0,0)),f.x),mix(h13(i+vec3(0,1,0)),h13(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(h13(i+vec3(0,0,1)),h13(i+vec3(1,0,1)),f.x),mix(h13(i+vec3(0,1,1)),h13(i+vec3(1,1,1)),f.x),f.y),f.z);}
float vn2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h12(i),h12(i+vec2(1,0)),f.x),mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x),f.y);}
float fbm(vec3 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+17.1;a*=.5;}return s;}
`;

const VS = `#version 300 es
precision highp float;
in vec3 aPos; in vec3 aNrm; in vec4 aPar;
uniform mat4 uModel, uView, uProj;
out vec3 vW; out vec3 vN; out vec4 vP; out vec3 vO;
void main(){
  vec4 w = uModel*vec4(aPos,1.);
  vW = w.xyz; vN = mat3(uModel)*aNrm; vP = aPar; vO = aPos;
  gl_Position = uProj*uView*w;
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; in vec4 vP; in vec3 vO;
out vec4 frag;
uniform vec3 uCam, uSkin, uKeyDir, uRimDir;
uniform float uTime, uTan, uHair, uFreckle, uDark;
uniform sampler2D uTat; uniform float uHasTat;
uniform vec4 uPlace; // fraction-around, z0(cm), size(cm), rotation
uniform float uAspect;
uniform float uDaysL, uDaysR, uSplit; uniform vec4 uMods; // sun, placement, aftercare, lineStyle
uniform float uEdit, uScan, uLock, uReveal;
uniform vec2 uRes;
${NOISE}
vec3 toLin(vec3 c){return pow(c,vec3(2.2));}
float lum(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}

// ---- per-colour ink fade rate (per effective year) ----
float inkRate(vec3 c){ // c = ink colour, sRGB 0..1
  float mx=max(c.r,max(c.g,c.b)), mn=min(c.r,min(c.g,c.b)), s=mx-mn;
  float black = 1.-smoothstep(.12,.38,mx);
  float white = smoothstep(.72,.9,mn);
  float h=0.;
  if(s>1e-3){ if(mx==c.r) h=mod((c.g-c.b)/s,6.); else if(mx==c.g) h=(c.b-c.r)/s+2.; else h=(c.r-c.g)/s+4.; h*=60.; }
  float sat = s/max(mx,1e-3);
  float red = (1.-smoothstep(18.,34.,h)) + smoothstep(330.,345.,h);
  float orange = smoothstep(14.,26.,h)*(1.-smoothstep(36.,44.,h));
  float yellow = smoothstep(38.,46.,h)*(1.-smoothstep(68.,80.,h));
  float green = smoothstep(75.,95.,h)*(1.-smoothstep(160.,185.,h));
  float blue = smoothstep(165.,190.,h)*(1.-smoothstep(255.,275.,h));
  float purple = smoothstep(255.,275.,h)*(1.-smoothstep(330.,345.,h));
  float chroma = red*.030+orange*.038+yellow*.065+green*.026+blue*.023+purple*.042;
  float grey = .018 + (1.-mx)*-.004;               // grey wash (diluted black)
  float rate = mix(grey, chroma, smoothstep(.12,.32,sat));
  rate = mix(rate, .010, black);                   // carbon black: most stable
  rate = mix(rate, .11, white*(1.-smoothstep(.1,.25,sat))); // white highlights: fastest
  // pastels (light, low saturation tints) fade faster than saturated pigment
  rate *= 1. + .8*smoothstep(.6,.85,mn)*(1.-white);
  return rate;
}

// stage weights from days since tattooing
void stages(float d, out float fresh, out float healing, out float settled, out float yEff){
  fresh = exp(-d/1.6) ;                                     // redness / swelling / plasma: strongest day 0, gone ~day 5
  healing = smoothstep(2.5,6.,d)*(1.-smoothstep(13.,26.,d)); // peeling + cloudy "milky" phase, days 4–21
  settled = smoothstep(14.,30.,d);                          // healed: settled & slightly lighter
  float yrs = max(d-30.,0.)/365.;
  yEff = yrs*uMods.x*uMods.y*uMods.z;
}

// sample tattoo with ink-migration blur (radius in texture units)
vec4 tatBlur(vec2 uv, float r, float lod){
  vec4 s = textureLod(uTat, uv, lod)*.2;
  if(r<1e-4) return textureLod(uTat, uv, 0.);
  const float GA=2.39996;
  for(int i=0;i<10;i++){ float fi=float(i)+.5; float rr=sqrt(fi/10.)*r; float a=fi*GA;
    s += textureLod(uTat, uv+vec2(cos(a),sin(a))*rr, lod)*.08; }
  return s;
}

void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vW);
  float s = vP.x, per = vP.y, z = vP.z, phi = vP.w;
  vec2 sc = vec2(s, z);                 // surface coords in cm

  // ----- skin microstructure (height field, cm) -----
  float px = length(fwidth(sc));        // cm per pixel, for AA fade
  vec3 o = vO;
  float pores = vn(o*14.)*.6 + vn(o*31.)*.4;
  float creaseA = vn2(vec2(sc.x*9.+sc.y*6., sc.y*1.2)), creaseB = vn2(vec2(sc.x*9.-sc.y*6., sc.y*1.2+7.));
  float crease = (smoothstep(.45,.5,creaseA)*smoothstep(.55,.5,creaseA) + smoothstep(.45,.5,creaseB)*smoothstep(.55,.5,creaseB))*smoothstep(.3,.7,vn2(sc*.8));
  float fine = 1.-smoothstep(.02,.07,px);
  float hgt = (pores*.010 + crease*.0015)*mix(.35,1.,fine) + fbm(o*1.1)*.012;
  // veins: inner side near wrist
  float vw = vn2(vec2(s*.9, z*.12)+vn2(vec2(s,z)*.35)*.9);
  float vein = (1.-smoothstep(.0,.16,abs(vw-.5))); vein*=vein;
  vein *= smoothstep(1.4,.3,abs(phi)) * smoothstep(-16.,4.,-z) * uDark;
  hgt += vein*.012;

  // ----- tattoo coordinates (wrapped on the surface) -----
  float sc0 = uPlace.x*per;
  float dx = s - sc0; dx = dx - per*floor(dx/per+.5);
  vec2 tl = vec2(dx, z-uPlace.y);
  float cr=cos(uPlace.w), sr=sin(uPlace.w);
  tl = vec2(cr*tl.x+sr*tl.y, -sr*tl.x+cr*tl.y)/uPlace.z;
  tl.x /= uAspect;
  vec2 tuv = vec2(tl.x+.5, .5-tl.y);
  float inBox = step(0.,tuv.x)*step(tuv.x,1.)*step(0.,tuv.y)*step(tuv.y,1.);

  // ----- aging state -----
  float days = (uSplit>=0. && gl_FragCoord.x > uSplit*uRes.x) ? uDaysR : uDaysL;
  float fresh, healing, settled, yEff; stages(days, fresh, healing, settled, yEff);
  float mmPerTex = uPlace.z*10.;                 // tattoo height in mm across one texture unit
  float line = uMods.w;                          // 1 = bold, >1 fine-line (shallower, single-needle)
  float sigmaMM = .045 + (.034*pow(yEff,.62) + .018*settled)*line; // ink migration (lateral spread), mm
  float rTex = sigmaMM*2.2/mmPerTex;
  float lod = clamp(log2(max(rTex*1024.*.55,1.)),0.,6.);

  vec4 ink = vec4(0.);
  float halo = 0.;
  if(uHasTat>.5 && inBox>.0 || (uHasTat>.5 && fresh>.01)){
    vec2 cuv = clamp(tuv,0.,1.);
    float edge = smoothstep(0.,.02,min(min(tuv.x,1.-tuv.x),min(tuv.y,1.-tuv.y)));
    ink = tatBlur(cuv, rTex, lod) * inBox * edge;
    float hr = 2.4/mmPerTex; // ~2.4 mm inflammation halo
    float hl = log2(hr*1024.*.7);
    halo = (textureLod(uTat, cuv, hl).a*.5 + textureLod(uTat, cuv+vec2(hr*.5,0.), hl).a*.25 + textureLod(uTat, cuv-vec2(hr*.5,0.), hl).a*.25) * edge;
  }
  ink *= uReveal; halo *= uReveal;

  // swelling: raised skin around fresh lines
  hgt += halo*fresh*.09 + ink.a*fresh*.04 - ink.a*healing*.01;
  // flakes during healing
  float flakeN = vn(o*vec3(9.,3.,9.)+3.7);
  float flake = smoothstep(.62,.7,flakeN)*smoothstep(.05,.3,ink.a+halo*.4)*healing;
  hgt += flake*.02;

  // bump mapping from screen-space derivatives (Mikkelsen)
  vec3 dpx = dFdx(vW), dpy = dFdy(vW);
  float dhx = dFdx(hgt), dhy = dFdy(hgt);
  vec3 r1 = cross(dpy,N), r2 = cross(N,dpx);
  float det = dot(dpx,r1);
  vec3 grad = sign(det)*(dhx*r1+dhy*r2);
  vec3 Nb = normalize(abs(det)*N - grad*1.0);
  if(abs(det)<1e-9) Nb = N;

  // ----- skin albedo -----
  vec3 base = toLin(uSkin);
  float blot = fbm(o*.55+11.);
  float redden = smoothstep(.45,.8,fbm(o*.9+3.));
  vec3 alb = base*(.88+.24*blot);
  alb *= mix(vec3(1.), vec3(.94,.9,.86), smoothstep(.5,.75,vn(o*2.2+5.))*.6);
  alb = mix(alb, alb*vec3(1.08,.9,.88), redden*.35);
  alb *= mix(vec3(1.), vec3(.93,.9,.88), uTan*smoothstep(.6,1.8,abs(phi)));   // sun-tanned outer side
  alb = mix(alb, alb*vec3(.86,.9,1.02), vein*.3);
  // freckles / naevi
  vec2 fc = floor(sc*3.2); vec2 fr = fract(sc*3.2)-.5+ (h22(fc)-.5)*.6;
  float frk = smoothstep(.09,.04,length(fr))*step(.86,h12(fc+5.))*uFreckle;
  alb = mix(alb, alb*vec3(.72,.6,.52), frk*.6);
  alb *= 1.-crease*.015*fine;

  // ----- ink optics: pigment sits in the dermis, under the epidermis -----
  vec3 inkC = ink.a>1e-3 ? ink.rgb/ink.a : vec3(0.);
  float rate = inkRate(inkC);
  float dens = mix(1., .9, settled) * exp(-rate*yEff*1.0) * (1.-.12*healing);
  // fine lines lose more contrast: spread already dilutes thin lines; shallow lines also shed more
  dens *= mix(1., exp(-.006*yEff), line-1.);
  // saturation loss & macrophage-driven blue-green shift of carbon black
  float lc = lum(inkC);
  vec3 ic = mix(inkC, vec3(lc), 1.-exp(-.035*yEff));
  float blk = 1.-smoothstep(.12,.38,max(inkC.r,max(inkC.g,inkC.b)));
  ic = mix(ic, vec3(.10,.15,.16), blk*(1.-exp(-.05*yEff))*.9);
  vec3 icl = toLin(ic);
  icl = max(icl, vec3(.010,.012,.017));            // even fresh black transmits a little
  float cov = clamp(ink.a,0.,1.);                  // coverage (edges / migration spread)
  float a = cov*dens;
  // Beer–Lambert: pigment concentration scales optical depth, so fading lightens without washing out hue
  vec3 trans = pow(clamp(icl*1.12,0.,1.), vec3(max(dens,.02)));
  vec3 tinted = alb*mix(vec3(1.), trans, cov);
  // epidermis scatters light before it reaches the pigment: a thin milky veil, thickening slowly with age & sun
  float veil = .03 + .04*settled + .14*(1.-exp(-.06*yEff));
  tinted = mix(tinted, alb*mix(vec3(1.),trans,.5)*vec3(.8,.9,1.), veil*cov);
  // fresh ink looks inky-wet; healing ink looks "milky" under the new skin layer
  tinted = mix(tinted, tinted*.9, fresh*a);
  tinted = mix(tinted, mix(tinted, alb*.8+vec3(.06), .32*a), healing);
  alb = tinted;
  // fresh redness halo
  alb = mix(alb, alb*vec3(1.12,.62,.58), clamp(halo*1.6,0.,1.)*fresh*.85);
  alb = mix(alb, alb*vec3(1.06,.85,.82), clamp(halo*1.6,0.,1.)*healing*.35);
  alb = mix(alb, mix(alb, vec3(.72,.66,.6)*base*1.25, .7), flake*.75);

  // ----- hair: short strands following the limb axis -----
  float hairA = 0.;
  if(uHair>0.){
    vec2 hp = vec2(sc.x*1., sc.y*.55)*3.2; vec2 hc = floor(hp);
    for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
      vec2 c = hc+vec2(i,j); vec2 rnd = h22(c);
      if(h12(c*1.7)>uHair) continue;
      vec2 p0 = c + rnd;
      float ang = -1.45 + (h12(c+9.)-.5)*.7;
      vec2 dir = vec2(cos(ang)*1.0, sin(ang)*1.8);
      vec2 q = hp - p0; float t = clamp(dot(q,dir)/dot(dir,dir),0.,1.);
      vec2 dd = q - dir*t; dd.x/=1.; dd.y/=1.8;
      float d = length(vec2(dd.x/3.2, dd.y/(3.2*.55*1.8)));
      float w = .0028 + px*.3;
      hairA = max(hairA, (1.-smoothstep(w*.3,w,d))*(.3+.7*(1.-t))*min(1.,.0035/w)*1.3);
    }
    hairA *= smoothstep(.2,1.,abs(phi))*.6+.4;
    hairA = clamp(hairA,0.,.7)*(1.-smoothstep(.02,.06,px));
  }

  // ----- lighting: wrap diffuse with per-channel scatter (SSS approx) + dual-lobe GGX -----
  vec3 L = normalize(uKeyDir);
  float ndl = dot(Nb,L);
  vec3 wrap = vec3(.62,.3,.22);
  vec3 diff = clamp((vec3(ndl)+wrap)/(1.+wrap),0.,1.);
  diff = diff*diff*(3.-2.*diff)*.25 + diff*.75;
  vec3 keyC = vec3(1.0,.88,.76)*1.4;
  vec3 hemi = mix(vec3(.16,.13,.11), vec3(.24,.26,.30), Nb.y*.5+.5);
  vec3 bounce = vec3(.25,.16,.11)*max(0.,-Nb.y)*.6;
  float rimN = max(0.,dot(Nb,normalize(uRimDir)));
  float fres = pow(1.-max(dot(Nb,V),0.),3.);
  vec3 rim = vec3(.55,.62,.72)*fres*.9*(.35+rimN);
  // translucency at silhouette (light bleeding through thin skin edges)
  vec3 transL = vec3(.9,.28,.14)*pow(1.-max(dot(N,V),0.),2.)*max(0.,dot(-N,L)+.6)*.22;
  vec3 col = alb*(keyC*diff + hemi*1.25 + bounce) + alb*transL*3.;
  // specular
  vec3 H = normalize(L+V);
  float nh = max(dot(Nb,H),0.), nv=max(dot(Nb,V),1e-3), nl=max(ndl,0.);
  float rough = mix(.48,.17,fresh*clamp(halo*2.+a,0.,1.));
  rough = mix(rough,.75,healing*clamp(halo*2.,0.,1.));
  float a2 = rough*rough*rough*rough;
  float D = a2/(3.14159*pow(nh*nh*(a2-1.)+1.,2.));
  float F = .028+(.972)*pow(1.-max(dot(H,V),0.),5.);
  float G = .5/max(nl*sqrt(nv*nv*(1.-a2)+a2)+nv*sqrt(nl*nl*(1.-a2)+a2),1e-4);
  float spec = D*F*G*nl;
  float a22 = .35*.35*.35*.35; float D2 = a22/(3.14159*pow(nh*nh*(a22-1.)+1.,2.));
  spec = spec*.55 + D2*F*G*nl*.35;
  float wet = 1.+fresh*clamp(halo*2.5+a*2.,0.,1.)*2.2;
  float oil = .7+.6*vn(o*2.3);
  col += keyC*spec*oil*wet*(1.-hairA)*(1.-flake*.8);
  col += fres*vec3(.08,.085,.09)*.35;
  // hair over skin
  vec3 hairC = mix(vec3(.05,.035,.025), toLin(uSkin)*.35, .25);
  col = mix(col, hairC*(keyC*.25*max(ndl,0.)+hemi) + keyC*.08*pow(nh,24.), hairA);

  // ----- AR overlays: scan point-cloud, edit frame -----
  vec3 ov = vec3(0.); float ova = 0.;
  if(uScan>0.){
    vec2 g = sc/vec2(.55,.55); vec2 gf = abs(fract(g)-.5);
    float dotp = smoothstep(.16,.05,length(gf));
    float zs = mix(17.,-17.,uScan);
    float band = exp(-pow((z-zs)/1.6,2.));
    float done = smoothstep(zs-.2,zs+.8,z);
    float wire = (1.-smoothstep(.0,.05,min(gf.x,gf.y)*.55/max(px*1.5,.001)))*.35;
    ova = max(ova, dotp*(band*1.+done*.35) + wire*(band*.8+done*.12));
    ov = mix(vec3(.95,.92,.85), vec3(1.,.42,.25), band);
    ova += band*.08;
  }
  if(uLock>0.){
    vec2 g = sc/vec2(.55,.55); vec2 gf = abs(fract(g)-.5);
    float wire = (1.-smoothstep(.0,.05,min(gf.x,gf.y)*.55/max(px*1.5,.001)));
    ova = max(ova, wire*.25*uLock); ov = vec3(.95,.92,.85);
  }
  vec3 outc = aces(col*1.0);
  outc = pow(outc, vec3(1./2.2));
  outc = mix(vec3(lum(outc)), outc, 1.12);
  outc = mix(outc, ov, clamp(ova,0.,1.)*.8);
  if(uEdit>0.){
    vec2 e = abs(tuv-.5);
    float box = max(e.x,e.y);
    float bw = px*1.6/(uPlace.z);
    float edge = (1.-smoothstep(bw*.5,bw*1.5,abs(box-.5)));
    float dash = step(.5,fract((tuv.x+tuv.y)*14.));
    vec2 cn = vec2(min(abs(tuv.x),abs(1.-tuv.x)), min(abs(tuv.y),abs(1.-tuv.y)));
    float corner = 1.-smoothstep(bw*2.,bw*3.2,length(cn));
    outc = mix(outc, vec3(.93,.35,.2), max(edge*dash, corner)*uEdit*.95);
  }
  // sensor grain
  float gr = h12(gl_FragCoord.xy+fract(uTime*7.)*91.)-.5;
  outc += gr*.028;
  frag = vec4(outc,1.);
}`;

const BG_VS = `#version 300 es
in vec2 aQ; out vec2 vUv; void main(){ vUv=aQ*.5+.5; gl_Position=vec4(aQ,.999,1.); }`;

const BG_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 frag;
uniform float uTime, uAsp, uCamMode, uVidAsp, uMirror; uniform vec2 uPar; uniform sampler2D uVid;
${NOISE}
float disc(vec2 p, vec2 c, float r, float soft){ return 1.-smoothstep(r-soft, r+soft, length(p-c)); }
float box(vec2 p, vec2 a, vec2 b, float soft){ vec2 d = max(a-p, p-b); return 1.-smoothstep(-soft, soft, max(d.x,d.y)); }
void main(){
  vec2 uv = vUv; vec3 col;
  if(uCamMode>.5){
    vec2 q = uv-.5; float va = uVidAsp; // cover-fit
    if(uAsp<va) q.x *= uAsp/va; else q.y *= va/uAsp;
    q += .5; if(uMirror>.5) q.x = 1.-q.x;
    vec3 c = vec3(0.);
    for(int i=0;i<8;i++){ float a=float(i)*.785; c += texture(uVid, q+vec2(cos(a),sin(a))*.004).rgb; }
    col = c/8.;
    col = mix(col, col*vec3(1.02,1.,.97), .5);
  } else {
    // portrait-first scene: x spans [-.5,.5] across the frame, y extends with the aspect
    vec2 p = vec2(uv.x-.5, (uv.y-.5)/uAsp) + uPar*.8;
    float fy = p.y;
    // warm plaster wall, lit from a window at upper left
    vec3 wall = mix(vec3(.10,.085,.075), vec3(.42,.34,.27), smoothstep(-.9,1.1,-p.x*1.1+p.y*.9));
    wall *= .9+.2*vn(vec3(p*4.,1.));
    col = wall;
    // window (heavily defocused)
    float win = box(p, vec2(-.75,.35), vec2(-.12,1.25), .16);
    col = mix(col, vec3(1.,.97,.9), win*.78);
    col *= 1.-.22*box(p, vec2(-.47,.35), vec2(-.4,1.25), .08)*win;
    col += vec3(.6,.52,.42)*exp(-length(p-vec2(-.42,.8))*1.8)*.5;
    // framed print on the wall (right)
    float fr = box(p, vec2(.18,.42), vec2(.52,.86), .05);
    col = mix(col, vec3(.07,.06,.055), fr*.9);
    col = mix(col, vec3(.78,.72,.62), box(p, vec2(.23,.48), vec2(.47,.8), .05)*.85);
    col = mix(col, vec3(.55,.2,.14), disc(p, vec2(.35,.64), .07, .05)*.6);
    // shelf with jars and a plant
    col = mix(col, vec3(.06,.05,.045), box(p, vec2(-.6,.08), vec2(.65,.13), .03));
    col = mix(col, vec3(.2,.13,.09), box(p, vec2(.3,.13), vec2(.4,.34), .04));
    col = mix(col, vec3(.62,.55,.45), box(p, vec2(.43,.13), vec2(.5,.27), .04));
    col = mix(col, vec3(.12,.11,.1), box(p, vec2(-.3,.13), vec2(-.22,.3), .04));
    float pl = 0.;
    for(int i=0;i<10;i++){ float fi=float(i); vec2 c = vec2(-.05+.1*sin(fi*2.1), .2+.06*fi + .03*cos(fi*3.)); pl = max(pl, disc(p, c, .07+.02*sin(fi), .05)); }
    col = mix(col, vec3(.05,.08,.05), pl*.8);
    // table top & dark floor
    float tab = smoothstep(-.55,-.62,fy);
    col = mix(col, vec3(.13,.09,.07)*(1.+p.x*.4), tab);
    col = mix(col, vec3(.04,.035,.03), smoothstep(-.8,-1.,fy));
    // warm string-light bokeh across the top
    for(int i=0;i<12;i++){
      float fi=float(i);
      vec2 c = vec2(-.55+fi*.1+.03*sin(fi*7.3), .98-.12*sin(fi*.55+.4)+.02*cos(fi*5.));
      float r = .04+.02*h12(vec2(fi,3.));
      float d = length(p-c);
      float b = 1.-smoothstep(r-.006, r+.006, d);
      float ring = smoothstep(r*.65, r, d)*b;
      vec3 bc = mix(vec3(1.,.62,.3), vec3(1.,.84,.6), h12(vec2(fi,1.)));
      col += bc*(b*.24+ring*.14)*(.85+.15*sin(uTime*.6+fi));
    }
    // a few lamp bokeh low right
    for(int i=0;i<5;i++){ float fi=float(i); vec2 c=vec2(.3+.07*fi, -.35+.05*sin(fi*2.)); float r=.05; float b=1.-smoothstep(r-.008,r+.008,length(p-c)); col += vec3(1.,.7,.4)*b*.12; }
    col += vec3(1.,.66,.35)*exp(-length((p-vec2(.48,-.2))*vec2(1.,1.3))*3.5)*.35;
  }
  // vignette
  vec2 vq = uv-.5; col *= 1.-dot(vq,vq)*.9;
  float gr = h12(gl_FragCoord.xy+fract(uTime*7.)*91.)-.5;
  col += gr*.03;
  frag = vec4(col,1.);
}`;

function toGL1(src, frag) {
  let s = src.replace('#version 300 es', '');
  if (frag) {
    s = '#extension GL_OES_standard_derivatives : enable\n#extension GL_EXT_shader_texture_lod : enable\n' + s;
    s = s.replace(/out vec4 frag;/, '').replace(/\bfrag\s*=/g, 'gl_FragColor=').replace(/\bin\s+/g, 'varying ')
      .replace(/textureLod\(/g, 'texture2DLodEXT(').replace(/\btexture\(/g, 'texture2D(');
  } else {
    s = s.replace(/\bin\s+/g, 'attribute ').replace(/\bout\s+/g, 'varying ');
  }
  return s;
}

/* ---------------- engine ---------------- */
function create(canvas, opts) {
  opts = opts || {};
  const ctxOpts = { antialias: true, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
  let gl = canvas.getContext('webgl2', ctxOpts), v2 = !!gl;
  if (!gl) { gl = canvas.getContext('webgl', ctxOpts); if (gl) { gl.getExtension('OES_standard_derivatives'); gl.getExtension('EXT_shader_texture_lod'); gl.getExtension('OES_element_index_uint'); } }
  if (!gl) throw new Error('WebGL is not available on this device.');

  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function prog(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, v2 ? vs : toGL1(vs, false)));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, v2 ? fs : toGL1(fs, true)));
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  const P = prog(VS, FS), B = prog(BG_VS, BG_FS);

  // quad
  const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  // mesh buffers
  const mb = { pos: gl.createBuffer(), nrm: gl.createBuffer(), par: gl.createBuffer(), idx: gl.createBuffer(), count: 0 };
  // textures
  function mkTex() { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,0])); return t; }
  const tatTex = mkTex(), vidTex = mkTex();

  const st = {
    body: 'forearm', skin: [0.82, 0.62, 0.50], tan: 0.1, hair: 0.0, freckle: 0, dark: 1,
    place: { f: 0, z: 0.5, size: 9, rot: 0 }, aspect: 1, hasTat: 0,
    daysL: 0, daysR: 0, split: -1, mods: [1, 1, 1, 1],
    roll: 0, yaw: 0, pitch: 0, zoom: 1, edit: 0, scan: 0, lock: 0, reveal: 1,
    camMode: 0, video: null, mirror: 0, sway: 1, t0: performance.now(), running: false, scale: 1
  };
  let body = BODIES.forearm;

  function setBody(name) {
    body = BODIES[name] || BODIES.forearm; st.body = name;
    const m = buildMesh(body);
    gl.bindBuffer(gl.ARRAY_BUFFER, mb.pos); gl.bufferData(gl.ARRAY_BUFFER, m.pos, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, mb.nrm); gl.bufferData(gl.ARRAY_BUFFER, m.nrm, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, mb.par); gl.bufferData(gl.ARRAY_BUFFER, m.par, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mb.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW);
    mb.count = m.count;
    st.tan = body.skinTan;
  }
  setBody('forearm');

  function setTattoo(src, aspect) {
    gl.bindTexture(gl.TEXTURE_2D, tatTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    st.aspect = aspect || 1; st.hasTat = 1;
  }

  const cw = () => opts.fixed ? opts.fixed[0] : canvas.clientWidth, ch = () => opts.fixed ? opts.fixed[1] : canvas.clientHeight;
  function size() {
    if (opts.fixed) { const w = Math.round(opts.fixed[0] * (opts.fixed[2] || 1)), h = Math.round(opts.fixed[1] * (opts.fixed[2] || 1)); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } return; }
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * st.scale;
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }

  function matrices(t) {
    const sway = st.sway;
    const asp = canvas.width / canvas.height;
    const proj = M.persp(52 * Math.PI / 180, asp, 2, 400);
    proj[8] = st.shiftX || 0; proj[9] = st.shiftY || 0;
    // hand-held camera: slow breathing drift + small high-frequency tremor
    const cx = sway * (Math.sin(t*0.37)*0.35 + Math.sin(t*1.9)*0.05), cy = sway * (Math.sin(t*0.29+1)*0.3 + Math.sin(t*2.3)*0.04);
    const croll = sway * Math.sin(t*0.21)*0.012;
    const dist = body.dist / st.zoom;
    const view = M.mul(M.rz(croll), M.tr(-cx, -cy, -dist));
    // limb micro-motion: tiny breathing rotation
    const mr = sway * Math.sin(t*0.5)*0.02, mt = sway * Math.sin(t*0.43+2)*0.012;
    let model = M.mul(M.rz(body.tilt + mt), M.mul(M.rx(st.pitch + Math.sin(t*0.31)*0.015*sway), M.mul(M.ry(st.yaw), M.ry(st.roll + mr))));
    return { proj, view, model, cam: [cx, cy, dist], par: [cx*0.012, cy*0.012] };
  }

  function bind(prog, name, buf, n) {
    const loc = gl.getAttribLocation(prog, name); if (loc < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0);
  }

  let lastM = null;
  function render(now) {
    size();
    const t = ((now || performance.now()) - st.t0) / 1000;
    const m = lastM = matrices(t);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    // background
    gl.useProgram(B.p);
    for (let i = 0; i < 8; i++) { const l = gl.getAttribLocation(P.p, ['aPos','aNrm','aPar'][i] || 'x'); if (l >= 0) gl.disableVertexAttribArray(l); }
    bind(B.p, 'aQ', qb, 2);
    gl.uniform1f(B.u.uTime, t); gl.uniform1f(B.u.uAsp, canvas.width / canvas.height); gl.uniform2f(B.u.uPar, m.par[0], m.par[1]);
    gl.uniform1f(B.u.uCamMode, st.camMode && st.video ? 1 : 0); gl.uniform1f(B.u.uMirror, st.mirror);
    if (st.camMode && st.video && st.video.readyState >= 2) {
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, vidTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, st.video); } catch (e) {}
      gl.uniform1i(B.u.uVid, 1); gl.uniform1f(B.u.uVidAsp, (st.video.videoWidth || 4) / (st.video.videoHeight || 3));
    } else if (B.u.uVid) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, vidTex); gl.uniform1i(B.u.uVid, 1); }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(gl.getAttribLocation(B.p, 'aQ'));
    // limb
    gl.enable(gl.DEPTH_TEST); gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    gl.useProgram(P.p);
    bind(P.p, 'aPos', mb.pos, 3); bind(P.p, 'aNrm', mb.nrm, 3); bind(P.p, 'aPar', mb.par, 4);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mb.idx);
    const u = P.u;
    gl.uniformMatrix4fv(u.uModel, false, m.model); gl.uniformMatrix4fv(u.uView, false, m.view); gl.uniformMatrix4fv(u.uProj, false, m.proj);
    gl.uniform3f(u.uCam, m.cam[0], m.cam[1], m.cam[2]);
    gl.uniform3fv(u.uSkin, st.skin); gl.uniform1f(u.uTan, st.tan); gl.uniform1f(u.uHair, st.hair); gl.uniform1f(u.uFreckle, st.freckle); gl.uniform1f(u.uDark, st.dark);
    gl.uniform3f(u.uKeyDir, -0.55, 0.62, 0.62); gl.uniform3f(u.uRimDir, 0.8, 0.2, -0.6);
    gl.uniform1f(u.uTime, t);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tatTex); gl.uniform1i(u.uTat, 0);
    gl.uniform1f(u.uHasTat, st.hasTat);
    gl.uniform4f(u.uPlace, st.place.f, st.place.z, st.place.size, st.place.rot);
    gl.uniform1f(u.uAspect, st.aspect);
    gl.uniform1f(u.uDaysL, st.daysL); gl.uniform1f(u.uDaysR, st.daysR); gl.uniform1f(u.uSplit, st.split);
    gl.uniform4fv(u.uMods, st.mods);
    gl.uniform1f(u.uEdit, st.edit); gl.uniform1f(u.uScan, st.scan); gl.uniform1f(u.uLock, st.lock); gl.uniform1f(u.uReveal, st.reveal);
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.drawElements(gl.TRIANGLES, mb.count, v2 || gl.getExtension('OES_element_index_uint') ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
    for (const n of ['aPos','aNrm','aPar']) { const l = gl.getAttribLocation(P.p, n); if (l >= 0) gl.disableVertexAttribArray(l); }
  }

  // adaptive resolution: keep phones smooth
  let raf = 0, slow = 0, last = 0;
  function loop(now) {
    if (!st.running) return;
    const dt = last ? now - last : 16; last = now;
    if (dt > 45) slow++; else if (dt < 22) slow = Math.max(0, slow - 1);
    if (slow > 20 && st.scale > 0.55) { st.scale = Math.max(0.55, st.scale - 0.15); slow = 0; }
    render(now);
    if (opts.onFrame) opts.onFrame(now);
    raf = requestAnimationFrame(loop);
  }

  // project a point on the skin (fraction around, z) to CSS px in the canvas; also returns facing
  // arc fraction (signed, measured from phi = 0, as in the shader) -> phi
  function phiFromFrac(z, f) {
    const N = 192; let per = 0; const arcs = [0]; let q = surf(body, z, 0);
    for (let j = 1; j <= N; j++) { const p = surf(body, z, j / N * 2 * Math.PI); per += Math.hypot(p[0]-q[0], p[2]-q[2]); arcs.push(per); q = p; }
    let t = ((f % 1) + 1) % 1 * per;
    let j = 1; while (j < N && arcs[j] < t) j++;
    const a = (j - 1 + (t - arcs[j-1]) / Math.max(1e-6, arcs[j] - arcs[j-1])) / N * 2 * Math.PI;
    return a > Math.PI ? a - 2 * Math.PI : a;
  }
  function project(f, z) {
    if (!lastM) return null;
    const phi = phiFromFrac(z, f);
    const p = surf(body, z, phi);
    const w = M.xf(lastM.model, p);
    const c = M.xf(lastM.proj, M.xf(lastM.view, w));
    const e = 0.01, p2 = surf(body, z, phi + e), w2 = M.xf(lastM.model, p2);
    const nrm = M.xf(lastM.model, [Math.sin(phi), 0, Math.cos(phi), 0]);
    const toCam = [lastM.cam[0] - w[0], lastM.cam[1] - w[1], lastM.cam[2] - w[2]];
    const facing = nrm[0]*toCam[0] + nrm[1]*toCam[1] + nrm[2]*toCam[2];
    return { x: (c[0]/c[3]*0.5+0.5) * cw(), y: (0.5 - c[1]/c[3]*0.5) * ch(), facing: facing > 0, w2 };
  }
  // cm per CSS px at the tattoo (for drag mapping)
  function cmPerPx() { const dist = body.dist / st.zoom; const vis = 2 * dist * Math.tan(26 * Math.PI / 180); return vis / Math.max(1, ch()); }
  function perimeter(z) { let s = 0, q = surf(body, z, -Math.PI); for (let j = 1; j <= 96; j++) { const p = surf(body, z, -Math.PI + j/96*2*Math.PI); s += Math.hypot(p[0]-q[0], p[2]-q[2]); q = p; } return s; }

  return {
    gl, webgl2: v2, BODIES, state: st,
    setBody, setTattoo, render, project, cmPerPx, perimeter,
    setFixed(f) { opts.fixed = f; },
    fracFromPhi(z, phi) { const N = 128; let s = 0, q = surf(body, z, 0), per = perimeter(z); for (let j = 1; j <= N; j++) { const p = surf(body, z, phi * j / N); s += Math.hypot(p[0]-q[0], p[2]-q[2]); q = p; } return Math.sign(phi) * s / per; },
    get body() { return body; },
    set(o) { Object.assign(st, o); },
    setSkin(rgb, opt) { st.skin = rgb; Object.assign(st, opt || {}); },
    start() { if (st.running) return; st.running = true; last = 0; raf = requestAnimationFrame(loop); },
    stop() { st.running = false; cancelAnimationFrame(raf); },
    capture(type) { render(); return canvas.toDataURL(type || 'image/png'); },
    sideFor(f) {
      f = ((f % 1) + 1.5) % 1 - 0.5;
      const zz = st.place.z; const phi2 = phiFromFrac(zz, f);
      const s0 = body.sides[0];
      const phi = phi2; let inside;
      if (s0.from < -Math.PI || s0.to > Math.PI || s0.from > 0) { const p2 = (phi + 2*Math.PI) % (2*Math.PI); inside = p2 >= s0.from && p2 <= s0.to; }
      else inside = phi >= s0.from && phi <= s0.to;
      return inside ? s0 : body.sides[1];
    },
    destroy() { this.stop(); const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); }
  };
}

window.InkAR = { create, BODIES };
})();

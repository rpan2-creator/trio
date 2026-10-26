/* INK STUDY — P0 beta. */
(function(){
'use strict';
const St=window.InkStore,R=window.InkRender,D=window.InkDesigns;
const app=document.getElementById('app'),sr=document.getElementById('sr');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const announce=t=>{sr.textContent='';setTimeout(()=>sr.textContent=t,30);};
const MODE_LABEL={photo:'Photo study',ar_marker:'AR marker study',scenario:'Scenario illustration'};
const REGIONS=['Inner forearm','Outer forearm','Upper arm','Wrist','Shoulder','Calf','Ankle','Collarbone','Back','Other'];
const urls=new Map();const url=b=>{if(!b)return '';if(!urls.has(b))urls.set(b,URL.createObjectURL(b));return urls.get(b);};
let S={view:'boot',params:{},hist:[],new:null,ed:null,svc:{}};

/* ---------- ui helpers ---------- */
const I={
 back:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>',
 studio:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 9h16M9 9v11"/></svg>',
 designs:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3c-3 5-6 8-6 12a6 6 0 0 0 12 0c0-4-3-7-6-12z"/></svg>',
 compare:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="8" height="14"/><rect x="13" y="5" width="8" height="14"/></svg>',
 consult:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4M8 12h8M8 16h6"/></svg>',
 move:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>',
 size:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="10" height="10"/><path d="M14 14l6 6M20 15v5h-5"/></svg>',
 rotate:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5"/></svg>',
 shape:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 6l14-2-2 16-12-3z"/><circle cx="5" cy="6" r="1.5"/><circle cx="19" cy="4" r="1.5"/><circle cx="17" cy="20" r="1.5"/><circle cx="5" cy="17" r="1.5"/></svg>',
 blend:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/></svg>',
 layers:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 4l9 5-9 5-9-5z"/><path d="M3 14l9 5 9-5"/></svg>',
 ruler:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 16L16 3l5 5L8 21z"/><path d="M7 12l2 2M10 9l2 2M13 6l2 2"/></svg>',
};
function toast(t){app.querySelectorAll('.toast').forEach(x=>x.remove());const d=document.createElement('div');d.className='toast';d.setAttribute('role','status');d.textContent=t;app.appendChild(d);setTimeout(()=>d.remove(),3400);}
function topbar(title,o){o=o||{};return `<div class="topbar">${o.back===false?'<span style="width:44px"></span>':`<button class="iconbtn" data-back aria-label="Back">${I.back}</button>`}<div class="title">${esc(title)}</div>${o.right||'<span style="width:44px"></span>'}</div>`;}
function tabs(cur){return `<nav class="tabs" aria-label="Main">${[['studio','Studio',I.studio],['designs','Designs',I.designs],['compare','Compare',I.compare],['consult','Consult',I.consult]].map(([k,l,i])=>`<button class="tab" data-tab="${k}" ${cur===k?'aria-current="page"':''}>${i}<span>${l}</span></button>`).join('')}</nav>`;}
function confirmDlg(title,body,verb,danger){return new Promise(res=>{const prev=document.activeElement;const w=document.createElement('div');
  w.innerHTML=`<div class="scrim"></div><div class="sheet" role="alertdialog" aria-modal="true" aria-labelledby="cdt"><div class="sb stack"><h2 id="cdt">${esc(title)}</h2><p class="muted">${esc(body)}</p></div><div class="sf"><button class="btn block ${danger?'danger':'primary'}" data-ok>${esc(verb)}</button><button class="btn block ghost" data-no>Cancel</button></div></div>`;
  app.appendChild(w);const done=v=>{w.remove();prev&&prev.focus&&prev.focus();res(v);};w.querySelector('[data-ok]').onclick=()=>done(true);w.querySelector('[data-no]').onclick=()=>done(false);w.querySelector('.scrim').onclick=()=>done(false);w.onkeydown=e=>{if(e.key==='Escape')done(false);};w.querySelector('[data-no]').focus();});}
function go(v,p,o){o=o||{};if(!o.replace&&S.view!=='boot')S.hist.push([S.view,S.params]);S.view=v;S.params=p||{};render();}
function back(){const h=S.hist.pop();if(h){S.view=h[0];S.params=h[1];render();}else go('studio',{},{replace:true});}
async function render(){
  stopCamera();
  const V=VIEWS[S.view];const html=await V.html();
  app.innerHTML=`<div class="view ${V.dark?'dark':''}">${html}</div>`;
  window.Frame&&Frame.tone(V.dark?'light':'dark');
  app.querySelectorAll('[data-back]').forEach(b=>b.onclick=back);
  app.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{S.hist=[];go(b.dataset.tab,{},{replace:true});});
  V.bind&&await V.bind();
  const h=app.querySelector('h1,h2');if(h&&!V.dark){h.tabIndex=-1;h.focus({preventScroll:true});}
}
async function ensureDesignAsset(libId){
  const id='asset-'+libId;let a=await St.get('assets',id);if(a)return a;
  const d=D.DESIGNS.find(x=>x.id===libId);const c=await D.raster(d.svg,1024);
  const blob=await new Promise(r=>c.toBlob(r,'image/png'));
  a={id,type:'design',blob,width:1024,height:1024,name:d.name,rights_source:'library:'+libId,rights_note:D.rights,created:Date.now()};
  await St.put('assets',a);return a;
}
const imgCache=new Map();
async function assetImg(id){if(imgCache.has(id))return imgCache.get(id);const a=await St.get('assets',id);if(!a)return null;const i=await St.img(a.blob);imgCache.set(id,i);return i;}
async function thumbOf(canvas,size){const k=(size||720)/Math.max(canvas.width,canvas.height);const t=document.createElement('canvas');t.width=Math.round(canvas.width*k);t.height=Math.round(canvas.height*k);t.getContext('2d').drawImage(canvas,0,0,t.width,t.height);return new Promise(r=>t.toBlob(r,'image/jpeg',.82));}
async function renderVersion(v,max){
  if(v.capture_asset_id){const i=await assetImg(v.capture_asset_id);const c=document.createElement('canvas');const k=Math.min(1,(max||1600)/Math.max(i.width,i.height));c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);return c;}
  const base=await assetImg(v.body_asset_id);const layers=[];for(const L of v.layers){layers.push(Object.assign({},L,{img:await assetImg(L.design_asset_id)}));}
  return R.composite(base,layers,{max:max||1600,scenario:v.scenario,watermark:v.mode==='scenario'?'SCENARIO ILLUSTRATION — not a prediction':null});
}
async function studies(){return (await St.all('studies')).sort((a,b)=>b.updated-a.updated);}
async function versionsOf(sid){return (await St.all('versions')).filter(v=>v.study_id===sid).sort((a,b)=>a.created-b.created);}

/* ---------- views ---------- */
const VIEWS={};
VIEWS.welcome={
  html:()=>`<div class="scroll stack" style="padding-top:28px">
   <div class="eyebrow">Ink Study · No. 01</div>
   <h1>Try it on before you sit down.</h1>
   <svg viewBox="0 0 320 170" role="img" aria-label="Line drawing of a forearm with a small fern design placed on it" style="width:100%;background:#fff;border:1px solid var(--rule)"><g fill="none" stroke="#20201E" stroke-width="2" stroke-linecap="round"><path d="M20 120c60-10 140-14 200-30 30-8 60-12 90-10"/><path d="M20 150c70-6 160-6 220-22 25-6 50-8 70-6"/><path d="M150 132c4-20 10-38 24-56" stroke="#8D3027"/><path d="M158 112c-10 0-18-6-22-14M164 100c10-2 18-8 20-18M154 122c-10 0-16-4-20-10" stroke="#8D3027"/></g><path d="M118 62h88v76h-88z" fill="none" stroke="#8D3027" stroke-dasharray="4 4"/></svg>
   <div class="stack" style="gap:14px">
    <div><b>Photo study</b><p class="muted">Place a design on a photo of your body. Move, size, rotate and bend it to the surface.</p></div>
    <div><b>Live AR (with a marker card)</b><p class="muted">See the design move with a printed card placed next to the spot. Works on flat-ish areas only.</p></div>
    <div><b>Change study</b><p class="muted">An adjustable illustration of fading and softening. It shows possibilities — it can’t predict your skin.</p></div>
   </div>
   <p class="small muted">Nothing here replaces your artist’s stencil or advice. Body photos stay on this device.</p>
  </div><div class="foot"><button class="btn primary block" data-start>Start a study</button><button class="btn ghost block" data-data>How your photos are handled</button></div>`,
  bind(){app.querySelector('[data-start]').onclick=async()=>{await St.put('meta',{id:'welcomed',v:true});go('studio',{},{replace:true});};
    app.querySelector('[data-data]').onclick=()=>go('privacy');}
};
VIEWS.studio={
  html:async()=>{const ss=await studies();const vs=await St.all('versions');
   const cov=async s=>{const v=vs.filter(x=>x.study_id===s.id).sort((a,b)=>b.created-a.created)[0];return v&&v.thumb?url(v.thumb):'';};
   const items=[];for(const s of ss)items.push(`<button class="study" data-s="${s.id}"><div class="th">${await cov(s)?`<img alt="" src="${await cov(s)}">`:''}</div><div style="flex:1"><b>${esc(s.title)}</b><span>${esc(s.body_region)} · ${vs.filter(v=>v.study_id===s.id).length} versions · ${new Date(s.updated).toLocaleDateString()}</span></div></button>`);
   return `<div class="topbar"><span style="width:44px"></span><div class="title"></div><button class="iconbtn" data-settings aria-label="Data and permissions">⚙︎</button></div>
   <div class="scroll stack"><div class="eyebrow">Studio</div><h1>Your studies</h1>
    <button class="btn primary block" data-new>New study</button>
    ${items.length?`<div>${items.join('')}</div>`:`<div class="empty"><p class="serif" style="font-size:20px;color:var(--ink)">No studies yet.</p><p class="small">A study is one idea — a design and a spot on your body — with as many versions as you like.</p></div>`}
   </div>${tabs('studio')}`;},
  bind(){app.querySelector('[data-new]').onclick=()=>{S.new={};go('source');};app.querySelector('[data-settings]').onclick=()=>go('privacy');
    app.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>go('study',{id:b.dataset.s}));}
};
VIEWS.source={
  html:()=>`${topbar('New study')}<div class="scroll stack"><div class="eyebrow">Step 1 of 3</div><h2>Choose a design</h2>
   <button class="choice" data-lib><div><b>From the INK STUDY library</b><span>${D.DESIGNS.length} original line drawings, cleared for try-on.</span></div></button>
   <button class="choice" data-up><div><b>Upload your own</b><span>PNG or JPEG (transparent PNG works best), or SVG. Only upload art you have the right to use.</span></div></button>
   <input type="file" id="dup" accept="image/png,image/jpeg,image/svg+xml" hidden>
   <p class="err" id="derr" role="alert"></p></div>`,
  bind(){const f=app.querySelector('#dup');app.querySelector('[data-lib]').onclick=()=>go('designs',{pick:true});app.querySelector('[data-up]').onclick=()=>f.click();
    f.onchange=async()=>{const file=f.files[0];if(!file)return;const err=app.querySelector('#derr');
      if(!/^image\/(png|jpeg|svg\+xml)$/.test(file.type)){err.textContent='Use a PNG, JPEG or SVG file.';return;}
      if(file.size>12e6){err.textContent='That file is over 12 MB.';return;}
      try{ // SVG is rasterized through <img>, which never runs scripts; then stored as PNG
        let blob,w,h;
        if(file.type==='image/svg+xml'){const txt=await file.text();if(/<script|on\w+=|javascript:/i.test(txt)){err.textContent='This SVG contains scripts or event handlers, so it can’t be used. Export it as PNG instead.';return;}
          const i=await St.img(new Blob([txt],{type:'image/svg+xml'}));const c=document.createElement('canvas');const k=1024/Math.max(i.width||1024,i.height||1024);c.width=Math.round((i.width||1024)*k);c.height=Math.round((i.height||1024)*k);c.getContext('2d').drawImage(i,0,0,c.width,c.height);blob=await new Promise(r=>c.toBlob(r,'image/png'));w=c.width;h=c.height;}
        else{const n=await St.normalize(file,1400,'image/png');blob=n.blob;w=n.width;h=n.height;}
        S.new.pendingUpload={blob,width:w,height:h,name:file.name.replace(/\.[^.]+$/,'').slice(0,40)};go('rights');
      }catch(e){err.textContent='Couldn’t read that image. Try another file.';}};}
};
VIEWS.rights={
  html:()=>{const u=S.new.pendingUpload;return `${topbar('Your design')}<div class="scroll stack"><div class="art"><div class="pic"><img alt="Your uploaded design" src="${url(u.blob)}"></div></div>
   <div class="field"><label class="label" for="dn">Name</label><input id="dn" value="${esc(u.name)}" maxlength="40"></div>
   <div class="field"><label class="label" for="ds">Where it’s from</label><select id="ds"><option value="own">I drew it myself</option><option value="artist">My artist made it for me</option><option value="licensed">I have a license or permission</option></select></div>
   <label class="check"><input type="checkbox" id="ok"><span>I have the right to use this design for a try-on and to share it with my artist.</span></label>
   <p class="small muted">Saying so doesn’t grant a license. Please don’t upload another artist’s work without permission.</p>
  </div><div class="foot"><button class="btn primary block" data-use>Use in study</button></div>`;},
  bind(){app.querySelector('[data-use]').onclick=async()=>{if(!app.querySelector('#ok').checked){toast('Please confirm you have the right to use this design.');return;}
    const u=S.new.pendingUpload;const a={id:St.uid(),type:'design',blob:u.blob,width:u.width,height:u.height,name:app.querySelector('#dn').value.trim()||'My design',rights_source:'user:'+app.querySelector('#ds').value,created:Date.now()};
    await St.put('assets',a);S.new.design=a.id;delete S.new.pendingUpload;go('body');};}
};
VIEWS.designs={
  html:()=>`${S.params.pick?topbar('Library'):'<div class="topbar"></div>'}<div class="scroll stack"><div class="eyebrow">Licensed library</div><h1>Designs</h1>
   <div class="chips" role="radiogroup" aria-label="Style">${['All','Botanical','Minimal','Line','Celestial','Traditional','Graphic'].map(s=>`<button class="chip" role="radio" aria-checked="${(S.params.f||'All')===s}" data-f="${s}">${s}</button>`).join('')}</div>
   <div class="grid2">${D.DESIGNS.filter(d=>!S.params.f||S.params.f==='All'||d.style===S.params.f).map(d=>`<button class="art" data-d="${d.id}"><div class="pic">${d.svg}</div><b>${esc(d.name)}</b><span>${d.style} · ${d.lines} lines</span></button>`).join('')||'<p class="empty">No designs in this style. <button class="btn ghost" data-f="All">Clear filter</button></p>'}</div>
   <p class="small muted">${esc(D.rights)}</p></div>${S.params.pick?'':tabs('designs')}`,
  bind(){app.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{S.params.f=b.dataset.f;render();});
    app.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>go('design',{id:b.dataset.d}));}
};
VIEWS.design={
  html:()=>{const d=D.DESIGNS.find(x=>x.id===S.params.id);return `${topbar(d.name)}<div class="scroll stack"><div class="art"><div class="pic" style="aspect-ratio:1">${d.svg}</div></div>
   <h2>${esc(d.name)}</h2><p class="muted">${d.style} · ${d.lines} lines</p>
   <div class="notice"><b>Rights:</b> ${esc(D.rights)}</div>
   <p class="small muted">Recorded with every version that uses it, so your package shows where the art came from.</p></div>
   <div class="foot"><button class="btn primary block" data-use>Use in study</button></div>`;},
  bind(){app.querySelector('[data-use]').onclick=async()=>{const a=await ensureDesignAsset(S.params.id);if(S.ed&&S.params.addLayer){S.params.addLayer(a);return;}S.new=S.new||{};S.new.design=a.id;go('body');};}
};
VIEWS.body={
  html:()=>`${topbar('Body photo')}<div class="scroll stack"><div class="eyebrow">Step 2 of 3</div><h2>Photo of the spot</h2>
   <svg viewBox="0 0 300 120" role="img" aria-label="Guide: fill the frame with the area, in even light, camera straight on" style="width:100%;background:#fff;border:1px solid var(--rule)"><rect x="70" y="14" width="160" height="92" rx="6" fill="none" stroke="#8D3027" stroke-dasharray="5 4"/><path d="M40 90c60-10 160-14 220-30" stroke="#20201E" stroke-width="2" fill="none"/><path d="M40 108c80-4 160-6 230-24" stroke="#20201E" stroke-width="2" fill="none"/><text x="150" y="60" text-anchor="middle" font-size="11" fill="#625E57">fill the frame · even light · straight on</text></svg>
   <p class="muted small">Photograph just the area you’re considering. Photos are re-encoded on this device (location data removed) and never uploaded unless you export them.</p>
   <input type="file" id="bup" accept="image/*" hidden><p class="err" id="berr" role="alert"></p></div>
   <div class="foot"><button class="btn primary block" data-cam>Take photo</button><button class="btn block" data-up>Upload a photo</button></div>`,
  bind(){const f=app.querySelector('#bup');
    app.querySelector('[data-cam]').onclick=()=>{if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){app.querySelector('#berr').textContent='This browser can’t open the camera here. Upload a photo instead.';return;}go('camera');};
    app.querySelector('[data-up]').onclick=()=>f.click();
    f.onchange=async()=>{const file=f.files[0];if(!file)return;try{const n=await St.normalize(file,2000);S.new.bodyDraft=n;go('review');}catch(e){app.querySelector('#berr').textContent='Couldn’t open that image. Try a JPEG or PNG.';}};}
};
let camStream=null;function stopCamera(){if(camStream){camStream.getTracks().forEach(t=>t.stop());camStream=null;}}
VIEWS.camera={dark:true,
  html:()=>`<div class="topbar"><button class="btn ghost" data-cancel style="min-height:44px">Cancel</button><div class="title">Photo study</div><button class="btn ghost" data-flip style="min-height:44px" aria-label="Switch camera">Flip</button></div>
   <div class="cam"><video id="v" playsinline muted autoplay aria-label="Camera preview"></video><div class="guide"></div><p id="cmsg" role="status" style="position:absolute;left:12px;right:12px;bottom:10px;text-align:center;font-size:13px">Starting camera…</p></div>
   <div class="row" style="justify-content:center;padding:16px 0 calc(var(--safe-bottom) + 14px)"><button class="shutter" data-shoot aria-label="Take photo" disabled></button></div>`,
  async bind(){
    let facing=S.params.facing||'environment';const v=app.querySelector('#v'),msg=app.querySelector('#cmsg'),sh=app.querySelector('[data-shoot]');
    async function start(){stopCamera();try{camStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing,width:{ideal:1920},height:{ideal:1440}},audio:false});v.srcObject=camStream;await v.play();msg.textContent='Fill the frame with the spot. Even light helps.';sh.disabled=false;}
      catch(e){msg.innerHTML=e.name==='NotAllowedError'?'Camera access was declined. You can <button class="btn ghost" data-upl style="min-height:36px;color:#fff;text-decoration:underline">upload a photo</button> instead, or allow the camera in your browser settings.':'Couldn’t start the camera ('+esc(e.name)+'). <button class="btn ghost" data-upl style="min-height:36px;color:#fff;text-decoration:underline">Upload instead</button>';
        const u=app.querySelector('[data-upl]');if(u)u.onclick=()=>{S.hist.pop();go('body',{},{replace:true});};}}
    await start();
    app.querySelector('[data-cancel]').onclick=back;
    app.querySelector('[data-flip]').onclick=()=>{facing=facing==='environment'?'user':'environment';start();};
    sh.onclick=async()=>{if(!v.videoWidth)return;const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);stopCamera();
      const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.9));S.new.bodyDraft={blob,width:c.width,height:c.height};go('review',{},{replace:true});};
  }
};
VIEWS.review={dark:true,
  html:()=>`${topbar('Check photo')}<div class="stagearea"><canvas id="rc" aria-label="Your photo"></canvas></div>
   <div class="panel"><div class="row"><span class="small" style="color:#bdb8ae">Crop</span>${[['full','Full'],['43','3:4'],['11','Square']].map(([k,l])=>`<button class="nbtn" data-crop="${k}" aria-pressed="${(S.new.crop||'full')===k}">${l}</button>`).join('')}<button class="nbtn" data-rot>Rotate</button></div>
   <p class="small" style="color:#bdb8ae">Crop out faces, other people and anything you don’t want in the study.</p></div>
   <div class="foot" style="background:#1f1e1c"><div class="row"><button class="btn" style="flex:1" data-retake>Retake</button><button class="btn primary" style="flex:2" data-use>Use photo</button></div></div>`,
  async bind(){
    const b=S.new.bodyDraft;const img=await St.img(b.blob);const c=app.querySelector('#rc');S.new.rot=S.new.rot||0;
    const draw=()=>{const rot=S.new.rot%360,sw=rot%180?img.height:img.width,sh=rot%180?img.width:img.height;let cw=sw,ch=sh;const crop=S.new.crop||'full';
      if(crop==='43'){if(cw/ch>3/4)cw=ch*3/4;else ch=cw*4/3;}if(crop==='11'){cw=ch=Math.min(cw,ch);}
      c.width=Math.round(cw);c.height=Math.round(ch);const x=c.getContext('2d');x.save();x.translate(c.width/2,c.height/2);x.rotate(rot*Math.PI/180);x.drawImage(img,-img.width/2,-img.height/2);x.restore();
      const area=app.querySelector('.stagearea');const k=Math.min(area.clientWidth/c.width,area.clientHeight/c.height);c.style.width=c.width*k+'px';c.style.height=c.height*k+'px';};
    draw();
    app.querySelectorAll('[data-crop]').forEach(x=>x.onclick=()=>{S.new.crop=x.dataset.crop;app.querySelectorAll('[data-crop]').forEach(y=>y.setAttribute('aria-pressed',String(y===x)));draw();});
    app.querySelector('[data-rot]').onclick=()=>{S.new.rot+=90;draw();};
    app.querySelector('[data-retake]').onclick=()=>{S.new.bodyDraft=null;S.new.rot=0;S.new.crop='full';back();};
    app.querySelector('[data-use]').onclick=async()=>{const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.9));
      const a={id:St.uid(),type:'body',blob,width:c.width,height:c.height,created:Date.now(),retention:'device'};await St.put('assets',a);
      S.new.body=a.id;S.new.bodyDraft=null;go('naming',{},{replace:true});};
  }
};
VIEWS.naming={
  html:()=>`${topbar('New study')}<div class="scroll stack"><div class="eyebrow">Step 3 of 3</div><h2>Name this study</h2>
   <div class="field"><label class="label" for="st">Title</label><input id="st" maxlength="40" placeholder="e.g. Fern on left forearm"></div>
   <div class="field"><label class="label" for="sr2">Body area</label><select id="sr2">${REGIONS.map(r=>`<option>${r}</option>`).join('')}</select><span class="hint">Just a label for you and your artist. No measurements needed.</span></div>
   <p class="err" id="nerr" role="alert"></p></div><div class="foot"><button class="btn primary block" data-go>Open editor</button></div>`,
  bind(){app.querySelector('[data-go]').onclick=async()=>{const t=app.querySelector('#st').value.trim();if(!t){app.querySelector('#nerr').textContent='Give the study a short title.';app.querySelector('#st').focus();return;}
    const s={id:St.uid(),title:t,body_region:app.querySelector('#sr2').value,created:Date.now(),updated:Date.now(),last_body:S.new.body};await St.put('studies',s);
    S.hist=[['studio',{}]];startEditor({studyId:s.id,bodyId:S.new.body,layers:[{design_asset_id:S.new.design}],fresh:true});};}
};

/* ---------- editor ---------- */
async function startEditor(o){
  const base=await assetImg(o.bodyId);const W=base.width,H=base.height;
  const layers=[];for(const L of o.layers){const img=await assetImg(L.design_asset_id);
    let q=L.quad?L.quad.map(p=>[p[0]*W,p[1]*H]):null;
    if(!q){const w=Math.min(W,H)*.42,h=w*img.height/img.width;q=R.rectQuad(W/2,H/2,w,h,0);}
    layers.push({design_asset_id:L.design_asset_id,img,quad:q,opacity:L.opacity==null?.88:L.opacity,blend:L.blend||'multiply',visible:L.visible!==false});}
  S.ed={studyId:o.studyId,bodyId:o.bodyId,base,layers,sel:0,tool:'move',undo:[],redo:[],scaleRef:o.scaleRef?{p1:[o.scaleRef.p1[0]*W,o.scaleRef.p1[1]*H],p2:[o.scaleRef.p2[0]*W,o.scaleRef.p2[1]*H],length:o.scaleRef.length,unit:o.scaleRef.unit}:null,source:o.source||null,dirty:!!o.fresh,corner:0};
  go('editor',{},{replace:!!o.replace});
}
function snap(){const e=S.ed;return JSON.stringify({l:e.layers.map(L=>({q:L.quad,o:L.opacity,b:L.blend,v:L.visible,d:L.design_asset_id})),s:e.scaleRef});}
function pushUndo(){const e=S.ed;e.undo.push(snap());if(e.undo.length>30)e.undo.shift();e.redo=[];e.dirty=true;}
async function restore(js){const e=S.ed,o=JSON.parse(js);const L=[];for(const x of o.l){L.push({quad:x.q,opacity:x.o,blend:x.b,visible:x.v,design_asset_id:x.d,img:await assetImg(x.d)});}e.layers=L;e.scaleRef=o.s;e.sel=Math.min(e.sel,L.length-1);}
const cen=q=>[(q[0][0]+q[1][0]+q[2][0]+q[3][0])/4,(q[0][1]+q[1][1]+q[2][1]+q[3][1])/4];
const xf=(q,fn)=>{const c=cen(q);return q.map(p=>fn(p,c));};
const qMove=(q,dx,dy)=>q.map(p=>[p[0]+dx,p[1]+dy]);
const qScale=(q,k)=>xf(q,(p,c)=>[c[0]+(p[0]-c[0])*k,c[1]+(p[1]-c[1])*k]);
const qRot=(q,a)=>xf(q,(p,c)=>{const s=Math.sin(a),co=Math.cos(a),x=p[0]-c[0],y=p[1]-c[1];return [c[0]+x*co-y*s,c[1]+x*s+y*co];});
const qAngle=q=>Math.atan2(q[1][1]-q[0][1],q[1][0]-q[0][0]);
const qWidth=q=>Math.hypot(q[1][0]-q[0][0],q[1][1]-q[0][1]);
VIEWS.editor={dark:true,
  html:()=>`<div class="topbar"><button class="iconbtn" data-x aria-label="Close editor">${I.back}</button><div class="title"><span class="tag" style="color:#f9f6ee">Photo study</span></div><button class="btn primary" data-save style="min-height:40px;padding:0 14px">Save version</button></div>
   <div class="stagearea" id="area"><canvas id="ec" role="img" aria-label="Design placed on your photo"></canvas></div>
   <div class="panel" id="panel" aria-live="polite"></div>
   <div class="tools" role="toolbar" aria-label="Edit tools">${[['move','Move',I.move],['size','Size',I.size],['rotate','Rotate',I.rotate],['shape','Shape',I.shape],['blend','Blend',I.blend],['layers','Layers',I.layers],['scale','Scale',I.ruler]].map(([k,l,i])=>`<button class="tool" data-tool="${k}" aria-pressed="${S.ed.tool===k}">${i}${l}</button>`).join('')}
    <button class="tool" data-undo>↶<span>Undo</span></button><button class="tool" data-redo>↷<span>Redo</span></button></div>`,
  bind(){
    S.pickLayer=null;
    const e=S.ed,c=app.querySelector('#ec'),area=app.querySelector('#area');
    const W=e.base.width,H=e.base.height;const fit=Math.min(1,900/Math.max(W,H));c.width=Math.round(W*fit);c.height=Math.round(H*fit);
    const sizeIt=()=>{const k=Math.min(area.clientWidth/c.width,area.clientHeight/c.height);c.style.width=c.width*k+'px';c.style.height=c.height*k+'px';};sizeIt();
    let fast=false,raf=0;
    const draw=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
      const layers=e.layers.map(L=>Object.assign({},L,{quad:L.quad.map(p=>[p[0]/W,p[1]/H])}));
      R.composite(e.base,layers,{canvas:c,max:Math.max(c.width,c.height),fast});
      const x=c.getContext('2d'),k=c.width/W,L=e.layers[e.sel];
      if(L&&L.visible){x.save();x.strokeStyle='#f9f6ee';x.setLineDash([6,5]);x.lineWidth=1.5;x.beginPath();L.quad.forEach((p,i)=>i?x.lineTo(p[0]*k,p[1]*k):x.moveTo(p[0]*k,p[1]*k));x.closePath();x.stroke();x.setLineDash([]);
        if(e.tool==='shape')L.quad.forEach((p,i)=>{x.fillStyle=i===e.corner?'#8D3027':'#f9f6ee';x.beginPath();x.arc(p[0]*k,p[1]*k,9,0,7);x.fill();x.strokeStyle='#171717';x.stroke();});x.restore();}
      if(e.tool==='scale'&&e.scaleRef){const r=e.scaleRef;x.save();x.strokeStyle='#f5c542';x.lineWidth=3;x.beginPath();x.moveTo(r.p1[0]*k,r.p1[1]*k);x.lineTo(r.p2[0]*k,r.p2[1]*k);x.stroke();[r.p1,r.p2].forEach((p,i)=>{x.fillStyle=i===e.corner%2?'#8D3027':'#f5c542';x.beginPath();x.arc(p[0]*k,p[1]*k,9,0,7);x.fill();});x.restore();}
      c.setAttribute('aria-label',describe());
    });};
    e.draw=draw;draw();paintPanel();
    // pointer: drag moves; two pointers pinch scale/rotate; shape tool drags nearest corner
    const pts=new Map();let startQ=null,startPts=null,startRef=null;
    const toImg=ev=>{const r=c.getBoundingClientRect();return [(ev.clientX-r.left)/r.width*W,(ev.clientY-r.top)/r.height*H];};
    area.addEventListener('pointerdown',ev=>{const L=e.layers[e.sel];if(!L)return;area.setPointerCapture(ev.pointerId);pts.set(ev.pointerId,toImg(ev));
      if(pts.size===1){pushUndo();startQ=L.quad.map(p=>p.slice());startRef=e.scaleRef&&JSON.parse(JSON.stringify(e.scaleRef));const p=toImg(ev);
        if(e.tool==='shape'){let bi=0,bd=1e9;L.quad.forEach((q,i)=>{const d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<bd){bd=d;bi=i;}});e.corner=bi;}
        if(e.tool==='scale'&&e.scaleRef){const r=e.scaleRef;e.corner=Math.hypot(r.p1[0]-p[0],r.p1[1]-p[1])<Math.hypot(r.p2[0]-p[0],r.p2[1]-p[1])?0:1;}}
      startPts=[...pts.values()].map(p=>p.slice());fast=true;});
    area.addEventListener('pointermove',ev=>{if(!pts.has(ev.pointerId))return;pts.set(ev.pointerId,toImg(ev));const L=e.layers[e.sel];const cur=[...pts.values()];
      if(cur.length===1&&startPts.length===1){const dx=cur[0][0]-startPts[0][0],dy=cur[0][1]-startPts[0][1];
        if(e.tool==='shape'){L.quad=startQ.map((p,i)=>i===e.corner?[p[0]+dx,p[1]+dy]:p.slice());}
        else if(e.tool==='scale'&&e.scaleRef){const r=JSON.parse(JSON.stringify(startRef));const k2=e.corner?'p2':'p1';r[k2]=[r[k2][0]+dx,r[k2][1]+dy];e.scaleRef=r;}
        else L.quad=qMove(startQ,dx,dy);}
      else if(cur.length>=2&&startPts.length>=2){const d0=Math.hypot(startPts[1][0]-startPts[0][0],startPts[1][1]-startPts[0][1]),d1=Math.hypot(cur[1][0]-cur[0][0],cur[1][1]-cur[0][1]);
        const a0=Math.atan2(startPts[1][1]-startPts[0][1],startPts[1][0]-startPts[0][0]),a1=Math.atan2(cur[1][1]-cur[0][1],cur[1][0]-cur[0][0]);
        L.quad=qRot(qScale(startQ,d1/Math.max(1,d0)),a1-a0);}
      draw();});
    const up=ev=>{pts.delete(ev.pointerId);if(!pts.size){fast=false;draw();paintPanel();}else{startPts=[...pts.values()].map(p=>p.slice());startQ=e.layers[e.sel].quad.map(p=>p.slice());}};
    area.addEventListener('pointerup',up);area.addEventListener('pointercancel',up);
    app.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{e.tool=b.dataset.tool;e.corner=0;app.querySelectorAll('[data-tool]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
      if(e.tool==='scale'&&!e.scaleRef){}draw();paintPanel();});
    app.querySelector('[data-undo]').onclick=async()=>{const s=e.undo.pop();if(!s){toast('Nothing to undo.');return;}e.redo.push(snap());await restore(s);draw();paintPanel();};
    app.querySelector('[data-redo]').onclick=async()=>{const s=e.redo.pop();if(!s){toast('Nothing to redo.');return;}e.undo.push(snap());await restore(s);draw();paintPanel();};
    app.querySelector('[data-x]').onclick=async()=>{if(e.dirty&&!(await confirmDlg('Leave without saving?','Changes since your last saved version will be lost. Saved versions are never changed.','Leave editor',true)))return;S.ed=null;goStudy(e.studyId);};
    app.querySelector('[data-save]').onclick=async ev=>{const b=ev.currentTarget;b.disabled=true;b.textContent='Saving…';
      try{const v=await saveVersion();e.dirty=false;toast('Saved as a new version.');S.ed=null;goStudy(e.studyId,v.id);}catch(err){b.disabled=false;b.textContent='Save version';toast('Couldn’t save on this device: '+err.message);}};
  }
};
function goStudy(id,vid){S.hist=[['studio',{}]];go('study',{id,v:vid},{replace:true});}
function describe(){const e=S.ed,L=e.layers[e.sel];if(!L)return 'No design layer';const W=e.base.width,H=e.base.height,c=cen(L.quad);
  return `Design centered ${Math.round(c[0]/W*100)}% across and ${Math.round(c[1]/H*100)}% down, ${Math.round(qWidth(L.quad)/W*100)}% of the photo width, rotated ${Math.round(qAngle(L.quad)*180/Math.PI)} degrees${sizeText()?', about '+sizeText():''}.`;}
function sizeText(){const e=S.ed;if(!e||!e.scaleRef||!e.scaleRef.length)return '';const r=e.scaleRef,px=Math.hypot(r.p2[0]-r.p1[0],r.p2[1]-r.p1[1]);if(px<5)return '';const L=e.layers[e.sel];if(!L)return '';
  const per=r.length/px,w=qWidth(L.quad)*per,h=Math.hypot(L.quad[3][0]-L.quad[0][0],L.quad[3][1]-L.quad[0][1])*per;return `${w.toFixed(1)} × ${h.toFixed(1)} ${r.unit} (rough)`;}
function paintPanel(){
  const e=S.ed,p=app.querySelector('#panel');if(!p)return;const L=e.layers[e.sel];const W=e.base.width;
  const step=(k,lbl,val)=>`<div class="row"><label style="min-width:58px">${lbl}</label>${k}<span class="valbox">${val}</span></div>`;
  let h='';
  if(!L&&e.tool!=='layers'){h='<p class="small">No design layers. Add one in Layers.</p>';}
  else if(e.tool==='move'){h=`<div class="row" role="group" aria-label="Move design">${[['-1,0','←','left'],['0,-1','↑','up'],['0,1','↓','down'],['1,0','→','right']].map(([d,s,n])=>`<button class="nbtn" data-mv="${d}" aria-label="Move ${n}">${s}</button>`).join('')}<span class="small" style="color:#bdb8ae">Drag on the photo, or nudge 1% at a time.</span></div>`;}
  else if(e.tool==='size'){const w=qWidth(L.quad)/W*100;h=step(`<button class="nbtn" data-sz="0.95" aria-label="Smaller">−</button><input type="range" min="5" max="120" step="1" value="${w.toFixed(0)}" id="szr" aria-label="Width as percent of photo"><button class="nbtn" data-sz="1.05" aria-label="Larger">+</button>`,'Width',w.toFixed(0)+'%')+`<p class="small" style="color:#bdb8ae">${sizeText()?'≈ '+sizeText()+' · perspective and curves add error':'Relative size only. Add a measured reference in Scale to see rough cm/in.'}</p>`;}
  else if(e.tool==='rotate'){const a=qAngle(L.quad)*180/Math.PI;h=step(`<button class="nbtn" data-rt="-5" aria-label="Rotate left 5 degrees">⟲</button><input type="range" min="-180" max="180" step="1" value="${a.toFixed(0)}" id="rtr" aria-label="Rotation in degrees"><button class="nbtn" data-rt="5" aria-label="Rotate right 5 degrees">⟳</button>`,'Angle',a.toFixed(0)+'°');}
  else if(e.tool==='shape'){h=`<div class="row" role="radiogroup" aria-label="Corner">${['Top left','Top right','Bottom right','Bottom left'].map((n,i)=>`<button class="nbtn" role="radio" data-cn="${i}" aria-checked="${e.corner===i}" aria-pressed="${e.corner===i}" style="font-size:11px;padding:0 8px">${n}</button>`).join('')}</div>
    <div class="row">${[['-1,0','←','left'],['0,-1','↑','up'],['0,1','↓','down'],['1,0','→','right']].map(([d,s,n])=>`<button class="nbtn" data-cm="${d}" aria-label="Move corner ${n}">${s}</button>`).join('')}<button class="nbtn" data-flat style="font-size:12px;padding:0 10px">Flatten</button></div>
    <p class="small" style="color:#bdb8ae">Bend the design to a flat-ish surface. It can’t wrap around an arm or show what’s hidden.</p>`;}
  else if(e.tool==='blend'){h=step(`<input type="range" min="10" max="100" value="${Math.round(L.opacity*100)}" id="opr" aria-label="Opacity">`,'Opacity',Math.round(L.opacity*100)+'%')+`<div class="row" role="radiogroup" aria-label="Blend">${[['multiply','Ink (multiply)'],['darken','Darken'],['source-over','Normal']].map(([k,l])=>`<button class="nbtn" role="radio" data-bl="${k}" aria-checked="${L.blend===k}" aria-pressed="${L.blend===k}" style="font-size:12px;padding:0 10px">${l}</button>`).join('')}</div>`;}
  else if(e.tool==='layers'){h=`${e.layers.map((x,i)=>`<div class="layer" aria-current="${i===e.sel}"><button class="nbtn" data-sel="${i}" style="flex:1;text-align:left;border:0;background:none">Layer ${i+1}${i===e.sel?' · selected':''}</button><button class="nbtn" data-vis="${i}" aria-pressed="${x.visible}" aria-label="${x.visible?'Hide':'Show'} layer ${i+1}">${x.visible?'Hide':'Show'}</button><button class="nbtn" data-up2="${i}" aria-label="Move layer ${i+1} up" ${i===e.layers.length-1?'disabled':''}>▲</button><button class="nbtn" data-del="${i}" aria-label="Remove layer ${i+1}">✕</button></div>`).join('')}
    <div class="row"><button class="nbtn" data-add ${e.layers.length>=3?'disabled':''} style="padding:0 12px">+ Add design (${e.layers.length}/3)</button><span class="small" style="color:#bdb8ae">Photo layer is locked.</span></div>`;}
  else if(e.tool==='scale'){const r=e.scaleRef;h=r?`<div class="row"><label for="sl" style="min-width:58px">Length</label><input id="sl" type="number" min="0.1" step="0.1" value="${r.length||''}" style="width:90px" class="nbtn"><select id="su" class="nbtn"><option ${r.unit==='cm'?'selected':''}>cm</option><option ${r.unit==='in'?'selected':''}>in</option></select><button class="nbtn" data-clr style="padding:0 10px;font-size:12px">Clear</button></div>
     <div class="row">${['Point A','Point B'].map((n,i)=>`<button class="nbtn" data-pt="${i}" aria-pressed="${e.corner%2===i}" style="font-size:12px;padding:0 10px">${n}</button>`).join('')}${[['-1,0','←'],['0,-1','↑'],['0,1','↓'],['1,0','→']].map(([d,s])=>`<button class="nbtn" data-pm="${d}" aria-label="Move point ${s}">${s}</button>`).join('')}</div>
     <p class="small" style="color:#bdb8ae">Line the yellow bar up with something you measured in the photo (a ruler, a card). ${sizeText()?'Design ≈ '+sizeText()+'.':''} Not a stencil spec.</p>`
     :`<p class="small" style="color:#bdb8ae">Without a reference, INK STUDY shows only relative size. If something of known length is in the photo, add a reference line.</p><button class="nbtn" data-addref style="padding:0 12px">Add reference line</button>`;}
  p.innerHTML=h;
  const N=W*.01;
  const act=(fn)=>{pushUndo();fn();e.draw();paintPanel();};
  p.querySelectorAll('[data-mv]').forEach(b=>b.onclick=()=>act(()=>{const [dx,dy]=b.dataset.mv.split(',').map(Number);L.quad=qMove(L.quad,dx*N,dy*N);}));
  p.querySelectorAll('[data-sz]').forEach(b=>b.onclick=()=>act(()=>L.quad=qScale(L.quad,+b.dataset.sz)));
  const szr=p.querySelector('#szr');if(szr)szr.onchange=()=>act(()=>L.quad=qScale(L.quad,(+szr.value/100*W)/qWidth(L.quad)));
  p.querySelectorAll('[data-rt]').forEach(b=>b.onclick=()=>act(()=>L.quad=qRot(L.quad,+b.dataset.rt*Math.PI/180)));
  const rtr=p.querySelector('#rtr');if(rtr)rtr.onchange=()=>act(()=>L.quad=qRot(L.quad,+rtr.value*Math.PI/180-qAngle(L.quad)));
  p.querySelectorAll('[data-cn]').forEach(b=>b.onclick=()=>{e.corner=+b.dataset.cn;e.draw();paintPanel();});
  p.querySelectorAll('[data-cm]').forEach(b=>b.onclick=()=>act(()=>{const [dx,dy]=b.dataset.cm.split(',').map(Number);L.quad[e.corner]=[L.quad[e.corner][0]+dx*N,L.quad[e.corner][1]+dy*N];}));
  const fl=p.querySelector('[data-flat]');if(fl)fl.onclick=()=>act(()=>{const c=cen(L.quad),w=qWidth(L.quad),h=w*L.img.height/L.img.width;L.quad=R.rectQuad(c[0],c[1],w,h,qAngle(L.quad));});
  const opr=p.querySelector('#opr');if(opr)opr.onchange=()=>act(()=>L.opacity=+opr.value/100);
  p.querySelectorAll('[data-bl]').forEach(b=>b.onclick=()=>act(()=>L.blend=b.dataset.bl));
  p.querySelectorAll('[data-sel]').forEach(b=>b.onclick=()=>{e.sel=+b.dataset.sel;e.draw();paintPanel();});
  p.querySelectorAll('[data-vis]').forEach(b=>b.onclick=()=>act(()=>{const x=e.layers[+b.dataset.vis];x.visible=!x.visible;}));
  p.querySelectorAll('[data-up2]').forEach(b=>b.onclick=()=>act(()=>{const i=+b.dataset.up2;[e.layers[i],e.layers[i+1]]=[e.layers[i+1],e.layers[i]];e.sel=i+1;}));
  p.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>act(()=>{e.layers.splice(+b.dataset.del,1);e.sel=Math.max(0,Math.min(e.sel,e.layers.length-1));}));
  const add=p.querySelector('[data-add]');if(add)add.onclick=()=>{const ed=S.ed;go('designs',{pick:true});
    // When a design is chosen from the library while editing, come back with it as a new layer
    S.pickLayer=async a=>{const img=await assetImg(a.id);const H=ed.base.height,w=Math.min(ed.base.width,H)*.35;ed.undo.push(snap());ed.layers.push({design_asset_id:a.id,img,quad:R.rectQuad(ed.base.width/2,H/2,w,w*img.height/img.width,0),opacity:.88,blend:'multiply',visible:true});ed.sel=ed.layers.length-1;ed.tool='layers';ed.dirty=true;S.ed=ed;S.pickLayer=null;S.hist.pop();S.hist.pop();go('editor',{},{replace:true});};};
  const ar=p.querySelector('[data-addref]');if(ar)ar.onclick=()=>act(()=>{const H=e.base.height;e.scaleRef={p1:[W*.3,H*.85],p2:[W*.7,H*.85],length:'',unit:'cm'};});
  const sl=p.querySelector('#sl');if(sl){sl.onchange=()=>{e.scaleRef.length=parseFloat(sl.value)||'';e.dirty=true;paintPanel();e.draw();};p.querySelector('#su').onchange=ev=>{e.scaleRef.unit=ev.target.value;paintPanel();};
    p.querySelector('[data-clr]').onclick=()=>act(()=>e.scaleRef=null);
    p.querySelectorAll('[data-pt]').forEach(b=>b.onclick=()=>{e.corner=+b.dataset.pt;paintPanel();e.draw();});
    p.querySelectorAll('[data-pm]').forEach(b=>b.onclick=()=>act(()=>{const [dx,dy]=b.dataset.pm.split(',').map(Number);const k=e.corner%2?'p2':'p1';e.scaleRef[k]=[e.scaleRef[k][0]+dx*N,e.scaleRef[k][1]+dy*N];}));}
}
async function saveVersion(){
  const e=S.ed,W=e.base.width,H=e.base.height;
  if(!e.layers.length)throw new Error('add at least one design');
  const v={id:St.uid(),study_id:e.studyId,source_version:e.source,mode:'photo',body_asset_id:e.bodyId,
    layers:e.layers.map(L=>({design_asset_id:L.design_asset_id,quad:L.quad.map(p=>[p[0]/W,p[1]/H]),opacity:L.opacity,blend:L.blend,visible:L.visible})),
    scale_ref:e.scaleRef&&e.scaleRef.length?{p1:[e.scaleRef.p1[0]/W,e.scaleRef.p1[1]/H],p2:[e.scaleRef.p2[0]/W,e.scaleRef.p2[1]/H],length:e.scaleRef.length,unit:e.scaleRef.unit}:null,
    size_text:sizeText()||null,created:Date.now(),schema_version:1,note:''};
  const c=await renderVersion(v,900);v.thumb=await thumbOf(c);
  await St.put('versions',v);const s=await St.get('studies',e.studyId);s.updated=Date.now();s.last_body=e.bodyId;await St.put('studies',s);return v;
}
// library pick while editing
const _designBind=VIEWS.design.bind;
VIEWS.design.bind=function(){_designBind();if(S.pickLayer){const b=app.querySelector('[data-use]');b.textContent='Add as a layer';b.onclick=async()=>S.pickLayer(await ensureDesignAsset(S.params.id));}};

/* ---------- study detail ---------- */
VIEWS.study={
  html:async()=>{const s=await St.get('studies',S.params.id);if(!s)return `${topbar('Study')}<div class="empty">This study was deleted.</div>`;
   const vs=await versionsOf(s.id);const cur=vs.find(v=>v.id===S.params.v)||vs[vs.length-1];S.params.cur=cur&&cur.id;
   const design=cur&&cur.layers&&cur.layers[0]?await St.get('assets',cur.layers[0].design_asset_id):null;
   return `${topbar('Study',{right:`<button class="iconbtn" data-menu aria-label="Study options">⋯</button>`})}<div class="scroll stack">
    <div class="eyebrow">${esc(s.body_region)}</div><h1>${esc(s.title)}</h1>
    ${cur?`<div style="position:relative;background:#111"><img alt="${esc(MODE_LABEL[cur.mode])}: ${esc(s.title)}" src="${url(cur.thumb)}" style="width:100%;max-height:380px;object-fit:contain;display:block">${cur.mode==='ar_marker'?`<span class="watermark">AR MARKER STUDY</span>`:''}</div>
    <div class="row" style="flex-wrap:wrap"><span class="tag ${cur.mode==='scenario'?'red':''}">${MODE_LABEL[cur.mode]}</span>${cur.preferred?'<span class="tag solid">Preferred</span>':''}<span class="small muted">${new Date(cur.created).toLocaleString()}</span></div>
    <p class="small muted">${cur.size_text?'Size ≈ '+esc(cur.size_text)+' from your reference — perspective adds error.':'No measured reference — size is relative to the photo only.'}${design?' · Design: '+esc(design.name)+' ('+esc(design.rights_source.replace('library:','library · ').replace('user:','you · '))+')':''}</p>
    ${cur.mode==='scenario'?`<p class="notice">Illustration with your chosen settings (${esc(cur.scenario.label||cur.scenario.preset)}). It does not predict how your tattoo or skin will look.</p>`:''}
    ${cur.mode==='ar_marker'?`<p class="small muted">Captured live with marker ${esc(cur.ar.target_version)} · tracking ${esc(cur.ar.tracking_state)} at capture.</p>`:''}`
    :'<div class="empty">No saved versions yet.</div>'}
    <div class="label">Versions (${vs.length})</div>
    <div class="vstrip" role="list">${vs.map(v=>`<button role="listitem" data-v="${v.id}" aria-current="${cur&&v.id===cur.id}"><img alt="" src="${url(v.thumb)}"><span>${MODE_LABEL[v.mode]}${v.preferred?' · ★':''}<br>${new Date(v.created).toLocaleDateString()}</span></button>`).join('')}</div>
    <div class="grid2">
     <button class="btn" data-edit ${cur&&cur.mode==='photo'?'':'disabled'}>Duplicate & edit</button>
     <button class="btn" data-ar>Try in live AR</button>
     <button class="btn" data-cmp ${vs.length>1?'':'disabled'}>Compare</button>
     <button class="btn" data-sc ${cur&&cur.mode!=='scenario'?'':'disabled'}>Change study</button>
    </div>
    ${vs.length<2?'<p class="small muted">Compare needs two versions — duplicate & edit to try another placement or size.</p>':''}
    <button class="btn primary block" data-cons>Prepare consultation</button>
   </div>`;},
  bind(){
    const id=S.params.id,cur=S.params.cur;
    app.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{S.params.v=b.dataset.v;render();});
    const q=s=>app.querySelector(s);
    if(q('[data-edit]'))q('[data-edit]').onclick=async()=>{const v=await St.get('versions',cur);startEditor({studyId:id,bodyId:v.body_asset_id,layers:v.layers,scaleRef:v.scale_ref,source:v.id});};
    if(q('[data-ar]'))q('[data-ar]').onclick=async()=>{const v=cur&&await St.get('versions',cur);go('arsetup',{study:id,design:v&&v.layers?v.layers[0].design_asset_id:null});};
    if(q('[data-cmp]'))q('[data-cmp]').onclick=()=>go('compare',{study:id});
    if(q('[data-sc]'))q('[data-sc]').onclick=()=>go('scinfo',{version:cur});
    if(q('[data-cons]'))q('[data-cons]').onclick=()=>go('consult',{study:id});
    if(q('[data-menu]'))q('[data-menu]').onclick=()=>studyMenu(id,cur);
  }
};
async function studyMenu(id,vid){
  const s=await St.get('studies',id),v=vid&&await St.get('versions',vid);const w=document.createElement('div');
  w.innerHTML=`<div class="scrim"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="Study options"><div class="sb stack">
   <div class="field"><label class="label" for="rn">Rename study</label><input id="rn" value="${esc(s.title)}" maxlength="40"></div>
   ${v?`<button class="btn block" data-pref>${v.preferred?'Unmark preferred':'Mark this version preferred'}</button><button class="btn danger block" data-dv>Delete this version</button>`:''}
   <button class="btn danger block" data-ds>Delete study and its photos</button></div><div class="sf"><button class="btn primary block" data-done>Done</button></div></div>`;
  app.appendChild(w);const close=()=>{w.remove();render();};
  w.querySelector('.scrim').onclick=close;
  w.querySelector('[data-done]').onclick=async()=>{const t=w.querySelector('#rn').value.trim();if(t&&t!==s.title){s.title=t;s.updated=Date.now();await St.put('studies',s);}close();};
  const pf=w.querySelector('[data-pref]');if(pf)pf.onclick=async()=>{v.preferred=!v.preferred;await St.put('versions',v);close();};
  const dv=w.querySelector('[data-dv]');if(dv)dv.onclick=async()=>{if(!await confirmDlg('Delete this version?','Other versions and the original photo stay.','Delete version',true))return;await St.del('versions',v.id);w.remove();S.params.v=null;render();};
  w.querySelector('[data-ds]').onclick=async()=>{const vs=await versionsOf(id);const bodies=[...new Set(vs.map(x=>x.body_asset_id).concat(s.last_body))].filter(Boolean);
    if(!await confirmDlg(`Delete “${s.title}”?`,`Removes ${vs.length} versions and ${bodies.length} body photo(s) from this device. Files you already exported aren’t affected.`,'Delete study',true))return;
    for(const x of vs){await St.del('versions',x.id);if(x.capture_asset_id)await St.del('assets',x.capture_asset_id);}
    const others=(await St.all('versions'));for(const b of bodies){if(!others.some(o=>o.body_asset_id===b))await St.del('assets',b);}
    await St.del('studies',id);w.remove();toast('Study deleted.');S.hist=[];go('studio',{},{replace:true});};
}

/* ---------- compare ---------- */
VIEWS.compare={
  html:async()=>{const all=(await St.all('versions')).sort((a,b)=>b.created-a.created);const ss=await St.all('studies');
   const name=v=>{const s=ss.find(x=>x.id===v.study_id);return (s?s.title:'Study')+' · '+MODE_LABEL[v.mode]+' · '+new Date(v.created).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit'});};
   if(all.length<2)return `${S.params.study?topbar('Compare'):'<div class="topbar"></div>'}<div class="scroll stack"><h1>Compare</h1><div class="empty">You need at least two saved versions. Open a study and use “Duplicate & edit”.</div></div>${S.params.study?'':tabs('compare')}`;
   const inStudy=S.params.study?all.filter(v=>v.study_id===S.params.study):all;
   const A=S.params.a||(inStudy[1]||all[1]).id,B=S.params.b||(inStudy[0]||all[0]).id;S.params.a=A;S.params.b=B;
   const va=all.find(v=>v.id===A),vb=all.find(v=>v.id===B);const mode=S.params.m||'wipe';const same=va.body_asset_id===vb.body_asset_id&&va.mode!=='ar_marker'&&vb.mode!=='ar_marker';
   const opt=sel=>all.map(v=>`<option value="${v.id}" ${v.id===sel?'selected':''}>${esc(name(v))}</option>`).join('');
   const diff=[];if(va.mode!==vb.mode)diff.push(`Modes differ: A is ${MODE_LABEL[va.mode]}, B is ${MODE_LABEL[vb.mode]}.`);
   if(va.layers&&vb.layers&&va.layers.length!==vb.layers.length)diff.push(`A has ${va.layers.length} design layer(s), B has ${vb.layers.length}.`);
   if(va.size_text||vb.size_text)diff.push(`Rough size — A: ${va.size_text||'not calibrated'}; B: ${vb.size_text||'not calibrated'}.`);
   if(va.layers&&vb.layers&&va.layers[0]&&vb.layers[0]){const w=v=>Math.hypot(v.layers[0].quad[1][0]-v.layers[0].quad[0][0],v.layers[0].quad[1][1]-v.layers[0].quad[0][1]);const r=w(vb)/w(va);if(same&&Math.abs(r-1)>.03)diff.push(`B’s design is ${Math.round(Math.abs(r-1)*100)}% ${r>1?'wider':'narrower'} than A’s on the same photo.`);}
   return `${S.params.study?topbar('Compare'):'<div class="topbar"></div>'}<div class="scroll stack"><h1>Compare</h1>
    <div class="field"><label class="label" for="ca">A</label><select id="ca">${opt(A)}</select></div>
    <div class="field"><label class="label" for="cb">B</label><select id="cb">${opt(B)}</select></div>
    <div class="chips" role="radiogroup" aria-label="View">${[['wipe','Wipe'],['side','Side by side'],['toggle','Toggle']].map(([k,l])=>`<button class="chip" role="radio" aria-checked="${mode===k}" data-m="${k}">${l}</button>`).join('')}</div>
    ${!same?'<p class="notice">Different photos or a live capture — the two images aren’t aligned, so compare placement by eye. Retake on the same photo for a precise comparison.</p>':''}
    <div id="cmpbox"></div>
    <div class="stack" style="gap:6px">${diff.map(d=>`<p class="small">${esc(d)}</p>`).join('')||'<p class="small muted">Same mode and layer count.</p>'}</div>
    <div class="row"><button class="btn" style="flex:1" data-pa>${va.preferred?'★ A preferred':'Prefer A'}</button><button class="btn" style="flex:1" data-pb>${vb.preferred?'★ B preferred':'Prefer B'}</button></div>
   </div>${S.params.study?'':tabs('compare')}`;},
  async bind(){
    if(!S.params.a)return;
    const va=await St.get('versions',S.params.a),vb=await St.get('versions',S.params.b);
    const [ia,ib]=await Promise.all([renderVersion(va,1000),renderVersion(vb,1000)]);
    const da=ia.toDataURL('image/jpeg',.85),db=ib.toDataURL('image/jpeg',.85);const box=app.querySelector('#cmpbox');const m=S.params.m||'wipe';
    if(m==='wipe'){box.innerHTML=`<div class="cmp" id="cw" style="--cut:50%"><img alt="Version A" src="${da}"><img class="top" alt="Version B" src="${db}"><div class="line"></div><span class="lab" style="left:8px">A</span><span class="lab" style="right:8px">B</span></div>
      <div class="row"><button class="nbtn btn" data-w="-10" aria-label="Show more of A" style="min-width:48px">◀</button><input type="range" id="wr" min="0" max="100" value="50" aria-label="Wipe position: left shows A, right shows B" style="flex:1;accent-color:#8D3027"><button class="btn" data-w="10" aria-label="Show more of B" style="min-width:48px">▶</button></div>`;
      const cw=box.querySelector('#cw'),wr=box.querySelector('#wr');const set=v=>{wr.value=v;cw.style.setProperty('--cut',v+'%');};wr.oninput=()=>set(wr.value);box.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>set(Math.max(0,Math.min(100,+wr.value+ +b.dataset.w))));}
    if(m==='side')box.innerHTML=`<div class="side"><figure><img alt="Version A" src="${da}"><figcaption>A · ${MODE_LABEL[va.mode]}</figcaption></figure><figure><img alt="Version B" src="${db}"><figcaption>B · ${MODE_LABEL[vb.mode]}</figcaption></figure></div>`;
    if(m==='toggle'){let showB=false;box.innerHTML=`<div class="cmp"><img id="ti" alt="Version A" src="${da}"><span class="lab" id="tl" style="left:8px">A</span></div><button class="btn block" id="tb" style="margin-top:8px">Show B</button>`;
      box.querySelector('#tb').onclick=()=>{showB=!showB;const i=box.querySelector('#ti');i.src=showB?db:da;i.alt='Version '+(showB?'B':'A');box.querySelector('#tl').textContent=showB?'B':'A';box.querySelector('#tb').textContent='Show '+(showB?'A':'B');announce('Showing version '+(showB?'B':'A'));};}
    app.querySelector('#ca').onchange=e=>{S.params.a=e.target.value;render();};app.querySelector('#cb').onchange=e=>{S.params.b=e.target.value;render();};
    app.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{S.params.m=b.dataset.m;render();});
    const pref=async(x)=>{x.preferred=!x.preferred;await St.put('versions',x);render();};
    app.querySelector('[data-pa]').onclick=()=>pref(va);app.querySelector('[data-pb]').onclick=()=>pref(vb);
  }
};

/* ---------- change study ---------- */
VIEWS.scinfo={
  html:()=>`${topbar('Change study')}<div class="scroll stack"><div class="eyebrow">Before you start</div><h2>An illustration, not a forecast</h2>
   <p>This tool lets you <b>picture</b> softer, lighter or blurrier versions of your design so you can ask your artist about them.</p>
   <p>It <b>can’t</b> tell you how <i>your</i> tattoo will look in 5 or 10 years. How ink changes depends on things like sun exposure, aftercare, placement, ink and technique — and INK STUDY has no data that turns those into a personal prediction.</p>
   <p class="small muted">The general fact that sun exposure can fade tattoo ink comes from the American Academy of Dermatology’s tattoo care guidance. Nothing here asks for your weight, health or skin details.</p>
  </div><div class="foot"><button class="btn primary block" data-ok>I understand — continue</button><button class="btn ghost block" data-skip>Skip to consultation</button></div>`,
  bind(){app.querySelector('[data-ok]').onclick=()=>go('scenario',{version:S.params.version});app.querySelector('[data-skip]').onclick=async()=>{const v=await St.get('versions',S.params.version);go('consult',{study:v.study_id});};}
};
const PRESETS={soft:{fade:.15,spread:.15,desat:.15,warp:0,label:'Soft'},medium:{fade:.35,spread:.35,desat:.35,warp:.2,label:'Medium'},strong:{fade:.6,spread:.6,desat:.55,warp:.4,label:'Strong'}};
VIEWS.scenario={
  html:()=>{const p=S.params.p||Object.assign({preset:'medium'},PRESETS.medium);S.params.p=p;
   const sl=(k,l,d)=>`<div class="field"><div class="row" style="justify-content:space-between"><label class="label" for="s-${k}">${l}</label><span class="small muted">${Math.round(p[k]*100)}</span></div><input type="range" id="s-${k}" min="0" max="100" value="${Math.round(p[k]*100)}" style="accent-color:#8D3027"><span class="hint">${d}</span></div>`;
   return `${topbar('Settings')}<div class="scroll stack"><div class="cmp" style="aspect-ratio:3/4"><canvas id="scc" style="width:100%;height:100%;object-fit:contain" aria-label="Illustration preview"></canvas><span class="watermark">SCENARIO ILLUSTRATION</span></div>
    <div class="chips" role="radiogroup" aria-label="Preset">${Object.entries(PRESETS).map(([k,v])=>`<button class="chip" role="radio" aria-checked="${p.preset===k}" data-pre="${k}">${v.label}</button>`).join('')}</div>
    ${sl('fade','Lighter ink','Lowers ink opacity and shifts it slightly cooler.')}${sl('spread','Softer edges','Blurs line edges.')}${sl('desat','Less color','Moves colors toward grey.')}${sl('warp','Shape shift','A small geometric stretch — a drawing aid, not a body prediction.')}
    <div class="field"><label class="label" for="yl">Your label <span class="muted">(optional)</span></label><input id="yl" maxlength="24" placeholder="e.g. “what if — 10 years”" value="${esc(p.yearLabel||'')}"><span class="hint">A name for this illustration only. It isn’t linked to any timeline.</span></div>
    <button class="btn ghost" data-reset>Reset</button></div><div class="foot"><button class="btn primary block" data-make>Save illustration</button></div>`;},
  async bind(){
    const v=await St.get('versions',S.params.version),p=S.params.p;const c=app.querySelector('#scc');
    const base=await assetImg(v.body_asset_id);const layers=[];for(const L of v.layers)layers.push(Object.assign({},L,{img:await assetImg(L.design_asset_id)}));
    let t=0;const draw=()=>{clearTimeout(t);t=setTimeout(()=>R.composite(base,layers,{canvas:c,max:700,scenario:p}),40);};draw();
    ['fade','spread','desat','warp'].forEach(k=>{const r=app.querySelector('#s-'+k);r.oninput=()=>{p[k]=+r.value/100;p.preset='custom';r.closest('.field').querySelector('.small').textContent=r.value;app.querySelectorAll('[data-pre]').forEach(x=>x.setAttribute('aria-checked','false'));draw();};});
    app.querySelectorAll('[data-pre]').forEach(b=>b.onclick=()=>{Object.assign(p,PRESETS[b.dataset.pre],{preset:b.dataset.pre});render();});
    app.querySelector('#yl').oninput=e=>p.yearLabel=e.target.value;
    app.querySelector('[data-reset]').onclick=()=>{S.params.p=Object.assign({preset:'soft'},PRESETS.soft);render();};
    app.querySelector('[data-make]').onclick=async()=>{const sc={fade:p.fade,spread:p.spread,desat:p.desat,warp:p.warp,preset:p.preset,label:(p.yearLabel||'').trim()||PRESETS[p.preset]&&PRESETS[p.preset].label||'Custom'};
      const nv={id:St.uid(),study_id:v.study_id,source_version:v.id,mode:'scenario',body_asset_id:v.body_asset_id,layers:v.layers,scale_ref:v.scale_ref,size_text:v.size_text,scenario:sc,illustration_flag:true,software:'ink-study-1.0',created:Date.now(),schema_version:1};
      const out=await renderVersion(nv,900);nv.thumb=await thumbOf(out);await St.put('versions',nv);go('scresult',{version:nv.id},{replace:true});};
  }
};
VIEWS.scresult={
  html:async()=>{const v=await St.get('versions',S.params.version);const src=await St.get('versions',v.source_version);
   return `${topbar('Illustration')}<div class="scroll stack"><div class="side"><figure><img alt="Original version" src="${url(src.thumb)}"><figcaption>Original · ${MODE_LABEL[src.mode]}</figcaption></figure><figure style="position:relative"><img alt="Scenario illustration" src="${url(v.thumb)}"><figcaption>Scenario illustration · ${esc(v.scenario.label)}</figcaption></figure></div>
    <div class="qcard"><div class="label">Settings used</div><p class="small">Lighter ink ${Math.round(v.scenario.fade*100)} · Softer edges ${Math.round(v.scenario.spread*100)} · Less color ${Math.round(v.scenario.desat*100)} · Shape shift ${Math.round(v.scenario.warp*100)} · generated ${new Date(v.created).toLocaleString()} by INK STUDY 1.0</p>
     <div class="label">What this can’t tell you</div><p class="small">How your own tattoo will age, how fast, or whether this design suits this spot. Those are questions for your artist.</p></div>
    <div class="qcard" id="aibox"><div class="label">Questions to bring</div><p class="small muted">Draft questions from your settings — you edit them before anything is shared.</p><button class="btn" data-ai>Draft questions with AI</button></div>
   </div><div class="foot"><button class="btn primary block" data-cons>Add to consultation</button><button class="btn block" data-study>Back to study</button></div>`;},
  bind(){const id=S.params.version;app.querySelector('[data-ai]').onclick=()=>draftQuestions(id,app.querySelector('#aibox'));
    app.querySelector('[data-cons]').onclick=async()=>{const v=await St.get('versions',id);go('consult',{study:v.study_id,pre:[id]});};
    app.querySelector('[data-study]').onclick=async()=>{const v=await St.get('versions',id);goStudy(v.study_id,id);};}
};
async function callAI(body){const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),20000);
  try{const r=await fetch('/api/ai',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:ctl.signal});const j=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(j.error||'failed');e.code=j.code;throw e;}return j;}
  catch(e){if(e.name==='AbortError'){const x=new Error('The model took too long.');x.code='TIMEOUT';throw x;}throw e;}finally{clearTimeout(t);}}
async function draftQuestions(versionId,box,extra){
  const v=await St.get('versions',versionId),s=await St.get('studies',v.study_id);const d=v.layers&&v.layers[0]?await St.get('assets',v.layers[0].design_asset_id):null;
  box.innerHTML='<div class="label">Questions to bring</div><p class="small" role="status">Drafting…</p>';
  try{const r=await callAI({task:'ink-questions',design:d?d.name:'custom design',region:s.body_region,size:v.size_text||'relative only',intent:(extra&&extra.intent)||'',concerns:(extra&&extra.concerns)||'',scenario:v.scenario?`${v.scenario.label}: lighter ${Math.round(v.scenario.fade*100)}, softer ${Math.round(v.scenario.spread*100)}`:''});
    S.aiDraft={questions:r.questions,sources:r.sources,limitations:r.limitations,ai:true};
    box.innerHTML=`<div class="label">Draft questions <span class="tag">AI draft · edit freely</span></div>${r.summary?`<p class="small muted">${esc(r.summary)}</p>`:''}<ol style="margin:0;padding-left:18px">${r.questions.map(q=>`<li>${esc(q.text)}</li>`).join('')}</ol>
     ${r.limitations&&r.limitations.length?`<p class="small muted">${r.limitations.map(esc).join(' ')}</p>`:''}${r.sources&&r.sources.length?`<p class="small">Sources: ${r.sources.map(x=>esc(x.src)).join('; ')}</p>`:''}<p class="small muted">These go into your consultation draft, where you can edit or delete them.</p>`;}
  catch(e){box.innerHTML=`<div class="label">Questions to bring</div><p class="small" role="alert">${e.code==='NO_MODEL'?'AI drafting isn’t connected on this deployment.':esc(e.message)} You can write your own questions in the consultation step — nothing is lost.</p>`;}
}

/* ---------- consultation ---------- */
const STARTERS=['Is this size right for the detail in the design?','Would you adjust the placement for how this area moves?','How would you approach the line weight here?','What aftercare do you recommend for this spot?'];
VIEWS.consult={
  html:async()=>{const ss=await studies();if(!ss.length)return `<div class="topbar"></div><div class="scroll stack"><h1>Consult</h1><div class="empty">Create a study first, then come back to package it for your artist.</div><button class="btn primary" data-new>New study</button></div>${tabs('consult')}`;
   const sid=S.params.study||ss[0].id;S.params.study=sid;const vs=await versionsOf(sid);
   const P=S.pkg&&S.pkg.study===sid?S.pkg:(S.pkg={study:sid,title:(ss.find(s=>s.id===sid)||{}).title||'',versions:(S.params.pre||vs.filter(v=>v.preferred).map(v=>v.id)).slice(0,3),intent:'',questions:[],includeOriginal:false});
   return `${S.hist.length?topbar('Consultation'):'<div class="topbar"></div>'}<div class="scroll stack"><div class="eyebrow">Consultation package</div><h1>For your artist</h1>
    <div class="field"><label class="label" for="cs">Study</label><select id="cs">${ss.map(s=>`<option value="${s.id}" ${s.id===sid?'selected':''}>${esc(s.title)}</option>`).join('')}</select></div>
    <div class="field"><label class="label" for="pt">Package title</label><input id="pt" maxlength="60" value="${esc(P.title)}"></div>
    <div class="label">Versions to include (up to 3)</div>
    ${vs.length?vs.map(v=>`<label class="check"><input type="checkbox" data-iv="${v.id}" ${P.versions.includes(v.id)?'checked':''}><img src="${url(v.thumb)}" alt="" style="width:56px;height:56px;object-fit:cover"><span><b>${MODE_LABEL[v.mode]}</b>${v.preferred?' · preferred':''}<br><span class="small muted">${new Date(v.created).toLocaleString()}</span></span></label>`).join(''):'<p class="small muted">This study has no versions yet.</p>'}
    <label class="check"><input type="checkbox" id="io" ${P.includeOriginal?'checked':''}><span>Also include the unedited body photo<br><span class="small muted">Off by default. Edited versions are always the cropped photo you saved.</span></span></label>
    <div class="field"><label class="label" for="pi">What you’re hoping for</label><textarea id="pi" maxlength="400" placeholder="e.g. Small and delicate, visible when I roll my sleeves.">${esc(P.intent)}</textarea></div>
    <p class="err" id="perr" role="alert"></p>
   </div><div class="foot"><button class="btn primary block" data-next>Next: questions</button></div>${S.hist.length?'':tabs('consult')}`;},
  bind(){
    const n=app.querySelector('[data-new]');if(n){n.onclick=()=>{S.new={};go('source');};return;}
    const P=S.pkg;app.querySelector('#cs').onchange=e=>{S.params.study=e.target.value;S.params.pre=null;S.pkg=null;render();};
    app.querySelector('#pt').oninput=e=>P.title=e.target.value;app.querySelector('#pi').oninput=e=>P.intent=e.target.value;app.querySelector('#io').onchange=e=>P.includeOriginal=e.target.checked;
    app.querySelectorAll('[data-iv]').forEach(c=>c.onchange=()=>{const id=c.dataset.iv;if(c.checked){if(P.versions.length>=3){c.checked=false;app.querySelector('#perr').textContent='Up to 3 versions keeps the package easy to read.';return;}P.versions.push(id);}else P.versions=P.versions.filter(x=>x!==id);app.querySelector('#perr').textContent='';});
    app.querySelector('[data-next]').onclick=()=>{if(!P.title.trim()){app.querySelector('#perr').textContent='Add a package title.';return;}if(!P.versions.length){app.querySelector('#perr').textContent='Pick at least one version.';return;}go('questions');};
  }
};
VIEWS.questions={
  html:()=>{const P=S.pkg;if(!P.questions.length&&S.aiDraft&&S.aiDraft.questions){P.questions=S.aiDraft.questions.map(q=>({text:q.text,group:q.group,ai:true}));P.sources=S.aiDraft.sources||[];S.aiDraft=null;}
   return `${topbar('Questions')}<div class="scroll stack"><h2>Questions for your artist</h2><p class="small muted">Write your own, start from a prompt, or draft with AI. Nothing is sent until you export.</p>
    <div id="qs" class="stack">${P.questions.map((q,i)=>`<div class="qcard"><label class="label" for="q${i}">${q.ai?'AI draft':'Question'} ${i+1} <span class="muted small">· ${esc(q.group||'other')}</span></label><textarea id="q${i}" data-q="${i}" maxlength="240" style="min-height:64px;border:1px solid #8a857c;border-radius:6px;padding:8px">${esc(q.text)}</textarea><button class="btn ghost" data-rm="${i}" style="align-self:flex-end;min-height:36px">Remove</button></div>`).join('')||'<p class="empty small">No questions yet.</p>'}</div>
    <button class="btn" data-addq>+ Write a question</button>
    <div class="chips" aria-label="Starter prompts written by INK STUDY">${STARTERS.map((s,i)=>`<button class="chip" data-st="${i}">${esc(s)}</button>`).join('')}</div>
    <div class="field"><label class="label" for="cc">Anything you’re unsure about? <span class="muted">(helps the AI draft)</span></label><textarea id="cc" maxlength="300">${esc(P.concerns||'')}</textarea></div>
    <div id="aibox2"></div><button class="btn" data-ai>Draft with AI</button>
   </div><div class="foot"><button class="btn primary block" data-next>Review package</button></div>`;},
  bind(){const P=S.pkg;
    app.querySelectorAll('[data-q]').forEach(t=>t.oninput=()=>{P.questions[+t.dataset.q].text=t.value;});
    app.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{P.questions.splice(+b.dataset.rm,1);render();});
    app.querySelector('[data-addq]').onclick=()=>{P.questions.push({text:'',group:'other'});render();const t=app.querySelector(`#q${P.questions.length-1}`);t&&t.focus();};
    app.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{P.questions.push({text:STARTERS[+b.dataset.st],group:'other'});render();});
    app.querySelector('#cc').oninput=e=>P.concerns=e.target.value;
    app.querySelector('[data-ai]').onclick=async()=>{const box=app.querySelector('#aibox2');await draftQuestions(P.versions[0],box,{intent:P.intent,concerns:P.concerns});
      if(S.aiDraft){P.questions=P.questions.filter(q=>q.text.trim()).concat(S.aiDraft.questions.map(q=>({text:q.text,group:q.group,ai:true})));P.sources=S.aiDraft.sources||[];S.aiDraft=null;render();}};
    app.querySelector('[data-next]').onclick=()=>{P.questions=P.questions.filter(q=>q.text.trim());go('preview');};}
};
VIEWS.preview={
  html:async()=>{const P=S.pkg;const s=await St.get('studies',P.study);const vs=[];for(const id of P.versions)vs.push(await St.get('versions',id));
   return `${topbar('Review package')}<div class="scroll stack"><div class="eyebrow">${esc(s.body_region)}</div><h1>${esc(P.title)}</h1>
    ${vs.map((v,i)=>`<figure style="margin:0;position:relative"><img src="${url(v.thumb)}" alt="Version ${i+1}" style="width:100%;display:block">${v.mode==='ar_marker'?`<span class="watermark">AR MARKER STUDY</span>`:''}<figcaption class="small" style="margin-top:4px">Version ${i+1} · ${MODE_LABEL[v.mode]}${v.size_text?' · ≈ '+esc(v.size_text):' · size not calibrated'}</figcaption></figure>`).join('')}
    ${P.includeOriginal?'<p class="small"><b>+ unedited body photo</b></p>':'<p class="small muted">Unedited body photo: not included.</p>'}
    ${P.intent?`<div><div class="label">Hoping for</div><p>${esc(P.intent)}</p></div>`:''}
    <div><div class="label">Questions</div>${P.questions.length?`<ol style="padding-left:18px;margin:4px 0">${P.questions.map(q=>`<li>${esc(q.text)}${q.ai?' <span class="small muted">(AI-drafted, reviewed by me)</span>':''}</li>`).join('')}</ol>`:'<p class="small muted">None.</p>'}</div>
    <p class="small muted">The PDF is built on this device. Images are re-encoded without location data. Sending it doesn’t mean your artist has read it.</p>
    <p id="xmsg" role="status" class="small"></p>
   </div><div class="foot"><button class="btn primary block" data-share>Share PDF</button><button class="btn block" data-dl>Download PDF</button></div>`;},
  bind(){const go2=async share=>{const m=app.querySelector('#xmsg');m.textContent='Building PDF…';
      try{const blob=await buildPDF();const name=(S.pkg.title||'consultation').replace(/[^\w-]+/g,'-').toLowerCase()+'.pdf';const file=new File([blob],name,{type:'application/pdf'});
        if(share&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:S.pkg.title});m.textContent='Handed to your share sheet. Whether it was delivered depends on the app you chose.';}catch(e){m.textContent=e.name==='AbortError'?'Sharing cancelled. Your package is still here.':'Sharing failed — try Download instead.';}}
        else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>a.remove(),500);m.textContent=share?'This browser can’t share files, so the PDF was downloaded instead.':'PDF downloaded.';}}
      catch(e){m.textContent='Couldn’t build the PDF: '+e.message;}};
    app.querySelector('[data-share]').onclick=()=>go2(true);app.querySelector('[data-dl]').onclick=()=>go2(false);}
};
function loadScript(src){return new Promise((res,rej)=>{if([...document.scripts].some(s=>s.src===src))return res();const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('Couldn’t load the PDF library — check your connection.'));document.head.appendChild(s);});}
async function buildPDF(){
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  const {jsPDF}=window.jspdf;const P=S.pkg;const s=await St.get('studies',P.study);const doc=new jsPDF({unit:'pt',format:'a4'});const W=595,M=48;let y=M;
  const text=(t,size,opt)=>{doc.setFontSize(size);doc.setFont('helvetica',opt&&opt.bold?'bold':'normal');doc.setTextColor(opt&&opt.color||'#20201E');const lines=doc.splitTextToSize(String(t).replace(/[^\x20-\x7E -ÿ]/g,'?'),W-2*M);for(const l of lines){if(y>800){doc.addPage();y=M;}doc.text(l,M,y);y+=size*1.35;}};
  text('INK STUDY · CONSULTATION PACKAGE',9,{color:'#8D3027',bold:true});y+=4;text(P.title,22,{bold:true});text(`${s.body_region} · prepared ${new Date().toLocaleDateString()}`,10,{color:'#625E57'});y+=8;
  if(P.intent){text('Hoping for',11,{bold:true});text(P.intent,11);y+=6;}
  for(let i=0;i<P.versions.length;i++){const v=await St.get('versions',P.versions[i]);const c=await renderVersion(v,1400);const k=Math.min((W-2*M)/c.width,420/c.height);
    if(y+c.height*k+40>800){doc.addPage();y=M;}doc.addImage(c.toDataURL('image/jpeg',.88),'JPEG',M,y,c.width*k,c.height*k);y+=c.height*k+14;
    text(`Version ${i+1} — ${MODE_LABEL[v.mode]}${v.mode==='scenario'?' (illustration with chosen settings; not a prediction)':''}${v.size_text?' — approx. '+v.size_text+' from a user reference':' — size not calibrated'}`,10,{color:'#625E57'});y+=8;}
  if(P.includeOriginal){const v=await St.get('versions',P.versions[0]);const a=v.body_asset_id&&await assetImg(v.body_asset_id);if(a){const c=document.createElement('canvas');const k0=Math.min(1,1400/Math.max(a.width,a.height));c.width=a.width*k0;c.height=a.height*k0;c.getContext('2d').drawImage(a,0,0,c.width,c.height);const k=Math.min((W-2*M)/c.width,380/c.height);if(y+c.height*k>800){doc.addPage();y=M;}doc.addImage(c.toDataURL('image/jpeg',.88),'JPEG',M,y,c.width*k,c.height*k);y+=c.height*k+14;text('Unedited body photo',10,{color:'#625E57'});}}
  if(P.questions.length){y+=6;text('Questions',13,{bold:true});P.questions.forEach((q,i)=>text(`${i+1}. ${q.text}${q.ai?' (AI-drafted, reviewed by me)':''}`,11));}
  if(P.sources&&P.sources.length){y+=6;text('Sources: '+P.sources.map(x=>x.src).join('; '),9,{color:'#625E57'});}
  y+=10;text('Photo and AR previews are approximate: flat-surface placement, no curvature or skin texture. Sizes are rough unless measured with a stencil. Scenario illustrations show chosen settings only.',9,{color:'#625E57'});
  return doc.output('blob');
}

/* ---------- AR ---------- */
VIEWS.arsetup={
  html:()=>`${topbar('Live AR')}<div class="scroll stack"><div class="eyebrow">Limited planar tracking</div><h2>Live AR with a marker card</h2>
   <div class="marker"><img src="https://cdn.jsdelivr.net/gh/AR-js-org/AR.js@3.4.5/data/images/hiro.png" alt="The Hiro marker: a black square with the word Hiro inside"></div>
   <ol style="padding-left:20px;margin:0" class="stack"><li>Print this card (about 6–8 cm wide) or show it on another screen.</li><li>Hold or lay it <b>flat, right next to</b> the spot — don’t stick it to skin.</li><li>Point your camera at it. The design appears on the card’s plane and follows it.</li></ol>
   <p class="small muted">The card is a flat reference. It doesn’t scan your arm’s curve, and the design won’t bend around it. If the card leaves the view, the design pauses — it never floats on its own.</p>
   <a class="btn block" href="https://cdn.jsdelivr.net/gh/AR-js-org/AR.js@3.4.5/data/images/hiro.png" target="_blank" rel="noopener" download>Open printable card</a>
   <p class="err" id="arerr" role="alert"></p></div><div class="foot"><button class="btn primary block" data-start ${S.params.design?'':'disabled'}>Start camera</button>${S.params.design?'':'<p class="small muted">Save a photo version first so INK STUDY knows which design to show.</p>'}</div>`,
  bind(){app.querySelector('[data-start]').onclick=()=>{const c=document.createElement('canvas');const ok=!!(c.getContext('webgl')||c.getContext('experimental-webgl'));
    if(!ok){app.querySelector('#arerr').textContent='This browser doesn’t support WebGL, which live AR needs. Use the photo study instead.';return;}
    if(!navigator.mediaDevices){app.querySelector('#arerr').textContent='Camera isn’t available here (live AR needs HTTPS and camera permission).';return;}
    location.href=`/ink/ar?study=${encodeURIComponent(S.params.study)}&design=${encodeURIComponent(S.params.design)}`;};}
};

/* ---------- privacy ---------- */
VIEWS.privacy={
  html:async()=>{const as=await St.all('assets'),vs=await St.all('versions'),ss=await St.all('studies');
   const bodies=as.filter(a=>a.type==='body').length,caps=as.filter(a=>a.type==='capture').length,des=as.filter(a=>a.type==='design'&&!a.rights_source.startsWith('library')).length;
   return `${topbar('Data & permissions')}<div class="scroll stack"><h2>What’s stored</h2>
    <div class="qcard"><p><b>On this device</b> (browser storage): ${bodies} body photo(s), ${caps} AR capture(s), ${des} uploaded design(s), ${vs.length} version(s) across ${ss.length} stud${ss.length===1?'y':'ies'}.</p>
    <p><b>On INK STUDY’s server:</b> nothing. This beta has no cloud storage or share links.</p>
    <p><b>Sent to the AI</b> (only when you tap “Draft”): design name, body area label, rough size text, your notes and chosen illustration settings. Never your photos.</p>
    <p><b>Exports:</b> PDFs you download or share are yours; deleting here can’t reach copies already sent.</p></div>
    <div class="qcard"><p><b>Camera</b> is requested only when you tap Take photo or Start camera, and stops when you leave that screen. To change it, use your browser’s site settings.</p></div>
    <button class="btn danger block" data-wipe>Delete everything on this device</button></div>`;},
  bind(){app.querySelector('[data-wipe]').onclick=async()=>{if(!await confirmDlg('Delete everything?','All studies, versions, body photos, captures and uploaded designs are erased from this device.','Delete everything',true))return;
    for(const s of ['assets','studies','versions'])await St.clear(s);imgCache.clear();toast('Everything was deleted from this device.');S.hist=[];go('studio',{},{replace:true});};}
};

/* ---------- boot ---------- */
(async()=>{
  const q=new URLSearchParams(location.search);
  const w=await St.get('meta','welcomed').catch(()=>null);
  if(q.get('study')){S.hist=[['studio',{}]];go('study',{id:q.get('study'),v:q.get('v')},{replace:true});history.replaceState(null,'','/ink/');}
  else go(w?'studio':'welcome',{},{replace:true});
  fetch('/api/health').then(r=>r.json()).then(h=>{const el=document.getElementById('svc');if(el)el.innerHTML=`<span class="status-chip ${h.ai?'ok':'off'}">AI 咨询问题${h.ai?' · 已连接':' · 未配置（可手写）'}</span>`;}).catch(()=>{});
})();
})();

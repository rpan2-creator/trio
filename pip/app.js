/* PIP — P0 beta. Local-first: pet, actions, memories and chat history live in IndexedDB on this device.
   Server is only used for (a) the character's AI reply and (b) optional photo analysis the user turns on. */
(function(){
'use strict';
const A=window.PIPArt;
const app=document.getElementById('app');
const sr=document.getElementById('sr');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));
const announce=t=>{sr.textContent='';setTimeout(()=>sr.textContent=t,30);};
const sysReduce=matchMedia('(prefers-reduced-motion:reduce)').matches;

/* ---------------- storage (IndexedDB) ---------------- */
const SCHEMA=1;
const DB={
  db:null,
  open(){return this.db?Promise.resolve(this.db):new Promise((res,rej)=>{const r=indexedDB.open('pip-beta',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{this.db=r.result;res(this.db)};r.onerror=()=>rej(r.error);});},
  async get(k){const db=await this.open();return new Promise((res,rej)=>{const t=db.transaction('kv').objectStore('kv').get(k);t.onsuccess=()=>res(t.result);t.onerror=()=>rej(t.error);});},
  async put(k,v){const db=await this.open();return new Promise((res,rej)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(v,k);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});},
  async del(k){const db=await this.open();return new Promise((res,rej)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').delete(k);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});},
};
function freshSave(){return {schema_version:SCHEMA,pet:null,memories:[],convo:[],actions:[],stats:{comfort:60,energy:60,changes:[]},games:[],
  settings:{reduceMotion:sysReduce,sound:false,haptics:true,offerMemories:true,voiceConsent:false},lastExport:null,created:Date.now()};}
let S={save:freshSave(),saveState:'saved',draft:null,view:'boot',params:{},anim:{state:'idle',until:0,start:0},ai:null};
async function persist(){
  S.saveState='saving';paintSave();
  try{await DB.put('save',S.save);S.saveState='saved';}catch(e){S.saveState='error';}
  paintSave();return S.saveState==='saved';
}
function paintSave(){const el=document.querySelector('[data-save]');if(!el)return;
  el.className='save'+(S.saveState==='saving'?' pending':S.saveState==='error'?' err':'');
  el.innerHTML='<i></i>'+(S.saveState==='saving'?'Saving…':S.saveState==='error'?'Not saved — tap to retry':'Saved on this device');}
const reduce=()=>S.save.settings.reduceMotion;

/* ---------------- tiny UI helpers ---------------- */
const ICON={
  back:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  close:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  feed:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16l-1.5 6.5a2 2 0 0 1-2 1.5h-9a2 2 0 0 1-2-1.5z"/><path d="M8 9c0-2 1.5-3 4-3s4 1 4 3"/></svg>',
  pet:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11m0-1V5a1.5 1.5 0 0 1 3 0v5m0 0V6.5a1.5 1.5 0 0 1 3 0V12m0-2.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L4 14.5a1.6 1.6 0 0 1 2.6-1.9L7 13.5"/></svg>',
  talk:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/></svg>',
  play:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="7.5"/><path d="M5 9.5c4 2 10 2 14 0M5 14.5c4-2 10-2 14 0"/></svg>',
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z"/></svg>',
  mem:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 15l4.5-4 4 3.5L15 12l5 4"/><circle cx="15.5" cy="8.8" r="1.3"/></svg>',
  paw:'<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="7" cy="9" rx="1.8" ry="2.4"/><ellipse cx="11" cy="6.6" rx="1.8" ry="2.4"/><ellipse cx="15.5" cy="7.2" rx="1.8" ry="2.4"/><ellipse cx="18.4" cy="11" rx="1.6" ry="2.1"/><path d="M12.5 11.5c3 0 5.5 3.6 5.5 5.8 0 1.8-1.4 2.7-3 2.7-1 0-1.6-.6-2.5-.6s-1.6.6-2.6.6c-1.7 0-2.9-1-2.9-2.6 0-2.3 2.5-5.9 5.5-5.9z"/></svg>',
  mic:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
  send:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 12l16-8-6 16-2.5-6.5z"/></svg>',
  chev:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>',
};
function toast(t){document.querySelectorAll('.toast').forEach(x=>x.remove());const d=document.createElement('div');d.className='toast';d.setAttribute('role','status');d.textContent=t;app.appendChild(d);setTimeout(()=>d.remove(),3200);}
function vib(ms){if(S.save.settings.haptics&&navigator.vibrate)try{navigator.vibrate(ms)}catch(e){}}
let actx=null;function blip(f){if(!S.save.settings.sound)return;try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();const o=actx.createOscillator(),g=actx.createGain();o.type='square';o.frequency.value=f||660;g.gain.value=.04;o.connect(g);g.connect(actx.destination);o.start();g.gain.exponentialRampToValueAtTime(.0001,actx.currentTime+.12);o.stop(actx.currentTime+.13);}catch(e){}}

function confirmDialog({title,body,verb,danger}){
  return new Promise(res=>{
    const prev=document.activeElement;
    const wrap=document.createElement('div');
    wrap.innerHTML=`<div class="scrim"></div><div class="sheet" role="alertdialog" aria-modal="true" aria-labelledby="cd-t" aria-describedby="cd-b"><div class="grab"></div>
      <div class="sh-body" style="padding-top:14px"><h2 id="cd-t">${esc(title)}</h2><p id="cd-b" class="muted" style="margin-top:8px">${esc(body)}</p></div>
      <div class="sh-foot stack"><button class="btn block ${danger?'danger solid':'primary'}" data-ok>${esc(verb)}</button><button class="btn block ghost" data-no>Cancel</button></div></div>`;
    app.appendChild(wrap);
    const done=v=>{wrap.remove();prev&&prev.focus&&prev.focus();res(v);};
    wrap.querySelector('[data-ok]').onclick=()=>done(true);wrap.querySelector('[data-no]').onclick=()=>done(false);wrap.querySelector('.scrim').onclick=()=>done(false);
    wrap.querySelector('[data-no]').focus();
    wrap.addEventListener('keydown',e=>{if(e.key==='Escape')done(false);});
  });
}
function openSheet(html,{onClose,label}={}){
  closeSheet();
  const prev=document.activeElement;
  const w=document.createElement('div');w.id='sheet';
  w.innerHTML=`<div class="scrim" data-close></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label||'Panel')}"><div class="grab"></div>${html}</div>`;
  app.appendChild(w);
  w._prev=prev;w._onClose=onClose;
  w.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeSheet()));
  w.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet();});
  const f=w.querySelector('[autofocus]')||w.querySelector('button,input,textarea');f&&f.focus();
  return w;
}
function closeSheet(){const w=document.getElementById('sheet');if(!w)return;const p=w._prev;const cb=w._onClose;w.remove();cb&&cb();p&&p.focus&&document.contains(p)&&p.focus();}

function topbar(title,{back=true,right=''}={}){
  return `<div class="topbar">${back?`<button class="iconbtn" data-back aria-label="Back">${ICON.back}</button>`:'<span style="width:44px"></span>'}<div class="title">${esc(title)}</div>${right||'<span style="width:44px"></span>'}</div>`;
}
function tabs(cur){
  const t=[['home','Home',ICON.home],['play','Play',ICON.play],['memories','Memories',ICON.mem],['pet','Pet',ICON.paw]];
  return `<nav class="tabs" aria-label="Main">${t.map(([k,l,i])=>`<button class="tab" data-go="${k}" ${cur===k?'aria-current="page"':''}>${i}<span>${l}</span></button>`).join('')}</nav>`;
}
function progress(n,of){return `<div class="progress" aria-label="Step ${n} of ${of}">${Array.from({length:of},(_,i)=>`<i class="${i<n?'on':''}"></i>`).join('')}</div>`;}

/* ---------------- routing ---------------- */
const history_=[];
function go(view,params,{replace=false}={}){
  if(!replace&&S.view!=='boot') history_.push([S.view,S.params]);
  S.view=view;S.params=params||{};render();
}
function back(){const p=history_.pop();if(p){S.view=p[0];S.params=p[1];render();}else{go(S.save.pet?'home':'welcome',{},{replace:true});}}
function render(){
  closeSheet();
  stopRecognition();
  const v=VIEWS[S.view]||VIEWS.welcome;
  app.innerHTML=`<div class="view">${v.html()}</div>`;
  app.querySelectorAll('[data-back]').forEach(b=>b.addEventListener('click',back));
  app.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.go;history_.length=0;go(k,{},{replace:true});}));
  v.bind&&v.bind();
  paintSave();
  const h=app.querySelector('h1,h2');if(h){h.setAttribute('tabindex','-1');h.focus({preventScroll:true});}
  window.Frame&&Frame.tone('dark');
}

/* ---------------- scene + animation loop ---------------- */
let scene=null; // {canvas,ctx,W,H,spots,mode,toys}
function mountScene(sel,opts){
  const c=app.querySelector(sel);if(!c)return;
  const cw=c.parentElement.clientWidth;const W=Math.floor(cw/2);
  const avail=app.clientHeight;const H=opts.H||Math.max(150,Math.min(200,Math.floor(avail*.5/2)));
  c.width=W;c.height=H;c.style.width=W*2+'px';c.style.height=H*2+'px';
  const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
  scene=Object.assign({canvas:c,ctx,W,H},opts);
  return scene;
}
function setPet(state,ms){S.anim={state,until:performance.now()+(ms||0),start:performance.now()};}
function petPose(now){
  const a=S.anim;let st=a.state;if(st!=='idle'&&st!=='rest'&&now>a.until){st='idle';S.anim.state='idle';}
  const t=now-a.start,rm=reduce();
  const f=Math.floor(t/150);
  const pose={};
  if(st==='idle'){const cyc=Math.floor(now/450)%8;if(!rm)pose.dy=cyc%2;pose.blink=!rm&&Math.floor(now/180)%22===0;pose.wag=rm?0:(cyc%4<2?0:1);}
  if(st==='react'){pose.dy=rm?0:[0,-3,-5,-3,0,0][f%6];pose.mouth=true;pose.wag=f%2;}
  if(st==='eat'){pose.eat=true;pose.mouth=!rm&&f%2===0;pose.dy=0;}
  if(st==='play'){pose.dy=rm?0:[0,-4,-6,-4,0,0][f%6];pose.wag=f%2;}
  if(st==='rest'){pose.rest=true;pose.dy=0;}
  if(st==='blink'){pose.blink=true;}
  return {pose,st,t,f};
}
function loop(now){
  requestAnimationFrame(loop);
  if(!scene||!document.contains(scene.canvas))return;
  const {ctx,W,H}=scene;
  const room=A.drawRoom(ctx,W,H,{bowlFull:S.anim.state==='eat'});
  scene.spots=room.spots;
  if(scene.toys){ // find-the-toy
    scene.toys.forEach(t=>{if(t.found)return;const sp=room.spots[t.spot];A.bitmap(ctx,A.TOYS[t.kind].rows,sp.x,sp.y,A.TOYS[t.kind].map,2);
      if(scene.hint===t.spot){ctx.strokeStyle='#fffaf0';ctx.lineWidth=1;const k=(Math.floor(now/300)%2)&&!reduce();ctx.strokeRect(sp.x-3-k,sp.y-3-k,20+2*k,20+2*k);} });
  }
  const look=scene.look||(S.save.pet&&S.save.pet.appearance)||(S.draft&&S.draft.appearance);
  if(look&&!scene.noPet){
    const {pose,st,f}=petPose(now);
    const px=room.pet.x+(scene.petDx||0),py=room.pet.y;
    // shadow
    ctx.fillStyle='rgba(30,40,30,.25)';ctx.fillRect(px-16,py-2,32,3);
    A.drawPet(ctx,look,pose,px,py,false);
    if(st==='react'&&!reduce()){A.drawHeart(ctx,px+14,py-56-(f%6)*2);if(f%4<2)A.drawHeart(ctx,px-20,py-50);}
    if(st==='react'&&reduce()){A.drawHeart(ctx,px+14,py-56);}
    if(st==='play'){A.bitmap(ctx,A.TOYS.ball.rows,px+18+(reduce()?0:(f%6)*2),py-14-(reduce()?0:[0,6,10,6,0,0][f%6]),A.TOYS.ball.map,2);}
    if(st==='eat'){const fd=A.FOODS[S.anim.food||'fish'];A.bitmap(ctx,fd.rows,px-6,py-10,fd.map,2);}
    if(st==='rest'){A.drawZ(ctx,px+12,py-44-(reduce()?0:Math.floor(now/500)%3*2));}
  }
  if(scene.overlay)scene.overlay(ctx,now);
}
requestAnimationFrame(loop);

/* ---------------- pet rules ---------------- */
function stats(){return S.save.stats;}
function canChange(){const now=Date.now();stats().changes=stats().changes.filter(t=>now-t<3600e3);return stats().changes.length<3;}
function recordAction(type,payload,actionId){
  const id=actionId||uid();
  if(S.save.actions.some(a=>a.action_id===id))return {dup:true};
  const now=Date.now();
  const ev={action_id:id,pet_id:S.save.pet.id,type,payload:payload||{},client_time:now,version:1,applied:null};
  const st=stats();
  if(type==='feed'){const lastFeed=S.save.actions.filter(a=>a.type==='feed'&&a.applied).pop();
    if((!lastFeed||now-lastFeed.client_time>=600e3)&&canChange()){st.comfort=Math.min(100,st.comfort+5);st.changes.push(now);ev.applied={comfort:5};}}
  if(type==='game_complete'&&canChange()){st.energy=Math.max(0,st.energy-5);st.changes.push(now);ev.applied={energy:-5};}
  if(type==='rest'&&canChange()){st.energy=Math.min(100,st.energy+5);st.changes.push(now);ev.applied={energy:5};}
  S.save.actions.push(ev);if(S.save.actions.length>500)S.save.actions=S.save.actions.slice(-500);
  persist();return {ev};
}
function statusLine(){
  const p=S.save.pet;if(!p)return '';
  const st=S.anim.state;
  if(st==='eat')return `${p.name} is eating on the rug.`;
  if(st==='react')return `${p.name} leans into your hand.`;
  if(st==='play')return `${p.name} is chasing the ball.`;
  if(st==='rest')return `${p.name} is napping. Tap to wake.`;
  if(stats().energy<45)return `${p.name} is on the rug and looks a little sleepy.`;
  const last=S.save.actions[S.save.actions.length-1];
  if(last&&Date.now()-last.client_time>36*3600e3)return `${p.name} is happy to see you back.`;
  return `${p.name} is sitting on the rug.`;
}

/* ---------------- views ---------------- */
const VIEWS={};
VIEWS.welcome={
  html:()=>`<div class="scene-wrap"><canvas class="scene" id="scene" aria-label="A small pixel room with a sleeping cat on a green rug." role="img"></canvas></div>
  <div class="scroll stack" style="padding-top:22px">
    <div class="tag">Pixel pet · beta</div>
    <h1>A little place for your pet</h1>
    <p class="muted">Make an original pet, or a pixel companion inspired by a pet who lives far away. It's a playful character — not your real pet, and not a treatment for anything.</p>
    <p class="small muted">No account needed. Your pet is saved on this device.</p>
  </div>
  <div class="foot"><button class="btn primary block" data-create>Create a pet</button><button class="btn block" data-restore>Restore backup</button>
  <button class="btn ghost block" data-privacy style="min-height:40px;font-size:14px">How PIP handles your data</button></div>`,
  bind(){
    mountScene('#scene',{H:150,look:{species:'cat',palette:'cream',ear:'pointed',marking:'tabby'}});setPet('rest',0);
    app.querySelector('[data-create]').onclick=()=>{S.draft={appearance:{species:'cat',palette:'cream',ear:'pointed',marking:'none'},undo:[],name:'',addressAs:'',personality:'gentle',bio:'',mode:'original',photo:null};setPet('idle');go('mode');};
    app.querySelector('[data-restore]').onclick=()=>pickBackup();
    app.querySelector('[data-privacy]').onclick=()=>openSheet(`<div class="sh-head"><h2>Your data in PIP</h2><button class="iconbtn" data-close aria-label="Close">${ICON.close}</button></div><div class="sh-body stack">${privacyFacts()}</div>`,{label:'Data'});
  }
};
function privacyFacts(){return `<p><b>On this device:</b> your pet, actions, memories and recent conversation (IndexedDB). Clearing site data deletes them — export a backup first.</p>
<p><b>Sent when you talk:</b> your pet's profile, the last 8 messages and up to 5 memories you saved and allowed, to generate one reply. Not stored by PIP's server.</p>
<p><b>Photos:</b> optional. Only the cropped square, only if you turn on server analysis. Otherwise colors are sampled on your device.</p>
<p><b>Voice:</b> your browser's speech service turns speech into text; PIP never keeps audio, and you check the text before sending.</p>`;}

VIEWS.mode={
  html:()=>`${topbar('New pet')}${progress(1,5)}<div class="scroll stack" style="padding-top:18px">
   <h1>Who are we making?</h1>
   <div class="stack" role="radiogroup" aria-label="Pet source">
    <button class="choice" role="radio" data-m="original" aria-checked="${S.draft.mode==='original'}"><div><b>An original pet</b><span>Pick a template and make it yours. Uses only the choices you make here.</span></div></button>
    <button class="choice" role="radio" data-m="real" aria-checked="${S.draft.mode==='real'}"><div><b>Based on a real pet</b><span>Start from a photo and the habits you describe. PIP plays a fictional companion inspired by them — it can't know how your real pet is doing.</span></div></button>
   </div></div><div class="foot"><button class="btn primary block" data-next>Continue</button></div>`,
  bind(){
    app.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{
      if(S.draft.mode==='real'&&b.dataset.m==='original'&&S.draft.photo){confirmDialog({title:'Remove the photo?',body:'Switching to an original pet keeps your appearance choices but discards the photo you picked.',verb:'Remove photo and switch'}).then(ok=>{if(ok){S.draft.photo=null;S.draft.mode='original';render();}});return;}
      S.draft.mode=b.dataset.m;app.querySelectorAll('[data-m]').forEach(x=>x.setAttribute('aria-checked',String(x===b)));});
    app.querySelector('[data-next]').onclick=()=>go(S.draft.mode==='real'?'photo':'appearance');
  }
};

VIEWS.photo={
  html:()=>`${topbar('Photo')}${progress(2,5)}<div class="scroll stack" style="padding-top:18px">
   <h1>Start from a photo</h1>
   <p class="muted">Optional. Use one clear photo of your pet. You'll crop it next — leave out faces, addresses and anything personal.</p>
   <div class="li" style="cursor:default"><div class="grow"><b>Analyze on PIP's server</b><span style="white-space:normal">Sends only the cropped square, once, to suggest colors and markings. Off: colors are sampled on this device.</span></div>
   <button class="switch" role="switch" aria-checked="${!!S.draft.cloud}" aria-label="Analyze photo on server" data-cloud></button></div>
   <input type="file" accept="image/*" id="photoIn" hidden>
  </div><div class="foot"><button class="btn primary block" data-pick>Pick a photo</button><button class="btn block" data-skip>Skip — set up by hand</button></div>`,
  bind(){
    const sw=app.querySelector('[data-cloud]');sw.onclick=()=>{S.draft.cloud=!S.draft.cloud;sw.setAttribute('aria-checked',String(S.draft.cloud));};
    const inp=app.querySelector('#photoIn');
    app.querySelector('[data-pick]').onclick=()=>inp.click();
    inp.onchange=()=>{const f=inp.files[0];if(!f)return;
      if(!/^image\//.test(f.type)){toast('That file isn’t an image. Try a JPEG or PNG.');return;}
      if(f.size>15e6){toast('That photo is over 15 MB. Pick a smaller one.');return;}
      const url=URL.createObjectURL(f);const img=new Image();img.onload=()=>{S.draft.photo={url,w:img.naturalWidth,h:img.naturalHeight,x:0,y:0,z:1,r:0};go('crop');};
      img.onerror=()=>toast('Couldn’t open that image format. Try a JPEG or PNG.');img.src=url;};
    app.querySelector('[data-skip]').onclick=()=>{S.draft.suggestion=null;go('appearance');};
  }
};

VIEWS.crop={
  html:()=>`${topbar('Crop')}${progress(2,5)}<div class="scroll stack" style="padding-top:12px">
    <h2>Frame just your pet</h2><p class="small muted">Only the area inside the square is used. Drag the photo, or use the buttons.</p>
    <div class="crop" id="crop"><img id="cimg" alt="Your pet photo" src="${esc(S.draft.photo.url)}"><div class="frame"></div></div>
    <div class="field"><label class="label" for="zoom">Zoom</label><input id="zoom" type="range" min="1" max="4" step=".05" value="${S.draft.photo.z}"></div>
    <div class="row" style="justify-content:space-between;flex-wrap:wrap">
      <div class="row" role="group" aria-label="Move photo"><button class="btn" data-mv="-1,0" aria-label="Move left">←</button><button class="btn" data-mv="0,-1" aria-label="Move up">↑</button><button class="btn" data-mv="0,1" aria-label="Move down">↓</button><button class="btn" data-mv="1,0" aria-label="Move right">→</button></div>
      <div class="row"><button class="btn" data-rot>Rotate</button><button class="btn ghost" data-reset>Reset</button></div>
    </div>
    <p class="small muted" id="cropmsg" aria-live="polite"></p>
  </div><div class="foot"><button class="btn primary block" data-cont>Continue</button></div>`,
  bind(){
    const P=S.draft.photo,img=app.querySelector('#cimg'),box=app.querySelector('#crop');
    const base=()=>{const b=box.clientWidth;const s=Math.max(b/P.w,b/P.h)*((P.r%180)?Math.max(P.w,P.h)/Math.min(P.w,P.h):1);return s;};
    const paint=()=>{const s=base()*P.z;img.style.width=P.w*s+'px';img.style.height=P.h*s+'px';img.style.transform=`translate(calc(-50% + ${P.x}px),calc(-50% + ${P.y}px)) rotate(${P.r}deg)`;};
    paint();
    let drag=null;box.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,px:P.x,py:P.y};box.setPointerCapture(e.pointerId);});
    box.addEventListener('pointermove',e=>{if(!drag)return;const k=box.getBoundingClientRect().width/box.clientWidth;P.x=drag.px+(e.clientX-drag.x)/k;P.y=drag.py+(e.clientY-drag.y)/k;paint();});
    box.addEventListener('pointerup',()=>drag=null);
    app.querySelector('#zoom').oninput=e=>{P.z=+e.target.value;paint();};
    app.querySelectorAll('[data-mv]').forEach(b=>b.onclick=()=>{const [dx,dy]=b.dataset.mv.split(',').map(Number);P.x+=dx*12;P.y+=dy*12;paint();});
    app.querySelector('[data-rot]').onclick=()=>{P.r=(P.r+90)%360;paint();};
    app.querySelector('[data-reset]').onclick=()=>{Object.assign(P,{x:0,y:0,z:1,r:0});app.querySelector('#zoom').value=1;paint();};
    app.querySelector('[data-cont]').onclick=async e=>{
      const btn=e.currentTarget;btn.disabled=true;btn.textContent='Looking at the photo…';
      const out=document.createElement('canvas');out.width=out.height=384;const cx=out.getContext('2d');
      const bw=box.clientWidth,frame=bw*.76,s=base()*P.z,scale=384/frame;
      cx.fillStyle='#000';cx.fillRect(0,0,384,384);cx.translate(192+P.x*scale,192+P.y*scale);cx.rotate(P.r*Math.PI/180);
      cx.drawImage(img,-P.w*s*scale/2,-P.h*s*scale/2,P.w*s*scale,P.h*s*scale);
      const msg=app.querySelector('#cropmsg');
      let sug=null;
      if(S.draft.cloud){
        try{const r=await api('pet-appearance',{image:out.toDataURL('image/jpeg',.82)},20000);
          sug={species:r.species_template,palette:r.palette,marking:r.marking_preset,ear:r.ear,source:'server',status:r.status,confidence:r.confidence};}
        catch(err){msg.textContent=(err.code==='NO_MODEL'?'Server analysis isn’t available on this deployment.':'Server analysis didn’t finish.')+' Using colors sampled on your device instead.';}
      }
      if(!sug){sug=Object.assign(localSample(cx,out),{source:'device'});}
      S.draft.suggestion=sug;
      const a=S.draft.appearance;S.draft.undo.push(Object.assign({},a));
      if(sug.species)a.species=sug.species;a.palette=sug.palette;if(sug.marking)a.marking=sug.marking;a.ear=sug.ear||(a.species==='dog'?'floppy':'pointed');
      setTimeout(()=>go('appearance'),msg.textContent?1200:0);
    };
  }
};
function localSample(cx,canvas){
  const d=cx.getImageData(0,0,canvas.width,canvas.height).data;let r=0,g=0,b=0,n=0;
  for(let y=110;y<274;y+=3)for(let x=110;x<274;x+=3){const i=(y*canvas.width+x)*4;const L=(d[i]+d[i+1]+d[i+2])/3;if(L<8)continue;r+=d[i];g+=d[i+1];b+=d[i+2];n++;}
  if(!n)return {palette:'cream'};r/=n;g/=n;b/=n;
  let best='cream',bd=1e9;for(const [k,p] of Object.entries(A.PALETTES)){if(k==='tricolor')continue;const h=p.base;const pr=parseInt(h.slice(1,3),16),pg=parseInt(h.slice(3,5),16),pb=parseInt(h.slice(5,7),16);
    const dd=(pr-r)**2*.3+(pg-g)**2*.59+(pb-b)**2*.11;if(dd<bd){bd=dd;best=k;}}
  return {palette:best};
}

VIEWS.appearance={
  html:()=>{const a=S.draft.appearance,sug=S.draft.suggestion,edit=S.params.edit;
  const grp=(title,key,opts,sw)=>`<div class="stack" style="gap:8px"><div class="label" id="g-${key}">${title}</div><div class="chips" role="radiogroup" aria-labelledby="g-${key}">${Object.entries(opts).map(([k,v])=>`<button class="chip" role="radio" data-k="${key}" data-v="${k}" aria-checked="${a[key]===k}">${sw?`<span class="swatch" style="background:${sw[k].base}"></span>`:''}${esc(typeof v==='string'?v:v.name)}</button>`).join('')}</div></div>`;
  return `${topbar(edit?'Appearance':'Look')}${edit?'':progress(3,5)}<div class="scroll stack" style="padding-top:12px">
   <div class="preview"><canvas id="pv" width="52" height="52" role="img" aria-label="Preview of your pet"></canvas></div>
   ${sug?`<p class="small"><span class="tag ${sug.status==='manual_review'?'clay':'ok'}">${sug.source==='server'?(sug.status==='manual_review'?'Low-confidence suggestion — please check each layer':'Suggested from your photo'):'Color sampled on this device'}</span> Everything below is editable. Unusual coats are shown as a stylized interpretation.</p>`:''}
   ${grp('Species','species',{cat:'Cat',dog:'Dog'})}
   ${grp('Coat color','palette',Object.fromEntries(Object.entries(A.PALETTES).map(([k,v])=>[k,v.name])),A.PALETTES)}
   ${grp('Ears','ear',A.EARS)}
   ${grp('Markings','marking',A.MARKINGS)}
  </div><div class="foot"><div class="row"><button class="btn" data-undo ${S.draft.undo.length?'':'disabled aria-disabled="true"'} title="Undo last change">Undo</button><button class="btn primary" style="flex:1" data-next>${edit?'Save appearance':'Next'}</button></div></div>`;},
  bind(){
    const draw=()=>{const c=app.querySelector('#pv');A.drawPetIcon(c,S.draft.appearance,4);
      c.setAttribute('aria-label',`Preview: ${A.PALETTES[S.draft.appearance.palette].name} ${S.draft.appearance.species}, ${A.EARS[S.draft.appearance.ear]} ears, ${A.MARKINGS[S.draft.appearance.marking]}`);};
    draw();
    app.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{const a=S.draft.appearance;S.draft.undo.push(Object.assign({},a));a[b.dataset.k]=b.dataset.v;
      if(b.dataset.k==='species'&&a.species==='dog'&&a.ear==='pointed')a.ear='floppy';if(b.dataset.k==='species'&&a.species==='cat'&&a.ear==='floppy')a.ear='pointed';
      render();});
    app.querySelector('[data-undo]').onclick=()=>{const p=S.draft.undo.pop();if(p){S.draft.appearance=p;render();}};
    app.querySelector('[data-next]').onclick=async()=>{
      if(S.params.edit){S.save.pet.appearance=Object.assign({},S.draft.appearance);if(await persist()){toast('Appearance saved.');back();}else toast('Couldn’t save on this device. Try again.');return;}
      go('personality');};
  }
};

const PERSONALITIES={
  gentle:{name:'Gentle',ex:'Welcome home. Sit with me a minute — the rug is warm.'},
  playful:{name:'Playful',ex:'You’re back! Quick, the ball rolled under the bed again!'},
  cheeky:{name:'Cheeky',ex:'Oh, you again. Fine. You may pet me. Briefly.'},
};
VIEWS.personality={
  html:()=>{const d=S.draft,edit=S.params.edit;return `${topbar(edit?'Name & personality':'Personality')}${edit?'':progress(4,5)}<div class="scroll stack" style="padding-top:12px">
   <div class="row"><canvas id="pv" width="52" height="52" aria-hidden="true"></canvas><h2>${edit?'Edit':'Name and voice'}</h2></div>
   <div class="field"><label class="label" for="nm">Pet name</label><input id="nm" maxlength="24" autocomplete="off" value="${esc(d.name)}" aria-describedby="nm-h nm-e"><span class="hint" id="nm-h">1–24 characters</span><span class="err" id="nm-e" aria-live="polite"></span></div>
   <div class="field"><label class="label" for="as">What should ${esc(d.name||'your pet')} call you? <span class="muted">(optional)</span></label><input id="as" maxlength="24" value="${esc(d.addressAs)}"></div>
   <div class="label" id="pg">How they talk</div>
   <div class="stack" role="radiogroup" aria-labelledby="pg">${Object.entries(PERSONALITIES).map(([k,v])=>`<button class="choice" role="radio" data-p="${k}" aria-checked="${d.personality===k}"><div><b>${v.name}</b><span>When you come home after a long day: “${esc(v.ex)}”</span></div></button>`).join('')}</div>
   <div class="field"><label class="label" for="bio">Habits and little things <span class="muted">(optional)</span></label><textarea id="bio" maxlength="300" aria-describedby="bio-c">${esc(d.bio)}</textarea><span class="hint" id="bio-c">${d.bio.length}/300 · Only what you write here is used. PIP never guesses personality from a photo.</span></div>
  </div><div class="foot"><button class="btn primary block" data-next>${edit?'Save':'Next'}</button></div>`;},
  bind(){
    const d=S.draft;A.drawPetIcon(app.querySelector('#pv'),d.appearance,1.2);
    const nm=app.querySelector('#nm'),as=app.querySelector('#as'),bio=app.querySelector('#bio');
    nm.oninput=()=>{d.name=nm.value;app.querySelector('#nm-e').textContent='';};as.oninput=()=>d.addressAs=as.value;
    bio.oninput=()=>{d.bio=bio.value;app.querySelector('#bio-c').firstChild.textContent=bio.value.length+'/300 · Only what you write here is used. PIP never guesses personality from a photo.';};
    app.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{d.personality=b.dataset.p;app.querySelectorAll('[data-p]').forEach(x=>x.setAttribute('aria-checked',String(x===b)));});
    app.querySelector('[data-next]').onclick=async()=>{
      const n=d.name.trim();if(!n){app.querySelector('#nm-e').textContent='Give your pet a name (1–24 characters).';nm.focus();return;}
      d.name=n.slice(0,24);
      if(S.params.edit){Object.assign(S.save.pet,{name:d.name,addressAs:d.addressAs.trim(),personality:d.personality,bio:d.bio.trim()});if(await persist()){toast('Saved.');back();}else toast('Couldn’t save on this device.');return;}
      go('meet');};
  }
};

VIEWS.meet={
  html:()=>{const d=S.draft;return `<div class="scene-wrap"><canvas class="scene" id="scene" role="img" aria-label="${esc(d.name)} sits on the rug in a cozy pixel room."></canvas></div>
  ${progress(5,5)}
  <div class="scroll stack" style="padding-top:14px">
    <h1>Meet ${esc(d.name)}</h1>
    <div class="bubble" style="margin:0">Hi${d.addressAs?', '+esc(d.addressAs):''}. I’m ${esc(d.name)}. This room is ours now — come by whenever you like.</div>
    ${d.mode==='real'?`<p class="small muted">${esc(d.name)} here is a pixel companion inspired by your pet. It can’t see, hear or know how your real pet is doing.</p>`:''}
    <p class="small muted">This welcome is written by PIP, not generated by AI.</p>
    <p class="small" id="meeterr" role="alert"></p>
  </div><div class="foot"><button class="btn block" data-pet>Pet once</button><button class="btn primary block" data-meet>Meet ${esc(d.name)}</button></div>`;},
  bind(){
    mountScene('#scene',{H:160,look:S.draft.appearance});setPet('idle');
    app.querySelector('[data-pet]').onclick=()=>{setPet('react',1100);vib(15);blip(880);announce(`${S.draft.name} leans into your hand.`);};
    app.querySelector('[data-meet]').onclick=async e=>{
      const d=S.draft;e.currentTarget.disabled=true;
      const pet={id:uid(),local_owner_id:S.save.ownerId||(S.save.ownerId=uid()),mode:d.mode,name:d.name,addressAs:d.addressAs.trim(),species_template:d.appearance.species,
        appearance:Object.assign({},d.appearance),personality:d.personality,bio:d.bio.trim(),schema_version:SCHEMA,created:Date.now(),photoUsed:!!d.photo};
      S.save.pet=pet;
      if(await persist()){if(d.photo)URL.revokeObjectURL(d.photo.url);S.draft=null;history_.length=0;go('home',{first:true},{replace:true});}
      else{S.save.pet=null;e.currentTarget.disabled=false;app.querySelector('#meeterr').textContent='Couldn’t save on this device (storage may be full or blocked). Your choices are kept — try again.';}
    };
  }
};

VIEWS.home={
  html:()=>{const p=S.save.pet;const last=[...S.save.convo].reverse().find(m=>m.role==='pet'&&m.status!=='failed');
  return `<div class="hud"><div><div class="name">${esc(p.name)}</div><button class="save" data-save style="border:0;background:none;padding:0;cursor:pointer"></button></div>
    <span class="tag">${p.mode==='real'?'Inspired by your pet':'Original pet'}</span></div>
  <div class="scene-wrap"><canvas class="scene" id="scene" role="img" aria-label="${esc(statusLine())}"></canvas></div>
  <p class="sr-only" id="petstatus" aria-live="polite">${esc(statusLine())}</p>
  <div class="bubble" id="bubble">${last?esc(last.text):S.params.first?`${esc(p.name)} is settling in. Try Pet or Talk.`:esc(statusLine())}</div>
  <div class="actions" role="group" aria-label="Interact">
    <button class="act" data-a="feed">${ICON.feed}Feed</button><button class="act" data-a="pet">${ICON.pet}Pet</button>
    <button class="act" data-a="talk">${ICON.talk}Talk</button><button class="act" data-a="play">${ICON.play}Play</button>
  </div>
  ${stats().energy<45&&S.anim.state!=='rest'?`<div style="padding:0 16px"><button class="btn block" data-rest>Let ${esc(p.name)} nap</button></div>`:''}
  <div style="flex:1"></div>${tabs('home')}`;},
  bind(){
    const p=S.save.pet;mountScene("#scene",{H:Math.max(140,Math.min(230,Math.floor((app.clientHeight-400)/2)))});
    const c=app.querySelector('#scene');
    let sx=null,moved=0;
    c.addEventListener('pointerdown',e=>{sx=e.clientX;moved=0;});
    c.addEventListener('pointermove',e=>{if(sx!=null)moved+=Math.abs(e.clientX-sx);sx=e.clientX;});
    c.addEventListener('pointerup',()=>{sx=null;doPet();});
    app.querySelector('[data-save]').onclick=()=>{if(S.saveState==='error')persist();};
    app.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>({feed:openFeed,pet:doPet,talk:openTalk,play:()=>{history_.length=0;go('play',{},{replace:true});}})[b.dataset.a]());
    const r=app.querySelector('[data-rest]');if(r)r.onclick=()=>{recordAction('rest');setPet('rest');refreshStatus();render();};
    if(S.params.first&&!reduce())setPet('react',900);
  }
};
function refreshStatus(){const s=app.querySelector('#petstatus');if(s)s.textContent=statusLine();const c=app.querySelector('#scene');if(c)c.setAttribute('aria-label',statusLine());}
let petBusy=0;
function doPet(){
  const now=performance.now();if(now<petBusy)return;petBusy=now+600;
  if(S.anim.state==='rest'){setPet('idle');refreshStatus();return;}
  setPet('react',1000);vib(12);blip(880);
  const b=app.querySelector('#bubble');if(b)b.textContent=`${S.save.pet.name} leans into your hand.`;
  announce(`${S.save.pet.name} leans into your hand.`);refreshStatus();
}

function openFeed(){
  const foods=Object.entries(A.FOODS);let pick=null;
  const w=openSheet(`<div class="sh-head"><h2>Feed ${esc(S.save.pet.name)}</h2><button class="iconbtn" data-close aria-label="Close">${ICON.close}</button></div>
   <div class="sh-body stack"><div class="stack" role="radiogroup" aria-label="Food">${foods.map(([k,f])=>`<button class="choice" role="radio" aria-checked="false" data-f="${k}"><canvas width="16" height="14" data-ic="${k}" style="width:48px;height:42px;image-rendering:pixelated;flex:none" aria-hidden="true"></canvas><div><b>${f.name}</b><span>${esc(S.save.pet.name)} eats it on the rug — about 2 seconds.</span></div></button>`).join('')}</div>
   <p class="small muted">Pretend snacks for a pixel pet — not diet advice for real animals.</p></div>
   <div class="sh-foot"><button class="btn primary block" data-give disabled>Choose a snack</button></div>`,{label:'Feed'});
  w.querySelectorAll('[data-ic]').forEach(c=>{const x=c.getContext('2d');const f=A.FOODS[c.dataset.ic];A.bitmap(x,f.rows,0,0,f.map,2);});
  const give=w.querySelector('[data-give]');
  w.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{pick=b.dataset.f;w.querySelectorAll('[data-f]').forEach(x=>x.setAttribute('aria-checked',String(x===b)));give.disabled=false;give.textContent='Give '+A.FOODS[pick].name.toLowerCase();});
  const aid=uid(); // one id per confirm → retries never count twice
  give.onclick=()=>{give.disabled=true;const r=recordAction('feed',{food:pick},aid);closeSheet();
    S.anim.food=pick;setPet('eat',reduce()?900:2100);blip(520);
    const msg=`${S.save.pet.name} ate the ${A.FOODS[pick].name.toLowerCase()}. ${r.ev&&r.ev.applied?'':'(Snacks only count once every 10 minutes, but treats are always welcome.)'}`;
    setTimeout(()=>{const b=app.querySelector('#bubble');if(b)b.textContent=msg;announce(msg);refreshStatus();},reduce()?50:2100);};
}

/* ---------------- talk ---------------- */
let convoState='draft';
function openTalk(prefill){
  const p=S.save.pet;
  const w=openSheet(`<div class="sh-head"><h2>Talk with ${esc(p.name)}</h2><button class="iconbtn" data-close aria-label="Close">${ICON.close}</button></div>
    <div class="sh-body" style="flex:1;min-height:200px"><div class="msgs" id="msgs" aria-live="polite"></div><div id="propbox"></div></div>
    <div class="sh-foot"><div class="field" style="gap:4px"><label class="label" for="say">Message to ${esc(p.name)}</label>
     <div class="composer"><textarea id="say" maxlength="500" rows="1" placeholder="Say something…">${esc(prefill||S.talkDraft||'')}</textarea>
     <button class="iconbtn" data-mic aria-label="Record voice instead">${ICON.mic}</button><button class="btn primary" data-send aria-label="Send" style="min-width:52px;padding:0 12px">${ICON.send}</button></div>
     <span class="hint" id="saycount">${(prefill||S.talkDraft||'').length}/500</span></div></div>`,{label:'Talk',onClose:()=>{abortAI();}});
  w.querySelector('.sheet').style.height='72%';
  paintMsgs();
  const ta=w.querySelector('#say');
  ta.oninput=()=>{S.talkDraft=ta.value;w.querySelector('#saycount').textContent=ta.value.length+'/500';};
  ta.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();w.querySelector('[data-send]').click();}};
  w.querySelector('[data-send]').onclick=()=>{const t=ta.value.trim();if(!t||convoState==='sending')return;sendMessage(t);};
  w.querySelector('[data-mic]').onclick=()=>openRecord();
}
function paintMsgs(){
  const box=document.getElementById('msgs');if(!box)return;
  const msgs=S.save.convo.slice(-16);
  box.innerHTML=msgs.length?msgs.map(m=>`<div class="msg ${m.role}${m.status==='failed'?' failed':''}">${esc(m.text)}${m.role==='pet'?`<span class="meta">${m.simple?'Simple response · not AI':'AI reply'}${m.referenced&&m.referenced.length?' · used '+m.referenced.length+' saved memor'+(m.referenced.length>1?'ies':'y'):''} · <button data-flag="${m.id}" style="border:0;background:none;padding:0;color:inherit;text-decoration:underline;cursor:pointer;font-size:11px">Not right?</button></span>`:m.status==='failed'?'<span class="meta">Not delivered</span>':''}</div>`).join('')
   :`<p class="small muted" style="text-align:center;padding:16px 0">Say hello. ${esc(S.save.pet.name)} only knows what you tell them and what you choose to save.</p>`;
  if(convoState==='sending')box.insertAdjacentHTML('beforeend',`<div class="msg pet" id="typing">…<span class="meta" id="waitmeta">${esc(S.save.pet.name)} is thinking</span></div>`);
  box.querySelectorAll('[data-flag]').forEach(b=>b.onclick=()=>{const m=S.save.convo.find(x=>x.id===b.dataset.flag);if(m){m.flagged=true;persist();}toast('Thanks — this reply is marked as not right and won’t be reused.');});
  const body=box.parentElement;body.scrollTop=body.scrollHeight;
}
function pickMemories(text){
  const words=new Set(text.toLowerCase().split(/\W+/).filter(w=>w.length>2));
  return S.save.memories.filter(m=>m.retrieval_enabled&&m.user_confirmed)
    .map(m=>({m,s:m.text.toLowerCase().split(/\W+/).filter(w=>words.has(w)).length+(m.updated||m.created)/1e13}))
    .sort((a,b)=>b.s-a.s).slice(0,5).map(x=>({id:x.m.id,text:x.m.text}));
}
let aiCtl=null,waitTimer=null;
function abortAI(){if(aiCtl){aiCtl.abort();aiCtl=null;}clearTimeout(waitTimer);if(convoState==='sending')convoState='failed';}
async function api(task,body,timeout){
  const ctl=new AbortController();aiCtl=ctl;const t=setTimeout(()=>ctl.abort(),timeout||20000);
  try{const r=await fetch('/api/ai',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({task},body)),signal:ctl.signal});
    const j=await r.json().catch(()=>({error:'Bad response'}));if(!r.ok){const e=new Error(j.error||'Request failed');e.code=j.code;e.status=r.status;throw e;}return j;}
  catch(e){if(e.name==='AbortError'){const x=new Error('timeout');x.code='TIMEOUT';throw x;}throw e;}
  finally{clearTimeout(t);if(aiCtl===ctl)aiCtl=null;}
}
async function sendMessage(text,requestId){
  const p=S.save.pet;const rid=requestId||uid();
  let um=S.save.convo.find(m=>m.request_id===rid&&m.role==='user');
  if(!um){um={id:uid(),request_id:rid,role:'user',text,status:'sending',at:Date.now()};S.save.convo.push(um);}
  um.status='sending';S.talkDraft='';const ta=document.getElementById('say');if(ta){ta.value='';document.getElementById('saycount').textContent='0/500';}
  convoState='sending';paintMsgs();persist();
  clearTimeout(waitTimer);
  waitTimer=setTimeout(()=>{const m=document.getElementById('waitmeta');if(m){m.innerHTML=`Still thinking… <button id="stopwait" style="border:0;background:none;text-decoration:underline;cursor:pointer;color:inherit;font-size:11px">Stop waiting</button>`;document.getElementById('stopwait').onclick=()=>{abortAI();};}},12000);
  const turns=S.save.convo.filter(m=>m.status!=='failed'&&!m.flagged).slice(-8).map(m=>({role:m.role,text:m.text}));
  try{
    const r=await api('pet-respond',{pet:{name:p.name,species:p.species_template,personality:PERSONALITIES[p.personality].name,mode:p.mode,addressAs:p.addressAs,bio:p.bio},turns,memories:pickMemories(text),event:'conversation'},20000);
    clearTimeout(waitTimer);convoState='draft';um.status='sent';
    const pm={id:uid(),request_id:rid,role:'pet',text:r.reply_text,status:'sent',model_version:r.model_version,referenced:r.referenced_memory_ids,at:Date.now()};
    S.save.convo.push(pm);S.save.convo=S.save.convo.slice(-60);persist();
    setPet(r.animation_key==='eat'?'react':r.animation_key==='rest'?'idle':r.animation_key==='idle'?'react':r.animation_key,1100);
    const b=document.getElementById('bubble');if(b)b.textContent=r.reply_text;
    paintMsgs();
    if(r.memory_proposal&&S.save.settings.offerMemories)showProposal(r.memory_proposal);
  }catch(e){
    clearTimeout(waitTimer);convoState='failed';um.status='failed';persist();paintMsgs();
    const why=e.code==='NO_MODEL'?'The AI model isn’t connected on this deployment yet.':e.code==='TIMEOUT'?'The reply took too long.':e.status===429?'Too many messages — wait a minute.':'PIP couldn’t reach the model.';
    const box=document.getElementById('propbox');if(!box)return;
    box.innerHTML=`<div class="proposal" role="alert" style="border-color:var(--clay);background:#fbf1ec"><p>${why} Your message is kept.</p><div class="row" style="margin-top:10px;flex-wrap:wrap"><button class="btn" data-retry>Retry</button><button class="btn ghost" data-simple>Use a simple response</button></div></div>`;
    box.querySelector('[data-retry]').onclick=()=>{box.innerHTML='';sendMessage(text,rid);};
    box.querySelector('[data-simple]').onclick=()=>{box.innerHTML='';um.status='sent';
      S.save.convo.push({id:uid(),request_id:rid,role:'pet',text:simpleReply(text),status:'sent',simple:true,at:Date.now()});convoState='draft';persist();paintMsgs();setPet('react',900);};
  }
}
function simpleReply(t){
  const n=S.save.pet.name,l=t.toLowerCase();
  if(/sick|vet|ill|hurt|health|eat(ing)? less|vomit/.test(l))return `I can't tell how a real animal is feeling. If you're worried, check in with whoever is caring for them, or a vet.`;
  if(/miss|far|away|lonely/.test(l))return `I'm here on the rug whenever you open the app. Want to find a toy together?`;
  if(/hello|hi|hey|你好/.test(l))return `Hi! ${n} is glad you stopped by.`;
  if(/play|toy|ball|game/.test(l))return `Yes! Let's play Find the toy.`;
  return `${n} tilts their head and listens.`;
}
function showProposal(pr){
  const box=document.getElementById('propbox');if(!box)return;
  box.innerHTML=`<div class="proposal"><div class="label">Save this? <span class="tag">You told me</span></div>
   <div class="field" style="margin-top:8px"><label class="sr-only" for="ptext">Memory text</label><textarea id="ptext" maxlength="200">${esc(pr.text)}</textarea></div>
   <div class="row" style="margin-top:8px"><button class="btn primary" data-save-mem>Save memory</button><button class="btn ghost" data-skip-mem>Not now</button></div>
   <p class="small muted" style="margin-top:6px">Saved memories can be edited or forgotten in Memories.</p></div>`;
  box.querySelector('[data-save-mem]').onclick=async()=>{const t=box.querySelector('#ptext').value.trim();if(!t)return;
    S.save.memories.unshift({id:uid(),source_type:'you_shared',text:t.slice(0,200),user_confirmed:true,retrieval_enabled:true,created:Date.now()});
    box.innerHTML=(await persist())?'<p class="small" role="status">Saved to Memories.</p>':'<p class="small" role="alert">Couldn’t save on this device.</p>';};
  box.querySelector('[data-skip-mem]').onclick=()=>box.innerHTML='';
}

/* voice: browser speech recognition → editable transcript → send */
let rec=null,recTimer=null;
function stopRecognition(){if(rec){try{rec.abort();}catch(e){}rec=null;}clearInterval(recTimer);}
function openRecord(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  const p=S.save.pet;
  if(!SR){toast('Voice input isn’t supported in this browser. You can keep typing.');return;}
  if(!S.save.settings.voiceConsent){
    const w=openSheet(`<div class="sh-head"><h2>Use your voice?</h2><button class="iconbtn" data-close aria-label="Close">${ICON.close}</button></div>
     <div class="sh-body stack"><p>Your browser's speech service turns what you say into text (Safari uses Apple, Chrome uses Google). PIP never stores audio.</p><p>You'll see and can edit the text before it's sent to ${esc(p.name)}. Recording stops after 30 seconds and never runs in the background.</p></div>
     <div class="sh-foot stack"><button class="btn primary block" data-ok>Allow voice input</button><button class="btn block ghost" data-no>Keep typing</button></div>`,{label:'Voice consent'});
    w.querySelector('[data-ok]').onclick=()=>{S.save.settings.voiceConsent=true;persist();openRecord();};
    w.querySelector('[data-no]').onclick=()=>openTalk();
    return;
  }
  let finalText='',interim='',secs=0,state='idle';
  const w=openSheet(`<div class="sh-head"><h2>Talk to ${esc(p.name)}</h2><button class="iconbtn" data-close aria-label="Close">${ICON.close}</button></div>
   <div class="sh-body stack" style="text-align:center"><div class="timer" id="rt" aria-live="off">0:00 / 0:30</div>
    <button class="rec" id="recbtn" aria-pressed="false">Start</button>
    <p class="small muted" id="rmsg" aria-live="polite">Tap Start, speak, then tap Stop.</p>
    <div class="field" style="text-align:left" id="tbox" hidden><label class="label" for="tx">Check the text before sending</label><textarea id="tx" maxlength="500"></textarea></div>
   </div><div class="sh-foot stack"><button class="btn primary block" id="rsend" hidden>Send to ${esc(p.name)}</button><button class="btn block" id="rback">Back to typing</button></div>`,{label:'Record'});
  const btn=w.querySelector('#recbtn'),msg=w.querySelector('#rmsg'),rt=w.querySelector('#rt'),tbox=w.querySelector('#tbox'),tx=w.querySelector('#tx'),send=w.querySelector('#rsend');
  const fmt=s=>`0:${String(s).padStart(2,'0')} / 0:30`;
  function stop(){if(rec){try{rec.stop();}catch(e){}}clearInterval(recTimer);}
  function done(){state='review';btn.classList.remove('on');btn.textContent='Re-record';btn.setAttribute('aria-pressed','false');
    const t=(finalText+' '+interim).trim();if(!t){msg.textContent='Didn’t catch anything. Try again closer to the mic, or type instead.';return;}
    tbox.hidden=false;tx.value=t;send.hidden=false;msg.textContent='Edit anything that’s wrong, then send.';tx.focus();}
  btn.onclick=()=>{
    if(state==='recording'){stop();return;}
    finalText='';interim='';secs=0;rt.textContent=fmt(0);tbox.hidden=true;send.hidden=true;
    rec=new SR();rec.lang=navigator.language||'en-US';rec.continuous=true;rec.interimResults=true;
    rec.onresult=e=>{interim='';for(let i=e.resultIndex;i<e.results.length;i++){const r=e.results[i];if(r.isFinal)finalText+=r[0].transcript+' ';else interim+=r[0].transcript;}msg.textContent=(finalText+interim).trim()||'Listening…';};
    rec.onerror=e=>{clearInterval(recTimer);state='idle';btn.classList.remove('on');btn.textContent='Start';
      msg.textContent=e.error==='not-allowed'||e.error==='service-not-allowed'?'Microphone access was declined. You can keep typing instead.':e.error==='no-speech'?'Didn’t hear anything. Try again.':e.error==='network'?'The speech service couldn’t be reached. Try again or type.':e.error==='language-not-supported'?'This language isn’t supported for voice here. Please type.':'Recording stopped ('+e.error+'). Try again or type.';};
    rec.onend=()=>{rec=null;clearInterval(recTimer);if(state==='recording')done();};
    try{rec.start();}catch(e){msg.textContent='Couldn’t start recording. Try again.';return;}
    state='recording';btn.classList.add('on');btn.textContent='Stop';btn.setAttribute('aria-pressed','true');msg.textContent='Listening…';
    recTimer=setInterval(()=>{secs++;rt.textContent=fmt(secs);if(secs>=30){msg.textContent='30 seconds — stopped automatically.';stop();}},1000);
  };
  send.onclick=()=>{const t=tx.value.trim();if(!t)return;stopRecognition();openTalk();sendMessage(t);};
  w.querySelector('#rback').onclick=()=>{stopRecognition();openTalk();};
}

/* ---------------- play ---------------- */
VIEWS.play={
  html:()=>`${topbar('Play',{back:false})}<div class="scroll stack" style="padding-top:8px">
   <div class="game-card"><canvas class="scene" id="scene" role="img" aria-label="Preview: toys hidden around the room"></canvas>
    <div class="body stack"><h2>Find the toy</h2><p class="muted">Three toys are hiding in plain sight around ${esc(S.save.pet.name)}'s room. Tap them in the picture, or pick places from a list. No timer, no penalties.</p>
     <div class="chips"><span class="tag">About 2 minutes</span><span class="tag">Tap or list</span><span class="tag ok">Works offline</span></div>
     <button class="btn primary block" data-start>Start</button></div></div>
   <p class="small muted">More games arrive after this one is tested.</p>
  </div>${tabs('play')}`,
  bind(){
    mountScene('#scene',{H:120,toys:[{kind:'ball',spot:'shelf'},{kind:'yarn',spot:'plant'},{kind:'bone',spot:'bed'}]});setPet('idle');
    app.querySelector('[data-start]').onclick=()=>go(S.save.seenHowTo?'game':'howto');
  }
};
VIEWS.howto={
  html:()=>`${topbar('How to play')}<div class="scroll stack" style="padding-top:8px">
   <h2>Find the toy</h2>
   <ol class="stack" style="padding-left:20px;margin:0">
    <li><b>Look around the room.</b> Three toys are visible somewhere — on the shelf, by the plant, in the bed…</li>
    <li><b>Tap a toy</b>, or open <b>Search a spot</b> and choose a place. Both count the same.</li>
    <li><b>Stuck?</b> Hints outline where the next toy is. Wrong guesses cost nothing.</li>
   </ol>
   <p class="small muted">Leaving mid-round ends that round; nothing else is lost.</p>
  </div><div class="foot"><button class="btn block" data-try>Try one first</button><button class="btn primary block" data-go2>Start</button></div>`,
  bind(){app.querySelector('[data-try]').onclick=()=>{S.save.seenHowTo=true;persist();go('game',{practice:true});};
    app.querySelector('[data-go2]').onclick=()=>{S.save.seenHowTo=true;persist();go('game');};}
};
VIEWS.game={
  html:()=>`<div class="topbar"><button class="btn ghost" data-exit style="min-height:44px">Exit</button><div class="title"><span class="counter" id="cnt" aria-live="polite"></span></div><button class="btn ghost" data-hint style="min-height:44px">Hint</button></div>
   <div class="scene-wrap"><canvas class="scene" id="scene" role="img" aria-label="${esc(S.save.pet.name)}'s room with toys hidden in it"></canvas></div>
   <div class="scroll stack" style="padding-top:12px"><p id="gmsg" aria-live="polite">${S.params.practice?'Practice: find one toy.':'Find three toys.'}</p>
    <div class="label" id="sl">Search a spot</div><div class="toylist" role="group" aria-labelledby="sl" id="spots"></div></div>`,
  bind(){
    const spots=['window','shelf','plant','bed','basket','rug'];
    const pickSpots=spots.slice().sort(()=>Math.random()-.5);
    const kinds=['ball','bone','yarn'];
    const n=S.params.practice?1:3;
    const toys=kinds.slice(0,n).map((k,i)=>({kind:k,spot:pickSpots[i],found:false}));
    const G={session_id:uid(),toys,started:Date.now(),done:false};
    const sc=mountScene('#scene',{H:180,toys,petDx:0});setPet('idle');
    const cnt=app.querySelector('#cnt'),msg=app.querySelector('#gmsg'),list=app.querySelector('#spots');
    const paint=()=>{const f=toys.filter(t=>t.found).length;cnt.textContent=`${f} / ${n} found`;
      list.innerHTML=spots.map(s=>{const t=toys.find(x=>x.spot===s&&x.found);return `<button data-s="${s}" class="${t?'found':''}">${t?'✓ '+A.TOYS[t.kind].name:'Look '+esc(sc.spots?sc.spots[s].label:s)}</button>`;}).join('');
      list.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>search(b.dataset.s));};
    function search(s){
      if(G.done)return;const t=toys.find(x=>x.spot===s&&!x.found);
      if(t){t.found=true;sc.hint=null;blip(990);vib(20);setPet('play',900);msg.textContent=`Found the ${A.TOYS[t.kind].name.toLowerCase()} ${sc.spots[s].label}!`;}
      else{const done=toys.find(x=>x.spot===s&&x.found);msg.textContent=done?'Already found that one.':`Nothing ${sc.spots[s].label}. Keep looking.`;}
      paint();
      if(toys.every(x=>x.found)){G.done=true;G.status='completed';setTimeout(()=>finish(),reduce()?200:900);}
    }
    function finish(){
      if(!S.params.practice){recordAction('game_complete',{game:'find_toy',session_id:G.session_id},'game-'+G.session_id);
        S.save.games.push({id:G.session_id,game_version:1,found_ids:toys.map(t=>t.kind),status:'completed',at:Date.now()});persist();}
      go('result',{toys:toys.map(t=>({kind:t.kind,spot:t.spot,label:sc.spots[t.spot].label})),session_id:G.session_id,practice:!!S.params.practice},{replace:true});
    }
    setTimeout(paint,0);
    const c=app.querySelector('#scene');
    c.addEventListener('pointerup',e=>{const r=c.getBoundingClientRect();const x=(e.clientX-r.left)/r.width*sc.W,y=(e.clientY-r.top)/r.height*sc.H;
      let best=null,bd=1e9;for(const s of spots){const p=sc.spots[s];const d=Math.hypot(x-(p.x+7),y-(p.y+7));if(d<bd){bd=d;best=s;}}
      if(bd<=14)search(best);else{msg.textContent='Nothing there. Keep looking.';}});
    app.querySelector('[data-hint]').onclick=()=>{const t=toys.find(x=>!x.found);if(t){sc.hint=t.spot;msg.textContent=`Hint: try ${sc.spots[t.spot].label}.`;}};
    app.querySelector('[data-exit]').onclick=async()=>{if(G.done)return;if(await confirmDialog({title:'Leave this round?',body:'Toys found in this round won’t be saved. Your pet and everything else stay as they are.',verb:'Leave round'})){history_.length=0;go('play',{},{replace:true});}};
    document.addEventListener('visibilitychange',()=>{},{once:true}); // no timers to pause: the round simply waits
  }
};
VIEWS.result={
  html:()=>{const p=S.save.pet,t=S.params.toys;const names=t.map(x=>A.TOYS[x.kind].name.toLowerCase());
   const line=`You and ${p.name} found the ${names.length>1?names.slice(0,-1).join(', ')+' and '+names.slice(-1):names[0]}.`;
   S.params.line=line;
   return `<div class="scene-wrap"><canvas class="scene" id="scene" role="img" aria-label="${esc(p.name)} plays with the ball"></canvas></div>
   <div class="scroll stack" style="padding-top:16px"><h1>${S.params.practice?'Practice done':'All found!'}</h1><p>${esc(line)}</p>
   ${S.params.practice?'<p class="small muted">Practice rounds aren’t saved.</p>':`<div id="saveline"><button class="btn block" data-mem>Save as a memory</button></div>`}</div>
   <div class="foot"><button class="btn primary block" data-again>Play again</button><button class="btn block" data-home>Back home</button></div>`;},
  bind(){
    mountScene('#scene',{H:150});setPet('play',reduce()?600:2400);
    const m=app.querySelector('[data-mem]');if(m)m.onclick=async()=>{
      if(S.save.memories.some(x=>x.session_id===S.params.session_id))return;
      S.save.memories.unshift({id:uid(),source_type:'together',session_id:S.params.session_id,text:S.params.line+' (Find the toy)',user_confirmed:true,retrieval_enabled:true,created:Date.now()});
      app.querySelector('#saveline').innerHTML=(await persist())?'<p class="small" role="status">Saved to Memories → Together.</p>':'<p class="small" role="alert">Couldn’t save on this device.</p>';};
    app.querySelector('[data-again]').onclick=()=>go('game',{},{replace:true});
    app.querySelector('[data-home]').onclick=()=>{history_.length=0;go('home',{},{replace:true});};
  }
};

/* ---------------- memories ---------------- */
VIEWS.memories={
  html:()=>{const f=S.params.filter||'all',q=(S.params.q||'').toLowerCase();
  const items=S.save.memories.filter(m=>(f==='all'||m.source_type===f)&&(!q||m.text.toLowerCase().includes(q)));
  return `${topbar('Memories',{back:false,right:`<button class="iconbtn" data-add aria-label="Add a memory">+</button>`})}
  <div class="scroll stack" style="padding-top:4px">
   <div class="field"><label class="sr-only" for="mq">Search memories</label><input id="mq" type="search" placeholder="Search memories" value="${esc(S.params.q||'')}"></div>
   <div class="chips" role="radiogroup" aria-label="Filter">${[['all','All'],['you_shared','You shared'],['together','Together']].map(([k,l])=>`<button class="chip" role="radio" aria-checked="${f===k}" data-f="${k}">${l}</button>`).join('')}</div>
   ${items.length?`<div class="list">${items.map(m=>`<button class="li" data-id="${m.id}"><div class="grow"><b>${esc(m.text)}</b><span>${m.source_type==='together'?'Together':'You shared'} · ${new Date(m.created).toLocaleDateString()}${m.retrieval_enabled?'':' · not used in chats'}</span></div>${ICON.chev}</button>`).join('')}</div>`
     :`<div class="empty"><p><b>${S.save.memories.length?'Nothing matches.':'No memories yet.'}</b></p><p class="small">${S.save.memories.length?'Try another word or filter.':`When you tell ${esc(S.save.pet.name)} something worth keeping, you can choose to save it here. Only saved memories are used in conversations.`}</p></div>`}
   <div class="li" style="cursor:default"><div class="grow"><b>Offer to save things I mention</b><span style="white-space:normal">When off, ${esc(S.save.pet.name)} never proposes memories.</span></div><button class="switch" role="switch" aria-checked="${S.save.settings.offerMemories}" data-offer aria-label="Offer to save memories"></button></div>
   <p class="small muted">Stored on this device only.</p>
  </div>${tabs('memories')}`;},
  bind(){
    const q=app.querySelector('#mq');q.oninput=()=>{S.params.q=q.value;const pos=q.selectionStart;render();const n=app.querySelector('#mq');n.focus();n.setSelectionRange(pos,pos);};
    app.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{S.params.filter=b.dataset.f;render();});
    app.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>go('memory',{id:b.dataset.id}));
    app.querySelector('[data-add]').onclick=()=>go('memory',{id:null,edit:true});
    const o=app.querySelector('[data-offer]');o.onclick=()=>{S.save.settings.offerMemories=!S.save.settings.offerMemories;persist();o.setAttribute('aria-checked',String(S.save.settings.offerMemories));};
  }
};
VIEWS.memory={
  html:()=>{const m=S.save.memories.find(x=>x.id===S.params.id);const isNew=!m;const edit=S.params.edit||isNew;
  return `${topbar(isNew?'New memory':'Memory')}<div class="scroll stack" style="padding-top:8px">
   ${edit?`<div class="field"><label class="label" for="mt">${isNew?'Something you want '+esc(S.save.pet.name)+' to remember':'Edit memory'}</label><textarea id="mt" maxlength="200">${esc(m?m.text:'')}</textarea><span class="hint">Max 200 characters. Write it as a fact, e.g. “My sister walks Milo on Sundays.”</span><span class="err" id="me" aria-live="polite"></span></div>`
   :`<p style="font-size:18px">${esc(m.text)}</p>`}
   ${m?`<p class="small muted">${m.source_type==='together'?'Something you did together in PIP':'Something you shared'} · saved ${new Date(m.created).toLocaleString()}${m.updated?' · edited '+new Date(m.updated).toLocaleDateString():''}</p>
   <div class="li" style="cursor:default"><div class="grow"><b>Use in conversations</b><span style="white-space:normal">Off keeps it here but never sends it to the model.</span></div><button class="switch" role="switch" aria-checked="${m.retrieval_enabled}" data-use aria-label="Use in conversations"></button></div>`:''}
  </div><div class="foot">${edit?`<button class="btn primary block" data-save>Save</button>`:`<div class="row"><button class="btn" style="flex:1" data-edit>Edit</button><button class="btn" style="flex:1" data-export>Export text</button></div><button class="btn danger block" data-forget>Forget this memory</button>`}</div>`;},
  bind(){
    const m=S.save.memories.find(x=>x.id===S.params.id);
    const sv=app.querySelector('[data-save]');if(sv)sv.onclick=async()=>{const t=app.querySelector('#mt').value.trim();if(!t){app.querySelector('#me').textContent='Write something, or go back.';return;}
      if(m){m.text=t;m.updated=Date.now();}else S.save.memories.unshift({id:uid(),source_type:'you_shared',text:t,user_confirmed:true,retrieval_enabled:true,created:Date.now()});
      if(await persist()){toast('Memory saved.');back();}else toast('Couldn’t save on this device.');};
    const u=app.querySelector('[data-use]');if(u)u.onclick=()=>{m.retrieval_enabled=!m.retrieval_enabled;persist();u.setAttribute('aria-checked',String(m.retrieval_enabled));};
    const e=app.querySelector('[data-edit]');if(e)e.onclick=()=>go('memory',{id:m.id,edit:true},{replace:true});
    const x=app.querySelector('[data-export]');if(x)x.onclick=()=>download(`memory-${m.id.slice(0,8)}.txt`,m.text+'\n','text/plain');
    const f=app.querySelector('[data-forget]');if(f)f.onclick=async()=>{if(!await confirmDialog({title:'Forget this memory?',body:`${S.save.pet.name} will stop using it right away. Copies you exported or screenshots aren’t affected.`,verb:'Forget memory',danger:true}))return;
      S.save.memories=S.save.memories.filter(y=>y.id!==m.id);
      if(await persist()){toast('Forgotten.');back();}else toast('Couldn’t update this device. Try again.');};
  }
};

/* ---------------- pet / settings / backup / privacy ---------------- */
VIEWS.pet={
  html:()=>{const p=S.save.pet;return `${topbar('Pet',{back:false})}<div class="scroll stack" style="padding-top:4px">
   <div class="row"><div class="preview" style="padding:6px"><canvas id="pv" width="52" height="52" role="img" aria-label="${esc(p.name)}"></canvas></div>
   <div><h2>${esc(p.name)}</h2><p class="small muted">${p.mode==='real'?'Fictional companion inspired by your pet':'Original pet'} · ${PERSONALITIES[p.personality].name}</p></div></div>
   ${p.mode==='real'?`<p class="small" style="background:#ece6d8;padding:10px 12px;border-radius:12px">${esc(p.name)} in PIP is a character you set up. It doesn’t receive anything from your real pet and can’t tell you how they are.</p>`:''}
   <div class="list">
    ${[['appearance','Appearance','Species, coat, ears, markings'],['personality','Name & personality',PERSONALITIES[p.personality].name+(p.bio?' · '+p.bio:'')],['settings','Settings','Motion, sound, vibration, voice'],['backup','Backup','Export or restore your pet'],['privacy','Data & privacy','What’s stored, and deleting it']]
      .map(([k,t,s])=>`<button class="li" data-k="${k}"><div class="grow"><b>${t}</b><span>${esc(s)}</span></div>${ICON.chev}</button>`).join('')}
   </div></div>${tabs('pet')}`;},
  bind(){A.drawPetIcon(app.querySelector('#pv'),S.save.pet.appearance,1.6);
    app.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{const k=b.dataset.k,p=S.save.pet;
      if(k==='appearance'){S.draft={appearance:Object.assign({},p.appearance),undo:[],suggestion:null};go('appearance',{edit:true});}
      else if(k==='personality'){S.draft={appearance:p.appearance,name:p.name,addressAs:p.addressAs||'',personality:p.personality,bio:p.bio||''};go('personality',{edit:true});}
      else go(k);});}
};
VIEWS.settings={
  html:()=>{const s=S.save.settings;const sw=(k,t,d)=>`<div class="li" style="cursor:default"><div class="grow"><b>${t}</b><span style="white-space:normal">${d}</span></div><button class="switch" role="switch" aria-checked="${!!s[k]}" data-s="${k}" aria-label="${t}"></button></div>`;
  return `${topbar('Settings')}<div class="scroll stack"><div class="list">
   ${sw('reduceMotion','Reduce motion','Static poses with text descriptions instead of hopping and bouncing.')}
   ${sw('sound','Sound effects','Small sounds for petting, feeding and finding toys. Off by default.')}
   ${sw('haptics','Vibration','Short taps where the device supports it.')}
   ${sw('voiceConsent','Voice input','Allow the browser’s speech service to turn your voice into text. You always review the text first.')}
   ${sw('offerMemories','Offer to save memories','Let your pet propose things to remember. Nothing is saved without you.')}
   </div>
   <p class="small muted">Microphone permission is managed by your browser; this switch only controls whether PIP asks for it. Notifications aren’t available in this web beta.</p></div>`;},
  bind(){app.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{const k=b.dataset.s;S.save.settings[k]=!S.save.settings[k];persist();b.setAttribute('aria-checked',String(S.save.settings[k]));});}
};
async function checksum(obj){const buf=new TextEncoder().encode(JSON.stringify(obj));const h=await crypto.subtle.digest('SHA-256',buf);return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('');}
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}
async function exportBackup(){const data=JSON.parse(JSON.stringify(S.save));const body={app:'pip',schema_version:SCHEMA,exported_at:new Date().toISOString(),data};
  body.checksum=await checksum(data);download(`pip-${(S.save.pet&&S.save.pet.name||'pet').replace(/\W+/g,'-').toLowerCase()}-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(body,null,2),'application/json');
  S.save.lastExport=Date.now();await persist();}
function pickBackup(){const i=document.createElement('input');i.type='file';i.accept='application/json,.json';i.onchange=async()=>{const f=i.files[0];if(!f)return;
  let b;try{b=JSON.parse(await f.text());}catch(e){toast('That file isn’t a PIP backup (couldn’t read JSON). Nothing was changed.');return;}
  if(b.app!=='pip'||!b.data||!b.data.pet){toast('That file isn’t a PIP backup. Nothing was changed.');return;}
  if(b.schema_version>SCHEMA){toast('This backup is from a newer version of PIP.');return;}
  if(await checksum(b.data)!==b.checksum){toast('This backup looks damaged (checksum mismatch). Nothing was changed.');return;}
  const cur=S.save.pet;
  const ok=await confirmDialog({title:`Restore ${b.data.pet.name}?`,body:`Backup from ${new Date(b.exported_at).toLocaleString()} with ${b.data.memories.length} memories. ${cur?`This replaces ${cur.name} and everything on this device.`:'Nothing on this device will be lost.'}`,verb:cur?`Replace with ${b.data.pet.name}`:'Restore',danger:!!cur});
  if(!ok)return;const prev=S.save;S.save=Object.assign(freshSave(),b.data);
  if(await persist()){history_.length=0;toast('Restored.');go('home',{},{replace:true});}else{S.save=prev;toast('Couldn’t write to this device. Nothing was changed.');}};i.click();}
VIEWS.backup={
  html:()=>`${topbar('Backup')}<div class="scroll stack"><h2>Keep a copy</h2>
   <p class="muted">PIP has no accounts, so clearing your browser data removes your pet. A backup file lets you restore it here or in another browser.</p>
   <p><b>Last export:</b> ${S.save.lastExport?new Date(S.save.lastExport).toLocaleString():'never'}</p>
   <p class="small muted">Includes your pet, settings, ${S.save.memories.length} memories, recent conversation and care history. It’s a plain JSON file with a checksum — keep it somewhere private.</p>
  </div><div class="foot"><button class="btn primary block" data-exp>Export backup</button><button class="btn block" data-imp>Restore from a file</button></div>`,
  bind(){app.querySelector('[data-exp]').onclick=async()=>{await exportBackup();render();toast('Backup downloaded.');};app.querySelector('[data-imp]').onclick=pickBackup;}
};
VIEWS.privacy={
  html:()=>`${topbar('Data & privacy')}<div class="scroll stack">${privacyFacts()}
   <p class="small muted">This beta keeps nothing about you on PIP's server, so deleting here is complete. Files you exported are yours to delete.</p>
   <div class="divider"></div><button class="btn block" data-dl>Download my data</button>
   <h2 style="margin-top:8px">Delete</h2>
   <button class="btn danger block" data-clear>Clear conversation (${S.save.convo.length} messages)</button>
   <button class="btn danger block" data-mems>Delete all memories (${S.save.memories.length})</button>
   <button class="btn danger solid block" data-all>Delete ${esc(S.save.pet.name)} and all data</button>
  </div>`,
  bind(){
    const n=S.save.pet.name;
    app.querySelector('[data-dl]').onclick=()=>exportBackup().then(()=>toast('Downloaded.'));
    app.querySelector('[data-clear]').onclick=async()=>{if(!await confirmDialog({title:'Clear conversation?',body:'Messages are removed from this device. Saved memories stay — delete those separately.',verb:'Clear conversation',danger:true}))return;S.save.convo=[];if(await persist()){toast('Conversation cleared.');render();}};
    app.querySelector('[data-mems]').onclick=async()=>{if(!await confirmDialog({title:'Delete all memories?',body:`${n} will stop using all of them immediately.`,verb:'Delete all memories',danger:true}))return;S.save.memories=[];if(await persist()){toast('Memories deleted.');render();}};
    app.querySelector('[data-all]').onclick=async()=>{if(!await confirmDialog({title:`Delete ${n}?`,body:'Your pet, memories, conversation, care history and settings are erased from this device. This can’t be undone unless you have a backup file.',verb:`Delete ${n}`,danger:true}))return;
      try{await DB.del('save');S.save=freshSave();history_.length=0;go('welcome',{},{replace:true});toast('Everything was deleted from this device.');}catch(e){toast('Couldn’t delete. Try again.');}};
  }
};

/* ---------------- boot ---------------- */
(async()=>{
  try{const s=await DB.get('save');if(s&&s.pet){S.save=Object.assign(freshSave(),s);S.save.settings=Object.assign(freshSave().settings,s.settings||{});}}
  catch(e){S.saveState='error';}
  setPet(S.save.pet&&stats().energy<30?'rest':'idle');
  go(S.save.pet?'home':'welcome',{},{replace:true});
  fetch('/api/health').then(r=>r.json()).then(h=>{const el=document.getElementById('svc');if(el)el.innerHTML=`<span class="status-chip ${h.ai?'ok':'off'}">AI 模型${h.ai?' · 已连接':' · 未配置（对话会标注 simple response）'}</span>`;}).catch(()=>{});
})();
})();

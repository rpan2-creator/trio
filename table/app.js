/* TABLE — P0 beta client. Online rooms: the server decides everything; this file renders the
   player's own view and sends intents. Shared-phone mode runs the same engine locally. */
(function(){
'use strict';
const G=window.Games;
const app=document.getElementById('app'),sr=document.getElementById('sr');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));
const announce=t=>{sr.textContent='';setTimeout(()=>sr.textContent=t,30);};
const LS={get(k){try{return JSON.parse(localStorage.getItem(k));}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}},del(k){try{localStorage.removeItem(k);}catch(e){}}};
const COLORS=['#2548B8','#A7352A','#2f7d55','#7a4fb0','#b06a1f','#1f7f8f','#8a3a6b','#5a6b1f','#304f7f','#9a4a3a'];
const ART={
 frequency:`<svg viewBox="0 0 120 84" aria-hidden="true"><rect x="8" y="10" width="104" height="64" rx="10" fill="#EAC849"/><rect x="20" y="44" width="16" height="22" rx="3" fill="#18283F"/><rect x="44" y="26" width="16" height="40" rx="3" fill="#2548B8"/><rect x="68" y="36" width="16" height="30" rx="3" fill="#18283F"/><circle cx="52" cy="18" r="5" fill="#FFFEF9"/></svg>`,
 relay:`<svg viewBox="0 0 120 84" aria-hidden="true"><rect x="10" y="8" width="62" height="40" rx="10" fill="#FFFEF9" stroke="#18283F" stroke-width="3"/><path d="M26 48l-4 12 14-12z" fill="#FFFEF9" stroke="#18283F" stroke-width="3" stroke-linejoin="round"/><rect x="48" y="30" width="62" height="40" rx="10" fill="#2548B8"/><path d="M96 70l4 10-14-10z" fill="#2548B8"/><path d="M22 22h38M22 32h26" stroke="#18283F" stroke-width="4" stroke-linecap="round"/><path d="M60 44h38M60 54h22" stroke="#FFFEF9" stroke-width="4" stroke-linecap="round"/></svg>`,
 signal:`<svg viewBox="0 0 120 84" aria-hidden="true"><circle cx="60" cy="50" r="8" fill="#A7352A"/><path d="M44 34a22 22 0 0 1 32 0M34 24a36 36 0 0 1 52 0" fill="none" stroke="#18283F" stroke-width="5" stroke-linecap="round"/><path d="M60 58v20" stroke="#18283F" stroke-width="5" stroke-linecap="round"/><circle cx="22" cy="70" r="7" fill="#EAC849"/><circle cx="98" cy="70" r="7" fill="#EAC849"/><circle cx="98" cy="20" r="7" fill="#2548B8"/></svg>`
};
let S={view:'boot',params:{},hist:[],setup:LS.get('table.setup')||{players:5,scene:'home',device:'each',minutes:20,vibe:'chatty',mood:'relaxed',familiar:'mixed',exclude:[],passAllowed:true,noPersonal:true},
  session:LS.get('table.session'),room:null,offset:0,local:{},net:'ok',poll:null,shared:null,settings:LS.get('table.settings')||{mute:true,reduce:matchMedia('(prefers-reduced-motion:reduce)').matches}};

/* ---------- ui helpers ---------- */
function toast(t){app.querySelectorAll('.toast').forEach(x=>x.remove());const d=document.createElement('div');d.className='toast';d.setAttribute('role','status');d.textContent=t;app.appendChild(d);setTimeout(()=>d.remove(),3200);}
function topbar(title,o){o=o||{};return `<div class="topbar">${o.back===false?'<span style="width:44px"></span>':`<button class="iconbtn" data-back aria-label="Back">‹</button>`}<div class="title">${esc(title)}</div>${o.right||'<span style="width:44px"></span>'}</div>`;}
function sheet(html,label){const prev=document.activeElement;const w=document.createElement('div');w.innerHTML=`<div class="scrim"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div>`;app.appendChild(w);
  const close=()=>{w.remove();prev&&document.contains(prev)&&prev.focus();if(S.deferred)setTimeout(()=>render(),0);};w.querySelector('.scrim').onclick=close;w.onkeydown=e=>{if(e.key==='Escape')close();};w.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
  const f=w.querySelector('button,input,select');f&&f.focus();return {el:w,close};}
function confirmDlg(title,body,verb,danger){return new Promise(res=>{const s=sheet(`<div class="sb"><h2>${esc(title)}</h2><p class="muted">${esc(body)}</p></div><div class="sf"><button class="btn block ${danger?'danger':'primary'}" data-ok>${esc(verb)}</button><button class="btn block ghost" data-no>Cancel</button></div>`,title);
  s.el.querySelector('[data-ok]').onclick=()=>{s.close();res(true);};s.el.querySelector('[data-no]').onclick=()=>{s.close();res(false);};s.el.querySelector('[data-no]').focus();});}
function go(v,p,o){o=o||{};if(!o.replace&&S.view!=='boot')S.hist.push([S.view,S.params]);S.view=v;S.params=p||{};render(true);}
function back(){const h=S.hist.pop();if(h){S.view=h[0];S.params=h[1];render(true);}else go('start',{},{replace:true});}
let lastKey='';
function render(force){
  const V=VIEWS[S.view];if(!V)return;
  const key=S.view+'|'+(S.room?S.room.version:'')+'|'+JSON.stringify(S.local)+'|'+S.net;
  if(!force&&key===lastKey)return;
  if(!force&&app.querySelector('.sheet')){S.deferred=true;return;} // never wipe an open dialog; re-render when it closes
  lastKey=key;S.deferred=false;
  const active=document.activeElement&&document.activeElement.dataset?Object.assign({},document.activeElement.dataset):null;
  app.innerHTML=`<div class="view ${V.dark&&V.dark()?'table':''}">${V.html()}</div>`;
  window.Frame&&Frame.tone(V.dark&&V.dark()?'light':'dark');
  app.querySelectorAll('[data-back]').forEach(b=>b.onclick=back);
  V.bind&&V.bind();
  if(force){const h=app.querySelector('h1,h2');if(h){h.tabIndex=-1;h.focus({preventScroll:true});}}
  else if(active){const k=Object.keys(active)[0];if(k){const el=app.querySelector(`[data-${k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}="${CSS.escape(active[k])}"]`);el&&el.focus({preventScroll:true});}}
  tickTimers();
}
function tickTimers(){app.querySelectorAll('[data-deadline]').forEach(el=>{const d=+el.dataset.deadline;const now=Date.now()+(el.dataset.local?0:S.offset);const s=Math.max(0,Math.ceil((d-now)/1000));
  el.textContent=s>=60?Math.floor(s/60)+':'+String(s%60).padStart(2,'0'):String(s);el.classList.toggle('low',s<=5);el.setAttribute('aria-label',s+' seconds left');
  if(s===0&&el.dataset.onzero&&!el.dataset.fired){el.dataset.fired='1';const f=ZERO[el.dataset.onzero];f&&f();}});}
const ZERO={};
setInterval(tickTimers,250);
function seatColor(room,id){const i=room?room.players.findIndex(p=>p.id===id):0;return COLORS[(i<0?0:i)%COLORS.length];}
const nameOf=id=>{if(S.shared)return (S.shared.names||{})[id]||id;const p=S.room&&S.room.players.find(x=>x.id===id);return p?p.name:'Someone who left';};

/* ---------- network ---------- */
async function rpc(body,timeout){const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),timeout||10000);
  try{const r=await fetch('/api/room',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:ctl.signal});const j=await r.json().catch(()=>({error:'Bad response'}));j._status=r.status;return j;}
  catch(e){return {error:e.name==='AbortError'?'The server took too long.':'Can’t reach the server.',_status:0,_net:true};}finally{clearTimeout(t);}}
function applyRoom(room){if(!room)return;S.offset=room.serverTime-Date.now();const prev=S.room;S.room=room;
  if(prev&&prev.game&&room.game&&prev.game.phase!==room.game.phase){S.local={};announce(phaseText(room));}
  if(prev&&prev.state!==room.state)S.local={};
  if(room.state==='ended'){stopPoll();}
}
function phaseText(room){const g=room.game;if(!g)return '';return ({answer:'New question.',reveal:'Results are in.',ready:'Next turn.',play:'Timer started.',roundEnd:'Round over.',roles:'Check your role.',clues:'Clue round.',vote:'Time to vote.',guess:'The visitor gets one guess.',final:'Game over.'})[g.phase]||'';}
async function act(action,opts){
  if(S.shared)return actLocal(action);
  const aid=uid();S.pending=action.type;render();
  let r=await rpc({op:'action',code:S.session.code,token:S.session.token,action_id:aid,expected_version:S.room.version,action});
  if(r._net){S.net='retrying';render();for(let i=0;i<3&&r._net;i++){await new Promise(z=>setTimeout(z,900*(i+1)));r=await rpc({op:'action',code:S.session.code,token:S.session.token,action_id:aid,expected_version:S.room.version,action});}}
  S.pending=null;S.net=r._net?'offline':'ok';
  if(r.room)applyRoom(r.room);
  if(r.left){leaveLocal();return r;}
  if(r.error&&!(opts&&opts.quiet))toast(r.code==='STALE'?'The table changed — showing the latest.':r.error);
  if(r.code==='NO_SEAT'){seatLost(r.error);return r;}
  render();return r;
}
function startPoll(){stopPoll();const tickP=async()=>{if(!S.session)return;const r=await rpc({op:'snapshot',code:S.session.code,token:S.session.token},8000);
    if(r.room){S.net='ok';applyRoom(r.room);routeFromRoom();}else if(r._net){S.net='offline';render();}else if(r.code==='NO_SEAT'||r.code==='NOT_FOUND'){seatLost(r.error);return;}
    S.poll=setTimeout(tickP,document.hidden?4000:1400);};S.poll=setTimeout(tickP,0);}
function stopPoll(){clearTimeout(S.poll);S.poll=null;}
function seatLost(msg){stopPoll();const code=S.session&&S.session.code;LS.del('table.session');S.session=null;S.room=null;go('join',{code,msg},{replace:true});}
function routeFromRoom(){const r=S.room;if(!r)return;const want=r.state==='lobby'?'lobby':r.state==='ended'?'ended':'game';
  if(S.view!=='invite'&&S.view!==want&&!(S.view==='invite'&&want==='lobby')){S.hist=[];go(want,{},{replace:true});}else render();}
function leaveLocal(){stopPoll();LS.del('table.session');S.session=null;S.room=null;S.hist=[];go('start',{},{replace:true});}
document.addEventListener('visibilitychange',()=>{if(document.hidden){S.local.reveal=false;render();}});

/* ---------- views ---------- */
const VIEWS={};
VIEWS.start={
  html:()=>`<div class="scroll stack" style="padding-top:28px">
   <div class="row" style="gap:8px"><span class="pill">TABLE</span><span class="small muted">Party games for the room you’re in</span></div>
   <h1 style="font-size:40px">What are we playing?</h1>
   <div style="display:flex;gap:10px;justify-content:center;padding:8px 0">${ART.frequency}${ART.relay}${ART.signal}</div>
   ${S.session?`<div class="banner">You’re still seated at table ${esc(S.session.code)}. <button class="btn small" data-resume style="margin-left:6px">Resume</button></div>`:''}
   <p class="muted">Tell TABLE who’s here and how long you’ve got. Everyone joins with a code — no sign-up, no app download.</p>
  </div><div class="foot"><button class="btn primary block" data-host>Start a table</button><button class="btn block" data-join>Join a table</button>
   <div class="row" style="justify-content:space-between"><button class="btn ghost small" data-lib>Browse games</button><button class="btn ghost small" data-settings>Settings</button></div></div>`,
  bind(){const q=s=>app.querySelector(s);q('[data-host]').onclick=()=>go('setup');q('[data-join]').onclick=()=>go('join');q('[data-lib]').onclick=()=>go('library');q('[data-settings]').onclick=()=>go('settings');
    const r=q('[data-resume]');if(r)r.onclick=()=>resume();}
};
async function resume(){const r=await rpc({op:'snapshot',code:S.session.code,token:S.session.token});if(r.room){applyRoom(r.room);startPoll();routeFromRoom();}else{toast(r.error||'Couldn’t resume.');if(!r._net){LS.del('table.session');S.session=null;render(true);}}}
VIEWS.setup={
  html:()=>{const s=S.setup;return `${topbar('New table')}<div class="scroll stack"><h2>Who’s here?</h2>
   <div class="field"><span class="label" id="pl">Players (including you)</span><div class="stepper" role="group" aria-labelledby="pl"><button data-p="-1" aria-label="One fewer">−</button><output aria-live="polite">${s.players}</output><button data-p="1" aria-label="One more">+</button></div></div>
   <div class="field"><span class="label" id="sc">Where are you?</span><div class="tiles" role="radiogroup" aria-labelledby="sc">${[['home','Home','Living room, kitchen table'],['restaurant','Restaurant','Seated, some noise'],['lounge','Lounge','Couches, moving around'],['other','Other','Anywhere else']].map(([k,l,d])=>`<button class="tile" role="radio" aria-checked="${s.scene===k}" data-sc="${k}"><b>${l}</b><span>${d}</span></button>`).join('')}</div></div>
   <div class="field"><span class="label" id="dv">Phones</span><div class="seg" role="radiogroup" aria-labelledby="dv"><button role="radio" aria-checked="${s.device==='each'}" data-dv="each">Everyone has a phone</button><button role="radio" aria-checked="${s.device==='shared'}" data-dv="shared">One shared phone</button></div>
   <span class="small muted">${s.device==='shared'?'Pass one phone around. Games with secret roles aren’t available this way.':'Each player joins on their own phone with a code.'}</span></div>
  </div><div class="foot"><button class="btn primary block" data-next>Next</button></div>`;},
  bind(){const s=S.setup;app.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{s.players=Math.max(3,Math.min(10,s.players+ +b.dataset.p));render(true);});
    app.querySelectorAll('[data-sc]').forEach(b=>b.onclick=()=>{s.scene=b.dataset.sc;render(true);});app.querySelectorAll('[data-dv]').forEach(b=>b.onclick=()=>{s.device=b.dataset.dv;render(true);});
    app.querySelector('[data-next]').onclick=()=>{LS.set('table.setup',s);go('prefs');};}
};
VIEWS.prefs={
  html:()=>{const s=S.setup;const seg=(k,opts,lab)=>`<div class="field"><span class="label" id="l-${k}">${lab}</span><div class="seg" role="radiogroup" aria-labelledby="l-${k}">${opts.map(([v,l])=>`<button role="radio" aria-checked="${s[k]==v}" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div></div>`;
   return `${topbar('Mood')}<div class="scroll stack"><h2>How should it feel?</h2>
   ${seg('minutes',[[10,'10 min'],[20,'20 min'],[30,'30 min'],[60,'Longer']],'Time for this game')}
   ${seg('vibe',[['quiet','Keep it quiet'],['chatty','Chatty is fine']],'Noise')}
   ${seg('mood',[['relaxed','Relaxed'],['competitive','Competitive']],'Energy')}
   ${seg('familiar',[['new','New to games'],['mixed','Mixed'],['regulars','Game regulars']],'Experience')}
   <div class="field"><span class="label">Leave out</span><label class="check"><input type="checkbox" data-ex="bluffing" ${s.exclude.includes('bluffing')?'checked':''}><span>Bluffing or hidden roles</span></label></div>
   <div class="field"><span class="label">Always on at TABLE</span><p class="small muted">Anyone can pass a turn without explaining. No personal questions, dares or drinking rules — even if you’re at a bar.</p></div>
  </div><div class="foot"><button class="btn primary block" data-next>See games</button></div>`;},
  bind(){const s=S.setup;app.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{const v=b.dataset.v;s[b.dataset.k]=isNaN(+v)?v:+v;render(true);});
    app.querySelectorAll('[data-ex]').forEach(c=>c.onchange=()=>{s.exclude=c.checked?[c.dataset.ex]:[];});
    app.querySelector('[data-next]').onclick=()=>{LS.set('table.setup',s);S.rec=null;go('recs');};}
};
function query(){const s=S.setup;return {players:s.players,device:s.device,minutes:s.minutes,vibe:s.vibe,mood:s.mood,familiar:s.familiar,exclude:s.exclude,language:'en'};}
VIEWS.recs={
  html:()=>{const q=query();const rank=G.rankGames(q);const all=G.filterGames(q);const rec=S.rec||{};
   const reasons=rec.picks?Object.fromEntries(rec.picks.map(p=>[p.game_id,p.reason])):{};
   const order=rec.picks?rec.picks.map(p=>p.game_id).concat(rank.map(r=>r.game_id).filter(id=>!reasons[id])):rank.map(r=>r.game_id);
   const card=id=>{const g=G.meta(id);return `<button class="rec" data-g="${id}"><div class="art" style="background:${id==='frequency'?'#f1e7c6':id==='relay'?'#dfe6fb':'#f3ded9'}">${ART[id]}</div><div class="body">
     <h2 style="font-size:22px">${g.name}</h2><div class="meta"><span class="pill">${q.device==='shared'?g.shared_min+'–'+g.shared_max:g.min+'–'+g.max} players</span><span class="pill">${g.duration[0]}–${g.duration[1]} min</span><span class="pill">${g.device_modes.includes('shared')?'Shared phone OK':'Phone each'}</span><span class="pill">${g.noise==='loud'?'Gets loud':'Talky'}</span></div>
     <p class="why">${reasons[id]?esc(reasons[id])+' <span class="pill ai">AI explanation</span>':esc(g.summary)}</p></div></button>`;};
   return `${topbar('Picks')}<div class="scroll stack"><h2>${order.length?'Good fits for your table':'Nothing fits yet'}</h2>
    <p class="small muted">${q.players} players · ${q.device==='shared'?'one shared phone':'phone each'} · ${q.minutes===60?'longer':q.minutes+' min'} · ${q.vibe==='quiet'?'quiet':'chatty'}</p>
    ${order.slice(0,3).map(card).join('')}
    ${!order.length?`<div class="stack"><p>No game we’ve built fits all of that. Here’s what’s in the way:</p>${all.map(r=>`<p class="small"><b>${r.game.name}:</b> ${esc(r.why.join('; '))}</p>`).join('')}<button class="btn" data-change>Change settings</button></div>`:''}
    <p class="small muted" aria-live="polite">${rec.loading?'Asking the model to explain the fits…':rec.note?esc(rec.note)+' <span class="pill ai">AI</span>':rec.error?'Showing the standard order — '+esc(rec.error):''}</p>
    ${order.length?`<button class="btn ghost small" data-all>See all ${all.length} games and why</button>`:''}
   </div>`;},
  bind(){
    app.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>go('detail',{id:b.dataset.g}));
    const c=app.querySelector('[data-change]');if(c)c.onclick=()=>go('setup');const a=app.querySelector('[data-all]');if(a)a.onclick=()=>go('library');
    if(!S.rec){const q=query();const cands=G.rankGames(q).map(r=>{const g=G.meta(r.game_id);return {game_id:g.game_id,name:g.name,players:q.device==='shared'?g.shared_min+'-'+g.shared_max:g.min+'-'+g.max,minutes:g.duration.join('-'),noise:g.noise,summary:g.summary};});
      S.rec={loading:!!cands.length};if(!cands.length)return;render(true);
      const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),12000);
      fetch('/api/ai',{method:'POST',headers:{'content-type':'application/json'},signal:ctl.signal,body:JSON.stringify(Object.assign({task:'table-recommend',candidates:cands,scene:S.setup.scene},q))})
       .then(r=>r.json().then(j=>({ok:r.ok,j}))).then(({ok,j})=>{S.rec=ok?{picks:j.picks,note:j.note}:{error:j.code==='NO_MODEL'?'AI explanations aren’t connected on this deployment.':'the model didn’t answer.'};if(S.view==='recs')render(true);})
       .catch(()=>{S.rec={error:'the model took too long.'};if(S.view==='recs')render(true);}).finally(()=>clearTimeout(t));}
  }
};
VIEWS.library={
  html:()=>`${topbar('All games')}<div class="scroll stack"><h2>Games on TABLE</h2><p class="small muted">Three original games so far — each fully playable. More arrive only once they’re built and tested.</p>
   ${G.catalog().map(g=>{const f=G.filterGames(query()).find(r=>r.game.game_id===g.game_id);return `<button class="rec" data-g="${g.game_id}"><div class="art" style="background:#eef0f5">${ART[g.game_id]}</div><div class="body"><h2 style="font-size:22px">${g.name}</h2>
    <div class="meta"><span class="pill">${g.min}–${g.max} players</span><span class="pill">${g.duration[0]}–${g.duration[1]} min</span><span class="pill">${g.device_modes.includes('shared')?'Shared phone OK':'Phone each'}</span></div><p class="small">${esc(g.summary)}</p>${f&&!f.ok?`<p class="small muted">For your current setup: ${esc(f.why.join('; '))}</p>`:''}</div></button>`;}).join('')}</div>`,
  bind(){app.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>go('detail',{id:b.dataset.g}));}
};
VIEWS.detail={
  html:()=>{const g=G.meta(S.params.id);const f=G.filterGames(query()).find(r=>r.game.game_id===g.game_id);const shared=S.setup.device==='shared';
   return `${topbar(g.name)}<div class="scroll stack"><div style="background:#eef0f5;border-radius:16px;display:grid;place-items:center;padding:14px">${ART[g.game_id].replace('<svg','<svg style="height:120px"')}</div>
    <h1>${g.name}</h1><p>${esc(g.summary)}</p>
    <ol class="steps">${g.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>
    <div class="meta"><span class="pill">${g.min}–${g.max} players</span><span class="pill">${g.duration[0]}–${g.duration[1]} min</span><span class="pill">${g.device_modes.includes('shared')?`Shared phone: ${g.shared_min}–${g.shared_max}`:'Needs a phone each'}</span><span class="pill">Rules v${g.version}</span></div>
    <p class="small muted">Original game and cards by the TABLE team. Content: ${g.content_tags.join(', ')}. No personal questions or dares.</p>
    ${f&&!f.ok?`<p class="banner">Doesn’t fit your current setup: ${esc(f.why.join('; '))}.</p>`:''}
   </div><div class="foot">${shared&&g.device_modes.includes('shared')?`<button class="btn primary block" data-shared ${f&&f.ok?'':'disabled'}>Play on this phone</button><button class="btn block" data-online>Start a table with codes instead</button>`:`<button class="btn primary block" data-online>Start a table</button>`}<p class="err" id="derr" role="alert"></p></div>`;},
  bind(){const q=s=>app.querySelector(s);const sh=q('[data-shared]');if(sh)sh.onclick=()=>go('sharedsetup',{id:S.params.id});
    q('[data-online]').onclick=()=>{S.pendingGame=S.params.id;go('hostname');};}
};
VIEWS.hostname={
  html:()=>`${topbar('Your name')}<div class="scroll stack"><h2>What should the table call you?</h2>
   <div class="field"><label class="label" for="nn">Nickname</label><input id="nn" maxlength="20" autocomplete="nickname" value="${esc(LS.get('table.name')||'')}"><span class="small muted">Not your real name unless you want it to be.</span></div>
   <label class="check"><input type="checkbox" id="ad"><span>I’m 18 or older</span></label><p class="err" id="herr" role="alert"></p></div>
   <div class="foot"><button class="btn primary block" data-make>Create room</button></div>`,
  bind(){app.querySelector('[data-make]').onclick=async e=>{const n=app.querySelector('#nn').value.trim();const err=app.querySelector('#herr');
    if(!n){err.textContent='Add a nickname.';return;}if(!app.querySelector('#ad').checked){err.textContent='TABLE is for adults only.';return;}
    e.currentTarget.disabled=true;e.currentTarget.textContent='Creating…';LS.set('table.name',n);
    const r=await rpc({op:'create',name:n,settings:Object.assign({},S.setup,{gameId:S.pendingGame})});
    if(!r.token){e.currentTarget.disabled=false;e.currentTarget.textContent='Create room';err.textContent=r.code==='NO_STORE'?'Online rooms aren’t set up on this deployment yet. On one phone you can still play Common Frequency or Describe Relay.':(r.error||'Couldn’t create the room.');return;}
    S.session={code:r.room.code,token:r.token,playerId:r.playerId};LS.set('table.session',S.session);applyRoom(r.room);startPoll();S.hist=[];go('invite',{},{replace:true});};}
};
function loadQR(){return window.QRCode?Promise.resolve():new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});}
const joinUrl=code=>location.origin+'/table/?join='+code;
VIEWS.invite={
  html:()=>{const r=S.room;return `${topbar('Invite',{back:false,right:`<button class="iconbtn" data-menu aria-label="Room menu">⋯</button>`})}<div class="scroll stack"><h2>Get everyone in</h2>
   <div class="codebox" aria-label="Room code ${r.code.split('').join(' ')}">${r.code}</div>
   <div class="qr" id="qr" aria-label="QR code to join this room"><span class="small muted">Loading QR…</span></div>
   <div class="row"><button class="btn small" style="flex:1" data-copy>Copy link</button>${navigator.share?'<button class="btn small" style="flex:1" data-share>Share…</button>':''}</div>
   <p class="small muted" style="word-break:break-all">${esc(joinUrl(r.code))}</p>
   <p class="label" aria-live="polite">${r.players.length} of ~${r.settings.expected} joined${r.locked?' · room locked':''}</p>
  </div><div class="foot"><button class="btn primary block" data-lobby>Go to lobby</button></div>`;},
  bind(){const r=S.room;const box=app.querySelector('#qr');
    loadQR().then(()=>{box.innerHTML='';new QRCode(box,{text:joinUrl(r.code),width:360,height:360,colorDark:'#18283F',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});}).catch(()=>{box.innerHTML='<p class="small">QR code unavailable — share the link or code instead.</p>';});
    app.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(joinUrl(r.code));toast('Link copied.');}catch(e){toast('Couldn’t copy — select the link text instead.');}};
    const sh=app.querySelector('[data-share]');if(sh)sh.onclick=()=>navigator.share({title:'Join our TABLE',text:'Room code '+r.code,url:joinUrl(r.code)}).catch(()=>{});
    app.querySelector('[data-lobby]').onclick=()=>{go('lobby',{},{replace:true});};app.querySelector('[data-menu]').onclick=roomMenu;}
};
VIEWS.join={
  html:()=>`${topbar('Join')}<div class="scroll stack"><h2>Join a table</h2>${S.params.msg?`<p class="banner bad">${esc(S.params.msg)}</p>`:''}
   <div class="field"><label class="label" for="jc">Room code</label><input id="jc" class="code-in" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(S.params.code||'')}" aria-describedby="jch"><span class="small muted" id="jch">5 letters and numbers from the host’s screen, like K7PQ2 (that one isn’t real).</span></div>
   <div class="field"><label class="label" for="jn">Nickname</label><input id="jn" maxlength="20" autocomplete="nickname" value="${esc(LS.get('table.name')||'')}"></div>
   <label class="check"><input type="checkbox" id="ja"><span>I’m 18 or older</span></label>
   <p class="small muted">The table sees your nickname, when you’re ready, and your moves in each game. Nothing else.</p>
   <p class="err" id="jerr" role="alert"></p></div><div class="foot"><button class="btn primary block" data-go>Join</button></div>`,
  bind(){const c=app.querySelector('#jc');c.oninput=()=>{c.value=c.value.toUpperCase().replace(/[^A-Z0-9]/g,'');};
    app.querySelector('[data-go]').onclick=async e=>{const err=app.querySelector('#jerr');const code=c.value,name=app.querySelector('#jn').value.trim();
      if(code.length!==5){err.textContent='Room codes have 5 characters.';c.focus();return;}if(!name){err.textContent='Add a nickname.';return;}if(!app.querySelector('#ja').checked){err.textContent='Please confirm you’re 18 or older.';return;}
      const b=e.currentTarget;b.disabled=true;b.textContent='Joining…';LS.set('table.name',name);
      const prev=LS.get('table.session');const r=await rpc({op:'join',code,name,adult:true,token:prev&&prev.code===code?prev.token:undefined});
      b.disabled=false;b.textContent='Join';
      if(!r.token){err.textContent=r.code==='NO_STORE'?'Online rooms aren’t set up on this deployment yet.':(r.error||'Couldn’t join.');return;}
      S.session={code,token:r.token,playerId:r.playerId};LS.set('table.session',S.session);applyRoom(r.room);startPoll();if(r.renamed)toast(`That name was taken — you’re “${r.renamed}”.`);S.hist=[];routeFromRoom();};}
};
function roomHeader(){const r=S.room;return `<div class="topbar"><button class="iconbtn" data-menu aria-label="Room menu">⋯</button><div class="title">Table ${esc(r.code)}</div><span class="tag ${S.net==='ok'?'ok':'off'}" role="status">${S.net==='ok'?'Live':S.net==='retrying'?'Retrying':'Offline'}</span></div>
  ${S.net!=='ok'?`<div class="banner bad" role="alert">${S.net==='retrying'?'Connection hiccup — retrying your last action.':'Reconnecting… Your seat is kept. Actions show as not sent until the server confirms.'}</div>`:''}
  ${r.notice?`<div class="banner">${esc(r.notice)}</div>`:''}`;}
VIEWS.lobby={
  html:()=>{const r=S.room,me=r.me,g=G.meta(r.gameId),n=r.players.length;const fits=n>=g.min&&n<=g.max;const allReady=r.players.every(p=>p.ready);const mine=r.players.find(p=>p.id===me.id);
   const pos=(i,N)=>{const a=-Math.PI/2+i/N*2*Math.PI;return `left:${50+42*Math.cos(a)}%;top:${50+40*Math.sin(a)}%`;};
   return `${roomHeader()}<div class="scroll stack">
   <div class="seats" role="img" aria-label="${n} players around the table">${`<div class="tablecircle">${g.name}<br>${g.min}–${g.max} players</div>`}${r.players.map((p,i)=>`<div class="seat ${p.ready?'ready':''}" style="${pos(i,n)}"><div class="avatar" style="background:${COLORS[i%COLORS.length]}">${esc(p.name[0].toUpperCase())}</div>${esc(p.name)}${p.isHost?' ★':''}<span class="st">${!p.online?'away':p.ready?'ready':'…'}</span></div>`).join('')}</div>
   <div class="plist" aria-label="Players">${r.players.map((p,i)=>`<div><span class="avatar" style="background:${COLORS[i%COLORS.length]};width:28px;height:28px;margin:0;font-size:12px;border-width:2px">${esc(p.name[0].toUpperCase())}</span><span class="grow">${esc(p.name)}${p.id===me.id?' (you)':''}${p.isHost?' · host':''}${p.id===r.coHostId?' · co-host':''}</span><span class="tag ${p.ready?'ok':'wait'}">${p.ready?'Ready':'Not ready'}</span>${p.online?'':'<span class="tag off">Away</span>'}</div>`).join('')}</div>
   <p class="small">${n} here · expected about ${r.settings.expected}. ${fits?'':`<b>${g.name} needs ${g.min}–${g.max} players.</b>`}</p>
   ${me.isHost?`<div class="field"><label class="label" for="gm">Game</label><select id="gm">${G.catalog().map(x=>`<option value="${x.game_id}" ${x.game_id===r.gameId?'selected':''}>${x.name} (${x.min}–${x.max})</option>`).join('')}</select></div>`:`<p class="label">Game: ${g.name}</p>`}
   <div class="row"><button class="btn small" style="flex:1" data-rules>How to play</button>${me.isHost?'<button class="btn small" style="flex:1" data-invite>Invite</button>':''}</div>
  </div><div class="foot">
   <button class="btn ${mine.ready?'':'primary'} block" data-ready aria-pressed="${mine.ready}">${mine.ready?'Ready ✓ — tap to undo':'I’ve read the rules — Ready'}</button>
   ${me.isHost?`<button class="btn citrus block" data-start ${fits&&allReady?'':'disabled'}>${!fits?`Need ${g.min}–${g.max} players`:allReady?'Start '+g.name:`Waiting for ${r.players.filter(p=>!p.ready).length} to be ready`}</button>`:''}
  </div>`;},
  bind(){const r=S.room,me=r.me;const q=s=>app.querySelector(s);
    q('[data-menu]').onclick=roomMenu;q('[data-rules]').onclick=()=>rulesSheet(r.gameId,true);
    q('[data-ready]').onclick=()=>{const mine=r.players.find(p=>p.id===me.id);if(mine.ready)act({type:'ready',value:false});else rulesSheet(r.gameId,true,true);};
    const gm=q('#gm');if(gm)gm.onchange=()=>act({type:'set_game',gameId:gm.value});
    const inv=q('[data-invite]');if(inv)inv.onclick=()=>go('invite');
    const st=q('[data-start]');if(st)st.onclick=()=>act({type:'start'});}
};
function rulesSheet(gameId,online,askReady){const g=G.meta(gameId);
  const s=sheet(`<div class="sb"><span class="pill">Rules v${g.version} · reviewed</span><h2>${g.name}</h2><ol class="steps">${g.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>${FULL[gameId]}</div><div class="sf">${askReady?'<button class="btn primary block" data-r>I’m ready</button>':''}<button class="btn block ghost" data-close>Close</button></div>`,g.name+' rules');
  const b=s.el.querySelector('[data-r]');if(b)b.onclick=()=>{s.close();act({type:'ready',value:true});};}
const FULL={
 frequency:'<p class="small"><b>Details.</b> 5 rounds. Each question has 3 answers. Submit your own answer and your guess for the single most-picked answer; you can change once before time’s up (20 s). If two answers tie for most picks, nobody scores that round. Results show how many picked each answer — never who picked what. Skipping scores 0. Ties at the end are shared.</p>',
 relay:'<p class="small"><b>Details.</b> Two teams, at least 2 each, 4 alternating 60-second turns. The describer sees a word and 3 banned words. A judge from the other team taps Correct (+1) or Broke a rule (0); the describer can skip up to 3 cards a turn. The judge can undo their last call. Highest total wins; ties are shared.</p>',
 signal:'<p class="small"><b>Details.</b> 5–8 players, one phone each. One random player is the visitor and only sees the category; everyone else sees the word. In seat order, each person says one clue out loud. Then everyone votes privately (30 s, not for yourself). If the top vote is a companion — or a revote ties again — the visitor wins. If the visitor is caught, they get 20 s to type the word: right means visitor wins, wrong means companions win. If nobody votes, the game has no winner. Roles are shown at the end. If someone is offline for 60 s, the host can restart or end.</p>'
};
function roomMenu(){const r=S.room,me=r.me;const others=r.players.filter(p=>p.id!==me.id);
  const s=sheet(`<div class="sb"><h2>Table ${esc(r.code)}</h2><p class="small">Connection: ${S.net==='ok'?'live':'reconnecting'} · ${r.players.filter(p=>p.online).length}/${r.players.length} online · version ${r.version}</p>
   <button class="btn small block" data-rules>Rules</button><button class="btn small block" data-a11y>${S.settings.reduce?'Turn motion back on':'Reduce motion'}</button><button class="btn small block" data-fb>Report a problem</button>
   ${me.isHost?`<div class="label">Host controls</div>
    <button class="btn small block" data-lock>${r.locked?'Unlock room':'Lock room (no new players)'}</button>
    ${others.length?`<div class="field"><label class="label" for="th">Hand hosting to</label><select id="th">${others.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div><button class="btn small block" data-tr>Transfer host</button>
    <div class="field"><label class="label" for="ch">Co-host (takes over if you drop for 30 s)</label><select id="ch"><option value="">None — earliest player takes over</option>${others.map(p=>`<option value="${p.id}" ${p.id===r.coHostId?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div>`:''}
    ${r.state==='in_game'?'<button class="btn small danger block" data-endg>End this game early</button>':''}
    <button class="btn small danger block" data-endt>End table for everyone</button>`:''}
   <button class="btn small danger block" data-leave>Leave table</button></div><div class="sf"><button class="btn block" data-close>Close</button></div>`,'Room menu');
  const q=x=>s.el.querySelector(x);
  q('[data-rules]').onclick=()=>{s.close();rulesSheet(r.gameId,true);};
  q('[data-a11y]').onclick=()=>{S.settings.reduce=!S.settings.reduce;LS.set('table.settings',S.settings);s.close();toast(S.settings.reduce?'Motion reduced.':'Motion on.');};
  q('[data-fb]').onclick=()=>{s.close();go('feedback');};
  if(q('[data-lock]'))q('[data-lock]').onclick=()=>{s.close();act({type:'lock',value:!r.locked});};
  if(q('[data-tr]'))q('[data-tr]').onclick=async()=>{const to=q('#th').value;s.close();if(await confirmDlg('Hand over hosting?',`${nameOf(to)} will control starting, continuing and ending games. You stay a player.`,'Transfer host'))act({type:'transfer_host',to});};
  if(q('#ch'))q('#ch').onchange=e=>act({type:'set_cohost',player:e.target.value||null});
  if(q('[data-endg]'))q('[data-endg]').onclick=async()=>{s.close();if(await confirmDlg('End this game early?','Everyone sees it as “Ended early” — no winner. You’ll go back to the results screen.','End game',true))act({type:'end_early'});};
  if(q('[data-endt]'))q('[data-endt]').onclick=async()=>{s.close();if(await confirmDlg('End the table?','Everyone’s game stops and the code stops working.','End table for everyone',true))act({type:'end_room'});};
  q('[data-leave]').onclick=async()=>{s.close();const g=r.game&&r.game.game_id;
    const effect=!g||r.state!=='in_game'?'You can rejoin with the code while the table is open.':g==='frequency'?'Your answers this round count as skipped; others keep playing.':g==='relay'?'If your team drops below 2, the host may need to end the game.':'Roles are fixed, so the game can’t continue without you — the host will restart or end it.';
    if(me.isHost&&others.length){toast('Hand hosting to someone first (Host controls).');return;}
    if(await confirmDlg('Leave the table?',effect,'Leave',true))act({type:'leave'});};
}
VIEWS.ended={html:()=>`<div class="scroll stack" style="padding-top:40px"><h1>This table has ended</h1><p class="muted">Thanks for playing. Private roles and answers are cleared within 24 hours.</p></div><div class="foot"><button class="btn primary block" data-home>Back to start</button></div>`,
  bind(){app.querySelector('[data-home]').onclick=leaveLocal;}};

/* ---------- in-game (online) ---------- */
VIEWS.game={dark:()=>true,
  html:()=>{const r=S.room,g=r.game;if(!g)return roomHeader();const me=r.me.id;
   let body='';
   if(g.game_id==='frequency')body=FREQ(g,me);if(g.game_id==='relay')body=RELAY(g,me);if(g.game_id==='signal')body=SIGNAL(g,me);
   if(g.phase==='final')body=FINAL(g,me);
   return roomHeader().replace('class="topbar"','class="topbar" style="color:#FAF7EF"')+body;},
  bind(){bindGame();}
};
const timer=(d,local,onzero)=>d?`<div class="timer" data-deadline="${d}" ${local?'data-local="1"':''} ${onzero?`data-onzero="${onzero}"`:''} role="timer"></div>`:'';
const isHost=()=>S.shared?true:S.room.me.isHost;
function FREQ(g,me){
  const L=S.local;const inRoster=g.roster.includes(me);
  if(g.phase==='answer'){
    const head=`<div class="round"><span>Round ${g.round+1} / ${g.rounds}</span><span>${g.submitted.length}/${g.roster.length} answered</span></div>`;
    if(!inRoster)return `${head}<div class="scroll stack"><p class="question">${esc(g.question)}</p><p class="muted">You joined mid-round — you’ll play from the next question.</p></div>`;
    const a=g.me.answer;
    if(a&&!L.editing)return `${head}${timer(g.deadline)}<div class="scroll stack"><p class="question">${esc(g.question)}</p><div class="card" style="min-height:0"><b>${a.skip?'You passed this round.':`Your answer: ${esc(g.options[a.pick])}`}</b>${a.skip?'':`<span>Your guess for the table: ${esc(g.options[a.guess])}</span>`}</div><p class="muted" aria-live="polite">Locked in. Waiting for ${g.roster.length-g.submitted.length} more…</p></div>
      ${a.canEdit?`<div class="foot"><button class="btn block" data-edit>Change my answer (once)</button></div>`:''}`;
    const step=L.step||0;const opts=(k,cur)=>`<div class="opts" role="radiogroup" aria-label="${k==='pick'?'Your answer':'Your guess'}">${g.options.map((o,i)=>`<button class="opt" role="radio" aria-checked="${cur===i}" data-${k}="${i}"><span class="k">${'ABC'[i]}</span>${esc(o)}</button>`).join('')}</div>`;
    return `${head}${timer(g.deadline)}<div class="scroll stack"><p class="question">${esc(g.question)}</p>
      <p class="label">${step===0?'1 · Your own answer':'2 · Which answer will the most people pick?'}</p>${step===0?opts('pick',L.pick):opts('guess',L.guess)}</div>
      <div class="foot">${step===0?`<button class="btn primary block" data-step ${L.pick==null?'disabled':''}>Next: guess the table</button>`:`<button class="btn primary block" data-submit ${L.guess==null?'disabled':''}>${S.pending==='answer'?'Sending…':'Lock in'}</button><button class="btn block" data-back2>Back</button>`}
      <button class="btn ghost small block" data-skipq>Pass this round</button></div>`;
  }
  if(g.phase==='reveal'){const R=g.reveal;const max=Math.max(1,...R.counts);
    const mine=R.gained[me];
    return `<div class="round"><span>Round ${g.round+1} / ${g.rounds}</span><span>${R.answered} of ${R.total} answered</span></div><div class="scroll stack"><p class="question">${esc(g.question)}</p>
     <div class="bars">${g.options.map((o,i)=>`<div class="bar ${R.majority===i?'top':''}"><span>${esc(o)}${R.majority===i?' — most picked':''}</span><span>${R.counts[i]}</span><div class="track"><div class="fill" style="width:${R.counts[i]/max*100}%"></div></div></div>`).join('')}</div>
     <p>${R.majority==null?'No single answer had the most picks, so nobody scores this round.':mine!=null?(mine?'You guessed it: +1':'Not this time: +0'):''}</p>
     ${LB(g.scores)}</div><div class="foot">${isHost()?`<button class="btn primary block" data-next>${g.round+1>=g.rounds?'See final results':'Next question'}</button>`:'<p class="muted" style="text-align:center">Waiting for the host to continue…</p>'}</div>`;}
  return '';
}
function LB(scores){const arr=Object.entries(scores).sort((a,b)=>b[1]-a[1]);return `<div class="lb" aria-label="Scores">${arr.map(([id,s])=>`<div><span>${esc(nameOf(id))}</span><span>${s}</span></div>`).join('')}</div>`;}
function RELAY(g,me){
  const tn=t=>esc(g.names[t]);const active=g.active;const myTeam=g.teams.A.includes(me)?'A':g.teams.B.includes(me)?'B':null;
  const scores=`<div class="score"><div class="A"><span>${tn('A')}</span><b>${g.teamScore.A}</b></div><div class="B"><span>${tn('B')}</span><b>${g.teamScore.B}</b></div></div>`;
  if(g.phase==='teams'){const col=t=>`<div class="stack" style="gap:6px"><b>${tn(t)}</b>${g.teams[t].map(p=>`<div class="row" style="justify-content:space-between;background:#1d3550;padding:6px 10px;border-radius:10px"><span>${esc(nameOf(p))}</span>${isHost()?`<button class="btn small" data-move="${p}" aria-label="Move ${esc(nameOf(p))} to the other team">⇄</button>`:''}</div>`).join('')}</div>`;
    return `<div class="scroll stack"><h2>Teams</h2><div class="score" style="align-items:start">${col('A')}${col('B')}</div>${isHost()?'<p class="small muted">Tap ⇄ to swap someone. Each team needs at least 2.</p>':'<p class="muted">The host is setting teams.</p>'}</div>
     ${isHost()?`<div class="foot"><button class="btn primary block" data-lock ${g.teams.A.length<2||g.teams.B.length<2?'disabled':''}>Start round 1</button></div>`:''}`;}
  const head=`<div class="round"><span>Turn ${g.round+1} / ${g.rounds} · ${tn(active)}</span><span>${g.passesLeft} skips left</span></div>`;
  if(g.phase==='ready'){const role=me===g.describer?'describer':me===g.judge?'judge':myTeam===active?'guesser':'watcher';
    return `${head}<div class="scroll stack">${scores}<h2>${role==='describer'?'You’re describing':role==='judge'?'You’re the judge':role==='guesser'?`${esc(nameOf(g.describer))} is describing — you guess!`:`${tn(active)} is up`}</h2>
     <p class="muted">${role==='describer'?`Your team guesses out loud. ${esc(nameOf(g.judge))} from ${tn(active==='A'?'B':'A')} judges. Start when everyone’s listening.`:role==='judge'?`You’ll see ${esc(nameOf(g.describer))}’s card. Tap Correct when ${tn(active)} says the word, or Broke a rule if a banned word slips out.`:`Describer: ${esc(nameOf(g.describer))} · Judge: ${esc(nameOf(g.judge))}`}</p></div>
     ${role==='describer'||isHost()?`<div class="foot"><button class="btn primary block" data-startturn>${role==='describer'?'Start 60 seconds':'Start turn for '+esc(nameOf(g.describer))}</button></div>`:''}`;}
  if(g.phase==='play'){const role=me===g.describer?'describer':me===g.judge?'judge':'other';const c=g.me.card;
    const cardHtml=c?(S.local.reveal||role==='judge'?`<div class="card"><span class="small muted">${role==='judge'?'Judge view':'Describe this'}</span><div class="word">${esc(c.word)}</div><div class="taboo"><span class="small muted" style="text-decoration:none;color:var(--muted)">Don’t say</span>${c.taboo.map(t=>`<span>${esc(t)}</span>`).join('')}</div>${role==='describer'?'<button class="btn small" data-hide>Hide card</button>':''}</div>`:`<button class="card cover" data-reveal>Tap to reveal your card<br><span class="small">Hold the phone so only you can see</span></button>`):'';
    return `${head}${timer(g.deadline)}<div class="scroll stack">${cardHtml}${role==='other'?`<p class="question" style="text-align:center">${esc(nameOf(g.describer))} is describing</p><p class="muted" style="text-align:center">${myTeam===active?'Shout your guesses!':'Listen — no hints!'}</p>`:''}${scores}
     <p class="small muted" aria-live="polite">${g.log.length?`Last call: ${g.log[g.log.length-1].kind==='undo'?'undone':g.log[g.log.length-1].kind}`:''}</p></div>
     <div class="foot">${role==='judge'?`<div class="row"><button class="btn primary" style="flex:2" data-correct>Correct +1</button><button class="btn" style="flex:1" data-foul>Broke a rule</button></div><button class="btn ghost small block" data-undo>Undo last call</button>`:role==='describer'?`<button class="btn block" data-pass ${g.passesLeft?'':'disabled'}>Skip card (${g.passesLeft} left)</button>`:''}</div>`;}
  if(g.phase==='roundEnd'){return `${head}<div class="scroll stack"><h2>Time!</h2>${scores}<p class="label">This turn</p>${(g.roundCards||[]).map(x=>`<p>${x.kind==='correct'?'✓':x.kind==='foul'?'✕':'↷'} ${esc(x.word)} <span class="small muted">${x.kind==='correct'?'+1':x.kind==='foul'?'rule broken':'skipped'}</span></p>`).join('')||'<p class="muted">No cards this turn.</p>'}
    ${me===g.judge?'<button class="btn small" data-undo>Undo last call</button>':''}</div><div class="foot">${isHost()?`<button class="btn primary block" data-next>${g.round+1>=g.rounds?'See final score':'Next turn'}</button>`:'<p class="muted" style="text-align:center">Waiting for the host…</p>'}</div>`;}
  return '';
}
function SIGNAL(g,me){
  const inG=g.roster.includes(me);
  const stall=g.stalled&&g.stalled.length?`<div class="banner bad" role="alert">Waiting for ${g.stalled.map(nameOf).map(esc).join(', ')} — offline for over 60 s. Roles can’t be reassigned. ${isHost()?'You can restart with a new deal or end the game.':'The host can restart or end.'}${isHost()?'<div class="row" style="margin-top:8px"><button class="btn small" data-restart>Restart</button><button class="btn small danger" data-endg>End game</button></div>':''}</div>`:'';
  if(!inG)return `<div class="scroll stack"><h2>Game in progress</h2><p class="muted">You joined after roles were dealt. You’ll be in the next game.</p></div>`;
  const role=g.me.role;
  const roleCard=S.local.reveal?`<div class="card"><span class="small muted">Only you can see this</span><div class="word">${role==='visitor'?'You are the visitor':esc(g.me.word)}</div><p>${role==='visitor'?`You don’t know the word. The category is <b>${esc(g.category)}</b>. Blend in!`:`You’re a companion. Category: ${esc(g.category)}. Give clues that prove you know it — without giving it away.`}</p><button class="btn small" data-hide>Hide</button></div>`
    :`<button class="card cover" data-reveal>Tap to see your role<br><span class="small">Make sure nobody’s looking</span></button>`;
  if(g.phase==='roles')return `${stall}<div class="round"><span>Roles</span><span>${g.seenCount}/${g.roster.length} checked</span></div><div class="scroll stack">${roleCard}</div><div class="foot"><button class="btn primary block" data-seen ${g.me.seen?'disabled':''}>${g.me.seen?'Waiting for others…':'I’ve seen my role'}</button></div>`;
  if(g.phase==='clues')return `${stall}<div class="round"><span>Clues · ${esc(g.category)}</span><span>${g.clueIdx+1}/${g.roster.length}</span></div><div class="scroll stack">
    <p class="question">${g.currentClue===me?'Your turn: say one clue out loud':esc(nameOf(g.currentClue))+' is giving a clue'}</p><p class="muted">One word or short phrase. Don’t say the word itself. Nothing is recorded.</p>
    <ol class="steps">${g.roster.map((p,i)=>`<li style="${i===g.clueIdx?'font-weight:800':i<g.clueIdx?'opacity:.55':''}">${esc(nameOf(p))}${p===me?' (you)':''}${i===g.clueIdx?' ← now':''}</li>`).join('')}</ol>
    ${S.local.reveal?roleCard:'<button class="btn small" data-reveal>Peek at my card</button>'}</div>
    <div class="foot">${isHost()?`<button class="btn primary block" data-nextclue>${g.clueIdx+1>=g.roster.length?'Everyone’s done — vote':'Next person'}</button>`:''}</div>`;
  if(g.phase==='vote'){const voted=g.me.vote;
    return `${stall}<div class="round"><span>${g.revote?'Revote — tied players only':'Vote'}</span><span>${g.voted.length}/${g.roster.length} voted</span></div>${timer(g.deadline)}<div class="scroll stack"><p class="question">Who’s the visitor?</p>
     <div class="vlist" role="radiogroup" aria-label="Vote">${g.candidates.map(p=>`<button class="vote" role="radio" aria-checked="${(voted||S.local.vote)===p}" data-vote="${p}" ${p===me||voted?'disabled':''}><span class="avatar" style="width:32px;height:32px;margin:0;background:${seatColor(S.room,p)};font-size:13px">${esc(nameOf(p)[0]||'?')}</span>${esc(nameOf(p))}${p===me?' (you — can’t vote for yourself)':''}</button>`).join('')}</div>
     ${voted?'<p class="muted" aria-live="polite">Vote locked. Votes stay secret until the end.</p>':''}</div>
     ${voted?'':`<div class="foot"><button class="btn primary block" data-castvote ${S.local.vote?'':'disabled'}>Lock in vote</button></div>`}`;}
  if(g.phase==='guess'){return `${stall}<div class="round"><span>Last chance</span><span></span></div>${timer(g.deadline)}<div class="scroll stack">${me===g.accused?`<p class="question">You were caught! Name the word to still win.</p><div class="field"><label class="label" for="gw">The word (category: ${esc(g.category)})</label><input id="gw" maxlength="40" autocomplete="off"></div>`:`<p class="question">${esc(nameOf(g.accused))} was the visitor!</p><p class="muted">They get one guess at the word.</p>`}</div>
    ${me===g.accused?'<div class="foot"><button class="btn primary block" data-sendguess>Submit guess</button></div>':''}`;}
  return '';
}
function FINAL(g,me){
  const o=g.outcome||{};let hero='',sub='';
  if(o.endedEarly){hero='Ended early';sub='The host stopped this game. No winner.';}
  else if(g.game_id==='frequency'){const L=(o.leaders||[]).map(nameOf);hero=L.length>1?'Shared win!':esc(L[0]||'')+' wins';sub=`${L.length>1?L.map(esc).join(' & ')+' tied':'Top score'} with ${o.top} point${o.top===1?'':'s'} over ${g.rounds} rounds.`;}
  else if(g.game_id==='relay'){hero=o.winner==='tie'?'It’s a tie!':esc(g.names[o.winner])+' wins';sub=`${esc(g.names.A)} ${g.teamScore.A} – ${g.teamScore.B} ${esc(g.names.B)} after ${g.rounds} turns.`;}
  else if(g.game_id==='signal'){if(o.incomplete){hero='No winner';sub=o.reason;}else{hero=o.winner==='visitor'?'The visitor wins':'Companions win';sub=o.reason;}}
  const sig=g.game_id==='signal'&&g.visitor?`<p>The visitor was <b>${esc(nameOf(g.visitor))}</b>. The word was <b>${esc(g.word)}</b>.${g.guess?` They guessed “${esc(g.guess.text)}”.`:''}</p>${Object.keys(g.tally||{}).length?`<p class="small muted">Votes: ${Object.entries(g.tally).map(([p,n])=>`${esc(nameOf(p))} ${n}`).join(' · ')}</p>`:''}`:'';
  return `<div class="scroll stack"><div class="result-hero"><div class="big">${hero}</div><p class="muted" style="margin-top:8px">${esc(sub)}</p></div>${sig}${g.game_id==='frequency'?LB(g.scores):''}</div>
   <div class="foot">${isHost()?`<button class="btn primary block" data-again>Play again</button><button class="btn block" data-another>Choose another game</button>`:'<p class="muted" style="text-align:center">The host picks what’s next.</p>'}${S.shared?'':''}</div>`;
}
function bindGame(){
  const q=s=>app.querySelector(s),qa=s=>app.querySelectorAll(s);const m=q('[data-menu]');if(m)m.onclick=S.shared?sharedMenu:roomMenu;
  const g=S.shared?S.shared.view:S.room.game;if(!g)return;const L=S.local;
  qa('[data-pick]').forEach(b=>b.onclick=()=>{L.pick=+b.dataset.pick;render();});qa('[data-guess]').forEach(b=>b.onclick=()=>{L.guess=+b.dataset.guess;render();});
  const st=q('[data-step]');if(st)st.onclick=()=>{L.step=1;render();};const bk=q('[data-back2]');if(bk)bk.onclick=()=>{L.step=0;render();};
  const sb=q('[data-submit]');if(sb)sb.onclick=async()=>{await act({type:'answer',pick:L.pick,guess:L.guess});S.local={};render();};
  const sk=q('[data-skipq]');if(sk)sk.onclick=async()=>{await act({type:'answer',skip:true});S.local={};render();};
  const ed=q('[data-edit]');if(ed)ed.onclick=()=>{const a=g.me.answer;S.local={editing:true,pick:a.pick,guess:a.guess,step:0};render();};
  const nx=q('[data-next]');if(nx)nx.onclick=()=>act({type:'next'});
  qa('[data-move]').forEach(b=>b.onclick=()=>act({type:'move',player:b.dataset.move}));
  const lk=q('[data-lock]');if(lk&&g.game_id==='relay')lk.onclick=()=>act({type:'lock_teams'});
  const stt=q('[data-startturn]');if(stt)stt.onclick=()=>{S.local={};act({type:'start_turn'});};
  const rv=q('[data-reveal]');if(rv)rv.onclick=()=>{L.reveal=true;render();};const hd=q('[data-hide]');if(hd)hd.onclick=()=>{L.reveal=false;render();};
  const co=q('[data-correct]');if(co)co.onclick=()=>{vib(30);act({type:'correct'});};const fo=q('[data-foul]');if(fo)fo.onclick=()=>act({type:'foul'});
  const ps=q('[data-pass]');if(ps)ps.onclick=()=>{L.reveal=true;act({type:'pass'});};
  qa('[data-undo]').forEach(b=>b.onclick=()=>act({type:'undo'}));
  const se=q('[data-seen]');if(se)se.onclick=()=>{L.reveal=false;act({type:'seen'});};
  const nc=q('[data-nextclue]');if(nc)nc.onclick=()=>act({type:'next_clue'});
  qa('[data-vote]').forEach(b=>b.onclick=()=>{L.vote=b.dataset.vote;render();});
  const cv=q('[data-castvote]');if(cv)cv.onclick=()=>act({type:'vote',target:L.vote});
  const gs=q('[data-sendguess]');if(gs)gs.onclick=()=>{const t=q('#gw').value.trim();if(!t){toast('Type your guess.');return;}act({type:'guess',text:t});};
  const rs=q('[data-restart]');if(rs)rs.onclick=()=>act({type:'restart'});const eg=q('[data-endg]');if(eg)eg.onclick=()=>act({type:'end_early'});
  const ag=q('[data-again]');if(ag)ag.onclick=()=>S.shared?sharedRestart():act({type:'restart'});
  const an=q('[data-another]');if(an)an.onclick=()=>{if(S.shared){S.shared=null;S.hist=[];go('recs',{},{replace:true});}else act({type:'back_to_lobby'});};
}
function vib(ms){if(navigator.vibrate)try{navigator.vibrate(ms);}catch(e){}}

/* ---------- shared-phone mode (local engine) ---------- */
VIEWS.sharedsetup={
  html:()=>{const g=G.meta(S.params.id);const names=S.params.names||(S.params.names=Array.from({length:Math.max(g.shared_min,Math.min(g.shared_max,S.setup.players))},(_,i)=>''));
   return `${topbar('Players')}<div class="scroll stack"><h2>${g.name} on one phone</h2><p class="small muted">${g.shared_min}–${g.shared_max} players. Names stay on this phone.</p>
    ${names.map((n,i)=>`<div class="field"><label class="label" for="n${i}">Player ${i+1}</label><input id="n${i}" data-n="${i}" maxlength="16" value="${esc(n)}" placeholder="Name"></div>`).join('')}
    <div class="row"><button class="btn small" data-add ${names.length>=g.shared_max?'disabled':''}>+ Player</button><button class="btn small" data-rm ${names.length<=g.shared_min?'disabled':''}>− Player</button></div><p class="err" id="serr" role="alert"></p></div>
    <div class="foot"><button class="btn primary block" data-play>Start</button></div>`;},
  bind(){const P=S.params;app.querySelectorAll('[data-n]').forEach(i=>i.oninput=()=>P.names[+i.dataset.n]=i.value);
    app.querySelector('[data-add]').onclick=()=>{P.names.push('');render(true);};app.querySelector('[data-rm]').onclick=()=>{P.names.pop();render(true);};
    app.querySelector('[data-play]').onclick=()=>{const names=P.names.map((n,i)=>n.trim()||'Player '+(i+1));if(new Set(names.map(n=>n.toLowerCase())).size!==names.length){app.querySelector('#serr').textContent='Give everyone a different name.';return;}
      const ids=names.map((_,i)=>'L'+(i+1));S.shared={gameId:P.id,ids,names:Object.fromEntries(ids.map((id,i)=>[id,names[i]]))};sharedRestart();};}
};
function sharedRestart(){const s=S.shared;const r=G.start(s.gameId,s.ids,{mode:'shared'},Date.now(),Math.random);if(r.error){toast(r.error);return;}
  s.game=r.game;s.turn=0;s.cover=true;s.ptimer=null;S.local={};S.hist=[];go('shared',{},{replace:true});}
function actLocal(a){const s=S.shared;const pid=a._as||(s.game.game_id==='frequency'?s.ids[s.turn]:s.game.describer||s.ids[0]);const r=G.act(s.game,pid,a,Date.now(),{isHost:()=>true});
  if(!r.ok)toast(r.error);
  if(s.game.game_id==='frequency'&&a.type==='answer'){s.turn++;s.cover=s.game.phase==='answer';s.ptimer=null;}
  if(a.type==='next'||a.type==='lock_teams'){s.turn=0;s.cover=true;}
  render(true);return r;}
setInterval(()=>{const s=S.shared;if(!s||!s.game||S.view!=='shared')return;if(G.tick(s.game,Date.now()))render(true);},300);
function sharedMenu(){const s=sheet(`<div class="sb"><h2>${G.meta(S.shared.gameId).name}</h2><button class="btn small block" data-rules>Rules</button><button class="btn small danger block" data-end>End game</button></div><div class="sf"><button class="btn block" data-close>Close</button></div>`,'Menu');
  s.el.querySelector('[data-rules]').onclick=()=>{s.close();rulesSheet(S.shared.gameId,false);};
  s.el.querySelector('[data-end]').onclick=async()=>{s.close();if(await confirmDlg('End this game?','Scores so far are shown as “Ended early”.','End game',true)){G.act(S.shared.game,'L1',{type:'end_early'},Date.now(),{isHost:()=>true});render(true);}};}
VIEWS.shared={dark:()=>true,
  html:()=>{const s=S.shared,g=s.game;const head=`<div class="topbar" style="color:#FAF7EF"><button class="iconbtn" data-menu aria-label="Menu">⋯</button><div class="title">${G.meta(g.game_id).name} · one phone</div><span style="width:44px"></span></div>`;
   if(g.phase==='final'){s.view=G.view(g,null,{all:true});return head+FINAL(s.view,null);}
   if(g.game_id==='frequency'&&g.phase==='answer'){const pid=s.ids[s.turn];
     if(s.cover)return head+`<div class="cover-screen" style="position:relative;flex:1"><p class="muted">Round ${g.round+1} of ${g.rounds}</p><h1 style="color:#FAF7EF">Pass to ${esc(s.names[pid])}</h1><p class="muted">Only ${esc(s.names[pid])} should look. You’ll have 20 seconds.</p><button class="btn primary" data-iam>I’m ${esc(s.names[pid])}</button></div>`;
     s.view=G.view(g,pid);return head+FREQ(s.view,pid).replace(/<div class="timer"[^>]*><\/div>/,timer(s.ptimer,true,'pskip'));}
   if(g.game_id==='relay'&&g.phase==='ready'){s.view=G.view(g,g.describer,{all:true});
     return head+`<div class="cover-screen" style="position:relative;flex:1"><p class="muted">Turn ${g.round+1} of ${g.rounds} · ${esc(g.names[s.view.active])}</p><h1 style="color:#FAF7EF">Pass to ${esc(s.names[g.describer])}</h1><p class="muted">${esc(s.names[g.describer])} describes. The phone stays facing them. Tap Got it when the team says the word.</p><button class="btn primary" data-startturn>Start 60 seconds</button></div>`;}
   const pid=g.game_id==='relay'?g.describer:s.ids[0];s.view=G.view(g,pid,{all:true});
   if(g.game_id==='relay'&&g.phase==='play'){const c=s.view.me.card;return head+`<div class="round"><span>Turn ${g.round+1}/${g.rounds}</span><span>${s.view.passesLeft} skips left</span></div>${timer(g.deadline,true)}<div class="scroll stack"><div class="card"><div class="word">${esc(c.word)}</div><div class="taboo"><span class="small muted" style="text-decoration:none;color:var(--muted)">Don’t say</span>${c.taboo.map(t=>`<span>${esc(t)}</span>`).join('')}</div></div>
     <div class="score"><div class="A"><span>${esc(g.names.A)}</span><b>${g.teamScore.A}</b></div><div class="B"><span>${esc(g.names.B)}</span><b>${g.teamScore.B}</b></div></div></div>
     <div class="foot"><div class="row"><button class="btn primary" style="flex:2" data-correct>Got it +1</button><button class="btn" style="flex:1" data-foul>Said a banned word</button></div><div class="row"><button class="btn small" style="flex:1" data-pass ${s.view.passesLeft?'':'disabled'}>Skip</button><button class="btn small ghost" style="flex:1" data-undo>Undo</button></div></div>`;}
   if(g.game_id==='relay'&&g.phase==='teams')return head+RELAY(s.view,null);
   return head+(g.game_id==='frequency'?FREQ(s.view,pid):RELAY(s.view,pid));},
  bind(){const s=S.shared;bindGame();const q=x=>app.querySelector(x);
    const i=q('[data-iam]');if(i)i.onclick=()=>{s.cover=false;s.ptimer=Date.now()+20000;S.local={};render(true);};
    ZERO.pskip=()=>{if(S.view==='shared'&&s.game.phase==='answer'&&!s.cover){toast('Time’s up — counted as a pass.');actLocal({type:'answer',skip:true,_as:s.ids[s.turn]});}};
  }
};

/* ---------- feedback & settings ---------- */
VIEWS.feedback={
  html:()=>`${topbar('Report a problem')}<div class="scroll stack"><h2>What happened?</h2>
   <div class="field"><label class="label" for="fc">Type</label><select id="fc"><option value="content">A card or question felt off</option><option value="rules">The rules didn’t work as written</option><option value="technical">Something broke</option><option value="other">Other</option></select></div>
   <div class="field"><label class="label" for="ft">Details</label><textarea id="ft" maxlength="1000" rows="5"></textarea><span class="small muted">No name or contact needed. We attach the app version${S.session?' and a scrambled room ID':''} — never roles or answers.</span></div>
   <p id="fmsg" role="status"></p></div><div class="foot"><button class="btn primary block" data-send>Send</button></div>`,
  bind(){app.querySelector('[data-send]').onclick=async e=>{const t=app.querySelector('#ft').value.trim();const m=app.querySelector('#fmsg');if(!t){m.textContent='Write a short description first.';return;}
    e.currentTarget.disabled=true;try{const r=await fetch('/api/feedback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({app:'table',category:app.querySelector('#fc').value,text:t,version:G.RULES_VERSION,room:S.session&&S.session.code})});const j=await r.json();
      if(r.ok){m.textContent='Sent. Receipt '+j.receipt+'. Thank you.';app.querySelector('#ft').value='';}else{m.textContent=j.error||'Couldn’t send.';e.currentTarget.disabled=false;}}catch(x){m.textContent='Couldn’t reach the server. Nothing was sent — try again later.';e.currentTarget.disabled=false;}};}
};
VIEWS.settings={
  html:()=>`${topbar('Settings')}<div class="scroll stack"><h2>Settings</h2>
   <label class="check"><input type="checkbox" id="rm" ${S.settings.reduce?'checked':''}><span>Reduce motion<br><span class="small muted">No card flips or bouncing.</span></span></label>
   <label class="check"><input type="checkbox" id="mu" ${S.settings.mute?'checked':''}><span>Mute sounds<br><span class="small muted">TABLE has no background music; this also silences vibration cues.</span></span></label>
   <div class="field"><span class="label">Language</span><p class="small muted">Cards are in English for this beta. Other languages appear here only once their cards are written and reviewed.</p></div>
   <h2 style="font-size:20px">Your data</h2>
   <p class="small">TABLE keeps your nickname and moves for each room. Private roles and answers expire with the room after 24 hours. We never ask for contacts, birthday or location.</p>
   <button class="btn danger block" data-forget>Forget me on this device</button>
   <button class="btn ghost block" data-fb>Report a problem</button></div>`,
  bind(){app.querySelector('#rm').onchange=e=>{S.settings.reduce=e.target.checked;LS.set('table.settings',S.settings);};app.querySelector('#mu').onchange=e=>{S.settings.mute=e.target.checked;LS.set('table.settings',S.settings);};
    app.querySelector('[data-fb]').onclick=()=>go('feedback');
    app.querySelector('[data-forget]').onclick=async()=>{if(!await confirmDlg('Forget me here?','Clears your nickname, saved setup and any open seat on this device. If you’re in a room, you’ll leave it.','Forget me',true))return;
      if(S.session){await rpc({op:'action',code:S.session.code,token:S.session.token,action:{type:'leave'}});}['table.session','table.name','table.setup','table.settings'].forEach(k=>LS.del(k));S.session=null;stopPoll();toast('Done.');S.hist=[];go('start',{},{replace:true});};}
};

/* ---------- boot ---------- */
(function(){
  const q=new URLSearchParams(location.search);const j=q.get('join');
  if(j){history.replaceState(null,'','/table/');if(S.session&&S.session.code===j.toUpperCase()){go('start',{},{replace:true});resume();}else go('join',{code:j.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5)},{replace:true});}
  else go('start',{},{replace:true});
  fetch('/api/health').then(r=>r.json()).then(h=>{const el=document.getElementById('svc');if(el)el.innerHTML=`<span class="status-chip ${h.rooms?'ok':'off'}">房间服务${h.rooms?' · 已连接':' · 未配置（仅一台手机模式）'}</span> <span class="status-chip ${h.ai?'ok':'off'}">AI 推荐解释${h.ai?' · 已连接':' · 未配置（规则排序）'}</span>`;}).catch(()=>{});
})();
})();

/* TABLE game engine — shared by the server (/api/room) and the shared-phone mode in the browser.
   Pure functions over plain JSON state. The server is the only authority in online rooms;
   view() strips every secret that the given player is not allowed to see. */
(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory();
  else root.Games=factory();
})(typeof self!=='undefined'?self:this,function(){

const RULES_VERSION='2026.10.26-1';

const CATALOG=[
  {game_id:'frequency',name:'Common Frequency',zh:'共同频率',version:1,min:3,max:10,shared_min:3,shared_max:6,
   device_modes:['each','shared'],duration:[6,10],noise:'chatty',space:'seated',language:['en'],
   content_tags:['opinions-light'],complexity:1,license_status:'original',implementation_status:'live',
   summary:'Everyone secretly picks an answer and guesses what most of the table picked.',
   steps:['Read the question. Pick your own answer.','Guess which answer the most people picked.','Score 1 point when your guess matches the single most-picked answer.']},
  {game_id:'relay',name:'Describe Relay',zh:'描述接力',version:1,min:4,max:10,shared_min:4,shared_max:10,
   device_modes:['each','shared'],duration:[8,12],noise:'loud',space:'seated',language:['en'],
   content_tags:['words'],complexity:2,license_status:'original',implementation_status:'live',
   summary:'Two teams. One describer, a word and three banned words, sixty seconds.',
   steps:['Your team’s describer sees a word and 3 banned words.','Describe it out loud without saying any of them.','A judge from the other team confirms each correct guess.']},
  {game_id:'signal',name:'Stranger Signal',zh:'陌生信号',version:1,min:5,max:8,shared_min:0,shared_max:0,
   device_modes:['each'],duration:[8,15],noise:'chatty',space:'seated',language:['en'],
   content_tags:['bluffing'],complexity:3,license_status:'original',implementation_status:'live',
   summary:'One player is the visitor and only knows the category. Find them — or let them bluff.',
   steps:['Everyone privately sees their role. Companions see the secret word.','In seat order, each person gives one spoken clue.','Vote together. If the visitor is caught, they get one guess at the word.']}
];

const FREQ_QUESTIONS=[
 {q:'Best way to spend a free Saturday morning?',o:['Sleep in','Long breakfast','Get outside']},
 {q:'The ideal party snack is…',o:['Something salty','Something sweet','Something homemade']},
 {q:'Which superpower would get the most use?',o:['Never needing sleep','Instant travel','Perfect memory']},
 {q:'Road trip music is chosen by…',o:['The driver','A shared playlist','Whoever is loudest']},
 {q:'The best season for a dinner party?',o:['Autumn','Summer','Winter']},
 {q:'A rainy evening calls for…',o:['A movie','A board game','A long bath']},
 {q:'Which job sounds most fun for one day?',o:['Zookeeper','Pastry chef','Lighthouse keeper']},
 {q:'Breakfast for dinner is…',o:['Brilliant','Fine sometimes','Just wrong']},
 {q:'The most useful kitchen tool?',o:['A good knife','A big pan','A kettle']},
 {q:'Pick a weekend trip.',o:['Mountains','Beach','A new city']},
 {q:'The best kind of gift is…',o:['Something useful','An experience','Something handmade']},
 {q:'If the table ordered one dessert to share…',o:['Chocolate cake','Fruit tart','Ice cream']},
 {q:'Which pet would you borrow for a week?',o:['A dog','A cat','A parrot']},
 {q:'Best time to go grocery shopping?',o:['Early morning','Lunch break','Late evening']},
 {q:'The ideal number of people at a dinner?',o:['Four','Six to eight','The more the better']}
];
const RELAY_CARDS=[
 {w:'Umbrella',t:['rain','open','handle']},{w:'Lighthouse',t:['ship','light','coast']},
 {w:'Pancake',t:['breakfast','flip','syrup']},{w:'Passport',t:['travel','country','stamp']},
 {w:'Volcano',t:['lava','erupt','mountain']},{w:'Library',t:['books','borrow','quiet']},
 {w:'Snowman',t:['winter','carrot','build']},{w:'Bicycle',t:['wheels','pedal','ride']},
 {w:'Thermometer',t:['temperature','fever','degrees']},{w:'Picnic',t:['blanket','park','basket']},
 {w:'Telescope',t:['stars','see','far']},{w:'Sandwich',t:['bread','lunch','fill']},
 {w:'Alarm clock',t:['wake','morning','ring']},{w:'Garden',t:['plants','grow','flowers']},
 {w:'Elevator',t:['floor','up','button']},{w:'Popcorn',t:['movie','corn','pop']},
 {w:'Suitcase',t:['pack','travel','clothes']},{w:'Fireworks',t:['sky','bang','celebrate']},
 {w:'Mailbox',t:['letter','post','send']},{w:'Candle',t:['wax','flame','light']},
 {w:'Hammock',t:['swing','relax','trees']},{w:'Compass',t:['north','direction','needle']},
 {w:'Kite',t:['wind','fly','string']},{w:'Wedding',t:['marry','bride','ring']},
 {w:'Penguin',t:['bird','ice','black']},{w:'Piano',t:['keys','music','play']},
 {w:'Dentist',t:['teeth','doctor','chair']},{w:'Treasure',t:['gold','map','pirate']},
 {w:'Bakery',t:['bread','bake','shop']},{w:'Rainbow',t:['colors','sky','rain']}
];
const SIGNAL_TOPICS=[
 {c:'Places to eat',w:'Food truck',s:['foodtruck','food van']},
 {c:'Things in a kitchen',w:'Toaster',s:['toaster oven']},
 {c:'Weather',w:'Thunderstorm',s:['thunder storm','storm']},
 {c:'Animals',w:'Owl',s:['owls']},
 {c:'Sports',w:'Tennis',s:['lawn tennis']},
 {c:'Ways to travel',w:'Train',s:['railway','rail']},
 {c:'Things at a beach',w:'Sandcastle',s:['sand castle']},
 {c:'Musical instruments',w:'Violin',s:['fiddle']},
 {c:'Jobs',w:'Firefighter',s:['fireman','firefighters']},
 {c:'Desserts',w:'Pudding',s:['puddings']},
 {c:'Rooms in a house',w:'Attic',s:['loft']},
 {c:'Holidays',w:'Halloween',s:['hallowe’en']}
];

function catalog(){return CATALOG.map(g=>Object.assign({},g));}
function meta(id){return CATALOG.find(g=>g.game_id===id);}

/* Hard-constraint filter (runs before any AI explanation). */
function filterGames(q){
  const out=[];
  for(const g of CATALOG){
    const why=[];
    if(g.implementation_status!=='live') why.push('not available');
    if(q.device==='shared'){
      if(!g.device_modes.includes('shared')) why.push('needs one phone per player');
      else if(q.players<g.shared_min||q.players>g.shared_max) why.push(`one shared phone supports ${g.shared_min}–${g.shared_max} players`);
    } else if(q.players<g.min||q.players>g.max) why.push(`supports ${g.min}–${g.max} players`);
    if(q.minutes && g.duration[0]>q.minutes) why.push(`takes at least ${g.duration[0]} min`);
    if(q.vibe==='quiet' && g.noise==='loud') why.push('gets loud');
    if(q.exclude && q.exclude.includes('bluffing') && g.content_tags.includes('bluffing')) why.push('involves bluffing');
    if(q.language && !g.language.includes(q.language)) why.push('no cards in that language yet');
    out.push({game:g,ok:why.length===0,why});
  }
  return out;
}
/* Deterministic ranking used when the model is slow or unavailable. */
function rankGames(q){
  return filterGames(q).filter(r=>r.ok).map(r=>{
    const g=r.game;let s=0;
    if(q.minutes) s-=Math.abs((g.duration[0]+g.duration[1])/2-Math.min(q.minutes,15))/4;
    if(q.familiar==='new') s-=g.complexity; else s+=g.complexity*.3;
    if(q.mood==='competitive' && g.game_id!=='frequency') s+=1;
    if(q.mood==='relaxed' && g.game_id==='frequency') s+=1;
    if(q.vibe==='quiet' && g.noise==='chatty') s+=.5;
    return {game_id:g.game_id,score:s};
  }).sort((a,b)=>b.score-a.score);
}

/* ---------- helpers ---------- */
function shuffle(a,rng){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function norm(s){return String(s||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function clone(o){return JSON.parse(JSON.stringify(o));}

/* ---------- start ---------- */
function start(gameId,players,opts,now,rng){
  const g=meta(gameId); if(!g) return {error:'Unknown game'};
  const mode=opts.mode==='shared'?'shared':'each';
  const n=players.length;
  if(mode==='shared'){ if(!g.device_modes.includes('shared')) return {error:g.name+' needs one phone per player.'};
    if(n<g.shared_min||n>g.shared_max) return {error:`${g.name} on one phone needs ${g.shared_min}–${g.shared_max} players.`}; }
  else if(n<g.min||n>g.max) return {error:`${g.name} needs ${g.min}–${g.max} players. You have ${n}.`};
  const base={game_id:gameId,rules_version:RULES_VERSION,mode,started:now,status:'playing',outcome:null,scores:{},events:[]};
  players.forEach(p=>base.scores[p]=0);
  if(gameId==='frequency'){
    const deck=shuffle(FREQ_QUESTIONS.map((_,i)=>i),rng).slice(0,5);
    Object.assign(base,{rounds:5,round:0,deck,roster:players.slice(),phase:'answer',answers:{},reveal:null,deadline:mode==='shared'?null:now+20000,history:[]});
    base.q=deck[0];
    return {game:base};
  }
  if(gameId==='relay'){
    const sh=players.slice();const A=[],B=[];sh.forEach((p,i)=>(i%2?B:A).push(p));
    Object.assign(base,{phase:'teams',teams:{A,B},names:{A:'Team Sun',B:'Team Moon'},teamScore:{A:0,B:0},rounds:4,round:0,
      deck:shuffle(RELAY_CARDS.map((_,i)=>i),rng),cursor:0,describerIdx:{A:0,B:0},judgeIdx:{A:0,B:0},current:null,deadline:null,passes:0,roundLog:[]});
    return {game:base};
  }
  if(gameId==='signal'){
    const topic=Math.floor(rng()*SIGNAL_TOPICS.length);
    const visitor=players[Math.floor(rng()*n)];
    Object.assign(base,{phase:'roles',roster:players.slice(),topic,visitor,seen:{},clueIdx:0,votes:{},revote:false,candidates:players.slice(),deadline:null,guess:null,stalled:null});
    return {game:base};
  }
}

/* ---------- actions ---------- */
function act(game,pid,a,now,ctx){
  const host=ctx&&ctx.isHost?ctx.isHost(pid):true;
  const E=m=>({ok:false,error:m});
  if(a.type==='end_early'){ if(!host) return E('Only the host can end the game.'); game.status='ended'; game.outcome={endedEarly:true,reason:a.reason||''}; game.phase='final'; return {ok:true}; }
  if(game.status!=='playing') return E('This game has finished.');
  if(game.game_id==='frequency') return actFreq(game,pid,a,now,host,E);
  if(game.game_id==='relay') return actRelay(game,pid,a,now,host,E);
  if(game.game_id==='signal') return actSignal(game,pid,a,now,host,E);
  return E('Unknown game');
}

function actFreq(g,pid,a,now,host,E){
  if(a.type==='answer'){
    if(g.phase!=='answer') return E('Answers are closed for this round.');
    if(!g.roster.includes(pid)) return E('You join from the next round.');
    if(g.deadline && now>g.deadline) return E('Time is up for this round.');
    const ok=x=>Number.isInteger(x)&&x>=0&&x<3;
    if(a.skip){ g.answers[pid]={skip:true,edits:0}; }
    else{
      if(!ok(a.pick)||!ok(a.guess)) return E('Choose your answer and your guess.');
      const prev=g.answers[pid];
      if(prev && !prev.skip){ if(prev.edits>=1) return E('You already changed your answer once.'); g.answers[pid]={pick:a.pick,guess:a.guess,edits:prev.edits+1}; }
      else g.answers[pid]={pick:a.pick,guess:a.guess,edits:0};
    }
    if(g.roster.every(p=>g.answers[p])) settleFreq(g,now);
    return {ok:true};
  }
  if(a.type==='next'){
    if(!host) return E('Only the host can continue.');
    if(g.phase!=='reveal') return E('Not ready yet.');
    if(g.round+1>=g.rounds){ g.phase='final'; g.status='finished'; g.outcome=resultTable(g.scores); return {ok:true}; }
    g.round++; g.q=g.deck[g.round]; g.answers={}; g.reveal=null; g.phase='answer';
    if(a.roster) g.roster=a.roster.slice(); // players present now, incl. late joiners
    a.roster && a.roster.forEach(p=>{ if(!(p in g.scores)) g.scores[p]=0; });
    g.deadline=g.mode==='shared'?null:now+20000; return {ok:true};
  }
  return E('Unknown action');
}
function settleFreq(g,now){
  const counts=[0,0,0];
  g.roster.forEach(p=>{const x=g.answers[p];if(x&&!x.skip)counts[x.pick]++;});
  const max=Math.max(...counts);const tops=counts.map((c,i)=>c===max?i:-1).filter(i=>i>=0);
  const majority=(max>0&&tops.length===1)?tops[0]:null;
  const gained={};
  g.roster.forEach(p=>{const x=g.answers[p];const hit=majority!==null&&x&&!x.skip&&x.guess===majority;gained[p]=hit?1:0;g.scores[p]=(g.scores[p]||0)+gained[p];});
  g.reveal={counts,majority,gained,answered:g.roster.filter(p=>g.answers[p]&&!g.answers[p].skip).length,total:g.roster.length};
  g.history.push({q:g.q,counts,majority});
  g.phase='reveal'; g.deadline=null;
}

function relayTeamOf(g,p){return g.teams.A.includes(p)?'A':g.teams.B.includes(p)?'B':null;}
function relayActiveTeam(g){return g.round%2===0?'A':'B';}
function actRelay(g,pid,a,now,host,E){
  if(a.type==='move'){
    if(!host) return E('Only the host arranges teams.'); if(g.phase!=='teams') return E('Teams are locked.');
    const from=relayTeamOf(g,a.player); if(!from) return E('Unknown player.'); const to=from==='A'?'B':'A';
    g.teams[from]=g.teams[from].filter(x=>x!==a.player); g.teams[to].push(a.player); return {ok:true};
  }
  if(a.type==='rename'){ if(!host||g.phase!=='teams') return E('Only the host can rename teams before starting.');
    const t=a.team==='B'?'B':'A'; g.names[t]=String(a.name||'').slice(0,18)||g.names[t]; return {ok:true}; }
  if(a.type==='lock_teams'){
    if(!host) return E('Only the host can start.'); if(g.phase!=='teams') return E('Already started.');
    if(g.teams.A.length<2||g.teams.B.length<2) return E('Each team needs at least 2 players.');
    setupRelayRound(g); return {ok:true};
  }
  const active=relayActiveTeam(g);
  if(a.type==='start_turn'){
    if(g.phase!=='ready') return E('Not ready.');
    if(pid!==g.describer && !host && g.mode!=='shared') return E('Only the describer starts the timer.');
    g.phase='play'; g.deadline=now+60000; drawRelay(g); return {ok:true};
  }
  if(a.type==='correct'||a.type==='foul'){
    if(g.phase!=='play') return E('The round is not running.');
    const allowed=g.mode==='shared'?pid===g.describer||host:pid===g.judge;
    if(!allowed) return E('Only the judge confirms.');
    if(now>g.deadline) return E('Time is up.');
    const delta=a.type==='correct'?1:0;
    const ev={id:'e'+(g.events.length+1),round:g.round,team:active,kind:a.type,card:g.current,delta,reversal_of:null,at:now};
    g.events.push(ev); g.teamScore[active]+=delta; g.roundLog.push(ev.id); drawRelay(g); return {ok:true};
  }
  if(a.type==='pass'){
    if(g.phase!=='play') return E('The round is not running.');
    if(pid!==g.describer && g.mode!=='shared') return E('Only the describer can skip.');
    if(g.passes>=3) return E('No skips left this round.');
    g.passes++; g.events.push({id:'e'+(g.events.length+1),round:g.round,team:active,kind:'pass',card:g.current,delta:0,at:now}); drawRelay(g); return {ok:true};
  }
  if(a.type==='undo'){
    if(g.phase!=='play'&&g.phase!=='roundEnd') return E('Nothing to undo.');
    const allowed=g.mode==='shared'?true:pid===g.judge||host; if(!allowed) return E('Only the judge can undo.');
    const lastId=g.roundLog[g.roundLog.length-1]; if(!lastId) return E('Nothing to undo this round.');
    const ev=g.events.find(e=>e.id===lastId);
    g.events.push({id:'e'+(g.events.length+1),round:g.round,team:ev.team,kind:'undo',card:ev.card,delta:-ev.delta,reversal_of:ev.id,at:now});
    g.teamScore[ev.team]-=ev.delta; g.roundLog.pop();
    if(g.phase==='play'){ g.cursor--; g.current=ev.card; } // put that card back in front of the describer
    return {ok:true};
  }
  if(a.type==='next'){
    if(!host) return E('Only the host can continue.'); if(g.phase!=='roundEnd') return E('Round still running.');
    g.round++;
    if(g.round>=g.rounds){ g.phase='final'; g.status='finished';
      const s=g.teamScore; g.outcome={teams:true,winner:s.A===s.B?'tie':(s.A>s.B?'A':'B'),score:s}; return {ok:true}; }
    setupRelayRound(g); return {ok:true};
  }
  return E('Unknown action');
}
function setupRelayRound(g){
  const t=relayActiveTeam(g),o=t==='A'?'B':'A';
  g.describer=g.teams[t][g.describerIdx[t]%g.teams[t].length]; g.describerIdx[t]++;
  g.judge=g.teams[o][g.judgeIdx[o]%g.teams[o].length]; g.judgeIdx[o]++;
  g.phase='ready'; g.passes=0; g.current=null; g.deadline=null; g.roundLog=[];
}
function drawRelay(g){ if(g.cursor>=g.deck.length) g.cursor=0; g.current=g.deck[g.cursor++]; }

function actSignal(g,pid,a,now,host,E){
  if(a.type==='seen'){ if(g.phase!=='roles') return E('Roles are already confirmed.'); if(!g.roster.includes(pid)) return E('Not in this game.');
    g.seen[pid]=true; if(g.roster.every(p=>g.seen[p])){ g.phase='clues'; g.clueIdx=0; } return {ok:true}; }
  if(a.type==='next_clue'){
    if(!host) return E('The host moves to the next person.'); if(g.phase!=='clues') return E('Not in the clue round.');
    g.clueIdx++; if(g.clueIdx>=g.roster.length){ g.phase='vote'; g.votes={}; g.deadline=now+30000; } return {ok:true}; }
  if(a.type==='vote'){
    if(g.phase!=='vote') return E('Voting is closed.'); if(!g.roster.includes(pid)) return E('Not in this game.');
    if(now>g.deadline) return E('Voting time is over.');
    if(a.target===pid) return E('You can’t vote for yourself.');
    if(!g.candidates.includes(a.target)) return E('Pick one of the listed players.');
    if(g.votes[pid]) return E('You already voted.');
    g.votes[pid]=a.target; if(g.roster.every(p=>g.votes[p])) settleSignal(g,now); return {ok:true};
  }
  if(a.type==='guess'){
    if(g.phase!=='guess') return E('No guess right now.'); if(pid!==g.visitor) return E('Only the visitor guesses.');
    const t=SIGNAL_TOPICS[g.topic]; const ok=[t.w].concat(t.s).map(norm).includes(norm(a.text));
    g.guess={text:String(a.text||'').slice(0,40),correct:ok};
    finishSignal(g,ok?'visitor':'companions',ok?'The visitor was caught but named the word.':'The visitor was caught and missed the word.'); return {ok:true};
  }
  return E('Unknown action');
}
function settleSignal(g,now){
  const tally={}; Object.values(g.votes).forEach(t=>tally[t]=(tally[t]||0)+1);
  const ids=Object.keys(tally);
  if(ids.length===0){ g.phase='final'; g.status='finished'; g.outcome={incomplete:true,reason:'Nobody voted, so this game has no winner.'}; g.lastTally=tally; return; }
  const max=Math.max(...ids.map(k=>tally[k])); const tops=ids.filter(k=>tally[k]===max);
  g.lastTally=tally;
  if(tops.length>1){
    if(!g.revote){ g.revote=true; g.candidates=tops; g.votes={}; g.deadline=now+30000; g.phase='vote'; return; }
    finishSignal(g,'visitor','The revote tied again, so the visitor wins.'); return;
  }
  const picked=tops[0]; g.picked=picked;
  if(picked!==g.visitor){ finishSignal(g,'visitor','The table picked a companion.'); return; }
  g.phase='guess'; g.deadline=now+20000;
}
function finishSignal(g,winner,reason){ g.phase='final'; g.status='finished'; g.deadline=null; g.outcome={winner,reason}; }

/* ---------- deadlines (called on every request) ---------- */
function tick(g,now,ctx){
  if(!g||g.status!=='playing') return false;
  let changed=false;
  if(g.game_id==='frequency' && g.phase==='answer' && g.deadline && now>g.deadline){ settleFreq(g,now); changed=true; }
  if(g.game_id==='relay' && g.phase==='play' && now>g.deadline){ g.phase='roundEnd'; g.deadline=null; changed=true; }
  if(g.game_id==='signal'){
    if(g.phase==='vote' && now>g.deadline){ settleSignal(g,now); changed=true; }
    else if(g.phase==='guess' && now>g.deadline){ finishSignal(g,'companions','The visitor ran out of time to guess.'); changed=true; }
    if(ctx && ctx.offlineSince){
      const gone=g.roster.filter(p=>{const t=ctx.offlineSince(p);return t && now-t>60000;});
      const st=gone.length?gone:null;
      if(JSON.stringify(st)!==JSON.stringify(g.stalled)){ g.stalled=st; changed=true; }
    }
  }
  return changed;
}

/* ---------- per-player view (secrets removed) ---------- */
function view(g,pid,opts){
  if(!g) return null;
  const v={game_id:g.game_id,rules_version:g.rules_version,mode:g.mode,status:g.status,phase:g.phase,deadline:g.deadline||null,scores:g.scores,outcome:g.outcome,me:{}};
  const all=opts&&opts.all; // shared-phone mode: the phone itself is passed around
  if(g.game_id==='frequency'){
    const Q=FREQ_QUESTIONS[g.q];
    Object.assign(v,{round:g.round,rounds:g.rounds,question:Q.q,options:Q.o,roster:g.roster,
      submitted:g.roster.filter(p=>g.answers[p]),reveal:g.reveal,history:g.history.map(h=>({q:FREQ_QUESTIONS[h.q].q,counts:h.counts,majority:h.majority}))});
    const mine=g.answers[pid]; v.me.answer=mine?{pick:mine.pick,guess:mine.guess,skip:!!mine.skip,canEdit:!mine.skip&&mine.edits<1}:null;
  }
  if(g.game_id==='relay'){
    Object.assign(v,{teams:g.teams,names:g.names,teamScore:g.teamScore,round:g.round,rounds:g.rounds,active:g.phase==='teams'?null:(g.round%2===0?'A':'B'),
      describer:g.describer||null,judge:g.judge||null,passesLeft:3-(g.passes||0),
      log:g.events.filter(e=>e.round===g.round).map(e=>({kind:e.kind,delta:e.delta,team:e.team,reversal_of:e.reversal_of}))});
    const canSee=all||pid===g.describer||pid===g.judge;
    if(canSee && g.phase==='play' && g.current!=null){ const c=RELAY_CARDS[g.current]; v.me.card={word:c.w,taboo:c.t}; }
    if(g.phase==='roundEnd'||g.phase==='final'){
      v.roundCards=g.events.filter(e=>e.round===g.round&&e.kind!=='undo'&&!g.events.some(u=>u.reversal_of===e.id)).map(e=>({word:RELAY_CARDS[e.card].w,kind:e.kind}));
    }
  }
  if(g.game_id==='signal'){
    const T=SIGNAL_TOPICS[g.topic];
    Object.assign(v,{roster:g.roster,seenCount:Object.keys(g.seen).length,clueIdx:g.clueIdx,currentClue:g.phase==='clues'?g.roster[g.clueIdx]:null,
      candidates:g.candidates,revote:g.revote,voted:Object.keys(g.votes),stalled:g.stalled,category:T.c});
    if(g.roster.includes(pid)){
      v.me.role=pid===g.visitor?'visitor':'companion';
      v.me.word=pid===g.visitor?null:T.w;
      v.me.seen=!!g.seen[pid]; v.me.vote=g.votes[pid]||null;
    }
    if(g.phase==='guess') v.accused=g.visitor; // public once the table has caught them
    if(g.status!=='playing'){ v.visitor=g.visitor; v.word=T.w; v.tally=g.lastTally||{}; v.guess=g.guess; }
  }
  return v;
}

function resultTable(scores){
  const arr=Object.entries(scores).sort((a,b)=>b[1]-a[1]); const top=arr.length?arr[0][1]:0;
  return {leaders:arr.filter(x=>x[1]===top).map(x=>x[0]),top};
}

return {RULES_VERSION,catalog,meta,filterGames,rankGames,start,act,tick,view,clone};
});

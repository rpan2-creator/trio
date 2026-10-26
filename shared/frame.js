/* Builds the iPhone hardware around <div class="screen"> and keeps it scaled to the window. */
(function(){
  const root=document.documentElement;
  if(!root.style.getPropertyValue('--safe-top')){
    root.style.setProperty('--safe-top', window.matchMedia('(max-width:520px)').matches ? 'env(safe-area-inset-top,0px)' : '54px');
    root.style.setProperty('--safe-bottom', window.matchMedia('(max-width:520px)').matches ? 'env(safe-area-inset-bottom,0px)' : '30px');
  }
  const iphone=document.querySelector('.iphone');
  const screen=document.querySelector('.screen');
  if(!iphone||!screen) return;
  ['btn-action','btn-vol-up','btn-vol-down','btn-power','btn-camera'].forEach(c=>{
    const b=document.createElement('span');b.className='btn-side '+c;b.setAttribute('aria-hidden','true');iphone.appendChild(b);
  });
  const island=document.createElement('div');island.className='island';island.setAttribute('aria-hidden','true');
  const sb=document.createElement('div');sb.className='statusbar';sb.setAttribute('aria-hidden','true');
  sb.innerHTML='<span class="sb-time">9:41</span><span class="sb-right">'+
    '<svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>'+
    '<svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.2-1.3C13.3 1.4 10.8.4 8 .4S2.7 1.4.8 3.3L2 4.6c1.6-1.5 3.7-2.4 6-2.4z"/><path d="M8 5.6c1.4 0 2.6.5 3.6 1.4l1.2-1.3C11.5 4.5 9.8 3.8 8 3.8s-3.5.7-4.8 1.9L4.4 7c1-.9 2.2-1.4 3.6-1.4z"/><path d="M8 9c.6 0 1.1.2 1.5.6L8 11.2 6.5 9.6c.4-.4.9-.6 1.5-.6z"/></svg>'+
    '<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.8" fill="none" stroke="currentColor" opacity=".4"/><rect class="sb-batt" x="2" y="2" width="20" height="9" rx="2.5"/><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2z" opacity=".45"/></svg>'+
    '</span>';
  const home=document.createElement('button');home.className='home-ind';home.type='button';
  home.setAttribute('aria-label','Home — 返回三个应用的总入口');
  home.addEventListener('click',()=>{ if(location.pathname!=='/' && !location.pathname.endsWith('/index.html')) location.href='/'; });
  screen.appendChild(island);screen.appendChild(sb);screen.appendChild(home);

  function tick(){
    const d=new Date();let h=d.getHours()%12||12;const m=String(d.getMinutes()).padStart(2,'0');
    sb.querySelector('.sb-time').textContent=h+':'+m;
  }
  tick();setInterval(tick,15000);
  if(navigator.getBattery){navigator.getBattery().then(b=>{const r=sb.querySelector('.sb-batt');const f=()=>r.setAttribute('width',String(Math.max(2,20*b.level)));f();b.addEventListener('levelchange',f);}).catch(()=>{});}

  window.Frame={
    tone(t){ sb.classList.toggle('light',t==='light'); home.classList.toggle('light',t==='light'); },
    hideHome(v){ home.style.display=v?'none':''; }
  };

  const wrap=document.querySelector('.device-wrap');
  function fit(){
    if(window.matchMedia('(max-width:520px)').matches){wrap.style.transform='';return;}
    const h=iphone.offsetHeight+48, w=iphone.offsetWidth+48;
    const s=Math.min(1,(window.innerHeight)/h, (window.innerWidth)/w);
    wrap.style.transform='scale('+s.toFixed(3)+')';
    wrap.style.margin=(-(1-s)*iphone.offsetHeight/2)+'px '+(-(1-s)*iphone.offsetWidth/2)+'px';
  }
  fit();window.addEventListener('resize',fit);
})();

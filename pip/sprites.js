/* PIP original pixel art. Everything is generated from layered shape rules on a 24x24 grid
   (each cell = 2 logical px → a 48x48 logical character), so appearance edits are whitelisted layers. */
(function(){
const INK='#25382F';
const PALETTES={
  cream:{name:'Cream',base:'#f0d9ad',light:'#fff5e2',dark:'#c49a5f'},
  ginger:{name:'Ginger',base:'#df8c46',light:'#f8dcb9',dark:'#a95b26'},
  grey:{name:'Grey',base:'#9ea5aa',light:'#e2e6e8',dark:'#666e74'},
  black:{name:'Black',base:'#33302f',light:'#5d5856',dark:'#181616',eye:'#d9c45a'},
  white:{name:'White',base:'#f7f3ec',light:'#ffffff',dark:'#cfc6b8'},
  brown:{name:'Brown',base:'#8b5b3d',light:'#d9b590',dark:'#5b3824'},
  tricolor:{name:'Calico',base:'#f6f0e5',light:'#ffffff',dark:'#d88a45',extra:'#2f2c2b'},
  golden:{name:'Golden',base:'#d8a54d',light:'#f3dba6',dark:'#a37427'},
};
const MARKINGS={none:'None',tabby:'Tabby stripes',patches:'Patches',socks:'White socks',mask:'Eye mask',tuxedo:'Tuxedo'};
const EARS={pointed:'Pointed',round:'Round',folded:'Folded',floppy:'Floppy'};

const inE=(x,y,cx,cy,rx,ry)=>((x-cx)/rx)**2+((y-cy)/ry)**2<=1;
function inTri(px,py,a,b,c){const s=(p1,p2,p3)=>(p1[0]-p3[0])*(p2[1]-p3[1])-(p2[0]-p3[0])*(p1[1]-p3[1]);
  const d1=s([px,py],a,b),d2=s([px,py],b,c),d3=s([px,py],c,a);const n=d1<0||d2<0||d3<0,p=d1>0||d2>0||d3>0;return !(n&&p);}

function cells(look,pose){
  const W=24,g=[];for(let y=0;y<W;y++)g.push(new Array(W).fill(null));
  const dog=look.species==='dog';
  const rest=pose.rest, eat=pose.eat;
  const hx=rest?9:12, hy=rest?13.2:eat?11:8.6;
  const hrx=dog?6.3:6.6, hry=dog?5.8:5.5;
  const bx=rest?13:12, by=rest?18.8:17.6, brx=rest?8.6:6, bry=rest?3.8:5.2;
  const ear=look.ear||(dog?'floppy':'pointed');
  const mk=look.marking||'none';
  const tailPts=rest?[[20.5,20],[21.6,19],[22.2,17.6]]:
    dog?[[18.2,17.6],[19.3,16.2],[20.1+(pose.wag||0),14.7]]:
    [[18.3,20.6],[19.9,19.7],[21,18],[21.4+(pose.wag||0)*.6,16.1],[21+(pose.wag||0),14.3]];
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){
    const px=x+.5,py=y+.5;let c=null;
    if(inE(px,py,bx,by,brx,bry)) c='b';
    for(const t of tailPts) if(((px-t[0])**2+(py-t[1])**2)<=1.35) c=c||'t';
    if(!rest){ if(inE(px,py,9.3,22.3,1.9,1.15)||inE(px,py,14.7,22.3,1.9,1.15)) c='paw'; }
    else if(inE(px,py,5.6,20.6,2,1.1)) c='paw';
    // ears behind head edge
    const mirror=(fn)=>fn(px,py)||fn(2*hx-px,py);
    if(ear==='pointed'&&mirror((X,Y)=>inTri(X,Y,[hx-6.8,hy-1.6],[hx-5.6,hy-7.6],[hx-1.9,hy-4.6]))) c='b';
    if(ear==='round'&&mirror((X,Y)=>((X-(hx-4.9))**2+(Y-(hy-4.7))**2)<=5)) c='b';
    if(ear==='folded'&&mirror((X,Y)=>inE(X,Y,hx-4.6,hy-4.4,2.4,1.3))) c='b';
    if(inE(px,py,hx,hy,hrx,hry)) c='b';
    if(ear==='floppy'&&mirror((X,Y)=>inE(X,Y,hx-6,hy+.4,1.8,3.7))) c='ear';
    if(ear==='pointed'&&mirror((X,Y)=>inTri(X,Y,[hx-5.9,hy-2.6],[hx-5.3,hy-6.2],[hx-3.2,hy-4.4]))) c='i';
    if(ear==='round'&&mirror((X,Y)=>((X-(hx-4.9))**2+(Y-(hy-4.9))**2)<=1.6)) c='i';
    if(c==='b'||c==='t'||c==='paw'){
      // light belly / muzzle
      if(c==='b'&&!rest&&inE(px,py,12,18.8,2.8,3.4)) c='l';
      if(c==='b'&&inE(px,py,hx,hy+2.4,dog?2.9:2.4,dog?1.9:1.3)) c='l';
      // markings
      const inHead=inE(px,py,hx,hy,hrx,hry);
      if(mk==='tabby'&&c==='b'){
        const fy=Math.floor(hy-4.2);
        if(inHead&&((y===fy&&(x===hx-2||x===hx||x===hx+1))||(y===fy+1&&x===hx))) c='d';
        if(!inHead&&y%2===0&&(x<=bx-3||x>=bx+3)) c='d';
      }
      if(c==='t'&&mk==='tabby'&&(x+y)%2===0) c='d';
      if(mk==='patches'&&c==='b'&&(((px-(bx-3.5))**2+(py-(by-1.8))**2)<6.5||((px-(hx+3.2))**2+(py-(hy-2.4))**2)<4)) c='d';
      if(look.palette==='tricolor'&&c==='b'&&((px-(bx+3))**2+(py-(by+.6))**2)<4.6) c='k';
      if(look.palette==='tricolor'&&mk==='none'&&c==='b'&&((px-(hx-3))**2+(py-(hy-2))**2)<4) c='d';
      if(mk==='mask'&&inHead&&Math.abs(py-hy)<1.4&&Math.abs(px-hx)>.8) c='d';
      if(mk==='tuxedo'&&(c==='l'||(c==='b'&&!inHead&&Math.abs(px-12)<3.4&&py>by-3.6))) c='w';
      if((mk==='socks'||mk==='tuxedo')&&c==='paw') c='w';
    }
    g[y][x]=c;
  }
  // face
  const ey=Math.floor(hy)-(rest?0:0), ex1=Math.floor(hx-2.6), ex2=Math.floor(hx+2.6);
  const set=(x,y,v)=>{if(y>=0&&y<W&&x>=0&&x<W)g[y][x]=v;};
  if(pose.blink||rest){ set(ex1-1,ey+1,'e');set(ex1,ey+1,'e');set(ex2,ey+1,'e');set(ex2+1,ey+1,'e'); }
  else { set(ex1,ey,'e');set(ex1,ey+1,'e');set(ex2,ey,'e');set(ex2,ey+1,'e'); set(ex1,ey,'h'); set(ex2,ey,'h'); }
  const ny=ey+2, nx=Math.floor(hx);
  set(nx-1,ny,'n');set(nx,ny,'n');
  if(pose.mouth){ set(nx-1,ny+1,'m');set(nx,ny+1,'m'); }
  // outline
  const out=g.map(r=>r.slice());
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){ if(g[y][x])continue;
    const nb=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{const v=g[y+dy]&&g[y+dy][x+dx];return v&&v!=='o';});
    if(nb) out[y][x]='o'; }
  return out;
}
function colorFor(k,pal,look){
  switch(k){case 'b':case 't':return pal.base;case 'paw':return pal.base;case 'l':return pal.light;case 'd':return pal.dark;
    case 'k':return pal.extra||pal.dark;case 'w':return '#fffaf0';case 'i':return '#e7a29b';case 'ear':return look.species==='dog'&&look.palette!=='black'?pal.dark:pal.base;
    case 'e':return pal.eye||INK;case 'h':return pal.eye?'#f6edb0':'#4d6b5d';case 'n':return '#7b3a33';case 'm':return '#5a2a24';case 'o':return INK;}
  return null;
}
/* draw a pet whose feet sit at (fx, fy) in logical px; cell size 2 */
function drawPet(ctx,look,pose,fx,fy,flip){
  const pal=PALETTES[look.palette]||PALETTES.cream;const g=cells(look,pose);const S=2;
  const ox=Math.round(fx-24), oy=Math.round(fy-48+(pose.dy||0));
  for(let y=0;y<24;y++)for(let x=0;x<24;x++){const k=g[y][x];if(!k)continue;const c=colorFor(k,pal,look);
    ctx.fillStyle=c;const xx=flip?23-x:x;ctx.fillRect(ox+xx*S,oy+y*S,S,S);}
}
function drawPetIcon(canvas,look,scale){
  const ctx=canvas.getContext('2d');canvas.width=52;canvas.height=52;ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,52,52);drawPet(ctx,look,{},26,50,false);
  if(scale){canvas.style.width=52*scale+'px';canvas.style.height=52*scale+'px';}
}

/* tiny pixel bitmaps (strings) for props */
function bitmap(ctx,rows,x,y,map,s){s=s||1;rows.forEach((r,j)=>{for(let i=0;i<r.length;i++){const c=map[r[i]];if(!c)continue;ctx.fillStyle=c;ctx.fillRect(x+i*s,y+j*s,s,s);}});}
const TOYS={
  ball:{name:'Red ball',rows:['..ooo..','.orrro.','orrwrro','orwwrro','orrrrro','.orrro.','..ooo..'],map:{o:INK,r:'#b4533a',w:'#f4e3c6'}},
  bone:{name:'Chew bone',rows:['oo...oo','obo.obo','.obbbo.','..obo..','.obbbo.','obo.obo','oo...oo'],map:{o:INK,b:'#f3ead6'}},
  yarn:{name:'Yarn ball',rows:['..ooo..','.ogggo.','oglgglo','oggglgo','olggggo','.ogglo.','..ooo..'],map:{o:INK,g:'#7f9f6c',l:'#c9dbb7'}},
};
const FOODS={
  fish:{name:'Fish crackers',rows:['...oo...','..obbo..','oobbbbo.','obbebbbo','oobbbbo.','..obbo..','...oo...'],map:{o:INK,b:'#e2b25c',e:INK}},
  pumpkin:{name:'Pumpkin bite',rows:['...gg...','..oggo..','.oppppo.','oppqppqo','oppqppqo','.oppppo.','..oooo..'],map:{o:INK,g:'#5e8a4f',p:'#df8c46',q:'#c06d2d'}},
  berry:{name:'Berry biscuit',rows:['.oooooo.','obbbbbbo','obrbbrbo','obbbbbbo','obbrbbbo','obbbbbbo','.oooooo.'],map:{o:INK,b:'#e6c690',r:'#9b3a4a'}},
};

/* room: W×H logical px; returns hotspots used by the find-the-toy game */
function drawRoom(ctx,W,H,opt){
  opt=opt||{};
  const wallH=Math.round(H*.58);
  const hr=new Date().getHours();const night=hr<6||hr>=20, dusk=(hr>=17&&hr<20)||(hr>=6&&hr<8);
  // wall
  ctx.fillStyle='#efe4cd';ctx.fillRect(0,0,W,wallH);
  ctx.fillStyle='#e6d8bb';for(let x=0;x<W;x+=10)ctx.fillRect(x,0,4,wallH);
  ctx.fillStyle='#c9b48d';ctx.fillRect(0,wallH-4,W,4);
  // window
  const wx=14,wy=18,ww=56,wh=48;
  ctx.fillStyle='#7a5a3a';ctx.fillRect(wx-3,wy-3,ww+6,wh+6);
  ctx.fillStyle=night?'#1f2b4a':dusk?'#e9a46e':'#a9d2e6';ctx.fillRect(wx,wy,ww,wh);
  if(night){ctx.fillStyle='#f5f0c8';[[wx+10,wy+8],[wx+40,wy+14],[wx+24,wy+30],[wx+46,wy+36]].forEach(p=>ctx.fillRect(p[0],p[1],1,1));ctx.fillRect(wx+38,wy+6,6,6);ctx.fillStyle='#1f2b4a';ctx.fillRect(wx+40,wy+5,5,5);}
  else {ctx.fillStyle='#ffffff';ctx.fillRect(wx+8,wy+12,14,4);ctx.fillRect(wx+12,wy+9,8,3);ctx.fillRect(wx+32,wy+26,12,3);}
  ctx.fillStyle='#7a5a3a';ctx.fillRect(wx+ww/2-1,wy,2,wh);ctx.fillRect(wx,wy+wh/2-1,ww,2);
  ctx.fillStyle='#b5523a';ctx.fillRect(wx-8,wy-6,8,wh+16);ctx.fillRect(wx+ww,wy-6,8,wh+16);
  ctx.fillStyle='#93412d';for(let y=wy-6;y<wy+wh+10;y+=4){ctx.fillRect(wx-6,y,1,2);ctx.fillRect(wx+ww+3,y,1,2);}
  // shelf
  const sx=W-78,sy=30;
  ctx.fillStyle='#7a5a3a';ctx.fillRect(sx,sy+22,64,4);
  [['#315C48',8,18],['#b5523a',6,15],['#d8a54d',7,20],['#6d7f9a',5,16],['#9b513a',6,19]].forEach((b,i,arr)=>{
    const x=sx+4+arr.slice(0,i).reduce((s,q)=>s+q[1]+1,0);ctx.fillStyle=b[0];ctx.fillRect(x,sy+22-b[2],b[1],b[2]);ctx.fillStyle='rgba(255,255,255,.25)';ctx.fillRect(x+1,sy+24-b[2],1,b[2]-6);});
  ctx.fillStyle='#c9a26b';ctx.fillRect(sx+46,sy+12,12,10);ctx.fillStyle='#5f8a4f';ctx.fillRect(sx+47,sy+4,4,8);ctx.fillRect(sx+52,sy+2,4,10);ctx.fillRect(sx+49,sy+7,6,5);
  // frame picture
  ctx.fillStyle='#7a5a3a';ctx.fillRect(sx+8,sy+38,26,20);ctx.fillStyle='#b7c7a4';ctx.fillRect(sx+10,sy+40,22,16);ctx.fillStyle='#8aa078';ctx.fillRect(sx+10,sy+50,22,6);ctx.fillStyle='#f0d9ad';ctx.fillRect(sx+22,sy+43,4,4);
  // floor
  ctx.fillStyle='#b98a5a';ctx.fillRect(0,wallH,W,H-wallH);
  ctx.fillStyle='#a77a4d';for(let y=wallH+6;y<H;y+=9){ctx.fillRect(0,y,W,1);}
  ctx.fillStyle='#c79a69';for(let y=wallH;y<H;y+=9){const off=((y/9)%2)*23;for(let x=off;x<W;x+=46)ctx.fillRect(x,y+1,1,8);}
  // rug
  const rx=W/2,ry=H-34;
  ctx.fillStyle='#315C48';for(let y=-14;y<=14;y++){const w=Math.round(Math.sqrt(1-(y/14.5)**2)*62);ctx.fillRect(rx-w,ry+y,w*2,1);}
  ctx.fillStyle='#4f7a63';for(let y=-10;y<=10;y++){const w=Math.round(Math.sqrt(1-(y/10.5)**2)*46);ctx.fillRect(rx-w,ry+y,w*2,1);}
  ctx.fillStyle='#e6d8bb';for(let x=-40;x<=40;x+=8)ctx.fillRect(rx+x,ry,3,1);
  // big plant (left)
  const px=10,py=H-18;
  ctx.fillStyle='#9b513a';ctx.fillRect(px,py-14,22,16);ctx.fillStyle='#7f3f2c';ctx.fillRect(px,py-14,22,3);
  ctx.fillStyle='#5f8a4f';[[px+3,py-40,5,26],[px+9,py-48,5,34],[px+15,py-38,5,24],[px-2,py-30,6,4],[px+18,py-28,7,4]].forEach(r=>ctx.fillRect(...r));
  ctx.fillStyle='#7fa86a';[[px+4,py-38,2,20],[px+10,py-46,2,28]].forEach(r=>ctx.fillRect(...r));
  // pet bed (right)
  const bxp=W-60,byp=H-20;
  ctx.fillStyle='#8f6a44';ctx.fillRect(bxp,byp-14,48,16);ctx.fillStyle='#a77d50';ctx.fillRect(bxp+2,byp-12,44,4);
  ctx.fillStyle='#e8c9a0';ctx.fillRect(bxp+5,byp-9,38,8);
  // bowl
  const bw={x:Math.round(W/2-50),y:H-26};
  ctx.fillStyle=INK;ctx.fillRect(bw.x,bw.y,16,7);ctx.fillStyle='#d9e2dc';ctx.fillRect(bw.x+1,bw.y+1,14,5);
  if(opt.bowlFull){ctx.fillStyle='#e2b25c';ctx.fillRect(bw.x+3,bw.y,10,2);}
  // basket (left floor)
  const bk={x:W-30,y:wallH+16};
  ctx.fillStyle='#c79a52';ctx.fillRect(bk.x,bk.y-10,20,12);ctx.fillStyle='#a77a35';for(let i=0;i<20;i+=3)ctx.fillRect(bk.x+i,bk.y-10,1,12);
  return {
    pet:{x:Math.round(W/2),y:H-30},
    spots:{
      window:{label:'by the window',x:wx+4,y:wy+wh-14},
      shelf:{label:'on the shelf',x:sx+26,y:sy+8},
      plant:{label:'behind the plant',x:px+24,y:py-14},
      bed:{label:'in the pet bed',x:bxp+16,y:byp-20},
      basket:{label:'in the basket',x:bk.x+3,y:bk.y-18},
      rug:{label:'at the edge of the rug',x:Math.round(rx-34),y:H-22},
    }
  };
}
function drawHeart(ctx,x,y){bitmap(ctx,['.o.o.','ooooo','ooooo','.ooo.','..o..'],x,y,{o:'#c4523e'});}
function drawZ(ctx,x,y){bitmap(ctx,['zzzz','..z.','.z..','zzzz'],x,y,{z:'#fffaf0'});}

window.PIPArt={PALETTES,MARKINGS,EARS,TOYS,FOODS,drawPet,drawPetIcon,drawRoom,bitmap,drawHeart,drawZ};
})();

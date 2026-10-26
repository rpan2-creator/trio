/* INK STUDY rendering: perspective-mapped design layers over the body photo, plus the
   deterministic "change study" filters (fade, edge spread, desaturation, limited warp). */
(function(){
function affine(s,d){ // map triangle s -> d ; returns [a,b,c,d,e,f]
  const [x0,y0,x1,y1,x2,y2]=s,[u0,v0,u1,v1,u2,v2]=d;
  const den=x0*(y1-y2)+x1*(y2-y0)+x2*(y0-y1); if(Math.abs(den)<1e-9) return null;
  const a=(u0*(y1-y2)+u1*(y2-y0)+u2*(y0-y1))/den, c=(u0*(x2-x1)+u1*(x0-x2)+u2*(x1-x0))/den;
  const e=(u0*(x1*y2-x2*y1)+u1*(x2*y0-x0*y2)+u2*(x0*y1-x1*y0))/den;
  const b=(v0*(y1-y2)+v1*(y2-y0)+v2*(y0-y1))/den, dd=(v0*(x2-x1)+v1*(x0-x2)+v2*(x1-x0))/den;
  const f=(v0*(x1*y2-x2*y1)+v1*(x2*y0-x0*y2)+v2*(x0*y1-x1*y0))/den;
  return [a,b,c,dd,e,f];
}
function bil(q,u,v){ // q: tl,tr,br,bl
  const x=(1-u)*(1-v)*q[0][0]+u*(1-v)*q[1][0]+u*v*q[2][0]+(1-u)*v*q[3][0];
  const y=(1-u)*(1-v)*q[0][1]+u*(1-v)*q[1][1]+u*v*q[2][1]+(1-u)*v*q[3][1];
  return [x,y];
}
function drawQuad(ctx,img,q,N){
  N=N||10; const W=img.width,H=img.height;
  for(let i=0;i<N;i++)for(let j=0;j<N;j++){
    const u0=i/N,u1=(i+1)/N,v0=j/N,v1=(j+1)/N;
    const p00=bil(q,u0,v0),p10=bil(q,u1,v0),p11=bil(q,u1,v1),p01=bil(q,u0,v1);
    tri(ctx,img,[u0*W,v0*H,u1*W,v0*H,u1*W,v1*H],[p00[0],p00[1],p10[0],p10[1],p11[0],p11[1]]);
    tri(ctx,img,[u0*W,v0*H,u1*W,v1*H,u0*W,v1*H],[p00[0],p00[1],p11[0],p11[1],p01[0],p01[1]]);
  }
}
function tri(ctx,img,s,d){
  const m=affine(s,d); if(!m) return;
  const cx=(d[0]+d[2]+d[4])/3, cy=(d[1]+d[3]+d[5])/3, g=.7; // grow clip slightly to hide seams
  ctx.save(); ctx.beginPath();
  for(let k=0;k<3;k++){const x=d[2*k]+(d[2*k]-cx>0?g:-g),y=d[2*k+1]+(d[2*k+1]-cy>0?g:-g);k?ctx.lineTo(x,y):ctx.moveTo(x,y);}
  ctx.closePath(); ctx.clip(); ctx.transform(m[0],m[1],m[2],m[3],m[4],m[5]); ctx.drawImage(img,0,0); ctx.restore();
}
/* scenario: {fade 0..1, spread 0..1, desat 0..1, warp 0..1} — visual parameters only, no medical units */
function processDesign(src,sc){
  if(!sc) return src;
  const W=src.width,H=src.height, c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d');
  if(sc.spread>0){ // edge spread: blur by down/up sampling, then re-darken core
    const k=Math.max(1,Math.round(1+sc.spread*10)); const t=document.createElement('canvas'); t.width=Math.max(1,Math.round(W/k)); t.height=Math.max(1,Math.round(H/k));
    const tx=t.getContext('2d'); tx.imageSmoothingQuality='high'; tx.drawImage(src,0,0,t.width,t.height);
    x.imageSmoothingQuality='high'; x.drawImage(t,0,0,W,H); x.globalAlpha=1-sc.spread*.55; x.drawImage(src,0,0); x.globalAlpha=1;
  } else x.drawImage(src,0,0);
  const id=x.getImageData(0,0,W,H),p=id.data, fade=sc.fade||0, ds=sc.desat||0;
  for(let i=0;i<p.length;i+=4){
    if(!p[i+3]) continue;
    const L=.3*p[i]+.59*p[i+1]+.11*p[i+2];
    let r=p[i]+(L-p[i])*ds,g=p[i+1]+(L-p[i+1])*ds,b=p[i+2]+(L-p[i+2])*ds;
    // ink drifts slightly blue-green and lighter as a visual cue (illustrative only)
    r=r+(110-r)*fade*.45; g=g+(120-g)*fade*.45; b=b+(130-b)*fade*.5;
    p[i]=r;p[i+1]=g;p[i+2]=b;p[i+3]=p[i+3]*(1-fade*.6);
  }
  x.putImageData(id,0,0); return c;
}
function warpQuad(q,w){ if(!w) return q; // limited geometric illustration: widen lower edge, slight sag
  const cx=(q[0][0]+q[1][0]+q[2][0]+q[3][0])/4; const k=w*.08;
  return q.map((p,i)=>[p[0]+(p[0]-cx)*(i>=2?k:k*.3),p[1]+(i>=2?Math.abs(q[2][1]-q[1][1])*k*.5:0)]);
}
/* layers: [{img,quad(normalized),opacity,blend,visible}] */
function composite(base,layers,opts){
  opts=opts||{}; const max=opts.max||1600; const k=Math.min(1,max/Math.max(base.width,base.height));
  const W=Math.round(base.width*k),H=Math.round(base.height*k);
  const c=opts.canvas||document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d');
  x.drawImage(base,0,0,W,H);
  for(const L of layers){ if(L.visible===false||!L.img) continue;
    const src=processDesign(L.img,opts.scenario);
    const q=warpQuad(L.quad.map(p=>[p[0]*W,p[1]*H]),opts.scenario&&opts.scenario.warp);
    const t=document.createElement('canvas'); t.width=W; t.height=H; const tx=t.getContext('2d');
    drawQuad(tx,src,q,opts.fast?6:12);
    x.save(); x.globalAlpha=L.opacity==null?.9:L.opacity; x.globalCompositeOperation=L.blend||'multiply'; x.drawImage(t,0,0); x.restore();
  }
  if(opts.watermark){ const fs=Math.max(12,Math.round(W*.032)); x.font=`600 ${fs}px ui-monospace,monospace`; const tw=x.measureText(opts.watermark).width;
    x.fillStyle='rgba(141,48,39,.92)'; x.fillRect(Math.round(fs*.6),H-Math.round(fs*2.2),tw+fs,Math.round(fs*1.6)); x.fillStyle='#fff'; x.fillText(opts.watermark,Math.round(fs*1.1),H-Math.round(fs*1));}
  return c;
}
function rectQuad(cx,cy,w,h,rot){ const c=Math.cos(rot),s=Math.sin(rot);
  return [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>[cx+x*c-y*s,cy+x*s+y*c]); }
window.InkRender={drawQuad,processDesign,composite,rectQuad,warpQuad};
})();

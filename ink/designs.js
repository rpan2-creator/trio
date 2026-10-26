/* Licensed library: original line art drawn for INK STUDY. Rights: created by the INK STUDY team,
   free to try on and to bring to an artist as reference. */
(function(){
const S=(body,w)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g fill="none" stroke="#151515" stroke-width="${w||9}" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
const DESIGNS=[
 {id:'lib-fern',name:'Fern sprig',style:'Botanical',lines:'fine',svg:S(`<path d="M256 470C250 340 262 200 300 60"/>${[0,1,2,3,4,5,6].map(i=>{const y=420-i*52,x=256+i*6;return `<path d="M${x} ${y}c-40-10-80-40-96-80"/><path d="M${x+4} ${y-10}c40-14 76-48 88-90"/>`;}).join('')}`,7)},
 {id:'lib-moon',name:'Crescent & stars',style:'Celestial',lines:'bold',svg:S(`<path d="M300 90a170 170 0 1 0 120 290A140 140 0 0 1 300 90z"/><path d="M380 120l10 26 26 10-26 10-10 26-10-26-26-10 26-10z"/><path d="M430 250l6 15 15 6-15 6-6 15-6-15-15-6 15-6z"/><circle cx="350" cy="320" r="5"/>`,10)},
 {id:'lib-wave',name:'Small wave',style:'Line',lines:'bold',svg:S(`<path d="M60 360c60 0 90-40 110-90 30-80 110-120 180-90 50 22 60 80 30 110-24 24-62 16-70-10-8-24 14-44 34-40"/><path d="M60 410c70 0 120 0 180 0s120 0 210 0"/><path d="M100 450c60 0 100 0 150 0s100 0 150 0"/>`,11)},
 {id:'lib-peaks',name:'Mountain line',style:'Minimal',lines:'fine',svg:S(`<path d="M50 390l120-170 70 90 80-150 140 230z"/><path d="M290 160l30 40 20-20"/><circle cx="380" cy="130" r="30"/><path d="M90 440h330"/>`,8)},
 {id:'lib-compass',name:'Compass rose',style:'Traditional',lines:'bold',svg:S(`<circle cx="256" cy="256" r="150"/><circle cx="256" cy="256" r="122"/><path d="M256 60l26 170 170 26-170 26-26 170-26-170-170-26 170-26z"/><path d="M256 256l-90-90M256 256l90-90M256 256l90 90M256 256l-90 90" stroke-width="6"/>`,9)},
 {id:'lib-plane',name:'Paper plane',style:'Minimal',lines:'fine',svg:S(`<path d="M70 250L450 90 330 430 250 300z"/><path d="M450 90L250 300"/><path d="M250 300l-20 110 60-70"/><path d="M60 360c40-10 60 10 90 0" stroke-dasharray="4 22"/>`,8)},
 {id:'lib-sun',name:'Rising sun',style:'Graphic',lines:'bold',svg:S(`<path d="M120 330a136 136 0 0 1 272 0"/><path d="M70 330h372"/>${Array.from({length:9},(_,i)=>{const a=Math.PI*(i/8);const x1=256-Math.cos(a)*165,y1=330-Math.sin(a)*165,x2=256-Math.cos(a)*215,y2=330-Math.sin(a)*215;return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;}).join('')}<path d="M130 380h252M170 420h172"/>`,12)},
 {id:'lib-branch',name:'Olive branch',style:'Botanical',lines:'fine',svg:S(`<path d="M90 440C180 330 300 220 430 80"/>${[[150,370,-1],[200,320,1],[245,275,-1],[290,230,1],[335,185,-1],[380,135,1]].map(([x,y,s])=>`<path d="M${x} ${y}c${s*-50} -6 ${s*-80} -36 ${s*-86} -70 ${s*40} -2 ${s*76} 30 ${s*86} 70z"/>`).join('')}<circle cx="205" cy="365" r="14"/><circle cx="330" cy="240" r="14"/>`,7)},
];
window.InkDesigns={DESIGNS,
  rights:'Original line art by the INK STUDY team. Free to try on and to share with your artist as reference.',
  async raster(svg,size){const blob=new Blob([svg],{type:'image/svg+xml'});const img=await window.InkStore.img(blob);
    const c=document.createElement('canvas');c.width=c.height=size||1024;c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(img.src);return c;}
};
})();

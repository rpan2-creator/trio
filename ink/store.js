/* INK STUDY local store (IndexedDB). Body photos never leave the device unless the user exports them. */
(function(){
const NAME='ink-study',VER=1,STORES=['assets','studies','versions','meta'];
let dbp=null;
function db(){return dbp||(dbp=new Promise((res,rej)=>{const r=indexedDB.open(NAME,VER);
  r.onupgradeneeded=()=>STORES.forEach(s=>{if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s,{keyPath:'id'});});
  r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}));}
function tx(store,mode,fn){return db().then(d=>new Promise((res,rej)=>{const t=d.transaction(store,mode);const s=t.objectStore(store);const out=fn(s);t.oncomplete=()=>res(out instanceof IDBRequest?out.result:out);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||new Error('aborted'));}));}
const Store={
  put:(s,v)=>tx(s,'readwrite',o=>{o.put(v);return v;}),
  get:(s,id)=>tx(s,'readonly',o=>o.get(id)),
  all:(s)=>tx(s,'readonly',o=>o.getAll()),
  del:(s,id)=>tx(s,'readwrite',o=>o.delete(id)),
  clear:(s)=>tx(s,'readwrite',o=>o.clear()),
  uid:()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)),
  /* re-encode an image so orientation is applied and EXIF/location is dropped */
  async normalize(blobOrFile,maxSide,type){
    let bmp;
    try{bmp=await createImageBitmap(blobOrFile,{imageOrientation:'from-image'});}
    catch(e){bmp=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('Unsupported image'));i.src=URL.createObjectURL(blobOrFile);});}
    const w=bmp.width,h=bmp.height,k=Math.min(1,(maxSide||2000)/Math.max(w,h));
    const c=document.createElement('canvas');c.width=Math.round(w*k);c.height=Math.round(h*k);
    c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
    const blob=await new Promise(r=>c.toBlob(r,type||'image/jpeg',.9));
    return {blob,width:c.width,height:c.height};
  },
  img(blob){return new Promise((res,rej)=>{const u=URL.createObjectURL(blob);const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('bad image'));i.src=u;});},
};
window.InkStore=Store;
})();

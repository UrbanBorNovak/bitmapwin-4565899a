// Inline, zero-dependency BITMAP renderer for the self-contained Store Kit shops.
// Plain-JS port of src/lib/mondrian.ts (bitfeed packing by @mononaut) plus a
// LiveOCI check by @boppleton: each card asks the on-chain LiveOCI modules for the
// canonical first-is-first inscription of its block and shows the proof.
// Must stay byte-equivalent in behaviour to MondrianLayout.

export const OCI_CACHE_MODULE_ID = "970c183ec1e8cb10d25e53140b520bbda5dcf4381d830ea4dfda507b9af4f926i0";
export const LIVE_OCI_MODULE_ID = "0c18b83ca6aa6f5653bb57dafb491ac786b7fa738b6c5190f4542d1d7f15c43ai0";
/** bop's on-chain block parser that LiveOCI itself imports. */
export const BLOCK_PARSER_MODULE_ID = "bbbb2172ebca174579884df1ad7487196c39e860b3aacdf4e052a33bf5ec31fai0";
/** Blocks scanned per resumable chunk; progress is saved after each chunk. */
export const LIVE_SPAN = 12;

/** Expects globals: MZ = { base, cache, live, parser, span, cacheLast }. Defines window.BM.{draw,oci}. */
export const MOSAIC_JS = String.raw`
(function(){
function M(list){var w=0;for(var i=0;i<list.length;i++)w+=list[i]*list[i];this.w=Math.max(1,Math.ceil(Math.sqrt(w)));this.off=0;this.rows=[];this.slots=[];for(var j=0;j<list.length;j++)this.place(Math.max(1,list[j]))}
var P=M.prototype;
P.row=function(y){return this.rows[y-this.off]};
P.get=function(x,y){var r=this.row(y);return r?r.map[x]:undefined};
P.addRow=function(){var r={y:this.rows.length+this.off,slots:[],map:{}};this.rows.push(r);return r};
P.add=function(s){if(s.r<=0)return;var e=this.get(s.x,s.y);if(e){if(s.r>e.r)e.r=s.r;return e}var r=this.row(s.y);if(!r)return;var at=-1;for(var i=0;i<r.slots.length;i++)if(r.slots[i].x>s.x){at=i;break}if(at<0)r.slots.push(s);else r.slots.splice(at,0,s);r.map[s.x]=s;return s};
P.rm=function(s){var r=this.row(s.y);if(!r)return;delete r.map[s.x];var i=r.slots.indexOf(s);if(i>=0)r.slots.splice(i,1)};
P.fill=function(slot,sw){var sq={x:slot.x,y:slot.y,r:sw};this.rm(slot);
 for(var ri=slot.y;ri<slot.y+sw;ri++){var row=this.row(ri);
  if(row){var col=[],mx=0,ss=row.slots.slice();for(var k=0;k<ss.length;k++){var ts=ss[k];if(!(ts.x+ts.r<=sq.x||ts.x>=sq.x+sw)){col.push(ts);mx=Math.max(mx,Math.max(0,ts.x+ts.r-(slot.x+slot.r)))}}
   if(sq.x+sw<this.w&&!row.map[sq.x+sw])this.add({x:sq.x+sw,y:ri,r:slot.r-sw+mx});
   for(var c=0;c<col.length;c++){col[c].r=slot.x-col[c].x;if(col[c].r<=0)this.rm(col[c])}}
  else{this.addRow();if(slot.x>0)this.add({x:0,y:ri,r:slot.x});if(sq.x+sw<this.w)this.add({x:sq.x+sw,y:ri,r:this.w-(sq.x+sw)})}}
 for(var r2=Math.max(0,slot.y-sw);r2<slot.y;r2++){var rw=this.row(r2);if(!rw)continue;var s2=rw.slots.slice();
  for(var q=0;q<s2.length;q++){var t=s2[q];if(t.x<sq.x+sw&&t.x+t.r>sq.x&&t.y+t.r>=slot.y){var ow=t.r;t.r=slot.y-t.y;if(t.r<=0){this.rm(t);continue}
   var m={x:t.x+t.r,y:t.y,w:ow-t.r,h:t.r};while(m.w>0&&m.h>0){if(m.w<=m.h){this.add({x:m.x,y:m.y,r:m.w});m.y+=m.w;m.h-=m.w}else{this.add({x:m.x,y:m.y,r:m.h});m.x+=m.h;m.w-=m.h}}}}}
 return sq};
P.place=function(size){var sq=null;
 outer:for(var i=0;i<this.rows.length;i++){var ss=this.rows[i].slots.slice();for(var j=0;j<ss.length;j++)if(ss[j].r>=size){sq=this.fill(ss[j],size);break outer}}
 if(!sq){var nr=this.addRow(),s={x:0,y:nr.y,r:this.w};nr.slots.push(s);nr.map[0]=s;sq=this.fill(s,size)}
 this.slots.push(sq)};
function draw(el,h){var cv=document.createElement('canvas');cv.width=cv.height=512;cv.setAttribute('aria-label',h+'.bitmap');
 return fetch(MZ.base+'/api/public/blocks/'+h).then(function(r){if(!r.ok)throw 0;return r.arrayBuffer()}).then(function(b){
  var u=new Uint8Array(b),cls=[];for(var i=0;i<u.length;i++)cls.push(Math.max(1,Math.min(8,u[i]||1)));if(!cls.length)throw 0;
  var L=new M(cls),W=L.w,s=512/W,x=cv.getContext('2d'),ac='#f7931a';
  x.fillStyle='#050607';x.fillRect(0,0,512,512);
  for(var k=0;k<L.slots.length;k++){var q=L.slots[k],g=s>=3?Math.max(.5,s*.08):0;x.fillStyle=ac;x.globalAlpha=1;
   x.fillRect(q.x*s+g/2,q.y*s+g/2,q.r*s-g,q.r*s-g)}
  x.globalAlpha=1;el.innerHTML='';el.appendChild(cv);el.classList.add('m');
  var t=document.createElement('span');t.className='tx';t.textContent=cls.length.toLocaleString('en-US')+' TX';el.appendChild(t)}).catch(function(){})}
var O=/ordinals\.com$/.test(location.hostname)?'':'https://ordinals.com',mods={},jobs={};
function mod(id){if(!mods[id])mods[id]=import(O+'/content/'+id+(O?'?origin='+O:''));return mods[id]}
/* Resumable progress per height: {id} once found, else {next} = first unscanned block.
   Only a found id is proof; an unfinished scan is never a verdict. */
function rd(h){try{return JSON.parse(localStorage.getItem('bmoci:'+h)||'null')}catch(e){return null}}
function wr(h,v){try{localStorage.setItem('bmoci:'+h,JSON.stringify(v))}catch(e){}}
/* One block download at a time across the page, so cards and scrolling stay smooth. */
var lane=Promise.resolve();function serial(f){var p=lane.then(f,f);lane=p.then(function(){},function(){});return p}
/* Above the cache: LiveOCI's own rule, run here because its block parser import
   carries no ?origin and 404s outside ordinals.com. First inscription whose body is
   exactly "<h>.bitmap", complete, no content encoding, no delegate; block h onward.
   Scans MZ.span blocks per chunk, saves progress, yields, then resumes until found or tip. */
function live(h,cb){var st=rd(h)||{next:h};if(st.id)return Promise.resolve({state:'found',id:st.id});
 return mod(MZ.parser).then(function(P){var want=P.toHex(new TextEncoder().encode(h+'.bitmap'));
  function chunk(){var end=st.next+MZ.span;
   function one(n){if(n>=end){wr(h,st);cb&&cb({state:'scanning',next:n});return new Promise(function(r){setTimeout(r,250)}).then(chunk)}
    return serial(function(){return P.fetchBlock(n,{classify:false,locate:false})}).then(function(b){
     var L=P.listInscriptions(b);for(var i=0;i<L.length;i++){var x=L[i];if(x.bodyHex===want&&x.complete===true&&!x.contentEncoding&&!x.delegate){wr(h,{id:x.id});return{state:'found',id:x.id}}}
     st.next=n+1;return one(n+1)},function(e){wr(h,st);if(String(e&&e.message).indexOf('404')>=0)return{state:'none',next:n};return{state:'fail',next:n}})}
   return one(st.next)}
  return chunk()})}
/* check(h,cb) → {state:'found',id} | {state:'none'} (no claim up to the tip yet) | {state:'fail'} (lookup broke; retry resumes). */
function check(h,cb){var k=String(h);if(jobs[k])return jobs[k];
 var p=(h<=MZ.cacheLast?mod(MZ.cache).then(function(m){return m.getBitmapInscriptionId(h)}).then(function(id){return id?{state:'found',id:id}:{state:'none'}}):live(h,cb))
  .catch(function(){return{state:'fail'}}).then(function(r){if(r.state!=='found')delete jobs[k];return r});
 return jobs[k]=p}
function oci(h){return check(h).then(function(r){return r.state==='found'?r.id:null})}
window.BM={draw:draw,oci:oci,check:check};
})();
`;

/** Card mosaic + LiveOCI badge styles shared by both shop kinds. */
export const MOSAIC_CSS = `.v{position:relative}.v.m{display:block}.v canvas{width:100%;height:100%;display:block;image-rendering:pixelated}.v .tx{position:absolute;left:8px;bottom:8px;font:700 10px ui-monospace,monospace;letter-spacing:.12em;background:#000b;color:var(--fg);padding:3px 6px;border-radius:4px}
.o{display:inline-block;margin-top:8px;font:700 10px ui-monospace,monospace;letter-spacing:.08em;padding:3px 7px;border-radius:4px;border:1px solid var(--ln);color:var(--mut);text-decoration:none}.o.ok{border-color:#22d3ee88;color:#22d3ee}.o.bad{border-color:#ff4d6d88;color:#ff4d6d}`;

export function mosaicConfig(base: string, cacheLast = 969_999): string {
  return JSON.stringify({ base, cache: OCI_CACHE_MODULE_ID, live: LIVE_OCI_MODULE_ID, parser: BLOCK_PARSER_MODULE_ID, span: LIVE_SPAN, cacheLast });
}

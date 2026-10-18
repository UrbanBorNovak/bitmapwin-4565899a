/**
 * TINY STUDIO — a self-contained WebGL voxel viewer + editor in one HTML file,
 * small enough to inscribe. Builds are BWVX1 (4 bytes/block [x,y,z,kind]) on
 * the 64³ canvas, palette = BLOCKS order, so Land Forge reads them unchanged.
 * The file needs no network: a block height seeds the starter terrain, and an
 * embedded payload (data-b) makes the same file a self-rendering viewer.
 */
import { BLOCKS } from "@/lib/voxel-world";

export const STUDIO_SPAN = 64;
/** On-chain LiveOCI sat cache module (getBitmapInscriptionId), imported by relative path on ordinals.com. */
const OCI_MODULE = "970c183ec1e8cb10d25e53140b520bbda5dcf4381d830ea4dfda507b9af4f926i0";

/** Deterministic starter ground for a block height (same maths as the inline JS). */
export function seedTerrain(height: number): number[][] {
  let s = (height * 2654435761) >>> 0;
  const r = () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 1) >>> 0) / 4294967296);
  const a = r() * 6, b = r() * 6, out: number[][] = [];
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) {
    const h = Math.max(1, 1 + Math.floor(1.5 + Math.sin(x / 9 + a) + Math.cos(z / 11 + b)));
    for (let y = 0; y < h; y++) out.push([x, y, z, y === h - 1 ? 0 : 1]);
  }
  return out;
}

export function packBwvx1(blocks: number[][]): Uint8Array {
  const o = new Uint8Array(blocks.length * 4);
  blocks.forEach((b, i) => o.set(b.slice(0, 4), i * 4));
  return o;
}

export function unpackBwvx1(bytes: Uint8Array): number[][] {
  const out: number[][] = [];
  for (let i = 0; i + 3 < bytes.length; i += 4) {
    const [x, y, z, k] = [bytes[i]!, bytes[i + 1]!, bytes[i + 2]!, bytes[i + 3]!];
    if (x < 64 && y < 64 && z < 64 && k < BLOCKS.length) out.push([x, y, z, k]);
  }
  return out;
}

const esc = (s: string) => s.replace(/[^A-Za-z0-9+/=]/g, "");

/** bitmapId: optional pre-resolved BITMAP inscription id for `height`, used only when the on-chain OCI module cannot run (e.g. off ordinals.com). */
export function buildTinyStudioHtml(opts: { height?: number; payload?: string; bitmapId?: string | undefined } = {}): string {
  const h = Math.max(0, Math.floor(opts.height ?? 840000));
  const pal = JSON.stringify(BLOCKS.map((b) => b.top));
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="bitmapwin" content="BWVX1;${h};studio"><title>${h}.bitmap · Tiny Studio</title><style>
html,body{margin:0;height:100%;background:#0b0d10;color:#e8e8e8;font:12px monospace;overflow:hidden}canvas{width:100%;height:100%;display:block;touch-action:none}
#u{position:fixed;left:8px;top:8px;display:flex;flex-wrap:wrap;gap:4px;max-width:96vw}#u *{font:inherit}button,input{background:#14171c;color:#e8e8e8;border:1px solid #2a2f37;border-radius:4px;padding:4px 6px}
button.on{border-color:#f7931a;color:#f7931a}.s{width:20px;height:20px;padding:0}#i{position:fixed;left:8px;bottom:8px;right:8px;opacity:.75}#j{position:fixed;left:16px;bottom:40px;width:110px;height:110px;border:1px solid #2a2f37;border-radius:50%;display:none;pointer-events:none}#j.w{display:block}
</style></head><body><canvas id="c"></canvas><div id="u"><input id="h" type="number" value="${h}" style="width:80px"><button id="g">SEED</button><input id="q" placeholder="block # or id" style="width:150px"><button id="f">FETCH ON-CHAIN</button><button id="n">VIEW: ORBIT</button><button id="t0" class="t">LOOK</button><button id="t1" class="t on">PLACE</button><button id="t2" class="t">ERASE</button><span id="p"></span><button id="x">EXPORT .BWVX</button><button id="v">SAVE .HTML</button></div><div id="j"></div><div id="i"></div>
<script id="d" type="text/plain" data-b="${esc(opts.payload ?? "")}"${opts.bitmapId && /^[0-9a-f]{64}i\d+$/.test(opts.bitmapId) ? ` data-i="${opts.bitmapId}" data-ih="${h}"` : ""}></script><script>
const P=${pal},C=document.getElementById('c'),G=C.getContext('webgl',{antialias:true}),$=i=>document.getElementById(i);
let S=64,V=new Map,K=0,T=1,W=0,H=+document.querySelector('meta[name=bitmapwin]').content.split(';')[1]||0,yaw=.8,pit=.6,dist=90,tx=32,ty=4,tz=32,dirty=1,wx=32,wy=20,wz=32,wyaw=0,wpit=-.2,jx=0,jy=0;const KD={};
const key=(x,y,z)=>x+','+y+','+z;
function seed(h){V.clear();S=64;tx=tz=32;let s=(h*2654435761)>>>0;const r=()=>((s=(Math.imul(s^(s>>>15),2246822507)+1)>>>0)/4294967296);const a=r()*6,b=r()*6;
for(let x=0;x<S;x++)for(let z=0;z<S;z++){const t=Math.max(1,1+Math.floor(1.5+Math.sin(x/9+a)+Math.cos(z/11+b)));for(let y=0;y<t;y++)V.set(key(x,y,z),y==t-1?0:1)}dirty=1}
function D(b,f){const r=atob(b),c=i=>r.charCodeAt(i);if(c(0)==66&&c(1)==87&&c(2)==50&&c(3)==0){for(let i=4;i+6<r.length;i+=7)for(let x=c(i);x<=c(i+3);x++)for(let y=c(i+1);y<=c(i+4);y++)for(let z=c(i+2);z<=c(i+5);z++)f(x,y,z,c(i+6))}else for(let i=0;i+3<r.length;i+=4)f(c(i),c(i+1),c(i+2),c(i+3))}
function load(b,sp){V.clear();const A=b.map?b:[];b.map||D(b,(...v)=>A.push(v));S=sp||(A.some(v=>v[0]>63||v[1]>63||v[2]>63)?128:64);tx=tz=S/2;dist=S*1.4;
for(const[x,y,z,k]of A)if(x<S&&y<S&&z<S&&k<P.length)V.set(key(x,y,z),k);dirty=1}
function pack(){let s=S>64?'BW2\\0':'';for(const[k,v]of V){const[x,y,z]=k.split(',').map(Number);s+=S>64?String.fromCharCode(x,y,z,x,y,z,v):String.fromCharCode(x,y,z,v)}return s}
const sh=(t,src)=>{const s=G.createShader(t);G.shaderSource(s,src);G.compileShader(s);return s},pr=G.createProgram();
G.attachShader(pr,sh(G.VERTEX_SHADER,'attribute vec3 p;attribute vec3 c;uniform mat4 m;varying vec3 v;varying float f;void main(){gl_Position=m*vec4(p,1.);v=c;f=gl_Position.z;}'));
G.attachShader(pr,sh(G.FRAGMENT_SHADER,'precision mediump float;varying vec3 v;varying float f;void main(){gl_FragColor=vec4(mix(v,vec3(.043,.051,.063),clamp((f-60.)/160.,0.,.7)),1.);}'));
G.linkProgram(pr);G.useProgram(pr);const bf=G.createBuffer(),ap=G.getAttribLocation(pr,'p'),ac=G.getAttribLocation(pr,'c'),um=G.getUniformLocation(pr,'m');let N=0;
const F=[[1,0,0,.8],[-1,0,0,.65],[0,1,0,1],[0,-1,0,.45],[0,0,1,.72],[0,0,-1,.58]];
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
function mesh(){const a=[];const quad=(x,y,z,d,c)=>{const[nx,ny,nz]=d,u=nx?[0,1,0]:[1,0,0],w=nz?[0,1,0]:ny?[0,0,1]:[0,0,1];const o=[x+(nx>0),y+(ny>0),z+(nz>0)];const q=[[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]];for(const[i,j]of q)a.push(o[0]+u[0]*i+w[0]*j,o[1]+u[1]*i+w[1]*j,o[2]+u[2]*i+w[2]*j,c[0]*d[3],c[1]*d[3],c[2]*d[3])};
for(const[k,v]of V){const[x,y,z]=k.split(',').map(Number),c=rgb(P[v]);for(const d of F)if(!V.has(key(x+d[0],y+d[1],z+d[2])))quad(x,y,z,d,c)}
const g=[.11,.13,.16];for(const[i,j]of[[0,0],[S,0],[S,S],[0,0],[S,S],[0,S]])a.push(i,-.01,j,...g);
G.bindBuffer(G.ARRAY_BUFFER,bf);G.bufferData(G.ARRAY_BUFFER,new Float32Array(a),G.STATIC_DRAW);N=a.length/6;dirty=0;hud()}
function hud(){$('i').textContent=(typeof M=='string'?M:'')+H+'.bitmap · '+V.size+' blocks · '+(S>64?'XL 128³ · ':'')+(W?'WALK: WASD/pad to move · drag to look':'ORBIT: drag to turn · pinch/wheel zoom')+' · tap/click = '+['look only','place','erase'][T]}
function view(){if(W)return{e:[wx,wy,wz],f:[Math.cos(wpit)*Math.cos(wyaw),Math.sin(wpit),Math.cos(wpit)*Math.sin(wyaw)]};const e=[tx+dist*Math.cos(pit)*Math.cos(yaw),ty+dist*Math.sin(pit),tz+dist*Math.cos(pit)*Math.sin(yaw)];return{e,f:[tx-e[0],ty-e[1],tz-e[2]]}}
function eye(){return view().e}
function mat(){const w=C.width,h=C.height,{e,f}=view(),n=v=>{const l=Math.hypot(...v);return v.map(x=>x/l)},cr=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const z=n(f.map(x=>-x)),x=n(cr([0,1,0],z)),y=cr(z,x),t=1/Math.tan(.5),a=w/h,nr=.5,fr=500;const dt=v=>-(v[0]*e[0]+v[1]*e[1]+v[2]*e[2]);
const Vw=[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,dt(x),dt(y),dt(z),1],Pm=[t/a,0,0,0,0,t,0,0,0,0,(fr+nr)/(nr-fr),-1,0,0,2*fr*nr/(nr-fr),0],o=new Float32Array(16);
for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=Pm[k*4+j]*Vw[i*4+k];o[i*4+j]=s}return{o,x,y,z,t,a}}
function draw(){const r=devicePixelRatio>2?2:devicePixelRatio,w=C.clientWidth*r|0,h=C.clientHeight*r|0;if(C.width!=w||C.height!=h){C.width=w;C.height=h}
step();if(dirty)mesh();G.viewport(0,0,w,h);G.clearColor(.043,.051,.063,1);G.clear(16640);G.enable(G.DEPTH_TEST);G.bindBuffer(G.ARRAY_BUFFER,bf);
G.enableVertexAttribArray(ap);G.vertexAttribPointer(ap,3,G.FLOAT,0,24,0);G.enableVertexAttribArray(ac);G.vertexAttribPointer(ac,3,G.FLOAT,0,24,12);G.uniformMatrix4fv(um,0,mat().o);G.drawArrays(G.TRIANGLES,0,N);requestAnimationFrame(draw)}
let lt=0;const solid=(x,y,z)=>V.has(key(Math.floor(x),Math.floor(y),Math.floor(z)));
function ground(x,z,top){for(let y=Math.min(S-1,Math.floor(top));y>=0;y--)if(solid(x,y,z))return y+1;return 0}
function step(){const n=performance.now(),dt=Math.min(.05,(n-lt)/1e3||0);lt=n;if(!W)return;
let f=(KD.KeyW||KD.ArrowUp?1:0)-(KD.KeyS||KD.ArrowDown?1:0)-jy,r=(KD.KeyD||KD.ArrowRight?1:0)-(KD.KeyA||KD.ArrowLeft?1:0)+jx;const l=Math.hypot(f,r);if(l>1){f/=l;r/=l}
const sp=(KD.ShiftLeft?14:7)*dt,c=Math.cos(wyaw),s=Math.sin(wyaw),feet=wy-1.6;
const nx=Math.max(.3,Math.min(S-.3,wx+(c*f-s*r)*sp)),nz=Math.max(.3,Math.min(S-.3,wz+(s*f+c*r)*sp));
const ok=(x,z)=>ground(x,z,feet+1.2)<=feet+1.05&&!solid(x,feet+1.2,z);if(ok(nx,wz))wx=nx;if(ok(wx,nz))wz=nz;
const g=ground(wx,wz,feet+1.2)+1.6;wy+=(g-wy)*(1-Math.exp(-12*dt))}
function pick(px,py){const m=mat(),r=C.getBoundingClientRect(),u=((px-r.left)/r.width*2-1)*m.a/m.t,v=(1-(py-r.top)/r.height*2)/m.t,o=eye();
let d=[0,1,2].map(i=>m.x[i]*u+m.y[i]*v-m.z[i]);const l=Math.hypot(...d);d=d.map(q=>q/l);let p=[...o],prev=null;
for(let s=0;s<1200;s++){const c=p.map(Math.floor);if(c[1]<0&&prev&&prev[0]>=0&&prev[0]<S&&prev[2]>=0&&prev[2]<S)return{hit:null,prev};if(V.has(key(...c)))return{hit:c,prev};prev=c;p=p.map((q,i)=>q+d[i]*.15)}return null}
function edit(px,py){if(!T)return;const r=pick(px,py);if(!r)return;if(T==2&&r.hit){if(r.hit[1]>0||V.size>1)V.delete(key(...r.hit))}else if(T==1&&r.prev){const[x,y,z]=r.prev;if(x>=0&&x<S&&y>=0&&y<S&&z>=0&&z<S&&!(W&&x==Math.floor(wx)&&z==Math.floor(wz)&&y>=Math.floor(wy-1.6)&&y<=Math.floor(wy)))V.set(key(x,y,z),K)}dirty=1}
const PT=new Map;let pinch=0;
C.onpointerdown=e=>{C.setPointerCapture(e.pointerId);const rc=C.getBoundingClientRect(),stick=W&&e.pointerType!='mouse'&&e.clientX-rc.left<rc.width*.4;PT.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,mv:0,stick});if(PT.size==2&&!W){const[a,b]=[...PT.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y)}};
C.onpointermove=e=>{const p=PT.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;p.mv+=Math.abs(dx)+Math.abs(dy);
if(p.stick){jx=Math.max(-1,Math.min(1,(p.x-p.sx)/50));jy=Math.max(-1,Math.min(1,(p.y-p.sy)/50));return}
if(PT.size==2&&!W){const[a,b]=[...PT.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)dist=Math.max(10,Math.min(220,dist*pinch/d));pinch=d;return}
if(W){wyaw+=dx*.006;wpit=Math.max(-1.4,Math.min(1.4,wpit-dy*.006))}else{yaw+=dx*.008;pit=Math.max(.05,Math.min(1.5,pit+dy*.008))}};
C.onpointerup=C.onpointercancel=e=>{const p=PT.get(e.pointerId);PT.delete(e.pointerId);if(PT.size<2)pinch=0;if(!p)return;if(p.stick){jx=jy=0;if(p.mv>=6)return}if(p.mv<6&&e.type=='pointerup')edit(e.clientX,e.clientY)};
C.onwheel=e=>{e.preventDefault();if(!W)dist=Math.max(10,Math.min(220,dist*(e.deltaY>0?1.1:.9)))};
onkeydown=e=>{if(e.target.tagName=='INPUT')return;KD[e.code]=1;if(e.key=='1'||e.key=='2'||e.key=='3')tool(+e.key-1);if(e.key=='v'||e.key=='V')$('n').click()};onkeyup=e=>{KD[e.code]=0};onblur=()=>{for(const k in KD)KD[k]=0};
function tool(i){T=i;document.querySelectorAll('.t').forEach((b,j)=>b.classList.toggle('on',j==i));hud()}[0,1,2].forEach(i=>$('t'+i).onclick=()=>tool(i));
$('n').onclick=()=>{W^=1;if(W){wx=wz=S/2;wyaw=yaw+Math.PI;wpit=-.2;wy=ground(wx,wz,S)+1.6}jx=jy=0;$('n').textContent='VIEW: '+(W?'WALK':'ORBIT');$('j').className=W&&matchMedia('(pointer:coarse)').matches?'w':'';hud()};
$('p').innerHTML='';P.forEach((c,i)=>{const b=document.createElement('button');b.className='s'+(i?'':' on');b.style.background=c;b.onclick=()=>{K=i;document.querySelectorAll('.s').forEach(q=>q.classList.remove('on'));b.classList.add('on')};$('p').append(b)});
$('g').onclick=()=>{H=Math.max(0,+$('h').value|0);seed(H)};
let M='';const say=t=>{M=t+' · ';hud()},O=location.hostname=='ordinals.com'?'':'https://ordinals.com',J=u=>fetch(O+u).then(r=>{if(!r.ok)throw 0;return r.json()});
function grab(t){const m=t.match(/data-b="([A-Za-z0-9+/=]+)"/)||t.match(/<script id="bwvx"[^>]*data-format="BWVX[12]"[^>]*>([A-Za-z0-9+/=\\s]+)<\\/script>/);return m?m[1].replace(/\\s/g,''):null}
function cb(b){let i=0;const L=a=>a<24?a:a==24?b[i++]:a==25?(i+=2,b[i-2]<<8|b[i-1]):a==26?(i+=4,(b[i-4]<<24>>>0)+(b[i-3]<<16)+(b[i-2]<<8)+b[i-1]):0;
const I=()=>{const x=b[i++],t=x>>5,a=x&31;if(t==0)return L(a);if(t==1)return-1-L(a);if(t==2||t==3){if(a==31){let s=t==3?"":[];while(b[i]!=255){const c=I();t==3?s+=c:s.push(...c)}i++;return s}const n=L(a),s=b.slice(i,i+n);i+=n;return t==3?new TextDecoder().decode(s):Array.from(s)}
if(t==4){const n=L(a),r=[];for(let k=0;k<n;k++)r.push(I());return r}if(t==5){const n=L(a),o={};for(let k=0;k<n;k++){const q=I();o[q]=I()}return o}return null};return I()}
async function fromId(id,dp){try{const h=(await J('/r/metadata/'+id)).replace(/[^0-9a-f]/gi,''),b=new Uint8Array(h.length/2);for(let k=0;k<b.length;k++)b[k]=parseInt(h.substr(k*2,2),16);const o=cb(b);if(o&&(o.d||o.b))return o.d||o.b}catch(e){}
try{const r=await fetch(O+'/content/'+id);if(!r.ok||!(r.headers.get('content-type')||'').includes('html'))return null;const t=await r.text(),a=!dp&&t.match(/<script id="bwvx-asm"([^>]*)>([A-Za-z0-9+/=\\s]*)</);if(!a)return grab(t);const g=n=>(a[1].match(RegExp('data-'+n+'="([^"]*)"'))||[])[1]||'',sp=+g('span')||64,own=a[2].replace(/\\s/g,''),o=[],n=0;if(own)D(own,(...v)=>o.push(v));const ps=g('parts').split(';').filter(Boolean).slice(0,32);
await Promise.all(ps.map(async seg=>{const[pid,pos]=seg.split('@'),[px,py,pz,q]=pos.split(',').map(Number),pb=await fromId(pid,1);if(typeof pb!='string')return;o.c=-~o.c;let B=[];D(pb,(...v)=>B.push(v));
const mn=j=>Math.min(...B.map(v=>v[j])),m0=mn(0),m1=mn(1),m2=mn(2);B=B.map(v=>[v[0]-m0,v[1]-m1,v[2]-m2,v[3]]);for(let k=0;k<(q%4+4)%4;k++){const m=Math.max(...B.map(v=>v[0]));B=B.map(v=>[v[2],v[1],m-v[0],v[3]])}
for(const v of B){const x=v[0]+px,y=v[1]+py,z=v[2]+pz;if(x<sp&&y<sp&&z<sp)o.push([x,y,z,v[3]])}}));return{a:o,s:sp,n:~~o.c+'/'+ps.length}}catch(e){return null}}
async function fetchBuild(){const q=$('q').value.trim();try{let ids=[q];if(!/^[0-9a-f]{64}i\\d+$/.test(q)){H=Math.max(0,+q|0||+$('h').value|0);$('h').value=H;say('looking up '+H+'.bitmap on chain…');
const bid=await(async()=>{try{const m=await import(O+'/content/${OCI_MODULE}');return await m.getBitmapInscriptionId(H)}catch(e){const d=$('d').dataset;if(d.ih==H)return d.i;if(parent!==window)return await new Promise(ok=>{const f=v=>{if(v.data&&v.data.tsH==H){removeEventListener('message',f);ok(v.data.tsId)}};addEventListener('message',f);parent.postMessage({tsAsk:H},'*');setTimeout(()=>ok(null),9e3)});throw e}})();if(!bid)throw 0;const ins=await J('/r/inscription/'+bid),at=await J('/r/sat/'+ins.sat+'/at/-1');ids=[at.id];
try{const l=await J('/r/sat/'+ins.sat);ids.push(...(l.ids||[]).reverse())}catch(e){}ids=[...new Set(ids)].filter(i=>i&&i!=bid).slice(0,8);if(!ids.length){seed(H);say(H+'.bitmap has no build yet · starter ground loaded');return}}
for(const id of ids){say('reading '+id.slice(0,10)+'…');const b=await fromId(id);if(b){b.a?load(b.a,b.s):load(b);say('loaded on-chain build '+id.slice(0,10)+'…'+(b.n?' · '+b.n+' pieces':'')+' · edit and SAVE');return}}
say('no build found · starter ground kept')}catch(e){say('ordinals.com unreachable · starter ground kept')}}
$('f').onclick=fetchBuild;
const save=(data,name,type)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click()};
$('x').onclick=()=>{const s=pack(),b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);save(b,H+'.bwvx','application/octet-stream')};
$('v').onclick=()=>{const html='<!doctype html>'+document.documentElement.outerHTML.replace(/data-b="[^"]*"/,'data-b="'+btoa(pack())+'"').replace(/content="BWVX[12];\\d+/,'content="BWVX'+(S>64?2:1)+';'+H);save(html,H+'.bitmap-build.html','text/html')};
$('h').value=H;const b0=$('d').dataset.b;if(b0)load(b0);else{seed(H);$('q').value=H;fetchBuild()}draw();
</script></body></html>`;
}

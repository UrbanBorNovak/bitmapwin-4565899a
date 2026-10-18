/**
 * TINY STUDIO — a self-contained WebGL voxel viewer + editor in one HTML file,
 * small enough to inscribe. Builds are BWVX1 (4 bytes/block [x,y,z,kind]) on
 * the 64³ canvas, palette = BLOCKS order, so Land Forge reads them unchanged.
 * The file needs no network: a block height seeds the starter terrain, and an
 * embedded payload (data-b) makes the same file a self-rendering viewer.
 */
import { BLOCKS } from "@/lib/voxel-world";

export const STUDIO_SPAN = 64;

/** Deterministic starter ground for a block height (same maths as the inline JS). */
export function seedTerrain(height: number): number[][] {
  let s = (height * 2654435761) >>> 0;
  const r = () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 1) >>> 0) / 4294967296);
  const a = r() * 6, b = r() * 6, out: number[][] = [];
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) {
    const h = 1 + Math.floor(1.5 + Math.sin(x / 9 + a) + Math.cos(z / 11 + b));
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

export function buildTinyStudioHtml(opts: { height?: number; payload?: string } = {}): string {
  const h = Math.max(0, Math.floor(opts.height ?? 840000));
  const pal = JSON.stringify(BLOCKS.map((b) => b.top));
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="bitmapwin" content="BWVX1;${h};studio"><title>${h}.bitmap · Tiny Studio</title><style>
html,body{margin:0;height:100%;background:#0b0d10;color:#e8e8e8;font:12px monospace;overflow:hidden}canvas{width:100%;height:100%;display:block;touch-action:none}
#u{position:fixed;left:8px;top:8px;display:flex;flex-wrap:wrap;gap:4px;max-width:96vw}#u *{font:inherit}button,input{background:#14171c;color:#e8e8e8;border:1px solid #2a2f37;border-radius:4px;padding:4px 6px}
button.on{border-color:#f7931a;color:#f7931a}.s{width:20px;height:20px;padding:0}#i{position:fixed;left:8px;bottom:8px;opacity:.7}
</style></head><body><canvas id="c"></canvas><div id="u"><input id="h" type="number" value="${h}" style="width:80px"><button id="g">SEED</button><button id="m" class="on">PLACE</button><span id="p"></span><button id="x">EXPORT .BWVX</button><button id="v">SAVE .HTML</button></div><div id="i"></div>
<script id="d" type="text/plain" data-b="${esc(opts.payload ?? "")}"></script><script>
const P=${pal},S=64,C=document.getElementById('c'),G=C.getContext('webgl',{antialias:true}),$=i=>document.getElementById(i);
let V=new Map,K=0,E=0,H=${h},yaw=.8,pit=.6,dist=90,tx=32,ty=4,tz=32,dirty=1;
const key=(x,y,z)=>x+','+y+','+z;
function seed(h){V.clear();let s=(h*2654435761)>>>0;const r=()=>((s=(Math.imul(s^(s>>>15),2246822507)+1)>>>0)/4294967296);const a=r()*6,b=r()*6;
for(let x=0;x<S;x++)for(let z=0;z<S;z++){const t=1+Math.floor(1.5+Math.sin(x/9+a)+Math.cos(z/11+b));for(let y=0;y<t;y++)V.set(key(x,y,z),y==t-1?0:1)}dirty=1}
function load(b64){V.clear();const r=atob(b64);for(let i=0;i+3<r.length;i+=4){const x=r.charCodeAt(i),y=r.charCodeAt(i+1),z=r.charCodeAt(i+2),k=r.charCodeAt(i+3);if(x<S&&y<S&&z<S&&k<P.length)V.set(key(x,y,z),k)}dirty=1}
function pack(){let s='';for(const[k,v]of V){const[x,y,z]=k.split(',');s+=String.fromCharCode(+x,+y,+z,v)}return s}
const sh=(t,src)=>{const s=G.createShader(t);G.shaderSource(s,src);G.compileShader(s);return s},pr=G.createProgram();
G.attachShader(pr,sh(G.VERTEX_SHADER,'attribute vec3 p;attribute vec3 c;uniform mat4 m;varying vec3 v;varying float f;void main(){gl_Position=m*vec4(p,1.);v=c;f=gl_Position.z;}'));
G.attachShader(pr,sh(G.FRAGMENT_SHADER,'precision mediump float;varying vec3 v;varying float f;void main(){gl_FragColor=vec4(mix(v,vec3(.043,.051,.063),clamp((f-60.)/160.,0.,.7)),1.);}'));
G.linkProgram(pr);G.useProgram(pr);const bf=G.createBuffer(),ap=G.getAttribLocation(pr,'p'),ac=G.getAttribLocation(pr,'c'),um=G.getUniformLocation(pr,'m');let N=0;
const F=[[1,0,0,.8],[-1,0,0,.65],[0,1,0,1],[0,-1,0,.45],[0,0,1,.72],[0,0,-1,.58]];
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
function mesh(){const a=[];const quad=(x,y,z,d,c)=>{const[nx,ny,nz]=d,u=nx?[0,1,0]:[1,0,0],w=nz?[0,1,0]:ny?[0,0,1]:[0,0,1];const o=[x+(nx>0),y+(ny>0),z+(nz>0)];const q=[[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]];for(const[i,j]of q)a.push(o[0]+u[0]*i+w[0]*j,o[1]+u[1]*i+w[1]*j,o[2]+u[2]*i+w[2]*j,c[0]*d[3],c[1]*d[3],c[2]*d[3])};
for(const[k,v]of V){const[x,y,z]=k.split(',').map(Number),c=rgb(P[v]);for(const d of F)if(!V.has(key(x+d[0],y+d[1],z+d[2])))quad(x,y,z,d,c)}
const g=[.11,.13,.16];for(const[i,j]of[[0,0],[S,0],[S,S],[0,0],[S,S],[0,S]])a.push(i,-.01,j,...g);
G.bindBuffer(G.ARRAY_BUFFER,bf);G.bufferData(G.ARRAY_BUFFER,new Float32Array(a),G.STATIC_DRAW);N=a.length/6;dirty=0;$('i').textContent=H+'.bitmap · '+V.size+' blocks · drag=orbit · wheel=zoom · click=edit'}
function eye(){return[tx+dist*Math.cos(pit)*Math.cos(yaw),ty+dist*Math.sin(pit),tz+dist*Math.cos(pit)*Math.sin(yaw)]}
function mat(){const w=C.width,h=C.height,e=eye(),f=[tx-e[0],ty-e[1],tz-e[2]],n=v=>{const l=Math.hypot(...v);return v.map(x=>x/l)},cr=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const z=n(f.map(x=>-x)),x=n(cr([0,1,0],z)),y=cr(z,x),t=1/Math.tan(.5),a=w/h,nr=.5,fr=500;const dt=v=>-(v[0]*e[0]+v[1]*e[1]+v[2]*e[2]);
const Vw=[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,dt(x),dt(y),dt(z),1],Pm=[t/a,0,0,0,0,t,0,0,0,0,(fr+nr)/(nr-fr),-1,0,0,2*fr*nr/(nr-fr),0],o=new Float32Array(16);
for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=Pm[k*4+j]*Vw[i*4+k];o[i*4+j]=s}return{o,x,y,z,t,a}}
function draw(){const r=devicePixelRatio>2?2:devicePixelRatio,w=C.clientWidth*r|0,h=C.clientHeight*r|0;if(C.width!=w||C.height!=h){C.width=w;C.height=h}
if(dirty)mesh();G.viewport(0,0,w,h);G.clearColor(.043,.051,.063,1);G.clear(16640);G.enable(G.DEPTH_TEST);G.bindBuffer(G.ARRAY_BUFFER,bf);
G.enableVertexAttribArray(ap);G.vertexAttribPointer(ap,3,G.FLOAT,0,24,0);G.enableVertexAttribArray(ac);G.vertexAttribPointer(ac,3,G.FLOAT,0,24,12);G.uniformMatrix4fv(um,0,mat().o);G.drawArrays(G.TRIANGLES,0,N);requestAnimationFrame(draw)}
function pick(px,py){const m=mat(),r=C.getBoundingClientRect(),u=((px-r.left)/r.width*2-1)*m.a/m.t,v=(1-(py-r.top)/r.height*2)/m.t,o=eye();
let d=[0,1,2].map(i=>m.x[i]*u+m.y[i]*v-m.z[i]);const l=Math.hypot(...d);d=d.map(q=>q/l);let p=[...o],prev=null;
for(let s=0;s<1200;s++){const c=p.map(Math.floor);if(c[1]<0&&prev&&prev[0]>=0&&prev[0]<S&&prev[2]>=0&&prev[2]<S)return{hit:null,prev};if(V.has(key(...c)))return{hit:c,prev};prev=c;p=p.map((q,i)=>q+d[i]*.15)}return null}
function edit(px,py){const r=pick(px,py);if(!r)return;if(E&&r.hit){if(r.hit[1]>0||V.size>1)V.delete(key(...r.hit))}else if(!E&&r.prev){const[x,y,z]=r.prev;if(x>=0&&x<S&&y>=0&&y<S&&z>=0&&z<S)V.set(key(x,y,z),K)}dirty=1}
let dn=null,mv=0;C.onpointerdown=e=>{dn=[e.clientX,e.clientY];mv=0;C.setPointerCapture(e.pointerId)};
C.onpointermove=e=>{if(!dn)return;const dx=e.clientX-dn[0],dy=e.clientY-dn[1];mv+=Math.abs(dx)+Math.abs(dy);yaw+=dx*.008;pit=Math.max(.05,Math.min(1.5,pit+dy*.008));dn=[e.clientX,e.clientY]};
C.onpointerup=e=>{if(dn&&mv<6)edit(e.clientX,e.clientY);dn=null};C.onwheel=e=>{e.preventDefault();dist=Math.max(10,Math.min(220,dist*(e.deltaY>0?1.1:.9)))};
P.forEach((c,i)=>{const b=document.createElement('button');b.className='s'+(i?'':' on');b.style.background=c;b.onclick=()=>{K=i;document.querySelectorAll('.s').forEach(q=>q.classList.remove('on'));b.classList.add('on')};$('p').append(b)});
$('m').onclick=()=>{E^=1;$('m').textContent=E?'ERASE':'PLACE'};$('g').onclick=()=>{H=Math.max(0,+$('h').value|0);seed(H)};
const save=(data,name,type)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click()};
$('x').onclick=()=>{const s=pack(),b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);save(b,H+'.bwvx','application/octet-stream')};
$('v').onclick=()=>{const html='<!doctype html>'+document.documentElement.outerHTML.replace(/data-b="[^"]*"/,'data-b="'+btoa(pack())+'"').replace(/content="BWVX1;\\d+/,'content="BWVX1;'+H);save(html,H+'.bitmap-build.html','text/html')};
const b0=$('d').dataset.b;b0?load(b0):seed(H);draw();
</script></body></html>`;
}

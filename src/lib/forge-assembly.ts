/**
 * BWVX_ASM — recursive Land Forge assemblies.
 *
 * An assembly inscription does not copy the voxels of the inscribed pieces it
 * uses. It lists them by inscription id + placement and the renderer pulls each
 * piece live from Bitcoin (/r/metadata/<id>, fallback /content/<id>). Only the
 * builder's own extra blocks travel as a BWVX1/BWVX2 payload. An optional baked
 * Guardian (the block's on-chain blueprint) perches on the build.
 *
 * Part list text: "<id>@x,y,z,r;<id>@x,y,z,r" (r = quarter turns, same rule as rotatePrefab).
 */
import { BLOCKS } from "@/lib/voxel-world";
import type { TplBlock } from "@/lib/voxel-templates";
import { FORGE_SPAN, FORGE_UNPACK_JS, encodeBuildBest } from "@/lib/voxel-populate";

export const FORGE_ASM_FORMAT = "BWVX_ASM";
export const MAX_ASM_PARTS = 32;
export type AsmPart = { id: string; x: number; y: number; z: number; r: number };

const ID_RE = /^[0-9a-f]{64}i\d+$/;
export const isInscriptionId = (s: string) => ID_RE.test(s.trim());

export function encodeParts(parts: AsmPart[]): string {
  return parts.slice(0, MAX_ASM_PARTS).map((p) => `${p.id}@${p.x},${p.y},${p.z},${((p.r % 4) + 4) % 4}`).join(";");
}

export function parseParts(s: string): AsmPart[] {
  const out: AsmPart[] = [];
  for (const seg of s.split(";")) {
    const [id, pos] = seg.split("@");
    if (!id || !pos || !ID_RE.test(id)) continue;
    const [x, y, z, r] = pos.split(",").map(Number);
    if ([x, y, z, r].some((n) => !Number.isInteger(n))) continue;
    out.push({ id, x: x!, y: y!, z: z!, r: r! });
    if (out.length >= MAX_ASM_PARTS) break;
  }
  return out;
}

/** Shift a piece so its lowest corner sits at 0,0,0 (renderer does the same). */
export function normPart(blocks: TplBlock[]): TplBlock[] {
  if (!blocks.length) return [];
  let mx = Infinity, my = Infinity, mz = Infinity;
  for (const b of blocks) { mx = Math.min(mx, b.dx); my = Math.min(my, b.dy); mz = Math.min(mz, b.dz); }
  return blocks.map((b) => ({ dx: b.dx - mx, dy: b.dy - my, dz: b.dz - mz, k: b.k }));
}

function rotate(blocks: TplBlock[], turns: number): TplBlock[] {
  let out = blocks;
  for (let t = 0; t < ((turns % 4) + 4) % 4; t++) {
    const maxX = Math.max(0, ...out.map((p) => p.dx));
    out = out.map((p) => ({ dx: p.dz, dy: p.dy, dz: maxX - p.dx, k: p.k }));
  }
  return out;
}

/** Places a part's (normalised) blocks at its placement, clipped to the 64³ canvas. */
export function placePart(blocks: TplBlock[], p: AsmPart): TplBlock[] {
  return rotate(normPart(blocks), p.r)
    .map((b) => ({ dx: b.dx + p.x, dy: b.dy + p.y, dz: b.dz + p.z, k: b.k }))
    .filter((b) => b.dx >= 0 && b.dy >= 0 && b.dz >= 0 && b.dx < FORGE_SPAN && b.dy < FORGE_SPAN && b.dz < FORGE_SPAN);
}

/** Compact baked Guardian: base64 of 10 bytes per voxel (see bakeGuardian). */
export type AsmGuardian = { data: string; at: [number, number, number] };

/** Self-rendering recursive assembly HTML. */
export function forgeAssemblyHtml(height: number, parts: AsmPart[], own: TplBlock[], guardian?: AsmGuardian | null, lineage = ""): string {
  const pal = BLOCKS.map((b) => [b.top, b.side]);
  const best = own.length ? encodeBuildBest(own) : { format: "BWVX1", data: "" };
  const list = encodeParts(parts);
  const lin = lineage.replace(/[^a-zA-Z0-9:,;._-]/g, "");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="bitmapwin" content="${FORGE_ASM_FORMAT};${height};assembly">${lin ? `<meta name="bitmapwin-lineage" content="${lin}">` : ""}<title>${height}.bitmap assembly</title><style>html,body{margin:0;height:100%;background:#07090d;color:#f7931a;font:12px monospace}canvas{width:100%;height:100%;display:block;touch-action:none}#m{position:fixed;left:12px;top:10px}</style></head><body><canvas id="c"></canvas><div id="m">ASSEMBLING FROM BITCOIN…</div><script id="bwvx-asm" type="text/plain" data-height="${height}" data-parts="${list}" data-format="${best.format}">${best.data}</script>${guardian ? `<script id="bwvx-guardian" type="text/plain" data-at="${guardian.at.join(",")}">${guardian.data}</script>` : ""}<script>
${FORGE_UNPACK_JS}
const P=${JSON.stringify(pal)},S=document.getElementById("bwvx-asm"),M=document.getElementById("m");let B=[],G=[],GA=[0,0,0],a=.6,drag=null,t0=performance.now();
function cb(b){let i=0;const L=a=>a<24?a:a==24?b[i++]:a==25?(i+=2,b[i-2]<<8|b[i-1]):a==26?(i+=4,(b[i-4]<<24>>>0)+(b[i-3]<<16)+(b[i-2]<<8)+b[i-1]):0;const I=()=>{const x=b[i++],t=x>>5,a=x&31;if(t==0)return L(a);if(t==1)return-1-L(a);if(t==2||t==3){const n=L(a),s=b.slice(i,i+n);i+=n;return t==3?new TextDecoder().decode(s):s}if(t==4){const n=L(a),r=[];for(let k=0;k<n;k++)r.push(I());return r}if(t==5){const n=L(a),o={};for(let k=0;k<n;k++){const key=I();o[key]=I()}return o}return null};return I()}
const OH=/ordinals/.test(location.host)?"":"https://ordinals.com";async function part(id){try{const r=await fetch(OH+"/r/metadata/"+id);if(r.ok){const h=(await r.json()).replace(/[^0-9a-f]/gi,"");const b=new Uint8Array(h.length/2);for(let k=0;k<b.length;k++)b[k]=parseInt(h.substr(k*2,2),16);const m=cb(b);const d=m&&(m.d||m.b);if(typeof d=="string")return U(atob(d))}}catch(e){}
try{const t=await(await fetch(OH+"/content/"+id)).text();const m=t.match(/<script id="bwvx"[^>]*>([A-Za-z0-9+\\/=\\s]+)<\\/script>/);if(m)return U(atob(m[1].trim()))}catch(e){}return[]}
function norm(V){if(!V.length)return V;let x=1e9,y=1e9,z=1e9;for(const v of V){x=Math.min(x,v[0]);y=Math.min(y,v[1]);z=Math.min(z,v[2])}return V.map(v=>[v[0]-x,v[1]-y,v[2]-z,v[3]])}
function rot(V,n){for(let t=0;t<(n%4+4)%4;t++){let mx=0;for(const v of V)mx=Math.max(mx,v[0]);V=V.map(v=>[v[2],v[1],mx-v[0],v[3]])}return V}
function sh(h,f){const n=parseInt(h.slice(1),16);return"rgb("+[(n>>16)&255,(n>>8)&255,n&255].map(v=>Math.round(v*f)).join(",")+")"}
const cv=document.getElementById("c"),g=cv.getContext("2d");
function cube(px,py,s,top,side,sx,sy,sz){g.fillStyle=top;g.beginPath();g.moveTo(px,py-s*sz);g.lineTo(px+s*sx,py-s*sz*.5);g.lineTo(px,py);g.lineTo(px-s*sx,py-s*sz*.5);g.fill()}
function draw(){const W=cv.width=innerWidth*devicePixelRatio,H=cv.height=innerHeight*devicePixelRatio,t=(performance.now()-t0)/1000;g.fillStyle="#07090d";g.fillRect(0,0,W,H);
const s=Math.min(W,H)/(64*1.9+8),ca=Math.cos(a),sa=Math.sin(a),c=32,L=[];
for(const b of B){const x=b[0]-c,z=b[2]-c;L.push([x*ca-z*sa,b[1],x*sa+z*ca,1,1,1,P[b[3]]||P[0],0])}
for(const v of G){let x=v[0],y=v[1],z=v[2];const pt=v[8],ph=v[9];if(pt==1)y+=Math.max(0,Math.sin(t*4+ph))*.5;else if(pt==2)y+=Math.abs(x)*Math.sin(t*5+ph)*.21;else if(pt==3)x+=Math.sin(t*2.2-ph)*(.25+ph*.18);else if(pt==4)y+=Math.sin(t*1.6)*.18;else if(pt==5){const q=ph+t*.6;x=Math.sin(q)*9;z=Math.cos(q)*9}
const k=.36,wx=GA[0]-c+x*k,wy=GA[1]+y*k+Math.sin(t*2)*.15,wz=GA[2]-c+z*k;L.push([wx*ca-wz*sa,wy,wx*sa+wz*ca,v[3]*k,v[4]*k,v[5]*k,[v[6],v[6]],v[7]])}
L.sort((p,q)=>(p[0]+p[2]+p[1]*.01)-(q[0]+q[2]+q[1]*.01));
for(const[x,y,z,w,h,d,col,gl]of L){const px=W/2+(x-z)*s,py=H*.6+(x+z)*s*.5-y*s,e=(w+d)/2;
g.fillStyle=sh(col[0],1+gl*.3);g.beginPath();g.moveTo(px,py-s*e);g.lineTo(px+s*e,py-s*e*.5);g.lineTo(px,py);g.lineTo(px-s*e,py-s*e*.5);g.fill();
g.fillStyle=sh(col[1],.8);g.beginPath();g.moveTo(px-s*e,py-s*e*.5);g.lineTo(px,py);g.lineTo(px,py+s*h);g.lineTo(px-s*e,py+s*h-s*e*.5);g.fill();
g.fillStyle=sh(col[1],.6);g.beginPath();g.moveTo(px+s*e,py-s*e*.5);g.lineTo(px,py);g.lineTo(px,py+s*h);g.lineTo(px+s*e,py+s*h-s*e*.5);g.fill()}}
addEventListener("pointerdown",e=>drag=e.clientX);addEventListener("pointerup",()=>drag=null);addEventListener("pointermove",e=>{if(drag!==null){a+=(e.clientX-drag)*.01;drag=e.clientX}});
function loop(){if(drag===null)a+=.004;draw();requestAnimationFrame(loop)}
(async()=>{const own=S.textContent.trim();if(own)B=U(atob(own));const parts=(S.dataset.parts||"").split(";").filter(Boolean);let n=0;
await Promise.all(parts.map(async seg=>{const[id,pos]=seg.split("@"),[x,y,z,r]=pos.split(",").map(Number);const V=rot(norm(await part(id)),r);if(V.length)n++;for(const v of V){const q=[v[0]+x,v[1]+y,v[2]+z,v[3]];if(q[0]<64&&q[1]<64&&q[2]<64)B.push(q)}}));
const gs=document.getElementById("bwvx-guardian");if(gs){GA=gs.dataset.at.split(",").map(Number);const r=atob(gs.textContent.trim()),C=r.charCodeAt.bind(r),sb=v=>(v>127?v-256:v)/4;const pal=[];let i=1;const np=C(0);for(let k=0;k<np;k++){pal.push("#"+[C(i),C(i+1),C(i+2)].map(v=>v.toString(16).padStart(2,"0")).join(""));i+=3}
for(;i+9<r.length+1;i+=10)G.push([sb(C(i)),sb(C(i+1)),sb(C(i+2)),C(i+3)/4,C(i+4)/4,C(i+5)/4,pal[C(i+6)]||"#f7931a",C(i+7)/20,C(i+8),C(i+9)/40])}
M.textContent="${height}.BITMAP · "+n+"/"+parts.length+" INSCRIBED PIECES · "+B.length+" BLOCKS"+(G.length?" · GUARDIAN":"")})();loop();
</script></body></html>`;
}

/** Reads the assembly tag from an inscription's HTML. */
export function parseAssemblyHtml(html: string): { height: number; parts: AsmPart[]; own: string } | null {
  const m = html.match(/<script id="bwvx-asm"[^>]*data-height="(\d+)"[^>]*data-parts="([^"]*)"[^>]*>([A-Za-z0-9+/=\s]*)<\/script>/);
  if (!m) return null;
  return { height: Number(m[1]), parts: parseParts(m[2]!), own: m[3]!.trim() };
}

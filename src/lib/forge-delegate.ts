/**
 * Land Forge master renderer (Tag 11 delegate).
 *
 * The master HTML is inscribed ONCE. Every build then inscribes no body at all:
 * Tag 11 points at the master, and the build bytes travel in Tag 5 metadata
 * (CBOR map { f:"BWVX1", h:<height>, d:<base64 BWVX1>, p?:"i;x0,z0,x1,z1", l?:lineage }).
 * ord serves the master's code for the build's own id, and the master reads
 * /r/metadata/<self> to draw it. Until the master is inscribed the studio keeps
 * inscribing the full self-rendering HTML.
 */
import { BLOCKS, type BlockId } from "@/lib/voxel-world";
import { FORGE_FORMAT } from "@/lib/voxel-populate";
import type { TplBlock } from "@/lib/voxel-templates";

/** The master renderer's inscription id (inscribed once; every delegated build points at it). */
export const FORGE_MASTER_DELEGATE_ID = "adc48ccd4b2c429c24bf37f44979c22bf14315f39578dbe02c2f33729555c827i0";

export type ForgeMeta = { f: string; h: number; d: string; p?: string; l?: string };

export function forgeDelegateMetadata(height: number, data: string, lineage = "", parcel?: { index: number; x0: number; z0: number; x1: number; z1: number }): ForgeMeta {
  return {
    f: FORGE_FORMAT,
    h: height,
    d: data,
    ...(parcel ? { p: `${parcel.index};${parcel.x0},${parcel.z0},${parcel.x1},${parcel.z1}` } : {}),
    ...(lineage ? { l: lineage.replace(/[^a-zA-Z0-9:,;._-]/g, "").slice(0, 400) } : {}),
  };
}

/** Minimal CBOR reader for the metadata ord returns (maps, text, ints, byte strings). */
export function readCbor(bytes: Uint8Array): unknown {
  let i = 0;
  const len = (ai: number): number => {
    if (ai < 24) return ai;
    if (ai === 24) return bytes[i++]!;
    if (ai === 25) { const v = (bytes[i]! << 8) | bytes[i + 1]!; i += 2; return v; }
    if (ai === 26) { const v = ((bytes[i]! << 24) >>> 0) + (bytes[i + 1]! << 16) + (bytes[i + 2]! << 8) + bytes[i + 3]!; i += 4; return v; }
    throw new Error("cbor: unsupported length");
  };
  const item = (): unknown => {
    const b = bytes[i++];
    if (b === undefined) throw new Error("cbor: eof");
    const mt = b >> 5, ai = b & 31;
    if (mt === 0) return len(ai);
    if (mt === 1) return -1 - len(ai);
    if (mt === 2 || mt === 3) {
      if (ai === 31) { // indefinite chunks
        const parts: Uint8Array[] = [];
        while (bytes[i] !== 0xff) { const c = item(); parts.push(typeof c === "string" ? new TextEncoder().encode(c) : (c as Uint8Array)); }
        i++;
        const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
        let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
        return mt === 3 ? new TextDecoder().decode(all) : all;
      }
      const n = len(ai), s = bytes.slice(i, i + n); i += n;
      return mt === 3 ? new TextDecoder().decode(s) : s;
    }
    if (mt === 4) { const n = len(ai), a: unknown[] = []; for (let k = 0; k < n; k++) a.push(item()); return a; }
    if (mt === 5) { const n = len(ai), o: Record<string, unknown> = {}; for (let k = 0; k < n; k++) { const key = String(item()); o[key] = item(); } return o; }
    if (b === 0xf4) return false;
    if (b === 0xf5) return true;
    if (b === 0xf6) return null;
    throw new Error("cbor: unsupported type");
  };
  return item();
}

export function parseForgeMeta(hexStr: string): ForgeMeta | null {
  try {
    const clean = hexStr.replace(/[^0-9a-f]/gi, "");
    const bytes = new Uint8Array(clean.length / 2);
    for (let k = 0; k < bytes.length; k++) bytes[k] = parseInt(clean.slice(k * 2, k * 2 + 2), 16);
    const m = readCbor(bytes) as Partial<ForgeMeta> | null;
    if (!m || m.f !== FORGE_FORMAT || typeof m.d !== "string" || typeof m.h !== "number") return null;
    return { f: m.f, h: m.h, d: m.d, ...(typeof m.p === "string" ? { p: m.p } : {}), ...(typeof m.l === "string" ? { l: m.l } : {}) };
  } catch {
    return null;
  }
}

/** Bytes saved per build compared with the standalone HTML. */
export function delegateSavings(fullHtml: string, meta: ForgeMeta) {
  const full = new TextEncoder().encode(fullHtml).length;
  const lean = new TextEncoder().encode(JSON.stringify(meta)).length + 40;
  return { full, lean, saved: Math.max(0, full - lean) };
}

/** The master renderer inscribed once; every delegated build runs this code. */
export function forgeMasterHtml(): string {
  const pal = BLOCKS.map((b) => [b.top, b.side]);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="bitmapwin" content="${FORGE_FORMAT};master"><title>BITMAPWIN Land Forge</title><style>html,body{margin:0;height:100%;background:#07090d;color:#f7931a;font:12px monospace}canvas{width:100%;height:100%;display:block;touch-action:none}#m{position:fixed;left:12px;top:10px}</style></head><body><canvas id="c"></canvas><div id="m">LOADING FROM BITCOIN…</div><script>
const P=${JSON.stringify(pal)},SELF=(location.pathname.match(/[0-9a-f]{64}i\\d+/)||[])[0],M=document.getElementById("m");
function cb(b){let i=0;const L=a=>a<24?a:a==24?b[i++]:a==25?(i+=2,b[i-2]<<8|b[i-1]):a==26?(i+=4,(b[i-4]<<24>>>0)+(b[i-3]<<16)+(b[i-2]<<8)+b[i-1]):0;
const I=()=>{const x=b[i++],t=x>>5,a=x&31;if(t==0)return L(a);if(t==1)return-1-L(a);if(t==2||t==3){if(a==31){let s=t==3?"":[];while(b[i]!=255){const c=I();t==3?s+=c:s.push(...c)}i++;return s}const n=L(a),s=b.slice(i,i+n);i+=n;return t==3?new TextDecoder().decode(s):Array.from(s)}
if(t==4){const n=L(a),r=[];for(let k=0;k<n;k++)r.push(I());return r}if(t==5){const n=L(a),o={};for(let k=0;k<n;k++){const key=I();o[key]=I()}return o}return null};return I()}
async function meta(){const r=await fetch("/r/metadata/"+SELF);if(!r.ok)return null;const h=(await r.json()).replace(/[^0-9a-f]/gi,"");const b=new Uint8Array(h.length/2);for(let k=0;k<b.length;k++)b[k]=parseInt(h.substr(k*2,2),16);return cb(b)}
let B=[],H="",a=.6,drag=null;
function sh(h,f){const n=parseInt(h.slice(1),16);return"rgb("+[(n>>16)&255,(n>>8)&255,n&255].map(v=>Math.round(v*f)).join(",")+")"}
const cv=document.getElementById("c"),g=cv.getContext("2d");
function draw(){const W=cv.width=innerWidth*devicePixelRatio,Hh=cv.height=innerHeight*devicePixelRatio;g.fillStyle="#07090d";g.fillRect(0,0,W,Hh);if(!B.length)return;
let mx=0,mz=0;for(const b of B){mx=Math.max(mx,b[0]);mz=Math.max(mz,b[2])}const cx=mx/2,cz=mz/2,s=Math.min(W,Hh)/(Math.max(mx,mz)*1.9+8),ca=Math.cos(a),sa=Math.sin(a);
const Lz=B.map(b=>{const x=b[0]-cx,z=b[2]-cz;return[x*ca-z*sa,b[1],x*sa+z*ca,b[3]]}).sort((p,q)=>(p[0]+p[2]+p[1]*.01)-(q[0]+q[2]+q[1]*.01));
for(const[x,y,z,k]of Lz){const px=W/2+(x-z)*s,py=Hh*.62+(x+z)*s*.5-y*s,c=P[k]||P[0];
g.fillStyle=sh(c[0],1);g.beginPath();g.moveTo(px,py-s);g.lineTo(px+s,py-s*.5);g.lineTo(px,py);g.lineTo(px-s,py-s*.5);g.fill();
g.fillStyle=sh(c[1],.8);g.beginPath();g.moveTo(px-s,py-s*.5);g.lineTo(px,py);g.lineTo(px,py+s);g.lineTo(px-s,py+s*.5);g.fill();
g.fillStyle=sh(c[1],.6);g.beginPath();g.moveTo(px+s,py-s*.5);g.lineTo(px,py);g.lineTo(px,py+s);g.lineTo(px+s,py+s*.5);g.fill()}}
addEventListener("pointerdown",e=>drag=e.clientX);addEventListener("pointerup",()=>drag=null);addEventListener("pointermove",e=>{if(drag!==null){a+=(e.clientX-drag)*.01;drag=e.clientX}});
function loop(){if(drag===null)a+=.004;draw();requestAnimationFrame(loop)}
(async()=>{try{const m=SELF&&await meta();if(!m||m.f!=="${FORGE_FORMAT}"||!m.d){M.textContent="BITMAPWIN LAND FORGE · MASTER RENDERER";return}
const r=atob(m.d);for(let i=0;i+3<r.length;i+=4)B.push([r.charCodeAt(i),r.charCodeAt(i+1),r.charCodeAt(i+2),r.charCodeAt(i+3)]);
M.textContent=(m.p?m.p.split(";")[0]+".":"")+m.h+".BITMAP · "+B.length+" BLOCKS"}catch(e){M.textContent="COULD NOT READ BUILD"}})();loop();
</script></body></html>`;
}

export type { BlockId, TplBlock };

/**
 * Marauder Relics — dev9's lean on-chain collection under BITMAP.
 * Rules: one master delegate (Tag 11) holds the viewer; each relic inscribes no body,
 * names its BITMAP as Tag 3 parent and carries baked voxels in Tag 5:
 *   { p:"BITMAPWIN-RELIC", k:<kind>, h:<height>, C:[colours], v:"x,y,z,w,h,d,ci,e;…" }
 * Voxels use the Guardian/pet tuple grid (×10 integers) and stay ≤ RELIC_MAX_VOXELS
 * so the whole relic is one instanced draw call. Everything is a pure function of
 * (kind, height): any viewer re-derives the same relic and can check the metadata.
 */
export const RELIC_PROTOCOL = "BITMAPWIN-RELIC";
export const RELIC_MAX_VOXELS = 256;
export const RELIC_KINDS = ["keycard", "cipher", "fuse", "beacon"] as const;
export type RelicKind = (typeof RELIC_KINDS)[number];
export const RELIC_LABEL: Record<RelicKind, string> = {
  keycard: "VOID KEYCARD", cipher: "CIPHER NOTE", fuse: "COLD FUSE", beacon: "TACTICAL BEACON",
};
/** [x,y,z,w,h,d,colour,glow] — same order as pet/Guardian voxels. */
export type RelicVox = [number, number, number, number, number, number, string, number];

const ORANGE = "#f7931a", CYAN = "#22e1ff", STEEL = "#2a3140", DARK = "#11151d";

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const seedOf = (kind: RelicKind, height: number) => (Math.imul(height + 1, 2654435761) ^ (RELIC_KINDS.indexOf(kind) + 1) * 40503) >>> 0;

export function relicVoxels(kind: RelicKind, height: number): RelicVox[] {
  if (!Number.isInteger(height) || height < 0) throw new Error("BAD HEIGHT");
  const r = rng(seedOf(kind, height));
  const bits = height.toString(2).padStart(20, "0").slice(-20);
  const out: RelicVox[] = [];
  const add = (x: number, y: number, z: number, w: number, h: number, d: number, c: string, e = 0) => out.push([x, y, z, w, h, d, c, e]);
  if (kind === "keycard") {
    add(0, 0, 0, 6, 0.3, 3.8, STEEL);
    for (let i = 0; i < 20; i++) if (bits[i] === "1") add(-2.6 + (i % 10) * 0.55, 0.3, -1.2 + Math.floor(i / 10) * 0.6, 0.4, 0.15, 0.4, ORANGE, 1);
    add(2.2, 0.3, 1.2, 1, 0.2, 0.8, CYAN, 1);
  } else if (kind === "cipher") {
    add(0, 0, 0, 4.4, 0.2, 5.6, "#d8cfb8");
    const rows = 6 + Math.floor(r() * 4);
    for (let i = 0; i < rows; i++) add(-1.5 + r() * 0.6, 0.2, -2.2 + i * 0.6, 1.2 + r() * 1.8, 0.08, 0.2, DARK);
    add(1.4, 0.25, 2.1, 0.9, 0.12, 0.9, ORANGE, 1);
  } else if (kind === "fuse") {
    add(0, 0, 0, 1.6, 0.5, 1.6, STEEL); add(0, 4.5, 0, 1.6, 0.5, 1.6, STEEL);
    add(0, 0.5, 0, 1, 4, 1, CYAN, 1);
    const coils = 3 + (height % 4);
    for (let i = 0; i < coils; i++) add(0, 1 + i * (3 / coils), 0, 1.3, 0.2, 1.3, ORANGE);
  } else {
    add(0, 0, 0, 3, 0.6, 3, STEEL); add(0, 0.6, 0, 0.5, 4 + r() * 2, 0.5, DARK);
    const top = out[1]![4] + 0.6;
    add(0, top, 0, 1.2, 1.2, 1.2, ORANGE, 1);
    for (let i = 0; i < 4; i++) add(Math.cos(i * 1.57) * 1.1, top + 0.3, Math.sin(i * 1.57) * 1.1, 0.3, 0.3, 0.3, CYAN, 1);
  }
  return out.slice(0, RELIC_MAX_VOXELS);
}

export type RelicMeta = { p: typeof RELIC_PROTOCOL; k: RelicKind; h: number; C: string[]; v: string };

export function relicMetadata(kind: RelicKind, height: number): RelicMeta {
  const C: string[] = [];
  const v = relicVoxels(kind, height).map((x) => {
    let ci = C.indexOf(x[6]); if (ci < 0) { C.push(x[6]); ci = C.length - 1; }
    return [x[0], x[1], x[2], x[3], x[4], x[5]].map((n) => Math.round(n * 10)).concat([ci, x[7] ? 1 : 0]).join(",");
  }).join(";");
  return { p: RELIC_PROTOCOL, k: kind, h: height, C, v };
}

/** A relic's metadata is valid only if it equals what (kind, height) derives. */
export function verifyRelic(meta: unknown): { ok: true } | { ok: false; reason: string } {
  const m = meta as Partial<RelicMeta> | null;
  if (!m || m.p !== RELIC_PROTOCOL) return { ok: false, reason: "NOT A RELIC" };
  if (!RELIC_KINDS.includes(m.k as RelicKind)) return { ok: false, reason: "UNKNOWN KIND" };
  if (!Number.isInteger(m.h) || (m.h as number) < 0) return { ok: false, reason: "BAD HEIGHT" };
  const want = relicMetadata(m.k as RelicKind, m.h as number);
  if (m.v !== want.v || JSON.stringify(m.C) !== JSON.stringify(want.C)) return { ok: false, reason: "VOXELS DO NOT MATCH THE BLOCK" };
  if (m.v.split(";").length > RELIC_MAX_VOXELS) return { ok: false, reason: "TOO MANY VOXELS" };
  return { ok: true };
}

/**
 * Master delegate HTML: reads /r/metadata/<self> (CBOR hex) and paints the relic as
 * isometric voxels. `preview` embeds metadata directly so the app can show it before inscribing.
 */
export function relicMasterHtml(preview?: RelicMeta): string {
  const inline = preview ? JSON.stringify(preview).replace(/</g, "\\u003c") : "null";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="bitmapwin" content="RELIC;master"><title>MARAUDER RELIC</title><style>html,body{margin:0;height:100%;background:#05080f;overflow:hidden}canvas{width:100%;height:100%;display:block}</style></head><body><canvas id="c"></canvas><script>
const PRE=${inline};
function cb(b){let i=0;const L=a=>a<24?a:a==24?b[i++]:a==25?(i+=2,b[i-2]<<8|b[i-1]):a==26?(i+=4,(b[i-4]<<24>>>0)+(b[i-3]<<16)+(b[i-2]<<8)+b[i-1]):0;const I=()=>{const x=b[i++],t=x>>5,a=x&31;if(t==0)return L(a);if(t==1)return-1-L(a);if(t==2||t==3){const n=L(a),s=b.slice(i,i+n);i+=n;return t==3?new TextDecoder().decode(s):s}if(t==4){const n=L(a),r=[];for(let k=0;k<n;k++)r.push(I());return r}if(t==5){const n=L(a),o={};for(let k=0;k<n;k++){const key=I();o[key]=I()}return o}return null};return I()}
const c=document.getElementById("c"),g=c.getContext("2d");let M=null,t=0;
function sh(h,k){let n=parseInt(h.slice(1),16),r=n>>16,G=n>>8&255,b=n&255,f=x=>Math.max(0,Math.min(255,Math.round(x*k)));return"rgb("+f(r)+","+f(G)+","+f(b)+")"}
function draw(){const W=c.width=innerWidth*devicePixelRatio,H=c.height=innerHeight*devicePixelRatio;g.fillStyle="#05080f";g.fillRect(0,0,W,H);if(!M){g.fillStyle="#22e1ff";g.font=(14*devicePixelRatio)+"px monospace";g.fillText("LOADING RELIC…",20,40);return}
const s=Math.min(W,H)/16,a=t*.0006,ca=Math.cos(a),sa=Math.sin(a),V=M.v.split(";").map(r=>r.split(",").map(Number));
const P=(x,y,z)=>{const X=x*ca-z*sa,Z=x*sa+z*ca;return[W/2+(X-Z)*.87*s,H*.62+((X+Z)*.5-y)*s,X+Z]};
V.map(v=>{const[x,y,z,w,h,d]=v.map(n=>n/10);return{v,x,y,z,w,h,d,k:P(x,y,z)[2]}}).sort((p,q)=>q.k-p.k).forEach(o=>{const col=M.C[o.v[6]]||"#f7931a",e=o.v[7];const x0=o.x-o.w/2,x1=o.x+o.w/2,z0=o.z-o.d/2,z1=o.z+o.d/2,y0=o.y,y1=o.y+o.h;
const face=(pts,k)=>{g.beginPath();pts.forEach((p,i)=>{const q=P(...p);i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1])});g.closePath();g.fillStyle=sh(col,k);g.fill()};
if(e){g.shadowColor=col;g.shadowBlur=12*devicePixelRatio}face([[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],1.1);face([[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],.75);face([[x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0]],.55);g.shadowBlur=0});
g.fillStyle="#f7931a";g.font="bold "+(13*devicePixelRatio)+"px monospace";g.fillText(M.k.toUpperCase()+" · "+M.h+".bitmap",20*devicePixelRatio,30*devicePixelRatio)}
function loop(ts){t=ts;draw();requestAnimationFrame(loop)}
(async()=>{if(PRE){M=PRE}else{try{const id=(location.pathname.match(/[0-9a-f]{64}i\\d+/)||[])[0];const hx=await (await fetch("/r/metadata/"+id)).json();M=cb(new Uint8Array(hx.match(/../g).map(h=>parseInt(h,16))))}catch(e){}}requestAnimationFrame(loop)})();
</script></body></html>`;
}

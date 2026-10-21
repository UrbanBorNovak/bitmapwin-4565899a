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
export const RELIC_KINDS = ["cassette", "skulltoshi", "floppy", "pizza", "visor", "chronometer", "passcard"] as const;
export type RelicKind = (typeof RELIC_KINDS)[number];
export const RELIC_LABEL: Record<RelicKind, string> = {
  cassette: "SATOSHI'S CASSETTE", skulltoshi: "GOLDEN SKULLTOSHI", floppy: "CYBER FLOPPY 3.5\"",
  pizza: "10K BTC PIZZA SLICE", visor: "MARAUDER LASER VISOR", chronometer: "HALVING CHRONOMETER", passcard: "VOID PASSCARD MK II",
};
/** [x,y,z,w,h,d,colour,glow] — same order as pet/Guardian voxels. */
export type RelicVox = [number, number, number, number, number, number, string, number];

/** Material tier: a pure function of the height, so rarity is block math, never a roll. */
export type RelicTier = "GOLD" | "VOID" | "CYAN" | "STEEL";
export const TIER_LABEL: Record<RelicTier, string> = {
  GOLD: "GOLD FOIL · HALVING / ROUND / PALINDROME", VOID: "VOID GHOST · PATOSHI ERA (<10,000)", CYAN: "CYAN ANODIZED · EVERY 21ST BLOCK", STEEL: "DARK STEEL",
};
const TIER_BODY: Record<RelicTier, string> = { GOLD: "#e8b923", VOID: "#3b3355", CYAN: "#1b7f93", STEEL: "#2a3140" };
export function relicTier(height: number): RelicTier {
  const s = String(height);
  if (height > 0 && (height % 210_000 === 0 || height % 100_000 === 0 || (s.length >= 3 && s === [...s].reverse().join("")))) return "GOLD";
  if (height < 10_000) return "VOID";
  if (height % 21 === 0) return "CYAN";
  return "STEEL";
}
/** A relic may only be derived for a mined block: 0 ≤ height ≤ current chain tip. */
export function withinTip(height: number, tip: number | null | undefined): boolean {
  return Number.isInteger(height) && height >= 0 && typeof tip === "number" && tip > 0 && height <= tip;
}

const ORANGE = "#f7931a", CYAN = "#22e1ff", DARK = "#11151d", BONE = "#d8cfb8", RED = "#ff3b3b";

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const seedOf = (kind: RelicKind, height: number) => (Math.imul(height + 1, 2654435761) ^ (RELIC_KINDS.indexOf(kind) + 1) * 40503) >>> 0;

export function relicVoxels(kind: RelicKind, height: number): RelicVox[] {
  if (!Number.isInteger(height) || height < 0) throw new Error("BAD HEIGHT");
  const r = rng(seedOf(kind, height));
  const B = TIER_BODY[relicTier(height)];
  const bits = height.toString(2).padStart(20, "0").slice(-20);
  const digits = String(height).padStart(7, "0");
  const out: RelicVox[] = [];
  const add = (x: number, y: number, z: number, w: number, h: number, d: number, c: string, e = 0) => out.push([x, y, z, w, h, d, c, e]);
  if (kind === "cassette") {
    add(0, 0, 0, 6.4, 0.6, 4, B);
    add(0, 0.6, -0.3, 4.6, 0.1, 1.6, DARK);
    for (const sx of [-1.3, 1.3]) { add(sx, 0.7, -0.3, 1, 0.15, 1, BONE); add(sx, 0.85, -0.3, 0.3, 0.1, 0.3, ORANGE, 1); }
    add(0, 0.7, -0.3, 1.6, 0.05, 0.3, CYAN, 1);
    for (let i = 0; i < 20; i++) if (bits[i] === "1") add(-2.85 + i * 0.3, 0.62, 1.5, 0.2, 0.08, 0.3, ORANGE, 1);
    add(0, 0.6, 1.9, 2.4, 0.2, 0.3, DARK);
  } else if (kind === "skulltoshi") {
    add(0, 0, 0, 3.6, 3.2, 3.4, BONE);
    add(0, -0.9, 0.3, 2.6, 0.9, 2.8, BONE);
    for (const sx of [-0.8, 0.8]) { add(sx, 1.4, 1.71, 0.9, 0.8, 0.1, DARK); add(sx, 1.7, 1.8, 0.4, 0.3, 0.1, CYAN, 1); }
    add(0, 0.6, 1.72, 0.4, 0.5, 0.1, DARK);
    const gold = Math.floor(r() * 6);
    for (let i = 0; i < 6; i++) add(-1.0 + i * 0.4, -0.5, 1.72, 0.3, 0.4, 0.1, i === gold ? "#e8b923" : BONE, i === gold ? 1 : 0);
    if (relicTier(height) !== "STEEL") add(0, 3.3, 0, 3.8, 0.2, 3.6, B, 1);
  } else if (kind === "floppy") {
    add(0, 0, 0, 5, 0.4, 5, B);
    add(0.4, 0.4, -1.6, 2.4, 0.08, 1.6, "#9aa3b2");
    add(1.0, 0.48, -1.6, 0.6, 0.04, 1.0, DARK);
    add(0, 0.4, 1.1, 3.8, 0.06, 2.4, BONE);
    for (let i = 0; i < 7; i++) add(-1.5 + i * 0.5, 0.47, 1.1, 0.3, 0.05, Number(digits[i]) * 0.2 + 0.1, DARK);
    add(-2.1, 0.4, 2.1, 0.4, 0.1, 0.4, height % 2 ? ORANGE : CYAN, 1);
  } else if (kind === "pizza") {
    for (let row = 0; row < 7; row++) { const w = 0.6 + row * 0.8; add(0, 0, -2.8 + row * 0.8, w, 0.4, 0.8, "#f2c14e"); }
    add(0, 0, 2.9, 6.4, 0.7, 0.8, "#b8742a");
    const pep = 3 + (height % 5);
    for (let i = 0; i < pep; i++) { const z = -1.8 + r() * 4.2, w = (0.6 + (z + 2.8) * 1) * 0.35; add((r() * 2 - 1) * w, 0.4, z, 0.6, 0.12, 0.6, RED, 1); }
    add(0, 0.42, 2.9, 0.5, 0.1, 0.4, ORANGE, 1);
  } else if (kind === "visor") {
    add(0, 0, 0, 6.6, 1.4, 0.6, B);
    add(0, 0.5, 0.31, 5.8, 0.3, 0.1, RED, 1);
    for (const sx of [-3.4, 3.4]) add(sx, 0.2, -1.2, 0.3, 1, 2.6, DARK);
    for (const sx of [-3.4, 3.4]) add(sx, 0.4, -1.4, 0.4, 0.6, 0.8, CYAN, 1);
    const beams = 1 + (height % 3);
    for (let i = 0; i < beams; i++) add(-1.2 + i * 1.2, 0.55, 2.5, 0.12, 0.12, 4, RED, 1);
  } else if (kind === "chronometer") {
    add(0, 0, 0, 3, 0.4, 3, B); add(0, 5.2, 0, 3, 0.4, 3, B);
    for (const [sx, sz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]] as const) add(sx, 0.4, sz, 0.25, 4.8, 0.25, DARK);
    const fill = (height % 210_000) / 210_000;
    for (let i = 0; i < 5; i++) { const w = 1.8 - Math.abs(i - 2) * 0.6; add(0, 0.4 + i * 0.5, 0, w, 0.5, w, i / 5 < fill ? ORANGE : DARK, i / 5 < fill ? 1 : 0); }
    for (let i = 0; i < 5; i++) { const w = 1.8 - Math.abs(i - 2) * 0.6; add(0, 2.8 + i * 0.5, 0, w, 0.5, w, (1 - i / 5) <= fill ? DARK : CYAN, (1 - i / 5) <= fill ? 0 : 1); }
  } else {
    add(0, 0, 0, 6, 0.35, 3.8, B);
    add(0, 0.35, -1.3, 6, 0.06, 0.6, DARK);
    for (let i = 0; i < 6; i++) add(-2.2 + (i % 3) * 0.35, 0.36, 0.2 + Math.floor(i / 3) * 0.35, 0.28, 0.06, 0.28, "#e8b923", 1);
    for (let i = 0; i < 20; i++) if (bits[i] === "1") add(-0.6 + (i % 10) * 0.32, 0.36, 0.4 + Math.floor(i / 10) * 0.45, 0.22, 0.08, 0.3, ORANGE, 1);
    add(2.3, 0.36, 1.4, 0.8, 0.12, 0.5, CYAN, 1);
  }
  return out.slice(0, RELIC_MAX_VOXELS);
}

export type RelicMeta = { p: typeof RELIC_PROTOCOL; k: RelicKind; h: number; r: RelicTier; C: string[]; v: string };

export function relicMetadata(kind: RelicKind, height: number): RelicMeta {
  const C: string[] = [];
  const v = relicVoxels(kind, height).map((x) => {
    let ci = C.indexOf(x[6]); if (ci < 0) { C.push(x[6]); ci = C.length - 1; }
    return [x[0], x[1], x[2], x[3], x[4], x[5]].map((n) => Math.round(n * 10)).concat([ci, x[7] ? 1 : 0]).join(",");
  }).join(";");
  return { p: RELIC_PROTOCOL, k: kind, h: height, r: relicTier(height), C, v };
}

/** Valid only if it equals what (kind, height) derives, and — when a tip is given — the block is mined. */
export function verifyRelic(meta: unknown, tip?: number): { ok: true } | { ok: false; reason: string } {
  const m = meta as Partial<RelicMeta> | null;
  if (!m || m.p !== RELIC_PROTOCOL) return { ok: false, reason: "NOT A RELIC" };
  if (!RELIC_KINDS.includes(m.k as RelicKind)) return { ok: false, reason: "UNKNOWN KIND" };
  if (!Number.isInteger(m.h) || (m.h as number) < 0) return { ok: false, reason: "BAD HEIGHT" };
  if (tip !== undefined && !withinTip(m.h as number, tip)) return { ok: false, reason: "BEYOND CHAIN TIP" };
  const want = relicMetadata(m.k as RelicKind, m.h as number);
  if (m.r !== want.r) return { ok: false, reason: "TIER DOES NOT MATCH THE BLOCK" };
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
g.fillStyle="#f7931a";g.font="bold "+(13*devicePixelRatio)+"px monospace";g.fillText(M.k.toUpperCase()+" · "+(M.r||"")+" · "+M.h+".bitmap",20*devicePixelRatio,30*devicePixelRatio)}
function loop(ts){t=ts;draw();requestAnimationFrame(loop)}
(async()=>{if(PRE){M=PRE}else{try{const id=(location.pathname.match(/[0-9a-f]{64}i\\d+/)||[])[0];const hx=await (await fetch("/r/metadata/"+id)).json();M=cb(new Uint8Array(hx.match(/../g).map(h=>parseInt(h,16))))}catch(e){}}requestAnimationFrame(loop)})();
</script></body></html>`;
}

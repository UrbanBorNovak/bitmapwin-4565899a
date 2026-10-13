/**
 * LAND FORGE — one-click voxel builds for a BITMAP, seeded by its own block,
 * packed into a compact payload and inscribed as a self-rendering child.
 *
 * Payload "BWVX1": base64 of 4 bytes per block [x, y, z, kindIndex], all
 * coordinates 0..63 relative to the build's own corner. The same bytes drive
 * the in-app preview and the on-chain HTML viewer, so what you see is what is
 * inscribed.
 */
import { BLOCKS, type BlockId } from "@/lib/voxel-world";
import type { TplBlock } from "@/lib/voxel-templates";

export const FORGE_FORMAT = "BWVX1";
export const FORGE_SPAN = 64;
export const FORGE_MAX_BLOCKS = 2400;

export const ARCHETYPES = [
  { id: "citadel", name: "SOVEREIGN CITADEL", blurb: "Walled keep with corner towers and a gold throne." },
  { id: "casino", name: "CASINO STRIP", blurb: "Neon glass towers, gold floors, glow signage." },
  { id: "arena", name: "GLADIATOR ARENA", blurb: "Stepped ring of seats around a sand pit." },
  { id: "vault", name: "LOOT VAULT", blurb: "Stone bunker with a gold-stacked core." },
  { id: "spire", name: "MINER SPIRE", blurb: "One tall tower; taller the busier the block." },
] as const;
export type ArchetypeId = (typeof ARCHETYPES)[number]["id"];

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build radius in blocks from the block's tx count: 6 for a near-empty block, up to 14. */
export function forgeRadius(txCount: number | null) {
  const tx = Math.max(1, txCount ?? 300);
  return Math.max(6, Math.min(14, Math.round(6 + Math.log10(tx) * 2.2)));
}

export function generateBuild(height: number, txCount: number | null, archetype: ArchetypeId): TplBlock[] {
  const r = forgeRadius(txCount);
  const rand = rng(Math.imul(height ^ 0x9e3779b9, 2654435761));
  const map = new Map<string, TplBlock>();
  const put = (x: number, y: number, z: number, k: BlockId) => {
    if (x < 0 || z < 0 || y < 0 || x >= FORGE_SPAN || y >= FORGE_SPAN || z >= FORGE_SPAN) return;
    map.set(`${x},${y},${z}`, { dx: x, dy: y, dz: z, k });
  };
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, k: BlockId, hollow = false) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      if (hollow && x > x0 && x < x1 && z > z0 && z < z1) continue;
      put(x, y, z, k);
    }
  };
  const c = r, n = r * 2;

  if (archetype === "citadel") {
    box(0, n, 0, 0, 0, n, "cobble");
    box(0, n, 1, 3, 0, n, "stone", true);
    for (let x = 0; x <= n; x += 2) put(x, 4, 0, "stone"), put(x, 4, n, "stone"), put(0, 4, x, "stone"), put(n, 4, x, "stone");
    for (const [x, z] of [[0, 0], [n, 0], [0, n], [n, n]] as const) { box(x - 1, x + 1, 1, 7, z - 1, z + 1, "brick", true); put(x, 8, z, "glow"); }
    box(c - 3, c + 3, 1, 6, c - 3, c + 3, "planks", true);
    box(c - 3, c + 3, 7, 7, c - 3, c + 3, "brick");
    put(c, 1, c, "gold"); put(c, 2, c, "gold"); put(c, 8, c, "glow");
    for (let y = 1; y <= 2; y++) map.delete(`${c},${y},0`);
  } else if (archetype === "casino") {
    box(0, n, 0, 0, 0, n, "gold");
    const towers = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < towers; i++) {
      const w = 2 + Math.floor(rand() * 2), h = 6 + Math.floor(rand() * (r + 4));
      const x = 1 + Math.floor(rand() * (n - w - 1)), z = 1 + Math.floor(rand() * (n - w - 1));
      box(x, x + w, 1, h, z, z + w, "glass", true);
      for (let y = 3; y <= h; y += 3) box(x, x + w, y, y, z, z + w, "glow", true);
      box(x, x + w, h + 1, h + 1, z, z + w, "gold");
    }
    for (let x = 0; x <= n; x += 3) put(x, 1, 0, "glow");
  } else if (archetype === "arena") {
    box(0, n, 0, 0, 0, n, "sand");
    for (let ring = 0; ring < 4; ring++) {
      const lo = ring, hi = n - ring;
      for (let x = lo; x <= hi; x++) for (let z = lo; z <= hi; z++) {
        const d = Math.hypot(x - c, z - c);
        if (d <= c - ring && d > c - ring - 1.4) box(x, x, 1, 4 - ring, z, z, ring % 2 ? "brick" : "stone");
      }
    }
    put(c, 1, c, "gold"); put(c, 2, c, "glow");
  } else if (archetype === "vault") {
    box(0, n, 0, 4, 0, n, "stone", true);
    box(0, n, 5, 5, 0, n, "cobble");
    box(c - 2, c + 2, 1, 1, c - 2, c + 2, "gold");
    box(c - 1, c + 1, 2, 2, c - 1, c + 1, "gold");
    put(c, 3, c, "glow");
    for (let y = 1; y <= 2; y++) map.delete(`${c},${y},0`);
  } else {
    const h = Math.min(FORGE_SPAN - 3, 10 + r * 3);
    box(c - 4, c + 4, 0, 0, c - 4, c + 4, "cobble");
    box(c - 2, c + 2, 1, h, c - 2, c + 2, "brick", true);
    for (let y = 4; y < h; y += 4) box(c - 2, c + 2, y, y, c - 2, c + 2, "glass", true);
    box(c - 3, c + 3, h + 1, h + 1, c - 3, c + 3, "planks");
    put(c, h + 2, c, "gold"); put(c, h + 3, c, "glow");
  }
  return [...map.values()].slice(0, FORGE_MAX_BLOCKS);
}

const KIND_INDEX = new Map(BLOCKS.map((b, i) => [b.id as string, i]));

export function encodeBuild(blocks: TplBlock[]): string {
  const bytes = new Uint8Array(blocks.length * 4);
  blocks.forEach((b, i) => {
    bytes[i * 4] = b.dx; bytes[i * 4 + 1] = b.dy; bytes[i * 4 + 2] = b.dz;
    bytes[i * 4 + 3] = KIND_INDEX.get(b.k) ?? 0;
  });
  let s = "";
  for (const v of bytes) s += String.fromCharCode(v);
  return btoa(s);
}

/**
 * BWVX2: greedy boxes. Payload = "BW2\0" magic + 7 bytes per box
 * [x0, y0, z0, x1, y1, z1, kindIndex] (inclusive). BWVX1 coords are < 64, so
 * the "B" (66) magic byte can never start a BWVX1 payload.
 */
export const FORGE_FORMAT_V2 = "BWVX2";
const V2_MAGIC = [66, 87, 50, 0];

export function encodeBuildV2(blocks: TplBlock[]): string {
  const S = FORGE_SPAN, idx = (x: number, y: number, z: number) => (y * S + z) * S + x;
  const grid = new Int16Array(S * S * S).fill(-1);
  for (const b of blocks) {
    if (b.dx < 0 || b.dy < 0 || b.dz < 0 || b.dx >= S || b.dy >= S || b.dz >= S) continue;
    grid[idx(b.dx, b.dy, b.dz)] = KIND_INDEX.get(b.k) ?? 0;
  }
  const out: number[] = [...V2_MAGIC];
  for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
    const k = grid[idx(x, y, z)]!;
    if (k < 0) continue;
    let x1 = x;
    while (x1 + 1 < S && grid[idx(x1 + 1, y, z)] === k) x1++;
    const rowOk = (zz: number, yy: number) => { for (let i = x; i <= x1; i++) if (grid[idx(i, yy, zz)] !== k) return false; return true; };
    let z1 = z;
    while (z1 + 1 < S && rowOk(z1 + 1, y)) z1++;
    let y1 = y;
    const layerOk = (yy: number) => { for (let j = z; j <= z1; j++) if (!rowOk(j, yy)) return false; return true; };
    while (y1 + 1 < S && layerOk(y1 + 1)) y1++;
    for (let yy = y; yy <= y1; yy++) for (let j = z; j <= z1; j++) for (let i = x; i <= x1; i++) grid[idx(i, yy, j)] = -1;
    out.push(x, y, z, x1, y1, z1, k);
  }
  let s = "";
  for (const v of out) s += String.fromCharCode(v);
  return btoa(s);
}

/** Smallest payload for these blocks: BWVX2 boxes when they win, else BWVX1. */
export function encodeBuildBest(blocks: TplBlock[]): { format: string; data: string } {
  const v1 = encodeBuild(blocks), v2 = encodeBuildV2(blocks);
  return v2.length < v1.length ? { format: FORGE_FORMAT_V2, data: v2 } : { format: FORGE_FORMAT, data: v1 };
}

/** Reads BWVX1 or BWVX2 payloads. */
export function decodeBuild(b64: string): TplBlock[] {
  const raw = atob(b64);
  const out: TplBlock[] = [];
  const c = (i: number) => raw.charCodeAt(i);
  if (raw.length >= 4 && V2_MAGIC.every((m, i) => c(i) === m)) {
    for (let i = 4; i + 6 < raw.length; i += 7) {
      const k = BLOCKS[c(i + 6)];
      if (!k) continue;
      const x1 = Math.min(FORGE_SPAN - 1, c(i + 3)), y1 = Math.min(FORGE_SPAN - 1, c(i + 4)), z1 = Math.min(FORGE_SPAN - 1, c(i + 5));
      for (let x = c(i); x <= x1; x++) for (let y = c(i + 1); y <= y1; y++) for (let z = c(i + 2); z <= z1; z++) out.push({ dx: x, dy: y, dz: z, k: k.id });
    }
    return out;
  }
  for (let i = 0; i + 3 < raw.length; i += 4) {
    const k = BLOCKS[c(i + 3)];
    if (k) out.push({ dx: c(i), dy: c(i + 1), dz: c(i + 2), k: k.id });
  }
  return out;
}

/** Inline JS that fills B=[[x,y,z,k]...] from a BWVX1 or BWVX2 binary string r. */
const UNPACK_JS = `function U(r){const B=[],c=i=>r.charCodeAt(i);if(r.length>3&&c(0)==66&&c(1)==87&&c(2)==50&&c(3)==0){for(let i=4;i+6<r.length;i+=7)for(let x=c(i);x<=c(i+3);x++)for(let y=c(i+1);y<=c(i+4);y++)for(let z=c(i+2);z<=c(i+5);z++)B.push([x,y,z,c(i+6)])}else for(let i=0;i+3<r.length;i+=4)B.push([c(i),c(i+1),c(i+2),c(i+3)]);return B}`;
export const FORGE_UNPACK_JS = UNPACK_JS;

/** Self-contained HTML child: renders the build isometrically on ordinals.com, no external code. */
export function forgeInscriptionHtml(height: number, archetype: string, blocks: TplBlock[], lineage = "", parcel?: { index: number; x0: number; z0: number; x1: number; z1: number }, compact = true): string {
  const pal = BLOCKS.map((b) => [b.top, b.side]);
  const best = compact ? encodeBuildBest(blocks) : { format: FORGE_FORMAT, data: encodeBuild(blocks) };
  const data = best.data;
  const pMeta = parcel ? `<meta name="bitmapwin-parcel" content="${parcel.index};${parcel.x0},${parcel.z0},${parcel.x1},${parcel.z1}">` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="bitmapwin" content="${best.format};${height};${archetype}">${pMeta}${lineage ? `<meta name="bitmapwin-lineage" content="${lineage.replace(/[^a-zA-Z0-9:,;._-]/g, "")}">` : ""}<title>${parcel ? `${parcel.index}.` : ""}${height}.bitmap build</title><style>html,body{margin:0;height:100%;background:#07090d}canvas{width:100%;height:100%;display:block}</style></head><body><canvas id="c"></canvas><script id="bwvx" type="text/plain" data-format="${best.format}" data-height="${height}">${data}</script><script>
${UNPACK_JS}
const P=${JSON.stringify(pal)},B=U(atob(document.getElementById("bwvx").textContent.trim()));
const cv=document.getElementById("c"),g=cv.getContext("2d");let a=0;
function sh(h,f){const n=parseInt(h.slice(1),16);return"rgb("+[(n>>16)&255,(n>>8)&255,n&255].map(v=>Math.round(v*f)).join(",")+")"}
function draw(){const W=cv.width=innerWidth*devicePixelRatio,H=cv.height=innerHeight*devicePixelRatio;g.fillStyle="#07090d";g.fillRect(0,0,W,H);
let mx=0,mz=0;for(const b of B){mx=Math.max(mx,b[0]);mz=Math.max(mz,b[2])}const cx=mx/2,cz=mz/2,s=Math.min(W,H)/(Math.max(mx,mz)*1.9+8),ca=Math.cos(a),sa=Math.sin(a);
const L=B.map(b=>{const x=b[0]-cx,z=b[2]-cz;return[x*ca-z*sa,b[1],x*sa+z*ca,b[3]]}).sort((p,q)=>(p[0]+p[2]+p[1]*.01)-(q[0]+q[2]+q[1]*.01));
for(const[x,y,z,k]of L){const px=W/2+(x-z)*s,py=H*.62+(x+z)*s*.5-y*s,c=P[k]||P[0];
g.fillStyle=sh(c[0],1);g.beginPath();g.moveTo(px,py-s);g.lineTo(px+s,py-s*.5);g.lineTo(px,py);g.lineTo(px-s,py-s*.5);g.fill();
g.fillStyle=sh(c[1],.8);g.beginPath();g.moveTo(px-s,py-s*.5);g.lineTo(px,py);g.lineTo(px,py+s);g.lineTo(px-s,py+s*.5);g.fill();
g.fillStyle=sh(c[1],.6);g.beginPath();g.moveTo(px+s,py-s*.5);g.lineTo(px,py);g.lineTo(px,py+s);g.lineTo(px+s,py+s*.5);g.fill()}
g.fillStyle="#f7931a";g.font=(14*devicePixelRatio)+"px monospace";g.fillText("${height}.BITMAP · "+B.length+" BLOCKS",16*devicePixelRatio,28*devicePixelRatio)}
setInterval(()=>{a+=.004;draw()},50);draw();
</script></body></html>`;
}

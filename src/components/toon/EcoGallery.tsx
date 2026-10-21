/** Framed real on-chain pictures from the wider BITMAP ecosystem: Bitmap Emporium (children of 717328.bitmap) and JIGGLYPUFF. */
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { JIGGLYPUFF_IDS } from "@/lib/game/jigglypuff";

/** A fixed set of 20 (10 Emporium children of 717328.bitmap + 10 JIGGLYPUFF), loaded once and reused in every room. */
const EMP = "1217ab4044e41565388b412e30ffab56abf912bb0366938d3ee07c42c6d3ddb2i";
export const GALLERY_IDS: string[] = [
  ...[0, 4, 8, 12, 16, 20, 24, 28, 32, 36].map((n) => EMP + n),
  ...JIGGLYPUFF_IDS.filter((_, i) => i % 21 === 0).slice(0, 10),
];

const cache = new Map<string, Promise<THREE.Texture | null>>();
function loadTex(id: string) {
  let p = cache.get(id);
  if (!p) {
    p = new Promise((res) => {
      const l = new THREE.TextureLoader(); l.setCrossOrigin("anonymous");
      // ordinals.com sends CORS headers; our relay is the fallback.
      const ok = (t: THREE.Texture) => { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; res(t); };
      l.load(`https://ordinals.com/content/${id}`, ok, undefined, () => l.load(`/api/public/inscription/${id}`, ok, undefined, () => res(null)));
    });
    cache.set(id, p);
  }
  return p;
}

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

function Frame({ id, position, size, trim }: { id: string; position: [number, number, number]; size: number; trim: string }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => { let alive = true; setTex(null); loadTex(id).then((t) => alive && setTex(t)); return () => { alive = false; }; }, [id]);
  if (!tex) return null; // never an empty frame
  return (
    <group position={position}>
      <mesh position={[0, 0, -0.1]}><boxGeometry args={[size + 1.2, size + 1.2, 0.3]} /><meshStandardMaterial color={trim} emissive={trim} emissiveIntensity={0.6} metalness={0.4} /></mesh>
      <mesh><planeGeometry args={[size, size]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      <pointLight position={[0, 0, 4]} intensity={30} distance={18} color="#fff4e0" />
    </group>
  );
}

type Box = { p: [number, number, number]; s: [number, number, number] };
/** Back-wall slots, low enough to sit behind the cast in medium and wide shots. */
const CANDIDATES: [number, number][] = [[-14, 16], [14, 16], [-30, 16], [30, 16], [0, 22], [-14, 28], [14, 28], [-30, 28], [30, 28], [-42, 16], [42, 16], [-42, 28], [42, 28], [0, 34]];
export function gallerySlots(props: Box[], size = 10, count = 6): [number, number][] {
  const h = size / 2 + 1;
  const free = CANDIDATES.filter(([x, y]) => !props.some((b) =>
    b.p[2] - b.s[2] / 2 < -20 && Math.abs(b.p[0] - x) < b.s[0] / 2 + h && Math.abs(b.p[1] - y) < b.s[1] / 2 + h));
  const out: [number, number][] = [];
  for (const c of free) if (out.length < count && !out.some(([x, y]) => Math.abs(x - c[0]) < size + 2 && Math.abs(y - c[1]) < size + 2)) out.push(c);
  return out;
}

/** Emporium portraits and Jigglypuffs alternate on free back-wall slots, picked deterministically from `seed`. */
export function EcoGallery({ seed, trim, props, size = 10 }: { seed: string; trim: string; props: Box[]; size?: number }) {
  const slots = useMemo(() => gallerySlots(props, size), [props, size]);
  const ids = useMemo(() => { const h = hash(seed); return slots.map((_, i) => GALLERY_IDS[(i % 2 ? 10 : 0) + ((h >>> i) + i * 3) % 10]!); }, [seed, slots]);
  return <group>{slots.map(([x, y], i) => <Frame key={`${i}-${ids[i]}`} id={ids[i]!} position={[x, y, -28.5]} size={size} trim={trim} />)}</group>;
}

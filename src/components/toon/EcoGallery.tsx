/** Framed real on-chain pictures from the wider BITMAP ecosystem: Bitmap Emporium (children of 717328.bitmap) and JIGGLYPUFF. */
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { usePuppets } from "@/lib/game/puppets";
import { JIGGLYPUFF_IDS } from "@/lib/game/jigglypuff";

/** Only the first 2,574 children of 717328 are image portraits; later ones are text parcels. */
const EMPORIUM_PORTRAITS = 2574;

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

function Frame({ id, position, rotation, size, trim }: { id: string; position: [number, number, number]; rotation: [number, number, number]; size: number; trim: string }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true, loaded: THREE.Texture | null = null;
    setTex(null); setFailed(false);
    // Same-origin relay: WebGL refuses cross-origin pixels without CORS headers.
    new THREE.TextureLoader().load(`/api/public/inscription/${id}`, (t) => {
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
      loaded = t; if (alive) setTex(t); else t.dispose();
    }, undefined, () => { if (alive) setFailed(true); });
    return () => { alive = false; loaded?.dispose(); };
  }, [id]);
  // Never draw an empty frame: hidden while loading or when the image can't be read.
  if (!tex || failed) return null;
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -0.05]}><boxGeometry args={[size + 0.8, size + 0.8, 0.2]} /><meshStandardMaterial color={trim} emissive={trim} emissiveIntensity={0.25} metalness={0.6} /></mesh>
      <mesh><planeGeometry args={[size, size]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
    </group>
  );
}

type Box = { p: [number, number, number]; s: [number, number, number] };
/** Back-wall slots (x, y) clear of every prop, away from the cast in the middle. */
const CANDIDATES: [number, number][] = [[-40, 30], [40, 30], [-26, 30], [26, 30], [-40, 15], [40, 15], [-26, 15], [26, 15]];
export function gallerySlots(props: Box[], size = 8, count = 4): [number, number][] {
  const h = size / 2 + 1;
  const free = CANDIDATES.filter(([x, y]) => !props.some((b) =>
    b.p[2] - b.s[2] / 2 < -20 && Math.abs(b.p[0] - x) < b.s[0] / 2 + h && Math.abs(b.p[1] - y) < b.s[1] / 2 + h));
  const out: [number, number][] = [];
  for (const c of free) if (out.length < count && !out.some(([x, y]) => Math.abs(x - c[0]) < size + 2 && Math.abs(y - c[1]) < size + 2)) out.push(c);
  return out;
}

/** Emporium portraits and Jigglypuffs alternate on free back-wall slots, picked deterministically from `seed`. */
export function EcoGallery({ seed, trim, props, size = 8 }: { seed: string; trim: string; props: Box[]; size?: number }) {
  const pool = usePuppets();
  const slots = useMemo(() => gallerySlots(props, size), [props, size]);
  const ids = useMemo(() => {
    const h = hash(seed);
    const emp = (pool?.list ?? []).slice(0, EMPORIUM_PORTRAITS);
    return slots.map((_, i) => {
      const k = (h >>> (i * 5)) + i * 7919;
      return i % 2 === 0 && emp.length ? emp[k % emp.length]!.inscriptionId : JIGGLYPUFF_IDS[k % JIGGLYPUFF_IDS.length]!;
    });
  }, [pool, seed, slots]);
  return (
    <group>
      {slots.map(([x, y], i) => <Frame key={`${i}-${ids[i]}`} id={ids[i]!} position={[x, y, -28.7]} rotation={[0, 0, 0]} size={size} trim={trim} />)}
    </group>
  );
}

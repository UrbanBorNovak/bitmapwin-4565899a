/** Framed real on-chain pictures from the wider BITMAP ecosystem: Bitmap Emporium (children of 717328.bitmap) and JIGGLYPUFF. */
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { usePuppets } from "@/lib/game/puppets";
import { JIGGLYPUFF_IDS } from "@/lib/game/jigglypuff";
import { inscriptionContentUrl } from "@/lib/game/pfpExtenders";

/** Only the first 2,574 children of 717328 are image portraits; later ones are text parcels. */
const EMPORIUM_PORTRAITS = 2574;

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

function Frame({ id, position, rotation, size, trim }: { id: string; position: [number, number, number]; rotation: [number, number, number]; size: number; trim: string }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true, loaded: THREE.Texture | null = null;
    setTex(null); setFailed(false);
    new THREE.TextureLoader().load(inscriptionContentUrl(id), (t) => {
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

/** Two Emporium portraits + two Jigglypuffs on the side walls, picked deterministically from `seed`. */
export function EcoGallery({ seed, trim, x = 48.8, size = 9 }: { seed: string; trim: string; x?: number; size?: number }) {
  const pool = usePuppets();
  const picks = useMemo(() => {
    const h = hash(seed);
    const emp = (pool?.list ?? []).slice(0, EMPORIUM_PORTRAITS);
    const e = emp.length ? [emp[h % emp.length]!.inscriptionId, emp[(h >>> 7) % emp.length]!.inscriptionId] : [];
    const j = [JIGGLYPUFF_IDS[h % JIGGLYPUFF_IDS.length]!, JIGGLYPUFF_IDS[(h >>> 11) % JIGGLYPUFF_IDS.length]!];
    return { e, j };
  }, [pool, seed]);
  const L: [number, number, number] = [0, Math.PI / 2, 0], R: [number, number, number] = [0, -Math.PI / 2, 0];
  return (
    <group>
      {picks.e[0] && <Frame id={picks.e[0]} position={[-x, 24, -14]} rotation={L} size={size} trim={trim} />}
      {picks.j[0] && <Frame id={picks.j[0]} position={[-x, 24, 4]} rotation={L} size={size} trim={trim} />}
      {picks.j[1] && <Frame id={picks.j[1]} position={[x, 24, -14]} rotation={R} size={size} trim={trim} />}
      {picks.e[1] && <Frame id={picks.e[1]} position={[x, 24, 4]} rotation={R} size={size} trim={trim} />}
    </group>
  );
}

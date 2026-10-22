/** Wall shelf of Oasis on-chain wearables. Flattened shared geometry, so each piece is a couple of draw calls. */
import { Suspense } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import { ModelFallback } from "@/components/game/ModelFallback";
import { ROOM_SHELVES, announceGear, type GearRoom } from "@/lib/biternam-gear";
import { COMIC_INSCRIPTION, GHOST_INSCRIPTION, GOGGLES_INSCRIPTION, MAGIC_BOOK_INSCRIPTION, NECKLACE_INSCRIPTION, RING_INSCRIPTION, SHOES_INSCRIPTION, WATCH_INSCRIPTION, WIZARD_HAT_INSCRIPTION } from "@/lib/world-gear";
import { JETPACK_HELMET_INSCRIPTION } from "@/lib/world-vehicle";
import { playSfx } from "@/lib/retro-sfx";

const IDS: Record<string, string> = {
  goggles: GOGGLES_INSCRIPTION, watch: WATCH_INSCRIPTION, shoes: SHOES_INSCRIPTION, necklace: NECKLACE_INSCRIPTION,
  helmet: JETPACK_HELMET_INSCRIPTION, comic: COMIC_INSCRIPTION, ring: RING_INSCRIPTION, book: MAGIC_BOOK_INSCRIPTION,
  hat: WIZARD_HAT_INSCRIPTION, ghost: GHOST_INSCRIPTION,
};

const Stub = () => <mesh position={[0, 0.12, 0]}><boxGeometry args={[0.24, 0.24, 0.24]} /><meshStandardMaterial color="#6a5a44" flatShading /></mesh>;

export function GearShelf({ room, position, rotation = 0 }: { room: GearRoom; position: [number, number, number]; rotation?: number }) {
  const items = ROOM_SHELVES[room];
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh><boxGeometry args={[2.4, 0.08, 0.5]} /><meshStandardMaterial color="#5a3d29" flatShading /></mesh>
      {items.map((it, i) => (
        <group key={it.id + i} position={[(i - 1) * 0.8, 0.04, 0]}
          onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); playSfx("hover"); announceGear(`${it.name} — ${it.blurb} (on-chain Oasis gear)`); }}>
          {/* invisible hit box: shelf pieces themselves skip raycasting */}
          <mesh position={[0, 0.25, 0]} visible={false}><boxGeometry args={[0.6, 0.5, 0.5]} /><meshBasicMaterial /></mesh>
          <ModelFallback fallback={<Stub />}><Suspense fallback={<Stub />}><InscribedModel url={contentUrl(IDS[it.id]!)} size={0.45} /></Suspense></ModelFallback>
        </group>
      ))}
    </group>
  );
}

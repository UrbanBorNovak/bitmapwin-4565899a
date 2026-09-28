/**
 * WHALES — the big swimmers of the inland seas.
 *
 * Each sea carries a small pod of inscribed whales that circle its middle,
 * rising to breathe and sinking again. Everything is derived from the sea's
 * own id, so every visitor sees the same whales on the same paths. Only the
 * pods near you are drawn or animated.
 */
import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SEAS, seaRadiusAt, type SeaMass } from "@/lib/world-sea";
import { waterSurfaceY } from "@/lib/world-terrain";
import type { PlayerState } from "@/lib/player-state";
import { InscribedModel, contentUrl } from "./InscribedParts";

/** The inscribed whale, read once from chain and reused by every copy. */
export const WHALE_INSCRIPTION =
  "09434427a0f5bddda76416dc60331212cd16312a538ef1b5c475e903ba318ecdi0";

type Whale = {
  sea: SeaMass;
  /** one shoreline swimmer per sea stays discoverable from the nearest bank */
  shoreline: boolean;
  /** orbit radius as a fraction of the sea's safe middle */
  orbit: number;
  /** swim speed in radians per second */
  speed: number;
  phase: number;
  /** body length in world units */
  size: number;
  /** how deep it dives and how high it breathes */
  dive: number;
};

/** Cheap deterministic hash in 0..1 — same pod on every client, forever. */
function seed(n: number, salt: number) {
  const v = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function buildPod(unit: number): Whale[] {
  const whales: Whale[] = [];
  for (const sea of SEAS) {
    // Every sea carries a whale. Bigger seas can carry up to three.
    const span = Math.min(sea.rx, sea.rz);
    const count = Math.max(1, Math.floor(seed(sea.id, 21) * 2 + span / (unit * 260)));
    for (let i = 0; i < Math.min(3, count); i++) {
      whales.push({
        sea,
        shoreline: i === 0,
        orbit: i === 0 ? 0.74 : 0.3 + seed(sea.id * 7 + i, 22) * 0.35,
        speed: (0.05 + seed(sea.id * 7 + i, 23) * 0.06) * (i % 2 === 0 ? 1 : -1),
        phase: seed(sea.id * 7 + i, 24) * Math.PI * 2,
        size: unit * (5 + seed(sea.id * 7 + i, 25) * 3),
        dive: unit * (0.5 + seed(sea.id * 7 + i, 26) * 0.8),
      });
    }
  }
  return whales;
}

export const Whales = memo(function Whales({
  unit,
  pose,
}: {
  /** One avatar height in world units. */
  unit: number;
  pose: React.MutableRefObject<PlayerState | null>;
}) {
  const group = useRef<THREE.Group>(null);
  const whales = useMemo(() => buildPod(unit), [unit]);

  useFrame(({ clock }) => {
    const node = group.current;
    const player = pose.current;
    if (!node) return;
    const t = clock.elapsedTime;
    const range = unit * 90;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]!;
      const whale = whales[i]!;
      const { sea } = whale;
      // Circle the sea's middle, always inside the wobbled coast.
      // The first whale in each sea patrols the visitor-facing shore. This
      // prevents a whole pod being hidden on the far side of a 30-BITMAP sea.
      const visitorBearing = player
        ? Math.atan2((player.z - sea.z) / sea.rz, (player.x - sea.x) / sea.rx)
        : whale.phase;
      const angle = whale.shoreline && player
        ? visitorBearing + Math.sin(t * whale.speed + whale.phase) * 0.16
        : whale.phase + t * whale.speed;
      const edge = seaRadiusAt(sea, angle);
      const radius = whale.shoreline
        ? edge * whale.orbit
        : Math.min(whale.orbit, edge * 0.58);
      const x = sea.x + Math.cos(angle) * sea.rx * radius;
      const z = sea.z + Math.sin(angle) * sea.rz * radius;
      if (player) {
        const distance = Math.hypot(player.x - x, player.z - z);
        child.visible = distance < range;
        if (!child.visible) continue;
      }
      // Slow breathing cycle: break the surface, then slip under.
      const breath = Math.sin(t * 0.35 + whale.phase * 3);
      const surfaced = Math.max(0, breath);
      const y = waterSurfaceY(sea.x, sea.z)
        - whale.dive * (0.3 + (1 - surfaced) * 0.45)
        - whale.size * (0.2 - surfaced * 0.1);
      child.position.set(x, y, z);
      // Face along the direction of travel.
      child.rotation.y = -angle + (whale.speed > 0 ? -Math.PI / 2 : Math.PI / 2);
      child.rotation.z = breath * 0.12;
    }
  });

  return (
    <group ref={group}>
      {whales.map((whale, i) => (
        <group key={i}>
          <InscribedModel url={contentUrl(WHALE_INSCRIPTION)} size={whale.size} />
        </group>
      ))}
    </group>
  );
});

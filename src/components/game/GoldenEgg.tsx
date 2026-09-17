/**
 * THE HIDDEN GOLDEN EGG.
 *
 * The inscribed egg hovers and turns just above the sand, wrapped in a faint
 * glow that only shows once you are close, so hunting it means walking the zone
 * rather than reading a marker off the map. Its hiding place changes every UTC
 * day.
 */

import { Suspense, memo, useMemo, useRef, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import {
  EGG_INSCRIPTION,
  EGG_REACH,
  eggClaimCount,
  eggClaimed,
  eggDay,
  eggSecuredAt,
  eggVersion,
  setEggProbe,
  subscribeEgg,
} from "@/lib/world-egg";

/** How long the sealing flourish plays after the relic is taken, in seconds. */
const SECURE_TIME = 1.8;

const EGG_URL = contentUrl(EGG_INSCRIPTION);
const noRaycast = () => {};
const GOLD = "#f7931a";

function hash(x: number, z: number, salt: number) {
  const n = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Text to a stable number, so a date can seed a hiding place. */
function seedOf(text: string) {
  let acc = 0;
  for (let i = 0; i < text.length; i++) acc = (acc * 31 + text.charCodeAt(i)) % 100000;
  return acc;
}

export const GoldenEgg = memo(function GoldenEgg({
  unit,
  pose,
}: {
  unit: number;
  pose: { current: { x: number; z: number } | null };
}) {
  const zone = unit * 60;
  const day = eggDay();

  const spot = useMemo(() => {
    const player = pose.current;
    const zx = Math.floor((player?.x ?? 0) / zone);
    const zz = Math.floor((player?.z ?? 0) / zone);
    const seed = seedOf(`${day}`);
    const x = (zx + hash(zx + seed, zz, 91)) * zone;
    const z = (zz + hash(zx, zz + seed, 92)) * zone;
    return { id: `${day}:${zx}:${zz}`, x, z };
    // Re-hidden when the day turns; the zone follows the hunter as they travel.
  }, [day, pose, zone]);

  const group = useRef<THREE.Group>(null);
  const halo = useRef<THREE.MeshBasicMaterial>(null);
  const probe = useRef(0);

  useFrame(({ clock }, delta) => {
    const player = pose.current;
    if (group.current) {
      group.current.rotation.y += delta * 0.9;
      group.current.position.y = unit * (0.45 + Math.sin(clock.elapsedTime * 1.6) * 0.08);
    }
    if (!player) return;
    const distance = Math.hypot(player.x - spot.x, player.z - spot.z);
    if (halo.current) {
      const near = Math.max(0, 1 - distance / (unit * 14));
      halo.current.opacity = near * (0.25 + Math.abs(Math.sin(clock.elapsedTime * 3)) * 0.4);
    }
    probe.current -= delta;
    if (probe.current > 0) return;
    probe.current = 0.25;
    setEggProbe({
      x: spot.x,
      z: spot.z,
      distance,
      id: spot.id,
      claimed: eggClaimed(spot.id),
    });
  });

  if (eggClaimed(spot.id)) return null;

  return (
    <group position={[spot.x, 0, spot.z]}>
      <group ref={group}>
        <Suspense
          fallback={
            <mesh raycast={noRaycast}>
              <sphereGeometry args={[unit * 0.16, 10, 8]} />
              <meshLambertMaterial color={GOLD} flatShading />
            </mesh>
          }
        >
          <InscribedModel url={EGG_URL} size={unit * 0.45} />
        </Suspense>
      </group>
      {/* the glow that gives it away from a few paces off */}
      <mesh position={[0, unit * 0.5, 0]} raycast={noRaycast}>
        <sphereGeometry args={[unit * EGG_REACH * 0.5, 12, 10]} />
        <meshBasicMaterial ref={halo} color={GOLD} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
});

useGLTF.preload(EGG_URL);

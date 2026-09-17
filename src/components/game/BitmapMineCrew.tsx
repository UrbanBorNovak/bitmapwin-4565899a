/**
 * MINERS ON YOUR OWN LAND — the inscribed crew working the BITMAPs you hold.
 *
 * A couple of miners stand on each held tile near you and swing away at the
 * ground. Where they stand is worked out from the tile itself, so the same crew
 * is in the same spot every time you come back. They are scenery with a job:
 * nothing here raycasts, and only the handful of tiles closest to you is drawn.
 */

import { Suspense, memo, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import type { PlayerState } from "@/lib/player-state";
import { tileCentre, tileOfHeight } from "@/lib/world-grid";
import { groundY } from "@/lib/world-terrain";

/** on-chain GLB inscription of the miner */
export const BITMAP_MINER_INSCRIPTION =
  "1b8e73e89f510dfa3ac863bcaab6be76688f51cb231c42483c7b84db60b80301i0";

const MINER_URL = contentUrl(BITMAP_MINER_INSCRIPTION);

/** Miners per tile, and how many of your tiles are dressed at once. */
const CREW = 2;
const MAX_TILES = 6;

const noRaycast = () => {};

function hash(a: number, b: number) {
  const n = Math.sin(a * 91.37 + b * 47.13) * 33_871.4471;
  return n - Math.floor(n);
}

/** One miner, leaning into a swing on a loop of its own. */
function Miner({ unit, seed, yaw }: { unit: number; seed: number; yaw: number }) {
  const body = useRef<THREE.Group>(null);
  const dust = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 2.1 + seed * Math.PI * 2;
    const swing = Math.sin(t);
    if (body.current) {
      body.current.rotation.x = 0.22 + swing * 0.26;
      body.current.position.y = Math.max(0, -swing) * unit * 0.08;
    }
    if (dust.current) {
      const puff = Math.max(0, -swing) ** 2;
      dust.current.scale.setScalar(0.25 + puff * 1.1);
      (dust.current.material as THREE.MeshBasicMaterial).opacity = puff * 0.32;
    }
  });

  return (
    <group rotation-y={yaw}>
      <group ref={body}>
        <Suspense fallback={null}>
          <InscribedModel url={MINER_URL} size={unit * 1.9} />
        </Suspense>
      </group>
      <mesh ref={dust} position={[0, unit * 0.14, unit * 0.5]} raycast={noRaycast}>
        <sphereGeometry args={[unit * 0.3, 8, 6]} />
        <meshBasicMaterial color="#c9a878" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** The crews on the held BITMAPs closest to the visitor. */
export const BitmapMineCrew = memo(function BitmapMineCrew({
  unit,
  pose,
  heights,
}: {
  unit: number;
  pose: React.RefObject<PlayerState>;
  heights: number[];
}) {
  const [near, setNear] = useState<number[]>([]);
  const last = useRef(0);

  const spots = useMemo(() => {
    const map = new Map<number, { x: number; z: number }>();
    for (const height of heights) {
      const { col, row } = tileOfHeight(height);
      map.set(height, tileCentre(col, row));
    }
    return map;
  }, [heights]);

  useFrame(({ clock }) => {
    const now = clock.getElapsedTime();
    if (now - last.current < 1.5) return;
    last.current = now;
    const player = pose.current;
    if (!player) return;
    const ranked = [...spots.entries()]
      .map(([height, at]) => ({
        height,
        d: (at.x - player.x) ** 2 + (at.z - player.z) ** 2,
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_TILES)
      .map((entry) => entry.height);
    setNear((current) =>
      current.length === ranked.length && current.every((h, i) => h === ranked[i])
        ? current
        : ranked,
    );
  });

  return (
    <>
      {near.map((height) => {
        const at = spots.get(height);
        if (!at) return null;
        return (
          <group key={height} position={[at.x, groundY(at.x, at.z), at.z]}>
            {Array.from({ length: CREW }, (_, i) => {
              const angle = hash(height, i) * Math.PI * 2;
              const reach = unit * (1.4 + hash(height + i, i * 7) * 1.6);
              return (
                <group
                  key={i}
                  position={[Math.cos(angle) * reach, 0, Math.sin(angle) * reach]}
                >
                  <Miner unit={unit} seed={hash(height, i + 11)} yaw={angle + Math.PI} />
                </group>
              );
            })}
          </group>
        );
      })}
    </>
  );
});

useGLTF.preload(MINER_URL);

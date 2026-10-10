import { useRef, useSyncExternalStore, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import * as THREE from "three";
import { GuardianBody } from "@/components/bitmon/GuardianBody";
import { guardianQuery } from "@/lib/bitmon-queries";
import { mountRev, mountState, setStanding, subscribeMount } from "@/lib/guardian-mount";
import { STRIDE, WORLD_GRID, cellX, cellZ, type PlayerState } from "@/lib/player-state";

const S = STRIDE;
const noRaycast = () => null;

function Shard({ height, surface }: { height: number; surface: (x: number, z: number) => number }) {
  const ref = useRef<THREE.Group>(null);
  const x = cellX(height % WORLD_GRID);
  const z = cellZ(Math.floor(height / WORLD_GRID));
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    g.position.set(x, surface(x, z) + S * 3 + Math.sin(clock.elapsedTime * 1.6) * S * 0.4, z);
    g.rotation.y = clock.elapsedTime * 0.9;
  });
  return (
    <group ref={ref}>
      <mesh raycast={noRaycast}>
        <octahedronGeometry args={[S * 1.4, 0]} />
        <meshStandardMaterial color="#f7931a" emissive="#f7931a" emissiveIntensity={1.6} roughness={0.3} />
      </mesh>
      <mesh raycast={noRaycast} position={[0, S * 10, 0]}>
        <cylinderGeometry args={[S * 0.15, S * 0.15, S * 20, 6, 1, true]} />
        <meshBasicMaterial color="#f7931a" transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Mount({ height, pose, surface }: { height: number; pose: MutableRefObject<PlayerState>; surface: (x: number, z: number) => number }) {
  const g = useQuery(guardianQuery(height)).data;
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const p = pose.current;
    const r = ref.current;
    if (!r) return;
    const moving = Math.hypot(p.vx, p.vz) > S;
    r.position.set(p.x, surface(p.x, p.z) + (moving ? Math.abs(Math.sin(clock.elapsedTime * 9)) * S * 0.25 : 0), p.z);
    r.rotation.y = p.yaw;
  });
  if (!g) return null;
  return (
    <group ref={ref}>
      <GuardianBody species={g.species} rarity={g.rarity} body={g.body} accent={g.accent} unit={S * 2.2} height={g.height} inscribed={!!g.inscriptionId} />
    </group>
  );
}

/** Raid shards on their real BITMAPs, plus the Guardian you ride. */
export function ShardRaidLayer({ pose, surface }: { pose: MutableRefObject<PlayerState>; surface: (x: number, z: number) => number }) {
  useSyncExternalStore(subscribeMount, mountRev, () => 0);
  const st = mountState();
  useFrame(() => setStanding(pose.current.height));
  return (
    <>
      {st.shards.filter((h) => !st.gathered.includes(h)).map((h) => <Shard key={h} height={h} surface={surface} />)}
      {st.riding !== null ? <Mount height={st.riding} pose={pose} surface={surface} /> : null}
    </>
  );
}

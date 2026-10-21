/** Café atmosphere: drifting smoke voxels and fly-brain patrons wearing unused BITMAP Pixels. */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, InstancedMesh } from "three";
import { Object3D } from "three";
import { createFlyBrain } from "@/lib/fly-brain";
import { ToonPixelRig } from "@/components/toon/ToonPixelRig";

/** Unused BITMAP Pixels (block 881,133 collection) worn by background patrons. */
export const CAFE_PATRONS = [
  { name: "Bitmap Bot", skin: "0b7f542de9d57c4944240b11e9ec49c8e8099506317efbb7e84546fa9e299f9ei0", start: [2.6, 0.6] },
  { name: "Astral", skin: "67d87f13c5636287189129463b1741320fdbf3e9963efe22baab5807eb522560i0", start: [-0.6, 0.2] },
  { name: "Fred the Frog", skin: "c9d85dd85ee24d8afc0d2b86986abd29672f3cc4dbe88cab5ed3283fb431f721i0", start: [0.4, 3.0] },
] as const;

// Walkable floor minus booth, bar, hatch and door swing.
const BOUNDS = { x0: -1.0, x1: 3.4, z0: -1.3, z1: 3.4 };
const blocked = (x: number, z: number) => Math.abs(x - 1.4) < 0.95 && Math.abs(z - 1.4) < 0.95;

function Patron({ skin, start, seed }: { skin: string; start: readonly [number, number]; seed: number }) {
  const g = useRef<Group>(null);
  const moving = useRef(false);
  const s = useMemo(() => ({ brain: createFlyBrain(seed), x: start[0], z: start[1], h: seed * 2.1, pause: 0 }), [seed, start]);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const act = s.brain.think({ now: performance.now(), hp: 1, maxHp: 1, snared: false, heading: s.h, playerDistance: null, playerAngle: 0, workDistance: null, workAngle: 0, worker: false, hostile: false, vendor: false }, dt);
    s.h += act.steer;
    const rest = act.state === "rest" || act.throttle < 0.15;
    const sp = rest ? 0 : 0.55 * act.throttle;
    let nx = s.x + Math.sin(s.h) * sp * dt, nz = s.z + Math.cos(s.h) * sp * dt;
    if (nx < BOUNDS.x0 || nx > BOUNDS.x1 || nz < BOUNDS.z0 || nz > BOUNDS.z1 || blocked(nx, nz)) {
      s.h = Math.atan2(1 - s.x, 1.2 - s.z) + (Math.random() - 0.5); nx = s.x; nz = s.z;
    }
    s.x = nx; s.z = nz; moving.current = sp > 0.05;
    if (g.current) { g.current.position.set(s.x, 0, s.z); g.current.rotation.y += (((s.h - g.current.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 8); }
  });
  return <group ref={g} scale={0.9}><ToonPixelRig inscriptionId={skin} pose="idle" movingRef={moving} fallback={null} /></group>;
}

export function CafePatrons() {
  return <>{CAFE_PATRONS.map((p, i) => <Patron key={p.skin} skin={p.skin} start={p.start} seed={i * 7.31 + 1.7} />)}</>;
}

/** Slowly rising, swirling smoke voxels plus a low floor mist layer. */
export function CafeSmoke({ count = 90 }: { count?: number }) {
  const m = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const parts = useMemo(() => Array.from({ length: count }, (_, i) => ({ x: (Math.random() - 0.5) * 7, z: (Math.random() - 0.5) * 7, y: Math.random() * 4, v: 0.08 + Math.random() * 0.15, p: i * 1.37, s: 0.15 + Math.random() * 0.3 })), [count]);
  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05), t = clock.elapsedTime;
    if (!m.current) return;
    parts.forEach((q, i) => {
      q.y += q.v * dt; if (q.y > 4) { q.y = 0; q.x = (Math.random() - 0.5) * 7; q.z = (Math.random() - 0.5) * 7; }
      const life = Math.sin((q.y / 4) * Math.PI);
      dummy.position.set(q.x + Math.sin(t * 0.3 + q.p) * 0.4, q.y, q.z + Math.cos(t * 0.25 + q.p) * 0.4);
      dummy.rotation.set(t * 0.1 + q.p, t * 0.13, 0);
      dummy.scale.setScalar(q.s * (0.5 + q.y * 0.35) * life + 0.001);
      dummy.updateMatrix(); m.current!.setMatrixAt(i, dummy.matrix);
    });
    m.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={m} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#d8c4b0" transparent opacity={0.07} depthWrite={false} />
      </instancedMesh>
      {[0.15, 0.4].map((y, i) => (
        <mesh key={y} rotation-x={-Math.PI / 2} position={[0, y, 0]}>
          <planeGeometry args={[8, 8]} />
          <meshBasicMaterial color={i ? "#ffb070" : "#a8b8c8"} transparent opacity={0.05} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

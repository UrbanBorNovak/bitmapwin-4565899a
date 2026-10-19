import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Object3D, type Group, type InstancedMesh } from "three";

/** Deterministic pseudo-random so the set is identical every play, scrub and export. */
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; }

const WAVE_N = 26 * 10;

/** Original voxel coastal-landing film set: grey sea, landing craft, steel obstacles, dunes, bunkers and drifting smoke.
 * Animation reads the episode timeline only, so playback and exports match. */
export function BeachSet({ timeRef }: { timeRef: MutableRefObject<number> }) {
  const waves = useRef<InstancedMesh>(null), smoke = useRef<InstancedMesh>(null), boats = useRef<Group>(null);
  const hedgehogs = useMemo(() => { const r = rng(1944); return Array.from({ length: 22 }, () => ({ x: (r() - 0.5) * 80, z: -6 + r() * 13, a: r() * Math.PI })); }, []);
  const puffs = useMemo(() => { const r = rng(606); return Array.from({ length: 40 }, () => ({ x: (r() - 0.5) * 90, z: -14 + r() * 20, s: 1 + r() * 2, o: r() * 10 })); }, []);
  const tmp = useMemo(() => new Object3D(), []);

  useLayoutEffect(() => {
    const m = waves.current; if (!m) return;
    for (let i = 0; i < WAVE_N; i++) { tmp.position.set(-65 + (i % 26) * 5, -0.3, 10 + Math.floor(i / 26) * 5); tmp.scale.set(5, 0.5, 5); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); }
    m.instanceMatrix.needsUpdate = true;
  }, [tmp]);

  useFrame(() => {
    const t = timeRef.current;
    const w = waves.current;
    if (w) {
      for (let i = 0; i < WAVE_N; i++) { const gx = i % 26, gz = Math.floor(i / 26);
        tmp.position.set(-65 + gx * 5, -0.35 + Math.sin(t * 1.6 + gx * 0.7 + gz * 1.1) * 0.2, 10 + gz * 5); tmp.scale.set(5, 0.5, 5); tmp.updateMatrix(); w.setMatrixAt(i, tmp.matrix); }
      w.instanceMatrix.needsUpdate = true;
    }
    const s = smoke.current;
    if (s) {
      puffs.forEach((p, i) => { const k = ((t + p.o) % 10) / 10;
        tmp.position.set(p.x + k * 4, 0.5 + k * 9, p.z); const sc = p.s * (0.6 + k * 1.6); tmp.scale.set(sc, sc, sc); tmp.updateMatrix(); s.setMatrixAt(i, tmp.matrix); });
      s.instanceMatrix.needsUpdate = true;
    }
    boats.current?.children.forEach((b, i) => { b.position.y = Math.sin(t * 1.3 + i) * 0.2; b.rotation.z = Math.sin(t * 0.9 + i * 2) * 0.05; });
  });

  return (
    <group scale={3}>
      {/* wet sand + dry sand */}
      <mesh position={[0, -0.6, 2]}><boxGeometry args={[140, 1.2, 18]} /><meshStandardMaterial color="#b6a27a" roughness={1} /></mesh>
      <mesh position={[0, -0.5, -18]}><boxGeometry args={[140, 1.2, 22]} /><meshStandardMaterial color="#cdb98c" roughness={1} /></mesh>
      {/* sea floor + voxel waves */}
      <mesh position={[0, -1.2, 35]}><boxGeometry args={[140, 1, 50]} /><meshStandardMaterial color="#3b4a52" /></mesh>
      <instancedMesh ref={waves} args={[undefined, undefined, WAVE_N]} raycast={() => null}>
        <boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#56707c" roughness={0.4} transparent opacity={0.9} />
      </instancedMesh>
      {/* dunes */}
      {[-56, -28, 0, 28, 56].map((x, i) => <mesh key={x} position={[x, 1.5 + (i % 2), -16]}><boxGeometry args={[28, 4 + (i % 2) * 2, 6]} /><meshStandardMaterial color="#a89466" roughness={1} /></mesh>)}
      {/* bunkers */}
      {[-36, 4, 40].map((x) => (
        <group key={x} position={[x, 5, -20]}>
          <mesh><boxGeometry args={[8, 4, 5]} /><meshStandardMaterial color="#7d7c76" roughness={1} /></mesh>
          <mesh position={[0, 0.3, 2.55]}><boxGeometry args={[5, 0.8, 0.2]} /><meshStandardMaterial color="#1c1c1c" /></mesh>
        </group>
      ))}
      {/* steel beach obstacles */}
      {hedgehogs.map((h, i) => (
        <group key={i} position={[h.x, 0.5, h.z]} scale={0.45} rotation={[0, h.a, 0]}>
          <mesh rotation={[0.6, 0, 0.6]}><boxGeometry args={[0.5, 4, 0.5]} /><meshStandardMaterial color="#3e3a36" metalness={0.4} /></mesh>
          <mesh rotation={[-0.6, 0, 0.6]}><boxGeometry args={[0.5, 4, 0.5]} /><meshStandardMaterial color="#3e3a36" metalness={0.4} /></mesh>
          <mesh rotation={[0, 0, -0.9]}><boxGeometry args={[0.5, 4, 0.5]} /><meshStandardMaterial color="#3e3a36" metalness={0.4} /></mesh>
        </group>
      ))}
      {/* landing craft */}
      <group ref={boats}>
        {([[-2, 13], [12, 17], [-17, 18], [26, 15]] as const).map(([x, z]) => (
          <group key={x} position={[x, 0, z]} scale={0.55}>
            <group position={[0, 0, 0]}>
              <mesh position={[0, 1.6, 0]}><boxGeometry args={[9, 3.2, 16]} /><meshStandardMaterial color="#5a6550" roughness={0.9} /></mesh>
              <mesh position={[0, 2.4, -8.2]}><boxGeometry args={[9, 4.8, 0.6]} /><meshStandardMaterial color="#4c5644" /></mesh>
              <mesh position={[0, 0.6, 0]}><boxGeometry args={[7.6, 1, 14]} /><meshStandardMaterial color="#2f342b" /></mesh>
            </group>
          </group>
        ))}
      </group>
      {/* drifting smoke */}
      <instancedMesh ref={smoke} args={[undefined, undefined, puffs.length]} raycast={() => null}>
        <boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#9a9a96" transparent opacity={0.45} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

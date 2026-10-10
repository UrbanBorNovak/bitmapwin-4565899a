import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clock, dropState, matchById, planeAt, stormAt, DROP, MATCH } from "@/lib/battle-royale";
import { STRIDE, type PlayerState } from "@/lib/player-state";

const S = STRIDE;
const noRaycast = () => null;
const CRATE_COLOR = { medkit: "#e8e2cf", bigmed: "#f7931a", shield: "#00f0ff" } as const;

/** Shared dropship, storm wall and loot crates — same for every visitor (clock-scheduled). */
export function DropshipLayer({ pose, surface }: { pose: MutableRefObject<PlayerState>; surface: (x: number, z: number) => number }) {
  const plane = useRef<THREE.Group>(null);
  const glider = useRef<THREE.Group>(null);
  const wall = useRef<THREE.Mesh>(null);
  const crates = useRef<THREE.Group>(null);
  const props = useRef<THREE.Mesh[]>([]);
  const wallMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#00f0ff", transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    [],
  );

  useFrame(({ clock: c }) => {
    const { id, t } = clock();
    const m = matchById(id);
    const p = pose.current;
    const g = plane.current;
    if (g) {
      const at = planeAt(m, t);
      g.visible = at.flying;
      if (at.flying) {
        g.position.set(at.x, surface(m.cx, m.cz) + DROP.altitude, at.z);
        g.rotation.set(0, at.yaw, Math.sin(c.elapsedTime * 0.8) * 0.03);
        for (const pr of props.current) pr.rotation.z = c.elapsedTime * 40;
      }
    }
    const storm = stormAt(m, t);
    const w = wall.current;
    if (w) {
      w.visible = Boolean(storm);
      if (storm) {
        w.position.set(storm.x, surface(storm.x, storm.z) + S * 60, storm.z);
        w.scale.set(storm.r, 1, storm.r);
        wallMat.opacity = 0.16 + Math.sin(c.elapsedTime * 3) * 0.05 + (storm.shrinking ? 0.08 : 0);
      }
    }
    const cg = crates.current;
    if (cg) {
      const st = dropState();
      const show = t >= MATCH.lobby;
      cg.children.forEach((child, i) => {
        const cr = m.crates[i];
        if (!cr) return void (child.visible = false);
        child.visible = show && !st.opened.has(`${id}:${cr.id}`) && Math.hypot(cr.x - p.x, cr.z - p.z) < S * 400;
        if (child.visible) {
          child.position.set(cr.x, surface(cr.x, cr.z) + S * 0.8 + Math.sin(c.elapsedTime * 2 + i) * S * 0.2, cr.z);
          child.rotation.y = c.elapsedTime * 0.6 + i;
          const mesh = child as THREE.Mesh;
          (mesh.material as THREE.MeshStandardMaterial).color.set(CRATE_COLOR[cr.kind]);
        }
      });
    }
    const gl = glider.current;
    if (gl) {
      gl.visible = dropState().phase === "glide";
      if (gl.visible) {
        gl.position.set(p.x, surface(p.x, p.z) + p.y + S * 2.1, p.z);
        gl.rotation.set(0.12, p.yaw, Math.sin(c.elapsedTime * 1.3) * 0.05);
      }
    }
  });

  const addProp = (m: THREE.Mesh | null) => {
    if (m && !props.current.includes(m)) props.current.push(m);
  };

  return (
    <>
      <mesh ref={wall} visible={false} raycast={noRaycast} material={wallMat} renderOrder={5}>
        <cylinderGeometry args={[1, 1, S * 160, 64, 1, true]} />
      </mesh>
      <group ref={crates}>
        {Array.from({ length: MATCH.crates }, (_, i) => (
          <mesh key={i} raycast={noRaycast} visible={false} castShadow>
            <boxGeometry args={[S * 1.4, S * 1.4, S * 1.4]} />
            <meshStandardMaterial color="#e8e2cf" emissive="#f7931a" emissiveIntensity={0.25} roughness={0.7} />
          </mesh>
        ))}
      </group>
      <group ref={plane} visible={false}>
        <mesh raycast={noRaycast}>
          <boxGeometry args={[S * 3, S * 3, S * 22]} />
          <meshStandardMaterial color="#3a4350" roughness={0.6} metalness={0.3} />
        </mesh>
        <mesh raycast={noRaycast} position={[0, S * 1.2, S * 8]}>
          <boxGeometry args={[S * 2.4, S * 1.2, S * 3]} />
          <meshStandardMaterial color="#7ad7f0" roughness={0.2} metalness={0.6} />
        </mesh>
        <mesh raycast={noRaycast} position={[0, S * 0.8, S * 1]}>
          <boxGeometry args={[S * 28, S * 0.5, S * 4.5]} />
          <meshStandardMaterial color="#4a5462" roughness={0.6} />
        </mesh>
        <mesh raycast={noRaycast} position={[0, S * 1.1, S * 1]}>
          <boxGeometry args={[S * 28.2, S * 0.2, S * 1]} />
          <meshStandardMaterial color="#f7931a" emissive="#f7931a" emissiveIntensity={0.4} />
        </mesh>
        <mesh raycast={noRaycast} position={[0, S * 3.2, -S * 9.5]}>
          <boxGeometry args={[S * 0.5, S * 4.5, S * 3]} />
          <meshStandardMaterial color="#f7931a" />
        </mesh>
        <mesh raycast={noRaycast} position={[0, S * 1.2, -S * 9.8]}>
          <boxGeometry args={[S * 10, S * 0.4, S * 2.4]} />
          <meshStandardMaterial color="#4a5462" />
        </mesh>
        {[-7, 7].map((x) => (
          <group key={x} position={[S * x, S * 0.1, S * 3]}>
            <mesh raycast={noRaycast}>
              <boxGeometry args={[S * 2, S * 2, S * 5]} />
              <meshStandardMaterial color="#2a3038" metalness={0.5} />
            </mesh>
            <mesh ref={addProp} raycast={noRaycast} position={[0, 0, S * 2.7]}>
              <boxGeometry args={[S * 5, S * 0.4, S * 0.2]} />
              <meshStandardMaterial color="#111" />
            </mesh>
          </group>
        ))}
        <mesh raycast={noRaycast} position={[-S * 14, S * 0.8, S * 1]}>
          <boxGeometry args={[S * 0.6, S * 0.6, S * 0.6]} />
          <meshBasicMaterial color="#ff3b3b" />
        </mesh>
        <mesh raycast={noRaycast} position={[S * 14, S * 0.8, S * 1]}>
          <boxGeometry args={[S * 0.6, S * 0.6, S * 0.6]} />
          <meshBasicMaterial color="#00f0ff" />
        </mesh>
      </group>
      <group ref={glider} visible={false}>
        <mesh raycast={noRaycast}>
          <boxGeometry args={[S * 3.4, S * 0.15, S * 1.3]} />
          <meshStandardMaterial color="#f7931a" side={THREE.DoubleSide} />
        </mesh>
        {[-1, 1].map((sd) => (
          <mesh key={sd} raycast={noRaycast} position={[sd * S * 1.9, -S * 0.15, 0]} rotation={[0, 0, sd * -0.5]}>
            <boxGeometry args={[S * 0.9, S * 0.12, S * 1.2]} />
            <meshStandardMaterial color="#f4f1de" />
          </mesh>
        ))}
      </group>
    </>
  );
}

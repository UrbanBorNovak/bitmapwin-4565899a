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
  const props = useRef<THREE.Object3D[]>([]);
  const strobes = useRef<THREE.Mesh[]>([]);
  const jumpLight = useRef<THREE.Mesh>(null);
  const marker = useRef<THREE.Mesh>(null);
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
        const blink = Math.floor(c.elapsedTime * 1.4) % 2 === 0;
        strobes.current.forEach((sm, i) => { sm.visible = i < 2 || blink; });
        if (jumpLight.current) (jumpLight.current.material as THREE.MeshBasicMaterial).color.set(at.p < 0.08 ? "#ff3b3b" : "#3bff7a");
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
    const mk = marker.current;
    if (mk) {
      const ph = dropState().phase;
      mk.visible = ph === "freefall" || ph === "glide";
      if (mk.visible) {
        const tFall = Math.min(p.y / Math.max(-p.vy, S * 2), 12);
        const lx = p.x + p.vx * tFall, lz = p.z + p.vz * tFall;
        mk.position.set(lx, surface(lx, lz) + S * 0.15, lz);
        const k = 1 + Math.sin(c.elapsedTime * 4) * 0.12;
        mk.scale.set(k, k, k);
      }
    }
    const gl = glider.current;
    if (gl) {
      gl.visible = dropState().phase === "glide";
      if (gl.visible) {
        gl.position.set(p.x, surface(p.x, p.z) + p.y + S * 2.1, p.z);
        gl.position.y += S * 1.2;
        gl.rotation.set(0.12, p.yaw, Math.sin(c.elapsedTime * 1.3) * 0.08);
      }
    }
  });

  const addStrobe = (m: THREE.Mesh | null) => {
    if (m && !strobes.current.includes(m)) strobes.current.push(m);
  };
  const addProp = (m: THREE.Object3D | null) => {
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
        {/* C-130 style transport: fuselage, nose, cockpit, open rear ramp */}
        <mesh raycast={noRaycast} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[S * 1.9, S * 1.9, S * 18, 14]} />
          <meshStandardMaterial color="#56604a" roughness={0.75} metalness={0.25} />
        </mesh>
        <mesh raycast={noRaycast} position={[0, -S * 0.1, S * 10.2]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[S * 1.9, S * 3, 14]} />
          <meshStandardMaterial color="#4b5440" roughness={0.7} />
        </mesh>
        <mesh raycast={noRaycast} position={[0, S * 1.1, S * 9.6]} rotation={[-0.5, 0, 0]}>
          <boxGeometry args={[S * 2.2, S * 0.7, S * 1.6]} />
          <meshStandardMaterial color="#1c2a33" emissive="#7ad7f0" emissiveIntensity={0.25} roughness={0.1} metalness={0.8} />
        </mesh>
        <mesh raycast={noRaycast} position={[0, S * 0.6, -S * 11.5]} rotation={[Math.PI / 2 - 0.25, 0, 0]}>
          <cylinderGeometry args={[S * 0.9, S * 1.9, S * 5, 14]} />
          <meshStandardMaterial color="#56604a" roughness={0.75} />
        </mesh>
        <mesh raycast={noRaycast} position={[0, -S * 1.9, -S * 10.5]} rotation={[0.55, 0, 0]}>
          <boxGeometry args={[S * 2.8, S * 0.2, S * 4]} />
          <meshStandardMaterial color="#3c4433" />
        </mesh>
        <mesh ref={jumpLight} raycast={noRaycast} position={[0, S * 0.6, -S * 8.9]}>
          <boxGeometry args={[S * 2.6, S * 2.4, S * 0.1]} />
          <meshBasicMaterial color="#ff3b3b" />
        </mesh>
        {/* high wing + bitcoin stripe */}
        <mesh raycast={noRaycast} position={[0, S * 1.95, S * 1.5]}>
          <boxGeometry args={[S * 36, S * 0.45, S * 4.2]} />
          <meshStandardMaterial color="#4b5440" roughness={0.7} />
        </mesh>
        <mesh raycast={noRaycast} position={[0, S * 2.2, S * 0.2]}>
          <boxGeometry args={[S * 36.2, S * 0.1, S * 0.7]} />
          <meshStandardMaterial color="#f7931a" emissive="#f7931a" emissiveIntensity={0.35} />
        </mesh>
        {/* tail fin + stabiliser */}
        <mesh raycast={noRaycast} position={[0, S * 4.2, -S * 12.6]}>
          <boxGeometry args={[S * 0.4, S * 5.5, S * 3.2]} />
          <meshStandardMaterial color="#4b5440" />
        </mesh>
        <mesh raycast={noRaycast} position={[0, S * 5.3, -S * 12.8]}>
          <boxGeometry args={[S * 0.45, S * 1.2, S * 2.4]} />
          <meshStandardMaterial color="#f7931a" />
        </mesh>
        <mesh raycast={noRaycast} position={[0, S * 2, -S * 13]}>
          <boxGeometry args={[S * 13, S * 0.3, S * 2.6]} />
          <meshStandardMaterial color="#4b5440" />
        </mesh>
        {/* four turboprops */}
        {[-12, -6, 6, 12].map((x) => (
          <group key={x} position={[S * x, S * 1.5, S * 3.6]}>
            <mesh raycast={noRaycast} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[S * 0.75, S * 0.6, S * 4.4, 10]} />
              <meshStandardMaterial color="#2f352a" metalness={0.5} roughness={0.5} />
            </mesh>
            <mesh raycast={noRaycast} position={[0, 0, S * 2.4]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[S * 0.35, S * 0.8, 8]} />
              <meshStandardMaterial color="#1a1a1a" metalness={0.6} />
            </mesh>
            <group ref={addProp} position={[0, 0, S * 2.3]}>
              {[0, 1].map((k) => (
                <mesh key={k} raycast={noRaycast} rotation={[0, 0, (k * Math.PI) / 2]}>
                  <boxGeometry args={[S * 4.2, S * 0.3, S * 0.08]} />
                  <meshStandardMaterial color="#111" transparent opacity={0.7} />
                </mesh>
              ))}
            </group>
            <mesh raycast={noRaycast} position={[0, 0, -S * 9]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[S * 0.15, S * 0.5, S * 14, 6, 1, true]} />
              <meshBasicMaterial color="#e8eef2" transparent opacity={0.12} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
        {/* nav strobes */}
        <mesh ref={addStrobe} raycast={noRaycast} position={[-S * 18, S * 2, S * 1.5]}>
          <sphereGeometry args={[S * 0.35, 6, 6]} />
          <meshBasicMaterial color="#ff3b3b" />
        </mesh>
        <mesh ref={addStrobe} raycast={noRaycast} position={[S * 18, S * 2, S * 1.5]}>
          <sphereGeometry args={[S * 0.35, 6, 6]} />
          <meshBasicMaterial color="#3bff7a" />
        </mesh>
        <mesh ref={addStrobe} raycast={noRaycast} position={[0, S * 7, -S * 13]}>
          <sphereGeometry args={[S * 0.3, 6, 6]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
      <mesh ref={marker} visible={false} raycast={noRaycast} rotation={[-Math.PI / 2, 0, 0]} renderOrder={6}>
        <ringGeometry args={[S * 2.2, S * 3, 32]} />
        <meshBasicMaterial color="#f7931a" transparent opacity={0.8} depthTest={false} depthWrite={false} />
      </mesh>
      {/* ram-air parachute canopy with suspension lines */}
      <group ref={glider} visible={false}>
        {[-2, -1, 0, 1, 2].map((i) => (
          <mesh key={i} raycast={noRaycast} position={[i * S * 0.72, -Math.abs(i) * S * 0.18, 0]} rotation={[0, 0, -i * 0.14]}>
            <boxGeometry args={[S * 0.7, S * 0.32, S * 1.5]} />
            <meshStandardMaterial color={i % 2 ? "#f4f1de" : "#f7931a"} roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
        ))}
        {[-1, 1].flatMap((sd) => [-0.5, 0.5].map((fz) => (
          <mesh key={`${sd}${fz}`} raycast={noRaycast} position={[sd * S * 0.9, -S * 1.05, fz * S * 0.6]} rotation={[fz * 0.5, 0, sd * 0.5]}>
            <cylinderGeometry args={[S * 0.015, S * 0.015, S * 2.2, 3]} />
            <meshBasicMaterial color="#222" />
          </mesh>
        )))}
      </group>
    </>
  );
}

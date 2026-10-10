import { useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { dropState, planeAt, planeProgress } from "@/lib/battle-royale";
import { STRIDE, traversalSurfaceY, type PlayerState } from "@/lib/player-state";

const S = STRIDE;
const noRaycast = () => null;

/** Voxel cargo plane + the glider canopy over the diver. Visible only during a drop. */
export function DropshipLayer({ pose }: { pose: MutableRefObject<PlayerState> }) {
  const plane = useRef<THREE.Group>(null);
  const glider = useRef<THREE.Group>(null);
  const props = useRef<THREE.Mesh[]>([]);

  useFrame(({ clock }) => {
    const st = dropState();
    const g = plane.current;
    if (g) {
      // The plane keeps flying on after you jump until its line ends.
      const at = st.path ? planeAt(st.phase === "plane" ? planeProgress() : Math.min(1, planeProgress() + 0)) : null;
      g.visible = Boolean(at);
      if (at) {
        g.position.set(at.x, at.y, at.z);
        g.rotation.set(0, at.yaw, Math.sin(clock.elapsedTime * 0.8) * 0.03);
        for (const p of props.current) p.rotation.z = clock.elapsedTime * 40;
      }
    }
    const gl = glider.current;
    if (gl) {
      const p = pose.current;
      gl.visible = st.phase === "glide";
      if (gl.visible) {
        gl.position.set(p.x, traversalSurfaceY(p.x, p.z) + p.y + S * 2.1, p.z);
        gl.rotation.set(0.12, p.yaw, Math.sin(clock.elapsedTime * 1.3) * 0.05);
      }
    }
  });

  const addProp = (m: THREE.Mesh | null) => {
    if (m && !props.current.includes(m)) props.current.push(m);
  };

  return (
    <>
      <group ref={plane} visible={false}>
        {/* fuselage */}
        <mesh raycast={noRaycast}>
          <boxGeometry args={[S * 3, S * 3, S * 22]} />
          <meshStandardMaterial color="#3a4350" roughness={0.6} metalness={0.3} />
        </mesh>
        <mesh raycast={noRaycast} position={[0, S * 1.2, S * 8]}>
          <boxGeometry args={[S * 2.4, S * 1.2, S * 3]} />
          <meshStandardMaterial color="#7ad7f0" roughness={0.2} metalness={0.6} />
        </mesh>
        {/* wings + orange stripe */}
        <mesh raycast={noRaycast} position={[0, S * 0.8, S * 1]}>
          <boxGeometry args={[S * 28, S * 0.5, S * 4.5]} />
          <meshStandardMaterial color="#4a5462" roughness={0.6} />
        </mesh>
        <mesh raycast={noRaycast} position={[0, S * 1.1, S * 1]}>
          <boxGeometry args={[S * 28.2, S * 0.2, S * 1]} />
          <meshStandardMaterial color="#f7931a" emissive="#f7931a" emissiveIntensity={0.4} />
        </mesh>
        {/* tail */}
        <mesh raycast={noRaycast} position={[0, S * 3.2, -S * 9.5]}>
          <boxGeometry args={[S * 0.5, S * 4.5, S * 3]} />
          <meshStandardMaterial color="#f7931a" />
        </mesh>
        <mesh raycast={noRaycast} position={[0, S * 1.2, -S * 9.8]}>
          <boxGeometry args={[S * 10, S * 0.4, S * 2.4]} />
          <meshStandardMaterial color="#4a5462" />
        </mesh>
        {/* engines + props */}
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
        {/* strobes */}
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

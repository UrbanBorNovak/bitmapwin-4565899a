/** Shared room immersion: gentle diorama parallax camera and drifting dust motes (one draw call). */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D, Vector3 } from "three";

/** Camera sways up to PARALLAX units with the pointer around its home spot, always looking at `at`. */
export const PARALLAX = 0.35;
export function DioramaCam({ home, at }: { home: [number, number, number]; at: [number, number, number] }) {
  const off = useRef(new Vector3());
  useFrame(({ camera, pointer }, dt) => {
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 3);
    off.current.x += (pointer.x * PARALLAX - off.current.x) * k;
    off.current.y += (pointer.y * PARALLAX * 0.5 - off.current.y) * k;
    camera.position.set(home[0] + off.current.x, home[1] + off.current.y, home[2] - off.current.x * 0.6);
    camera.lookAt(at[0], at[1], at[2]);
  });
  return null;
}

/** Slow-drifting motes inside a room box; colour sets the mood (warm café, neon arcade). */
export function DustMotes({ count = 60, color = "#ffd9a0", box = [7, 3.5, 7] as [number, number, number] }) {
  const ref = useRef<InstancedMesh>(null);
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: (((i * 73) % 100) / 100 - 0.5) * box[0], y: ((i * 37) % 100) / 100 * box[1], z: (((i * 51) % 100) / 100 - 0.5) * box[2], p: i * 1.7,
  })), [count, box]);
  const o = useMemo(() => new Object3D(), []);
  useFrame(({ clock }) => {
    const m = ref.current; if (!m) return;
    const t = clock.elapsedTime;
    seeds.forEach((s, i) => {
      o.position.set(s.x + Math.sin(t * 0.2 + s.p) * 0.3, 0.2 + ((s.y + t * 0.08) % box[1]), s.z + Math.cos(t * 0.15 + s.p) * 0.3);
      o.updateMatrix(); m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} raycast={() => null}>
      <boxGeometry args={[0.025, 0.025, 0.025]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} depthWrite={false} />
    </instancedMesh>
  );
}

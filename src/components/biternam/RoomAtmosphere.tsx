/** Shared room immersion: gentle diorama parallax camera and drifting dust motes (one draw call). */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D, Vector3 } from "three";

/** Motion preferences: reduced-motion users get a still camera and slow dust; touch devices skip pointer sway. */
export function useMotionPrefs() {
  const [p, setP] = useState({ reduced: false, coarse: false });
  useEffect(() => {
    const r = window.matchMedia("(prefers-reduced-motion: reduce)");
    const c = window.matchMedia("(pointer: coarse)");
    const up = () => setP({ reduced: r.matches, coarse: c.matches });
    up(); r.addEventListener("change", up); c.addEventListener("change", up);
    return () => { r.removeEventListener("change", up); c.removeEventListener("change", up); };
  }, []);
  return p;
}

/** Camera sways up to PARALLAX units with the pointer around its home spot, always looking at `at`.
 *  Still on reduced motion and on touch (a tap would jerk the view right as you aim at a hotspot). */
export const PARALLAX = 0.35;
/** Fit zoom to the canvas shape: wide screens keep `base`, tall phones pull back so the whole room stays in frame. */
export const ROOM_ZOOM = 1.5;
export function fitZoom(aspect: number, base = ROOM_ZOOM) {
  return base * Math.min(1, Math.max(0.42, aspect / 1.9));
}
export function fitCamera(camera: { zoom: number; updateProjectionMatrix(): void }, aspect: number, base = ROOM_ZOOM) {
  const z = fitZoom(aspect, base);
  if (Math.abs(camera.zoom - z) > 0.005) { camera.zoom = z; camera.updateProjectionMatrix(); }
}
export function DioramaCam({ home, at, zoom = ROOM_ZOOM }: { home: [number, number, number]; at: [number, number, number]; zoom?: number }) {
  const off = useRef(new Vector3());
  const { reduced, coarse } = useMotionPrefs();
  const still = reduced || coarse;
  useFrame(({ camera, pointer, size }, dt) => {
    fitCamera(camera, size.width / Math.max(1, size.height), zoom);
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 3);
    const px = still ? 0 : pointer.x, py = still ? 0 : pointer.y;
    off.current.x += (px * PARALLAX - off.current.x) * k;
    off.current.y += (py * PARALLAX * 0.5 - off.current.y) * k;
    camera.position.set(home[0] + off.current.x, home[1] + off.current.y, home[2] - off.current.x * 0.6);
    camera.lookAt(at[0], at[1], at[2]);
  });
  return null;
}

/** Slow-drifting motes inside a room box; colour sets the mood (warm café, neon arcade). Fewer on touch devices. */
export function DustMotes({ count: want = 60, color = "#ffd9a0", box = [7, 3.5, 7] as [number, number, number] }) {
  const { reduced, coarse } = useMotionPrefs();
  const count = coarse ? Math.ceil(want * 0.4) : want;
  const speed = reduced ? 0.25 : 1;
  const ref = useRef<InstancedMesh>(null);
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: (((i * 73) % 100) / 100 - 0.5) * box[0], y: ((i * 37) % 100) / 100 * box[1], z: (((i * 51) % 100) / 100 - 0.5) * box[2], p: i * 1.7,
  })), [count, box]);
  const o = useMemo(() => new Object3D(), []);
  const last = useRef(0);
  useFrame(({ clock }) => {
    const m = ref.current; if (!m) return;
    const t = clock.elapsedTime * speed;
    // dust is slow: ~30 updates/s is plenty and halves the matrix work
    if (clock.elapsedTime - last.current < 1 / 30) return;
    last.current = clock.elapsedTime;
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

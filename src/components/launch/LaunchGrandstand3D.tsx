import { useEffect, useMemo, useRef, useState } from "react";
import { events as r3fEvents, useFrame, type RootState } from "@react-three/fiber";
import * as THREE from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { resolvePixelTexture } from "@/lib/pixel-texture";
import { seatPlace, type LaunchSeat } from "@/lib/launch-seats";

const ROWS = 24;
const STEP_H = 0.55;
const STEP_D = 1.1;
const SEAT_W = 0.9;

/** Seat world position on the stepped arc grandstand. */
function seatPos(seat: number): [number, number, number, number] {
  const { row, col, perRow } = seatPlace(seat);
  const radius = 8 + row * STEP_D;
  const spread = (perRow * SEAT_W) / radius;
  const a = -spread / 2 + (col + 0.5) * (spread / perRow);
  return [Math.sin(a) * radius, row * STEP_H + STEP_H / 2, Math.cos(a) * radius, a];
}

/** Stepped stands: one instanced block per seat, each reaching down to the ground (no solid wedge across the stage). */
function Stands() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const total = useMemo(() => { let n = 0; for (let r = 0; r < ROWS; r++) n += 12 + 2 * r; return n; }, []);
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const o = new THREE.Object3D(); const c = new THREE.Color();
    for (let i = 0; i < total; i++) {
      const [x, y, z, a] = seatPos(i + 1);
      const top = y; // seat surface
      o.position.set(x, top / 2, z); o.rotation.set(0, a, 0); o.scale.set(SEAT_W, top, STEP_D);
      o.updateMatrix(); m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(seatPlace(i + 1).row % 2 ? "#4a4f5a" : "#3a3e47"));
    }
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [total]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, total]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial />
    </instancedMesh>
  );
}

/** Page-size CSS zoom skews default R3F picking; map the pointer with client/rect ratios instead. */
const zoomSafeEvents = (store: Parameters<typeof r3fEvents>[0]) => ({
  ...r3fEvents(store),
  compute(e: { clientX: number; clientY: number }, state: RootState) {
    const r = state.gl.domElement.getBoundingClientRect();
    state.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    state.raycaster.setFromCamera(state.pointer, state.camera);
  },
});

const faceCache = new Map<string, THREE.Texture>();
function useFace(pixelId: string) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let live = true;
    resolvePixelTexture(pixelId).then((id) => {
      if (!live || !id) return;
      let t = faceCache.get(id);
      if (!t) {
        t = new THREE.TextureLoader().load(`/api/public/inscription/${id}`);
        t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
        t.colorSpace = THREE.SRGBColorSpace;
        t.repeat.set(1 / 8, 1 / 8); t.offset.set(1 / 8, 1 - 2 / 8); // face front tile (1,1)
        faceCache.set(id, t);
      }
      setTex(t);
    });
    return () => { live = false; };
  }, [pixelId]);
  return tex;
}

function hue(address: string) {
  let h = 0; for (const c of address) h = (h * 31 + c.charCodeAt(0)) % 360;
  return new THREE.Color().setHSL(h / 360, 0.45, 0.45);
}

/** Orange banner carrying the held BITMAP number, drawn to a canvas (no font download). */
function FlagBanner({ height }: { height: number }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 256; c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "#f7931a"; g.fillRect(0, 0, 256, 128);
    g.fillStyle = "#0d0f13"; g.font = "bold 52px monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(String(height), 128, 56); g.font = "bold 26px monospace"; g.fillText(".bitmap", 128, 100);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [height]);
  return (
    <mesh position={[0.36, 1.75, 0]}>
      <planeGeometry args={[0.72, 0.36]} />
      <meshBasicMaterial map={tex} side={THREE.FrontSide} />
    </mesh>
  );
}

function Bitmapper({ seat, mine, selected, onPick }: { seat: LaunchSeat; mine: boolean; selected: boolean; onPick: (s: LaunchSeat) => void }) {
  const face = useFace(seat.pixelId);
  const [x, y, z, a] = seatPos(seat.seat);
  const body = useMemo(() => hue(seat.address), [seat.address]);
  const g = useRef<THREE.Group>(null);
  const phase = seat.seat * 0.7;
  useFrame(({ clock }) => {
    if (g.current) g.current.position.y = y + Math.max(0, Math.sin(clock.elapsedTime * 2 + phase)) * (selected ? 0.25 : 0.05);
  });
  return (
    <group ref={g} position={[x, y, z]} rotation-y={a + Math.PI} onClick={(e) => { e.stopPropagation(); onPick(seat); }}>
      <mesh position-y={0.35}><boxGeometry args={[0.5, 0.55, 0.32]} /><meshLambertMaterial color={body} /></mesh>
      <mesh position-y={0.9}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        {[0, 1, 2, 3].map((i) => <meshLambertMaterial key={i} attach={`material-${i}`} color="#c9a27a" />)}
        <meshLambertMaterial attach="material-4" color="#c9a27a" />
        <meshLambertMaterial attach="material-5" map={face} color={face ? "#ffffff" : "#c9a27a"} />
      </mesh>
      {seat.heldBitmap !== null && (
        <group position={[0.34, 0, 0.1]}>
          <mesh position-y={1.2}><boxGeometry args={[0.05, 1.5, 0.05]} /><meshLambertMaterial color="#d8d8d8" /></mesh>
          <FlagBanner height={seat.heldBitmap} />
        </group>
      )}
      {(mine || selected) && (
        <mesh position-y={2.4}><cylinderGeometry args={[0.04, 0.04, 2.2]} /><meshBasicMaterial color={mine ? "#22d3ee" : "#f7931a"} transparent opacity={0.8} /></mesh>
      )}
    </group>
  );
}

function Stage() {
  return (
    <group position={[0, 0, 2]} rotation-y={Math.PI}>
      <mesh position-y={0.2}><boxGeometry args={[6, 0.4, 2.4]} /><meshLambertMaterial color="#2a2d34" /></mesh>
      <mesh position={[0, 1.6, -0.9]}><boxGeometry args={[5.6, 2.4, 0.2]} /><meshLambertMaterial color="#f7931a" emissive="#5a2d00" /></mesh>
      {[-2.6, 2.6].map((x) => (
        <mesh key={x} position={[x, 1.2, 0.8]}><boxGeometry args={[0.25, 2, 0.25]} /><meshLambertMaterial color="#22d3ee" emissive="#0a4a55" /></mesh>
      ))}
    </group>
  );
}

/** Biternam-style light trusses and antenna towers ringing the arena. */
function Trusses() {
  const spots = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const a = -1.3 + (i / 13) * 2.6;
    return [Math.sin(a) * 38, Math.cos(a) * 38, a] as const;
  }), []);
  return <>{spots.map(([x, z, a], i) => (
    <group key={i} position={[x, 0, z]} rotation-y={a}>
      {[-0.5, 0.5].map((dx) => <mesh key={dx} position={[dx, 7, 0]}><boxGeometry args={[0.18, 14, 0.18]} /><meshLambertMaterial color="#3a3e47" /></mesh>)}
      {[3, 7, 11].map((y) => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[1.2, 0.14, 0.14]} /><meshLambertMaterial color="#4a4f5a" /></mesh>)}
      <mesh position={[0, 14.4, 0]}><boxGeometry args={[0.5, 0.5, 0.5]} /><meshBasicMaterial color={i % 2 ? "#22d3ee" : "#f7931a"} /></mesh>
    </group>
  ))}</>;
}

/** Neon rim strip along the front edge of every tier row (one instanced mesh). */
function NeonTiers() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const total = useMemo(() => { let n = 0; for (let r = 0; r < ROWS; r++) n += 12 + 2 * r; return n; }, []);
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const o = new THREE.Object3D(); const c = new THREE.Color();
    for (let i = 0; i < total; i++) {
      const [x, y, z, a] = seatPos(i + 1);
      const { row } = seatPlace(i + 1);
      const r = Math.hypot(x, z); const k = (r - STEP_D / 2 + 0.02) / r;
      o.position.set(x * k, y + 0.02, z * k); o.rotation.set(0, a, 0); o.scale.set(SEAT_W, 0.06, 0.06);
      o.updateMatrix(); m.setMatrixAt(i, o.matrix);
      // Founders Row (#1-#100) orange, rest cyan
      m.setColorAt(i, c.set(i < 100 ? "#f7931a" : row % 4 === 0 ? "#22d3ee" : "#145f6b"));
    }
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [total]);
  return <instancedMesh ref={ref} args={[undefined, undefined, total]}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial /></instancedMesh>;
}

/** Stage spotlight beams: additive cones sweeping slowly (no real lights, cheap). */
function Beams() {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    g.current?.children.forEach((c, i) => { c.rotation.z = Math.sin(clock.elapsedTime * 0.4 + i * 1.7) * 0.35; });
  });
  return (
    <group ref={g}>
      {[-3, -1, 1, 3].map((x, i) => (
        <group key={x} position={[x, 0.4, 1.2]}>
          <mesh position-y={9} rotation-x={0.35}>
            <coneGeometry args={[2.2, 18, 12, 1, true]} />
            <meshBasicMaterial color={i % 2 ? "#22d3ee" : "#f7931a"} transparent opacity={0.07} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Rising voxel motes caught in the beams (single Points). */
function Motes() {
  const ref = useRef<THREE.Points>(null);
  const pos = useMemo(() => {
    const p = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) { p[i * 3] = (Math.random() - 0.5) * 40; p[i * 3 + 1] = Math.random() * 16; p[i * 3 + 2] = Math.random() * 36 - 4; }
    return p;
  }, []);
  useFrame((_, d) => {
    const a = ref.current?.geometry.attributes["position"] as THREE.BufferAttribute | undefined; if (!a) return;
    for (let i = 0; i < 300; i++) { let y = a.getY(i) + d * 0.6; if (y > 16) y = 0; a.setY(i, y); }
    a.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[pos, 3]} /></bufferGeometry>
      <pointsMaterial color="#9fe9f5" size={0.12} transparent opacity={0.6} depthWrite={false} />
    </points>
  );
}

/** Stage jumbotron: CRT-style canvas showing the inspected Bitmapper. */
function Jumbotron({ seat }: { seat: LaunchSeat | null }) {
  const face = useFace(seat?.pixelId ?? "");
  const { tex, canvas } = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 512; c.height = 256;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
    return { tex: t, canvas: c };
  }, []);
  useEffect(() => {
    const g = canvas.getContext("2d")!;
    g.fillStyle = "#06090d"; g.fillRect(0, 0, 512, 256);
    g.fillStyle = "#22d3ee"; g.font = "bold 22px monospace"; g.fillText("BITMAPWIN · LAUNCH FEED", 20, 36);
    g.fillStyle = "#f7931a"; g.font = "bold 64px monospace";
    g.fillText(seat ? `SEAT #${seat.seat}` : "STAND BY", 20, 120);
    g.fillStyle = "#cfd6df"; g.font = "20px monospace";
    if (seat) {
      g.fillText(`${seat.address.slice(0, 10)}…${seat.address.slice(-6)}`, 20, 160);
      g.fillText(seat.seat <= 100 ? "FOUNDERS ROW" : seat.seat <= 500 ? "FULL HOUSE" : "IGNITION", 20, 192);
      if (seat.heldBitmap !== null) { g.fillStyle = "#f7931a"; g.fillText(`FLAG ${seat.heldBitmap}.bitmap`, 20, 224); }
    } else g.fillText("TAP A BITMAPPER", 20, 170);
    g.fillStyle = "rgba(0,0,0,0.35)"; for (let y = 0; y < 256; y += 4) g.fillRect(0, y, 512, 2);
    tex.needsUpdate = true;
  }, [seat, canvas, tex]);
  return (
    <group position={[0, 1.6, 3.03]}>
      <mesh><planeGeometry args={[5.2, 2.6]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      {seat && face && <mesh position={[1.75, 0, 0.01]}><planeGeometry args={[1.3, 1.3]} /><meshBasicMaterial map={face} toneMapped={false} /></mesh>}
    </group>
  );
}

export type GrandstandView = "diorama" | "stage" | "seat";

export default function LaunchGrandstand3D({ seats, myAddress, selected, onPick, focusSeat, view = "diorama", mySeat = null }: {
  seats: LaunchSeat[]; myAddress: string | null; selected: number | null; onPick: (s: LaunchSeat) => void; focusSeat: number | null;
  view?: GrandstandView; mySeat?: number | null;
}) {
  const picked = seats.find((s) => s.seat === selected) ?? null;
  return (
    <SafeCanvas events={zoomSafeEvents} camera={{ position: [0, 10, -6], fov: 55 }} dpr={[1, 1.5]}>
      <color attach="background" args={["#07090d"]} />
      <fog attach="fog" args={["#07090d", 28, 64]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 14, -8]} intensity={1.3} />
      <hemisphereLight args={["#9fb6ff", "#2a1a0a", 0.4]} />
      <CameraRig focus={focusSeat} view={view} mySeat={mySeat} />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01}><planeGeometry args={[120, 120]} /><meshLambertMaterial color="#14171c" /></mesh>
      <Stands /><NeonTiers /><Stage /><Trusses /><Beams /><Motes />
      <Jumbotron seat={picked} />
      {seats.map((s) => (
        <Bitmapper key={s.seat} seat={s} mine={!!myAddress && s.address.toLowerCase() === myAddress.toLowerCase()} selected={selected === s.seat} onPick={onPick} />
      ))}
    </SafeCanvas>
  );
}

function CameraRig({ focus, view, mySeat }: { focus: number | null; view: GrandstandView; mySeat: number | null }) {
  const target = useRef(new THREE.Vector3(0, 3, 13));
  const eye = useRef(new THREE.Vector3(0, 10, -6));
  useFrame(({ camera, clock }, d) => {
    let fov = 50;
    if (view === "seat" && mySeat) {
      // Sit in my seat: eye at head height, looking at the stage.
      const [x, y, z] = seatPos(mySeat);
      eye.current.set(x * 0.97, y + 1.0, z * 0.97); target.current.set(0, 1.6, 1.5); fov = 60;
    } else if (focus) {
      const [x, y, z] = seatPos(focus);
      target.current.set(x, y + 0.8, z);
      // Stand between the stage and the seat, above the stage backdrop, so nothing blocks the view.
      const pull = Math.max(0.2, 1 - 6 / Math.hypot(x, z));
      eye.current.set(x * pull, y + 4.5, z * pull);
    } else if (view === "stage") {
      const t = clock.elapsedTime * 0.15;
      eye.current.set(Math.sin(t) * 2, 1.8, 3.5); target.current.set(0, 7, 18); fov = 62;
    } else {
      // Biternam 2.5D diorama: fixed high tilted angle, narrow lens.
      eye.current.set(-22, 30, -18); target.current.set(0, 4, 12); fov = 32;
    }
    const k = 1 - Math.exp(-3 * Math.min(d, 0.05));
    const pc = camera as THREE.PerspectiveCamera;
    if (Math.abs(pc.fov - fov) > 0.1) { pc.fov += (fov - pc.fov) * k; pc.updateProjectionMatrix(); }
    camera.position.lerp(eye.current, k);
    camera.lookAt(target.current);
  });
  return null;
}

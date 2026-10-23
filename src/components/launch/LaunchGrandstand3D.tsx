import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
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

function Stands() {
  const steps = useMemo(() => Array.from({ length: ROWS }, (_, r) => r), []);
  return (
    <group>
      {steps.map((r) => {
        const radius = 8 + r * STEP_D;
        const perRow = 12 + 2 * r;
        const spread = (perRow * SEAT_W) / radius;
        return (
          <mesh key={r} position={[0, r * STEP_H / 2, 0]} rotation-y={-spread / 2 - 0.05}>
            <cylinderGeometry args={[radius + STEP_D / 2, radius + STEP_D / 2, (r + 1) * STEP_H, 48, 1, false, 0, spread + 0.1]} />
            <meshLambertMaterial color={r % 2 ? "#4a4f5a" : "#3a3e47"} flatShading />
          </mesh>
        );
      })}
    </group>
  );
}

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
        <mesh position={[0.32, 1.25, 0.1]}><boxGeometry args={[0.05, 0.5, 0.05]} /><meshLambertMaterial color="#f7931a" /></mesh>
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

function Trees() {
  const spots = useMemo(() => Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2;
    return [Math.sin(a) * 45, Math.cos(a) * 45] as const;
  }), []);
  return <>{spots.map(([x, z], i) => (
    <group key={i} position={[x, 0, z]}>
      <mesh position-y={1}><boxGeometry args={[0.6, 2, 0.6]} /><meshLambertMaterial color="#4a3423" /></mesh>
      <mesh position-y={3}><boxGeometry args={[2.4, 2.4, 2.4]} /><meshLambertMaterial color={i % 2 ? "#2f5d3a" : "#3b6e44"} /></mesh>
    </group>
  ))}</>;
}

export default function LaunchGrandstand3D({ seats, myAddress, selected, onPick, focusSeat }: {
  seats: LaunchSeat[]; myAddress: string | null; selected: number | null; onPick: (s: LaunchSeat) => void; focusSeat: number | null;
}) {
  return (
    <SafeCanvas camera={{ position: [0, 10, -6], fov: 55 }} dpr={[1, 1.5]}>
      <color attach="background" args={["#0d0f13"]} />
      <fog attach="fog" args={["#0d0f13", 30, 70]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 14, -8]} intensity={1.3} />
      <hemisphereLight args={["#9fb6ff", "#2a1a0a", 0.4]} />
      <CameraRig focus={focusSeat} />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01}><planeGeometry args={[120, 120]} /><meshLambertMaterial color="#1e2a1f" /></mesh>
      <Stands /><Stage /><Trees />
      {seats.map((s) => (
        <Bitmapper key={s.seat} seat={s} mine={!!myAddress && s.address.toLowerCase() === myAddress.toLowerCase()} selected={selected === s.seat} onPick={onPick} />
      ))}
    </SafeCanvas>
  );
}

function CameraRig({ focus }: { focus: number | null }) {
  const target = useRef(new THREE.Vector3(0, 3, 13));
  const eye = useRef(new THREE.Vector3(0, 10, -6));
  useFrame(({ camera, clock }, d) => {
    if (focus) {
      const [x, y, z] = seatPos(focus);
      target.current.set(x, y + 0.8, z);
      // Stand between the stage and the seat, above the stage backdrop, so nothing blocks the view.
      const pull = Math.max(0.2, 1 - 6 / Math.hypot(x, z));
      eye.current.set(x * pull, y + 4.5, z * pull);
    } else {
      const t = clock.elapsedTime * 0.08;
      target.current.set(0, 3, 13);
      eye.current.set(Math.sin(t) * 5, 14, -10);
    }
    const k = 1 - Math.exp(-3 * Math.min(d, 0.05));
    const pc = camera as THREE.PerspectiveCamera;
    if (pc.fov !== 50) { pc.fov = 50; pc.updateProjectionMatrix(); }
    camera.position.lerp(eye.current, k);
    camera.lookAt(target.current);
  });
  return null;
}

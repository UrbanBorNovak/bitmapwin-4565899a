import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { CHARGE_CYCLE, FIELD_GAP, chargeOffset, formation, type Soldier } from "@/lib/highland-charge";
import type { LaunchSeat } from "@/lib/launch-seats";

const ENEMY = 240;

function Army({ soldiers, focus }: { soldiers: Soldier[]; focus: number | null }) {
  const body = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const flags = useRef<THREE.InstancedMesh>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    const c = new THREE.Color();
    soldiers.forEach((s, i) => {
      const hl = s.seat === focus;
      body.current?.setColorAt(i, hl ? c.set("#f7931a") : c.setHSL(s.hue, 0.35, s.founder ? 0.55 : 0.4));
      head.current?.setColorAt(i, c.set(hl ? "#ffffff" : "#e8c39e"));
    });
    if (body.current?.instanceColor) body.current.instanceColor.needsUpdate = true;
    if (head.current?.instanceColor) head.current.instanceColor.needsUpdate = true;
  }, [soldiers, focus]);
  const flagIdx = useMemo(() => soldiers.map((s, i) => (s.flag ? i : -1)).filter((i) => i >= 0), [soldiers]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    soldiers.forEach((s, i) => {
      const z = s.z + chargeOffset(t, s.speed);
      const running = chargeOffset(t, s.speed) > 0;
      const bob = running ? Math.abs(Math.sin(t * 10 + s.phase)) * 0.25 : 0;
      o.position.set(s.x, 0.6 + bob, z); o.rotation.set(running ? 0.25 : 0, 0, 0); o.scale.set(0.5, 1.1, 0.35); o.updateMatrix();
      body.current?.setMatrixAt(i, o.matrix);
      o.position.set(s.x, 1.4 + bob, z + (running ? 0.15 : 0)); o.scale.setScalar(0.38); o.rotation.set(0, 0, 0); o.updateMatrix();
      head.current?.setMatrixAt(i, o.matrix);
    });
    flagIdx.forEach((i, k) => {
      const s = soldiers[i]; if (!s) return;
      const z = s.z + chargeOffset(t, s.speed);
      o.position.set(s.x + 0.35, 2.3, z); o.scale.set(0.5, 0.35, 0.04); o.rotation.set(0, Math.sin(t * 6 + s.phase) * 0.4, 0); o.updateMatrix();
      flags.current?.setMatrixAt(k, o.matrix);
    });
    for (const m of [body.current, head.current, flags.current]) if (m) m.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={body} args={[undefined, undefined, Math.max(1, soldiers.length)]}><boxGeometry /><meshLambertMaterial /></instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, Math.max(1, soldiers.length)]}><boxGeometry /><meshLambertMaterial /></instancedMesh>
      <instancedMesh ref={flags} args={[undefined, undefined, Math.max(1, flagIdx.length)]}><boxGeometry /><meshLambertMaterial color="#f7931a" /></instancedMesh>
    </>
  );
}

/** The Fiat Legion: a grey shield wall that marches in from the far side. */
function Enemy() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (let i = 0; i < ENEMY; i++) {
      const rank = Math.floor(i / 30), col = (i % 30) - 14.5;
      const adv = Math.min(chargeOffset(t, 1.2), 10);
      o.position.set(col * 1.3, 0.8, FIELD_GAP / 2 + rank * 1.4 - adv); o.scale.set(0.9, 1.6, 0.3); o.updateMatrix();
      ref.current?.setMatrixAt(i, o.matrix);
    }
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[undefined, undefined, ENEMY]}><boxGeometry /><meshLambertMaterial color="#5a5f68" /></instancedMesh>;
}

function ChaseCam({ lead }: { lead: Soldier | undefined }) {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime;
    const z = (lead ? lead.z + chargeOffset(t, lead.speed) : -FIELD_GAP / 2);
    const local = t % CHARGE_CYCLE;
    const side = local < 2 ? 0 : Math.sin(t * 0.3) * 8;
    camera.position.lerp(new THREE.Vector3((lead?.x ?? 0) + side, 10, z - 16), 0.06);
    camera.lookAt((lead?.x ?? 0), 0, z + 10);
  });
  return null;
}

export default function HighlandCharge3D({ seats, focus }: { seats: LaunchSeat[]; focus: number | null }) {
  const soldiers = useMemo(() => formation(seats), [seats]);
  const lead = soldiers.find((s) => s.seat === focus) ?? soldiers[0];
  return (
    <div className="h-full w-full" data-scene-ready>
      <SafeCanvas dpr={1} gl={{ antialias: false }} camera={{ fov: 60, position: [0, 6, -50] }}>
        <color attach="background" args={["#8fa3ad"]} />
        <fog attach="fog" args={["#8fa3ad", 20, 90]} />
        <hemisphereLight args={["#dfe8ee", "#3c4a2e", 1.1]} />
        <directionalLight position={[10, 20, -10]} intensity={1.2} />
        <mesh rotation-x={-Math.PI / 2}><planeGeometry args={[200, 200]} /><meshLambertMaterial color="#4f6b3a" /></mesh>
        <Army soldiers={soldiers} focus={focus} />
        <Enemy />
        <ChaseCam lead={lead} />
      </SafeCanvas>
    </div>
  );
}

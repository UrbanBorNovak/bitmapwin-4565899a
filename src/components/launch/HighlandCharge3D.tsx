import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PixelAvatar, proxied } from "@/components/launch/OwnedPixelModel3D";
import { resolvePixelAsset, type PixelAsset } from "@/lib/pixel-texture";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { CHARGE_CYCLE, FIELD_GAP, chargeOffset, formation, type Soldier } from "@/lib/highland-charge";
import type { LaunchSeat } from "@/lib/launch-seats";

const ENEMY = 240;

const NEAR = 30; // within this distance soldiers get full animation every frame
const FAR = 75; // beyond this, heads are dropped (fog hides them) and updates are throttled
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * The army: three instanced meshes (bodies, heads, flags) = 3 draw calls for any
 * number of soldiers. Distance LOD: near soldiers animate every frame, mid ones every
 * 2nd frame, far ones every 4th frame without bob or head. The followed soldier is
 * removed from the instances and drawn by <Hero> with real limbs.
 */
function Army({ soldiers, focus }: { soldiers: Soldier[]; focus: number | null }) {
  const body = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const flags = useRef<THREE.InstancedMesh>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  const frame = useRef(0);
  // Neighbours right beside the followed soldier step aside so nothing blocks them.
  const focusSoldier = useMemo(() => soldiers.find((s) => s.seat === focus), [soldiers, focus]);
  useEffect(() => {
    const c = new THREE.Color();
    soldiers.forEach((s, i) => {
      body.current?.setColorAt(i, c.setHSL(s.hue, 0.35, s.founder ? 0.55 : 0.4));
      head.current?.setColorAt(i, c.set("#e8c39e"));
    });
    if (body.current?.instanceColor) body.current.instanceColor.needsUpdate = true;
    if (head.current?.instanceColor) head.current.instanceColor.needsUpdate = true;
  }, [soldiers]);
  const flagOf = useMemo(() => {
    const m = new Int32Array(soldiers.length).fill(-1);
    let k = 0;
    soldiers.forEach((s, i) => { if (s.flag) m[i] = k++; });
    return { m, count: k };
  }, [soldiers]);
  useFrame(({ clock, camera }) => {
    const f = ++frame.current;
    const t = clock.elapsedTime;
    const cz = camera.position.z, cx = camera.position.x;
    const b = body.current, h = head.current, fl = flags.current;
    if (!b || !h) return;
    for (let i = 0; i < soldiers.length; i++) {
      const s = soldiers[i]!;
      const fi = flagOf.m[i]!;
      const fs = focusSoldier;
      if (s.seat === focus || (fs && Math.abs(s.x - fs.x) < 1.6 && Math.abs(s.z - fs.z) < 2.2)) {
        b.setMatrixAt(i, HIDDEN); h.setMatrixAt(i, HIDDEN);
        if (fi >= 0 && fl) fl.setMatrixAt(fi, HIDDEN);
        continue;
      }
      const off = chargeOffset(t, s.speed);
      const z = s.z + off;
      const d = Math.abs(z - cz) + Math.abs(s.x - cx);
      const tier = d < NEAR ? 1 : d < FAR ? 2 : 4;
      if ((f + i) % tier !== 0) continue;
      const running = off > 0;
      const bob = running && tier < 4 ? Math.abs(Math.sin(t * 10 + s.phase)) * 0.25 : 0;
      o.position.set(s.x, 0.6 + bob, z); o.rotation.set(running ? 0.25 : 0, 0, 0); o.scale.set(0.5, 1.1, 0.35); o.updateMatrix();
      b.setMatrixAt(i, o.matrix);
      if (tier === 4) h.setMatrixAt(i, HIDDEN);
      else {
        o.position.set(s.x, 1.4 + bob, z + (running ? 0.15 : 0)); o.scale.setScalar(0.38); o.rotation.set(0, 0, 0); o.updateMatrix();
        h.setMatrixAt(i, o.matrix);
      }
      if (fi >= 0 && fl) {
        o.position.set(s.x + 0.35, 2.3, z); o.scale.set(0.5, 0.35, 0.04);
        o.rotation.set(0, tier < 4 ? Math.sin(t * 6 + s.phase) * 0.4 : 0, 0); o.updateMatrix();
        fl.setMatrixAt(fi, o.matrix);
      }
    }
    b.instanceMatrix.needsUpdate = true; h.instanceMatrix.needsUpdate = true;
    if (fl) fl.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={body} frustumCulled={false} args={[undefined, undefined, Math.max(1, soldiers.length)]}><boxGeometry /><meshLambertMaterial /></instancedMesh>
      <instancedMesh ref={head} frustumCulled={false} args={[undefined, undefined, Math.max(1, soldiers.length)]}><boxGeometry /><meshLambertMaterial /></instancedMesh>
      <instancedMesh ref={flags} frustumCulled={false} args={[undefined, undefined, Math.max(1, flagOf.count)]}><boxGeometry /><meshLambertMaterial color="#f7931a" /></instancedMesh>
    </>
  );
}

/** The followed soldier at full detail: torso, kilt, head, swinging arms and legs, sword, flag. */
class AvatarBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Resolves the seat's Pixel (BRC-420 pointer → GLB + PNG skin); null while loading or if it has no model. */
function usePixelAsset(id: string | undefined) {
  const [a, setA] = useState<PixelAsset | null>(null);
  useEffect(() => {
    setA(null);
    if (!id) return;
    let live = true;
    resolvePixelAsset(id).then((r) => { if (live) setA(r ?? null); }).catch(() => {});
    return () => { live = false; };
  }, [id]);
  return a;
}

function Hero({ s, pixelId }: { s: Soldier; pixelId?: string | undefined }) {
  const asset = usePixelAsset(pixelId);
  if (!asset?.model) return <BlockHero s={s} />;
  const fallback = <BlockHero s={s} />;
  return (
    <AvatarBoundary key={asset.model} fallback={fallback}>
      <Suspense fallback={fallback}><PixelHero s={s} model={asset.model} texture={asset.texture ?? null} /></Suspense>
    </AvatarBoundary>
  );
}

/** The followed soldier as their own on-chain Pixel, skinned exactly as in the Oasis. */
function PixelHero({ s, model, texture }: { s: Soldier; model: string; texture: string | null }) {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const off = chargeOffset(t, s.speed);
    const bob = off > 0 ? Math.abs(Math.sin(t * 10 + s.phase)) * 0.2 : 0;
    root.current?.position.set(s.x, bob, s.z + off);
  });
  return (
    <group ref={root}>
      <PixelAvatar model={model} texture={texture} height={1.9} ground={0} via={proxied} />
      {s.flag && (
        <>
          <mesh position={[-0.45, 1.6, -0.1]}><boxGeometry args={[0.04, 1.6, 0.04]} /><meshLambertMaterial color="#5b3a22" /></mesh>
          <mesh position={[-0.2, 2.2, -0.1]}><boxGeometry args={[0.5, 0.35, 0.04]} /><meshLambertMaterial color="#f7931a" /></mesh>
        </>
      )}
    </group>
  );
}

function BlockHero({ s }: { s: Soldier }) {
  const root = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null), armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null), legR = useRef<THREE.Group>(null);
  const flag = useRef<THREE.Mesh>(null);
  const tunic = useMemo(() => new THREE.Color().setHSL(s.hue, 0.35, s.founder ? 0.55 : 0.4).getStyle(), [s]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const off = chargeOffset(t, s.speed);
    const running = off > 0;
    const sw = running ? Math.sin(t * 10 + s.phase) : 0;
    const bob = running ? Math.abs(sw) * 0.2 : 0;
    root.current?.position.set(s.x, bob, s.z + off);
    if (root.current) root.current.rotation.x = running ? 0.2 : 0;
    if (armL.current) armL.current.rotation.x = sw * 0.9;
    if (armR.current) armR.current.rotation.x = running ? -2.4 + sw * 0.3 : -2.8; // sword raised
    if (legL.current) legL.current.rotation.x = -sw * 0.8;
    if (legR.current) legR.current.rotation.x = sw * 0.8;
    if (flag.current) flag.current.rotation.y = Math.sin(t * 6 + s.phase) * 0.4;
  });
  return (
    <group ref={root}>
      <mesh position={[0, 1.05, 0]}><boxGeometry args={[0.5, 0.6, 0.3]} /><meshLambertMaterial color="#f7931a" /></mesh>
      <mesh position={[0, 0.65, 0]}><boxGeometry args={[0.55, 0.3, 0.34]} /><meshLambertMaterial color={tunic} /></mesh>
      <mesh position={[0, 1.6, 0]}><boxGeometry args={[0.38, 0.38, 0.38]} /><meshLambertMaterial color="#e8c39e" /></mesh>
      <mesh position={[0, 1.6, 0.195]}><boxGeometry args={[0.3, 0.08, 0.01]} /><meshLambertMaterial color="#2a5fa8" /></mesh>
      <group ref={armL} position={[-0.33, 1.3, 0]}><mesh position={[0, -0.28, 0]}><boxGeometry args={[0.14, 0.55, 0.14]} /><meshLambertMaterial color="#e8c39e" /></mesh></group>
      <group ref={armR} position={[0.33, 1.3, 0]}>
        <mesh position={[0, -0.28, 0]}><boxGeometry args={[0.14, 0.55, 0.14]} /><meshLambertMaterial color="#e8c39e" /></mesh>
        <mesh position={[0, -0.95, 0]}><boxGeometry args={[0.06, 0.9, 0.03]} /><meshLambertMaterial color="#c9ced6" /></mesh>
      </group>
      <group ref={legL} position={[-0.13, 0.5, 0]}><mesh position={[0, -0.25, 0]}><boxGeometry args={[0.16, 0.5, 0.16]} /><meshLambertMaterial color="#5b3a22" /></mesh></group>
      <group ref={legR} position={[0.13, 0.5, 0]}><mesh position={[0, -0.25, 0]}><boxGeometry args={[0.16, 0.5, 0.16]} /><meshLambertMaterial color="#5b3a22" /></mesh></group>
      {s.flag && (
        <>
          <mesh position={[-0.4, 1.6, -0.1]}><boxGeometry args={[0.04, 1.6, 0.04]} /><meshLambertMaterial color="#5b3a22" /></mesh>
          <mesh ref={flag} position={[-0.15, 2.2, -0.1]}><boxGeometry args={[0.5, 0.35, 0.04]} /><meshLambertMaterial color="#f7931a" /></mesh>
        </>
      )}
    </group>
  );
}

/** The Fiat Legion: matrices are built once; the whole wall moves as one group. */
function Enemy() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const group = useRef<THREE.Group>(null);
  useEffect(() => {
    const o = new THREE.Object3D();
    for (let i = 0; i < ENEMY; i++) {
      const rank = Math.floor(i / 30), col = (i % 30) - 14.5;
      o.position.set(col * 1.3, 0.8, FIELD_GAP / 2 + rank * 1.4); o.scale.set(0.9, 1.6, 0.3); o.updateMatrix();
      ref.current?.setMatrixAt(i, o.matrix);
    }
    if (ref.current) { ref.current.instanceMatrix.needsUpdate = true; ref.current.computeBoundingSphere(); }
  }, []);
  useFrame(({ clock }) => {
    if (group.current) group.current.position.z = -Math.min(chargeOffset(clock.elapsedTime, 1.2), 10);
  });
  return <group ref={group}><instancedMesh ref={ref} args={[undefined, undefined, ENEMY]}><boxGeometry /><meshLambertMaterial color="#5a5f68" /></instancedMesh></group>;
}

function ChaseCam({ lead }: { lead: Soldier | undefined }) {
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, clock }, delta) => {
    const t = clock.elapsedTime;
    const z = (lead ? lead.z + chargeOffset(t, lead.speed) : -FIELD_GAP / 2);
    const local = t % CHARGE_CYCLE;
    const side = local < 2 ? 0 : Math.sin(t * 0.3) * 8;
    target.set((lead?.x ?? 0) + side * 0.5, 3.6, z + 8);
    camera.position.lerp(target, 1 - Math.exp(-4 * Math.min(delta, 0.05)));
    camera.lookAt((lead?.x ?? 0), 2.6, z - 1);
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
        {focus != null && lead && lead.seat === focus && <Hero s={lead} pixelId={seats.find((x) => x.seat === focus)?.pixelId} />}
        <Enemy />
        <ChaseCam lead={lead} />
      </SafeCanvas>
    </div>
  );
}

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PixelAvatar, proxied } from "@/components/launch/OwnedPixelModel3D";
import { resolvePixelAsset, type PixelAsset } from "@/lib/pixel-texture";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { ARROW_FLIGHT, CAV_CONTACT, CAV_START, CHARGE_CYCLE, FIELD_GAP, VOLLEYS, armyFront, cavalryZ, chargeOffset, cycleOf, deathTime, formation, localTime, stepBattle, type BattleGame, type Soldier } from "@/lib/highland-charge";
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
function Army({ soldiers, focus, game }: { soldiers: Soldier[]; focus: number | null; game: BattleGame }) {
  const body = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const flags = useRef<THREE.InstancedMesh>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  const frame = useRef(0);
  // Fallen soldiers who have finished falling are written once and then skipped until the next charge.
  const downDone = useMemo(() => ({ cycle: -1, m: new Uint8Array(soldiers.length) }), [soldiers]);
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
    const local = localTime(t), cyc = cycleOf(t);
    let dead = 0;
    if (downDone.cycle !== cyc) { downDone.cycle = cyc; downDone.m.fill(0); }
    for (let i = 0; i < soldiers.length; i++) {
      const s = soldiers[i]!;
      const fi = flagOf.m[i]!;
      const fs = focusSoldier;
      if (s.seat === focus || (fs && Math.abs(s.x - fs.x) < 1.6 && Math.abs(s.z - fs.z) < 2.2)) {
        b.setMatrixAt(i, HIDDEN); h.setMatrixAt(i, HIDDEN);
        if (fi >= 0 && fl) fl.setMatrixAt(fi, HIDDEN);
        continue;
      }
      const dt = deathTime(s.seat, s.rank, cyc);
      if (dt != null && local >= dt) {
        dead++;
        if (downDone.m[i]) continue;
        const z = s.z + chargeOffset(t - (local - dt), s.speed);
        const fall = Math.min(1, (local - dt) * 3);
        if (fall >= 1) downDone.m[i] = 1;
        o.position.set(s.x, 0.6 - 0.4 * fall, z + fall * 0.5); o.rotation.set(-fall * Math.PI / 2, 0, (s.phase - 3) * 0.1); o.scale.set(0.5, 1.1, 0.35); o.updateMatrix();
        b.setMatrixAt(i, o.matrix);
        o.position.set(s.x, 0.2, z + fall * 1.2); o.scale.setScalar(0.38); o.rotation.set(0, 0, 0); o.updateMatrix();
        h.setMatrixAt(i, o.matrix);
        if (fi >= 0 && fl) { o.position.set(s.x + 0.6, 0.1, z + 0.4); o.rotation.set(-Math.PI / 2, 0, 0.3); o.scale.set(0.5, 0.35, 0.04); o.updateMatrix(); fl.setMatrixAt(fi, o.matrix); }
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
    game.casualties = dead; game.standing = soldiers.length - dead;
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

/** Where the followed soldier is: frozen and lying down once hit this cycle. */
function heroPose(s: Soldier, t: number, g: BattleGame) {
  const local = localTime(t);
  const down = g.heroDownAt != null && local >= g.heroDownAt ? local - g.heroDownAt : -1;
  const off = chargeOffset(down >= 0 ? t - down : t, s.speed);
  return { z: s.z + off, running: down < 0 && off > 0, fall: down < 0 ? 0 : Math.min(1, down * 3) };
}

/** Raised shield in front of the hero while the commander's block window is open. */
function HeroShield({ g }: { g: BattleGame }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (ref.current) ref.current.visible = clock.elapsedTime <= g.shieldUntil && g.heroDownAt == null; });
  return <mesh ref={ref} position={[0, 1.6, 0.45]} rotation-x={-0.5}><boxGeometry args={[0.9, 0.9, 0.08]} /><meshLambertMaterial color="#2a5fa8" emissive="#123" /></mesh>;
}

function Hero({ s, pixelId, game }: { s: Soldier; pixelId?: string | undefined; game: BattleGame }) {
  const asset = usePixelAsset(pixelId);
  if (!asset?.model) return <BlockHero s={s} game={game} />;
  const fallback = <BlockHero s={s} game={game} />;
  return (
    <AvatarBoundary key={asset.model} fallback={fallback}>
      <Suspense fallback={fallback}><PixelHero s={s} model={asset.model} texture={asset.texture ?? null} game={game} /></Suspense>
    </AvatarBoundary>
  );
}

/** The followed soldier as their own on-chain Pixel, skinned exactly as in the Oasis. */
function PixelHero({ s, model, texture, game }: { s: Soldier; model: string; texture: string | null; game: BattleGame }) {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const p = heroPose(s, t, game);
    const bob = p.running ? Math.abs(Math.sin(t * 10 + s.phase)) * 0.2 : 0;
    root.current?.position.set(s.x, bob, p.z);
    if (root.current) root.current.rotation.x = -p.fall * Math.PI / 2;
  });
  return (
    <group ref={root}>
      <HeroShield g={game} />
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

function BlockHero({ s, game }: { s: Soldier; game: BattleGame }) {
  const root = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null), armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null), legR = useRef<THREE.Group>(null);
  const flag = useRef<THREE.Mesh>(null);
  const tunic = useMemo(() => new THREE.Color().setHSL(s.hue, 0.35, s.founder ? 0.55 : 0.4).getStyle(), [s]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const p = heroPose(s, t, game);
    const running = p.running;
    const sw = running ? Math.sin(t * 10 + s.phase) : 0;
    const bob = running ? Math.abs(sw) * 0.2 : 0;
    root.current?.position.set(s.x, bob, p.z);
    if (root.current) root.current.rotation.x = p.fall > 0 ? -p.fall * Math.PI / 2 : running ? 0.2 : 0;
    if (armL.current) armL.current.rotation.x = sw * 0.9;
    if (armR.current) armR.current.rotation.x = running ? -2.4 + sw * 0.3 : -2.8; // sword raised
    if (legL.current) legL.current.rotation.x = -sw * 0.8;
    if (legR.current) legR.current.rotation.x = sw * 0.8;
    if (flag.current) flag.current.rotation.y = Math.sin(t * 6 + s.phase) * 0.4;
  });
  return (
    <group ref={root}>
      <HeroShield g={game} />
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

/** Phones get a lighter battle: fewer arrows, riders and dust puffs. */
const MOBILE = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
const PER_VOLLEY = MOBILE ? 40 : 90;
const RIDERS = MOBILE ? 14 : 22;
const DUST_PER = MOBILE ? 1 : 2;
/**
 * Adaptive battle quality: 2 = full, 1 = reduced, 0 = minimal. Only cosmetic effects read it
 * (dust, arrow count). The army, the followed Pixel and the shield rules never do: shield
 * timing runs on the scene clock in BattleStepper, so it is identical at every level.
 */
export const battleQuality = { level: 2, ema: 16.7 };
const ARROW_SHARE = [0.3, 0.6, 1] as const;
const DUST_SHARE = [0, 0.5, 1] as const;
const SLOW_MS = 22, FAST_MS = 15;

function QualityMonitor() {
  const slow = useRef(0), fast = useRef(0);
  useFrame((_, delta) => {
    const ms = Math.min(delta, 0.25) * 1000;
    const q = battleQuality;
    q.ema += (ms - q.ema) * 0.08;
    if (q.ema > SLOW_MS) { slow.current += delta; fast.current = 0; }
    else if (q.ema < FAST_MS) { fast.current += delta; slow.current = 0; }
    else { slow.current = 0; fast.current = 0; }
    if (slow.current > 1.5 && q.level > 0) { q.level--; slow.current = 0; }
    if (fast.current > 5 && q.level < 2) { q.level++; fast.current = 0; }
  }, -2);
  return null;
}

const enemyZ = (t: number) => FIELD_GAP / 2 + 1 - Math.min(chargeOffset(t, 1.2), 10);
function rnd(n: number) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

/**
 * Fiat arrow volleys: one instanced mesh, one draw call. Each volley is only rewritten while
 * in flight; once landed it is written one last time (stuck in the ground) and then left alone,
 * so most frames upload nothing at all.
 */
function Arrows() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  const a = useMemo(() => new THREE.Vector3(), []), b = useMemo(() => new THREE.Vector3(), []);
  // per volley: 0 = hidden written, 1 = flying, 2 = landed written; keyed to the cycle
  const state = useRef({ cycle: -1, v: new Uint8Array(VOLLEYS.length).fill(9) });
  const at = (v: number, j: number, p: number, c: number, out: THREE.Vector3, ez: number) => {
    const k = v * 1000 + j + c * 7919;
    const land = VOLLEYS[v]! + ARROW_FLIGHT;
    const x0 = (rnd(k) - 0.5) * 38, z0 = ez + rnd(k + 1) * 3;
    const x1 = (rnd(k + 2) - 0.5) * 38, z1 = armyFront(land) - rnd(k + 3) * 14 + 1;
    out.set(x0 + (x1 - x0) * p, 2.2 + Math.sin(Math.PI * p) * 16 - p * 2.2, z0 + (z1 - z0) * p);
  };
  useFrame(({ clock }) => {
    const m = ref.current; if (!m) return;
    const t = clock.elapsedTime, local = localTime(t), c = cycleOf(t);
    const st = state.current;
    if (st.cycle !== c) { st.cycle = c; st.v.fill(9); }
    // Draw fewer arrows when frames are slow; the rest are simply not drawn (mesh.count).
    const shown = Math.ceil(PER_VOLLEY * ARROW_SHARE[battleQuality.level as 0 | 1 | 2]) * VOLLEYS.length;
    if (m.count !== shown) { if (shown > m.count) st.v.fill(9); m.count = shown; }
    let dirty = false;
    for (let v = 0; v < VOLLEYS.length; v++) {
      const launch = VOLLEYS[v]!;
      const p = (local - launch) / ARROW_FLIGHT;
      const want = p < 0 ? 0 : p < 1 ? 1 : 2;
      if (want !== 1 && st.v[v] === want) continue; // already written, nothing moves
      st.v[v] = want; dirty = true;
      const q = Math.min(1, Math.max(0, p));
      const ez = enemyZ(clock.elapsedTime - (local - launch)); // launch point fixed at release
      for (let j = 0; j < PER_VOLLEY; j++) {
        const idx = j * VOLLEYS.length + v; // interleaved so a shorter count keeps both volleys
        if (want === 0) { m.setMatrixAt(idx, HIDDEN); continue; }
        at(v, j, q, c, a, ez); at(v, j, Math.max(0, q - 0.02), c, b, ez);
        b.sub(a).multiplyScalar(-1).add(a);
        o.position.copy(a); if (want === 2) o.position.y = 0.3;
        o.lookAt(b);
        o.scale.set(0.05, 0.05, 1); o.updateMatrix(); m.setMatrixAt(idx, o.matrix);
      }
    }
    if (dirty) m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} frustumCulled={false} args={[undefined, undefined, PER_VOLLEY * VOLLEYS.length]}><boxGeometry /><meshLambertMaterial color="#2b2118" /></instancedMesh>;
}

/**
 * Fiat cavalry: horses, riders and lances share ONE instanced mesh (per-instance colour) = 1 draw
 * call. Before the charge they are hidden once; after they have reared up they freeze, so only the
 * ~3 s gallop costs CPU.
 */
function Cavalry() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dust = useRef<THREE.InstancedMesh>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  const last = useRef<"" | "off" | "frozen">("");
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const cs = [new THREE.Color("#3b2a1e"), new THREE.Color("#6b717b"), new THREE.Color("#c9ced6")];
    for (let i = 0; i < RIDERS * 3; i++) m.setColorAt(i, cs[i % 3]!);
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);
  useFrame(({ clock }) => {
    const m = ref.current, d = dust.current; if (!m || !d) return;
    const t = clock.elapsedTime, local = localTime(t);
    const on = local >= CAV_START - 0.5;
    const settle = CAV_CONTACT + 0.3;
    const dustShown = Math.floor(RIDERS * DUST_PER * DUST_SHARE[battleQuality.level as 0 | 1 | 2]);
    if (d.count !== dustShown) { d.count = dustShown; last.current = ""; }
    const mode = !on ? "off" : local > settle + 0.6 ? "frozen" : "";
    if (mode && last.current === mode) return; // nothing changes: no CPU, no upload
    last.current = mode;
    const moving = local < CAV_CONTACT;
    const cz = cavalryZ(local);
    for (let i = 0; i < RIDERS; i++) {
      const k = i * 3;
      if (!on) { m.setMatrixAt(k, HIDDEN); m.setMatrixAt(k + 1, HIDDEN); m.setMatrixAt(k + 2, HIDDEN); }
      else {
        const x = (i - (RIDERS - 1) / 2) * (38 / RIDERS) + (rnd(i) - 0.5) * 0.5;
        const z = cz + rnd(i + 50) * 2.5;
        const gal = moving ? Math.abs(Math.sin(t * 14 + i)) * 0.3 : 0;
        const rear = moving ? 0 : Math.min(0.5, (local - CAV_CONTACT) * 2);
        o.position.set(x, 0.95 + gal, z); o.rotation.set(rear, Math.PI, 0); o.scale.set(0.6, 0.8, 1.7); o.updateMatrix(); m.setMatrixAt(k, o.matrix);
        o.position.set(x, 1.9 + gal, z + 0.1); o.rotation.set(0, 0, 0); o.scale.set(0.45, 0.8, 0.35); o.updateMatrix(); m.setMatrixAt(k + 1, o.matrix);
        o.position.set(x + 0.3, 1.8 + gal, z - 1.2); o.scale.set(0.05, 0.05, 2.6); o.updateMatrix(); m.setMatrixAt(k + 2, o.matrix);
      }
      // Dust: short-lived puffs kicked up behind the hooves, a burst at contact, gone once settled.
      for (let p = 0; p < DUST_PER; p++) {
        const di = i * DUST_PER + p;
        const age = ((t * 1.8 + rnd(di + 90)) % 1); // 0..1 loop per puff
        const alive = on && local < settle + 0.5;
        if (!alive) { d.setMatrixAt(di, HIDDEN); continue; }
        const x = (i - (RIDERS - 1) / 2) * (38 / RIDERS) + (rnd(di + 7) - 0.5) * 1.2;
        const burst = moving ? 1 : 1.8;
        o.position.set(x, 0.3 + age * 0.8, cz + 1.2 + age * 2.5); o.rotation.set(0, 0, 0);
        o.scale.setScalar((0.4 + age * 1.4) * burst * (1 - age * 0.5)); o.updateMatrix(); d.setMatrixAt(di, o.matrix);
      }
    }
    m.instanceMatrix.needsUpdate = true; d.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={ref} frustumCulled={false} args={[undefined, undefined, RIDERS * 3]}><boxGeometry /><meshLambertMaterial /></instancedMesh>
      <instancedMesh ref={dust} frustumCulled={false} args={[undefined, undefined, RIDERS * DUST_PER]}>
        <boxGeometry /><meshBasicMaterial color="#9c8a6a" transparent opacity={0.35} depthWrite={false} />
      </instancedMesh>
    </>
  );
}

/** Runs the commander rules once per frame, before anything reads them. */
function BattleStepper({ game, playing }: { game: BattleGame; playing: boolean }) {
  useFrame(({ clock }) => stepBattle(game, clock.elapsedTime, playing), -1);
  return null;
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
    const quake = Math.max(0, 1 - Math.abs(localTime(t) - CAV_CONTACT) * 1.5);
    if (quake > 0) { camera.position.x += (Math.random() - 0.5) * 0.25 * quake; camera.position.y += (Math.random() - 0.5) * 0.2 * quake; }
    camera.lookAt((lead?.x ?? 0), -0.4, z - 1);
  });
  return null;
}

export default function HighlandCharge3D({ seats, focus, game }: { seats: LaunchSeat[]; focus: number | null; game: BattleGame }) {
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
        <QualityMonitor />
        <BattleStepper game={game} playing={focus != null && lead?.seat === focus} />
        <Army soldiers={soldiers} focus={focus} game={game} />
        {focus != null && lead && lead.seat === focus && <Hero s={lead} game={game} pixelId={seats.find((x) => x.seat === focus)?.pixelId} />}
        <Enemy />
        <Arrows />
        <Cavalry />
        <ChaseCam lead={lead} />
      </SafeCanvas>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { STRIDE, type PlayerState } from "@/lib/player-state";
import { ATTACK_RANGE } from "@/lib/map-presence";
import type { MapCursor } from "@/lib/map-presence";
import { playSfx, unlockAudio } from "@/lib/world-audio";

/**
 * WEAPON — carry a Mosin Nagant while exploring the land world.
 *
 * Bolt-action hitscan fire from the live camera. No spawned creatures: the only
 * things a shot can touch are other visitors, and only inside the shared
 * melee-range rule the world already enforces, so no client can invent
 * long-range damage.
 */

export const MAGAZINE = 5;
export const RELOAD_MS = 2_400;
export const FIRE_COOLDOWN_MS = 1_250;
export const SHOT_RANGE = STRIDE * 90;
export const SHOT_DAMAGE = 12;

export type ShooterStats = {
  ammo: number;
  reloading: boolean;
  score: number;
  kills: number;
  targets: number;
  note: string | null;
};

type Tracer = { id: number; from: THREE.Vector3; to: THREE.Vector3; born: number };

export function ShooterLayer({
  active,
  pose,
  cursors,
  bitcoin,
  onShootPeer,
  onStats,
}: {
  active: boolean;
  pose: React.RefObject<PlayerState>;
  cursors: MapCursor[];
  bitcoin: string;
  /** land a strike on another visitor through the world's shared combat rules */
  onShootPeer: (id: string) => void;
  onStats: (stats: ShooterStats) => void;
}) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const cursorsRef = useRef(cursors);
  cursorsRef.current = cursors;

  const [ammo, setAmmo] = useState(MAGAZINE);
  const [reloading, setReloading] = useState(false);
  const [score, setScore] = useState(0);
  const [kills, setKills] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [tracers, setTracers] = useState<Tracer[]>([]);
  const [flash, setFlash] = useState(0);

  const lastFire = useRef(0);
  const nextTracer = useRef(0);
  const rifleRef = useRef<THREE.Group>(null);
  const recoil = useRef(0);

  useFrame((_, delta) => {
    if (!active) return;
    const now = performance.now();
    if (flash && now - flash > 70) setFlash(0);
    setTracers((current) => (current.length && now - current[0]!.born > 120 ? current.slice(1) : current));

    // keep the rifle glued to the view, with a little kick after each shot
    const rifle = rifleRef.current;
    if (rifle) {
      recoil.current = Math.max(0, recoil.current - delta * 3.4);
      const kick = recoil.current;
      rifle.position.copy(camera.position);
      rifle.quaternion.copy(camera.quaternion);
      rifle.translateX(STRIDE * 0.34);
      rifle.translateY(-STRIDE * 0.3 - kick * STRIDE * 0.08);
      rifle.translateZ(-STRIDE * 0.55 + kick * STRIDE * 0.22);
      rifle.rotateX(kick * 0.22);
    }
  });

  const flashNote = useCallback((message: string) => {
    setNote(message);
    window.setTimeout(() => setNote((current) => (current === message ? null : current)), 1300);
  }, []);

  const reload = useCallback(() => {
    if (reloading || ammo === MAGAZINE) return;
    setReloading(true);
    playSfx("reload");
    window.setTimeout(() => {
      setAmmo(MAGAZINE);
      setReloading(false);
      playSfx("bolt");
    }, RELOAD_MS);
  }, [ammo, reloading]);

  const fire = useCallback(() => {
    const me = pose.current;
    if (!active || !me) return;
    const now = performance.now();
    if (now - lastFire.current < FIRE_COOLDOWN_MS) return;
    if (reloading) return;
    if (ammo <= 0) {
      playSfx("empty");
      flashNote("EMPTY · R TO RELOAD");
      return;
    }
    lastFire.current = now;
    setAmmo((current) => Math.max(0, current - 1));
    playSfx("mosin");
    window.setTimeout(() => playSfx("bolt"), 620);
    setFlash(now);
    recoil.current = 1;

    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3();
    camera.getWorldPosition(origin);
    camera.getWorldDirection(direction);
    const ray = new THREE.Ray(origin, direction.normalize());

    let best: { distance: number; point: THREE.Vector3; peer: MapCursor } | null = null;
    const hit = new THREE.Vector3();
    for (const peer of cursorsRef.current) {
      if (peer.hp <= 0) continue;
      const center = new THREE.Vector3(peer.x, STRIDE * 1.1, peer.z);
      const sphere = new THREE.Sphere(center, STRIDE * 0.85);
      if (!ray.intersectSphere(sphere, hit)) continue;
      const distance = origin.distanceTo(hit);
      if (distance > SHOT_RANGE) continue;
      if (!best || distance < best.distance) best = { distance, point: hit.clone(), peer };
    }

    const end = best
      ? best.point.clone()
      : origin.clone().addScaledVector(ray.direction, SHOT_RANGE * 0.5);
    const id = ++nextTracer.current;
    setTracers((current) => [...current.slice(-5), { id, from: origin.clone(), to: end, born: now }]);

    if (!best) return;
    const reach = Math.hypot(best.peer.x - me.x, best.peer.z - me.z);
    if (reach > ATTACK_RANGE) {
      flashNote(`${best.peer.handle} OUT OF COMBAT RANGE`);
      return;
    }
    onShootPeer(best.peer.id);
    playSfx("hit");
    setScore((current) => current + 25);
    setKills((current) => (best!.peer.hp - SHOT_DAMAGE <= 0 ? current + 1 : current));
    flashNote(`HIT ${best.peer.handle}`);
  }, [active, ammo, camera, flashNote, onShootPeer, pose, reloading]);

  // Mouse / touch fire on the canvas, R to reload.
  useEffect(() => {
    if (!active) return;
    const element = gl.domElement;
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      unlockAudio();
      fire();
    };
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.code === "KeyR") {
        event.preventDefault();
        reload();
      }
      if (event.code === "KeyE") {
        event.preventDefault();
        unlockAudio();
        fire();
      }
    };
    element.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      element.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [active, fire, gl, reload]);

  useEffect(() => {
    if (!active) return;
    if (ammo === 0 && !reloading) reload();
  }, [active, ammo, reload, reloading]);

  const liveTargets = cursors.filter((peer) => peer.hp > 0).length;
  useEffect(() => {
    onStats({ ammo, reloading, score, kills, targets: liveTargets, note });
  }, [ammo, kills, liveTargets, note, onStats, reloading, score]);

  const wood = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#4a3524", roughness: 0.72, metalness: 0.05 }),
    [],
  );
  const steel = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#20232a", roughness: 0.34, metalness: 0.85 }),
    [],
  );

  useEffect(
    () => () => {
      wood.dispose();
      steel.dispose();
    },
    [steel, wood],
  );

  if (!active) return null;

  const u = STRIDE;

  return (
    <group>
      {/* MOSIN NAGANT — carried view model */}
      <group ref={rifleRef} rotation={[0, 0, 0]}>
        {/* stock */}
        <mesh material={wood} position={[0, -0.02 * u, 0.34 * u]} rotation={[0.06, 0, 0]}>
          <boxGeometry args={[0.09 * u, 0.14 * u, 0.62 * u]} />
        </mesh>
        {/* fore-end */}
        <mesh material={wood} position={[0, -0.02 * u, -0.28 * u]}>
          <boxGeometry args={[0.08 * u, 0.1 * u, 0.62 * u]} />
        </mesh>
        {/* barrel */}
        <mesh material={steel} position={[0, 0.02 * u, -0.52 * u]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018 * u, 0.02 * u, 1.05 * u, 10]} />
        </mesh>
        {/* receiver */}
        <mesh material={steel} position={[0, 0.01 * u, 0.02 * u]}>
          <boxGeometry args={[0.07 * u, 0.09 * u, 0.3 * u]} />
        </mesh>
        {/* bolt handle */}
        <mesh material={steel} position={[0.08 * u, 0.03 * u, 0.06 * u]} rotation={[0, 0, Math.PI / 2.6]}>
          <cylinderGeometry args={[0.014 * u, 0.014 * u, 0.14 * u, 8]} />
        </mesh>
        {/* bayonet lug / front sight */}
        <mesh material={steel} position={[0, 0.06 * u, -1.0 * u]}>
          <boxGeometry args={[0.02 * u, 0.05 * u, 0.04 * u]} />
        </mesh>
        {flash ? (
          <mesh position={[0, 0.02 * u, -1.08 * u]}>
            <sphereGeometry args={[0.07 * u, 8, 8]} />
            <meshBasicMaterial color={bitcoin} transparent opacity={0.85} />
          </mesh>
        ) : null}
      </group>

      {tracers.map((tracer) => (
        <Tracer key={tracer.id} from={tracer.from} to={tracer.to} color={bitcoin} />
      ))}
      {flash ? (
        <pointLight color={bitcoin} intensity={12} distance={STRIDE * 16} position={camera.position} />
      ) : null}
    </group>
  );
}

function Tracer({ from, to, color }: { from: THREE.Vector3; to: THREE.Vector3; color: string }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setFromPoints([from, to]);
    return g;
  }, [from, to]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color={color} transparent opacity={0.75} />
    </line>
  );
}

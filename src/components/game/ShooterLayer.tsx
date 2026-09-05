import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { STRIDE, type PlayerState } from "@/lib/player-state";
import { ATTACK_RANGE } from "@/lib/map-presence";
import type { MapCursor } from "@/lib/map-presence";
import { playSfx, unlockAudio } from "@/lib/world-audio";

/**
 * SHOOTER — the first game mode running inside the land world.
 *
 * Hitscan shooting from the live camera. Drone targets spawn around whichever
 * district you are standing on (deterministic per district, so two visitors on
 * the same land see the same range), take damage, drop, and respawn. Other
 * visitors can be shot too, but only inside the shared melee-range rule the
 * world already enforces, so no client can invent long-range damage.
 */

export const MAGAZINE = 12;
export const RELOAD_MS = 1_150;
export const FIRE_COOLDOWN_MS = 145;
export const SHOT_RANGE = STRIDE * 90;
export const DRONE_HP = 30;
export const SHOT_DAMAGE = 12;
const DRONE_COUNT = 7;
const DRONE_RESPAWN_MS = 6_000;
const DRONE_RADIUS = STRIDE * 1.1;

export type ShooterStats = {
  ammo: number;
  reloading: boolean;
  score: number;
  kills: number;
  targets: number;
  note: string | null;
};

type Drone = {
  id: number;
  home: THREE.Vector3;
  position: THREE.Vector3;
  hp: number;
  deadUntil: number;
  phase: number;
};

function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function spawnDrones(centerX: number, centerZ: number, seed: number): Drone[] {
  const rand = seeded(seed + 7919);
  return Array.from({ length: DRONE_COUNT }, (_, id) => {
    const angle = rand() * Math.PI * 2;
    const distance = STRIDE * (5 + rand() * 16);
    const x = centerX + Math.cos(angle) * distance;
    const z = centerZ + Math.sin(angle) * distance;
    const y = STRIDE * (1.6 + rand() * 3.2);
    const home = new THREE.Vector3(x, y, z);
    return {
      id,
      home,
      position: home.clone(),
      hp: DRONE_HP,
      deadUntil: 0,
      phase: rand() * Math.PI * 2,
    };
  });
}

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

  const dronesRef = useRef<Drone[]>([]);
  const [droneView, setDroneView] = useState<{ id: number; x: number; y: number; z: number; hp: number }[]>([]);
  const lastFire = useRef(0);
  const nextTracer = useRef(0);
  const homeDistrict = useRef<string>("");

  // Re-stock the range whenever you walk onto a different district.
  useFrame(({ clock }) => {
    const me = pose.current;
    if (!active || !me) return;
    const key = `${me.height}`;
    if (key !== homeDistrict.current) {
      homeDistrict.current = key;
      dronesRef.current = spawnDrones(me.x, me.z, me.height || 1);
    }
    const now = performance.now();
    const t = clock.getElapsedTime();
    for (const drone of dronesRef.current) {
      if (drone.hp <= 0) {
        if (now >= drone.deadUntil) {
          drone.hp = DRONE_HP;
          drone.position.copy(drone.home);
        }
        continue;
      }
      // lazy hover patrol around the spawn point, always in sight
      drone.position.set(
        drone.home.x + Math.sin(t * 0.6 + drone.phase) * STRIDE * 2.2,
        drone.home.y + Math.sin(t * 1.4 + drone.phase) * STRIDE * 0.5,
        drone.home.z + Math.cos(t * 0.5 + drone.phase) * STRIDE * 2.2,
      );
    }
    setDroneView((current) => {
      const next = dronesRef.current.map((drone) => ({
        id: drone.id,
        x: drone.position.x,
        y: drone.position.y,
        z: drone.position.z,
        hp: drone.hp,
      }));
      if (
        current.length === next.length &&
        current.every((c, i) => {
          const n = next[i]!;
          return c.hp === n.hp && Math.abs(c.x - n.x) < 0.002 && Math.abs(c.y - n.y) < 0.002;
        })
      )
        return current;
      return next;
    });
    if (flash && now - flash > 70) setFlash(0);
    setTracers((current) => (current.length && now - current[0]!.born > 120 ? current.slice(1) : current));
  });

  const flashNote = useCallback((message: string) => {
    setNote(message);
    window.setTimeout(() => setNote((current) => (current === message ? null : current)), 1100);
  }, []);

  const reload = useCallback(() => {
    if (reloading || ammo === MAGAZINE) return;
    setReloading(true);
    playSfx("reload");
    window.setTimeout(() => {
      setAmmo(MAGAZINE);
      setReloading(false);
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
      flashNote("MAGAZINE EMPTY · R TO RELOAD");
      return;
    }
    lastFire.current = now;
    setAmmo((current) => Math.max(0, current - 1));
    playSfx("shot");
    setFlash(now);

    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3();
    camera.getWorldPosition(origin);
    camera.getWorldDirection(direction);
    const ray = new THREE.Ray(origin, direction.normalize());

    let best: { distance: number; point: THREE.Vector3; drone?: Drone; peer?: MapCursor } | null = null;
    const hit = new THREE.Vector3();
    for (const drone of dronesRef.current) {
      if (drone.hp <= 0) continue;
      const sphere = new THREE.Sphere(drone.position, DRONE_RADIUS);
      if (!ray.intersectSphere(sphere, hit)) continue;
      const distance = origin.distanceTo(hit);
      if (distance > SHOT_RANGE) continue;
      if (!best || distance < best.distance) best = { distance, point: hit.clone(), drone };
    }
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
    if (best.drone) {
      best.drone.hp -= SHOT_DAMAGE;
      if (best.drone.hp <= 0) {
        best.drone.deadUntil = now + DRONE_RESPAWN_MS;
        setKills((current) => current + 1);
        setScore((current) => current + 100);
        playSfx("kill");
        flashNote("TARGET DOWN +100");
      } else {
        setScore((current) => current + 10);
        playSfx("hit");
      }
      return;
    }
    if (best.peer) {
      const reach = Math.hypot(best.peer.x - me.x, best.peer.z - me.z);
      if (reach > ATTACK_RANGE) {
        flashNote(`${best.peer.handle} OUT OF COMBAT RANGE`);
        return;
      }
      onShootPeer(best.peer.id);
      playSfx("hit");
      flashNote(`HIT ${best.peer.handle}`);
    }
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

  const alive = droneView.filter((drone) => drone.hp > 0).length;
  useEffect(() => {
    onStats({ ammo, reloading, score, kills, targets: alive, note });
  }, [alive, ammo, kills, note, onStats, reloading, score]);

  const droneMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: bitcoin, metalness: 0.2, roughness: 0.45 }),
    [bitcoin],
  );
  const coreMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#ffffff" }),
    [],
  );

  if (!active) return null;

  return (
    <group>
      {droneView
        .filter((drone) => drone.hp > 0)
        .map((drone) => (
          <group key={drone.id} position={[drone.x, drone.y, drone.z]}>
            <mesh material={droneMaterial}>
              <octahedronGeometry args={[DRONE_RADIUS, 0]} />
            </mesh>
            <mesh material={coreMaterial} scale={0.28}>
              <octahedronGeometry args={[DRONE_RADIUS, 0]} />
            </mesh>
            <mesh position={[0, DRONE_RADIUS * 1.5, 0]} scale={[drone.hp / DRONE_HP, 1, 1]}>
              <boxGeometry args={[DRONE_RADIUS * 1.4, DRONE_RADIUS * 0.14, DRONE_RADIUS * 0.14]} />
              <meshBasicMaterial color={bitcoin} />
            </mesh>
          </group>
        ))}
      {tracers.map((tracer) => (
        <Tracer key={tracer.id} from={tracer.from} to={tracer.to} color={bitcoin} />
      ))}
      {flash ? (
        <pointLight color={bitcoin} intensity={9} distance={STRIDE * 14} position={camera.position} />
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

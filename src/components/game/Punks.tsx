/**
 * PUNKS — the creatures that roam the universe.
 *
 * Punks are never alone: they move in mobs of three to five, mixed babies and
 * adults, wandering the sand and minding their own business. Hit one and the
 * whole mob turns on you at once and stays angry for a while, so picking a fight
 * with a Punk means picking a fight with all of them.
 *
 * The body is an on-chain GLB; the wide white eyes with black dots are added
 * here so every Punk reads as a Punk at a glance.
 */

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { Primitive } from "@/components/game/Primitive";
import { playSfx } from "@/lib/world-audio";
import { PUNK_INSCRIPTION } from "@/lib/world-gear";
import { registerBeastGroup, type BeastEntity } from "@/lib/world-entities";

const PUNK_URL = `https://ordinals.com/content/${PUNK_INSCRIPTION}`;

/** how many mobs roam near the visitor, and how big a mob gets */
const MOBS = 2;
const MOB_MIN = 3;
const MOB_MAX = 5;
/** how long a provoked mob keeps coming for you — they cool down quickly now */
const RAGE_MS = 10_000;

type Punk = BeastEntity & {
  mob: number;
  /** body scale — babies are small, adults are full size */
  size: number;
  seed: number;
  heading: number;
  lastBite: number;
};

function hash(a: number, b: number) {
  const n = Math.sin(a * 91.7 + b * 47.3) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * The face: square white eyes with black pupils, plus brows and a mouth that
 * shift with the Punk's mood so you can read it before it reads you.
 */
function Face({
  unit,
  size,
  seed,
  mood,
}: {
  unit: number;
  size: number;
  seed: number;
  mood: { current: "calm" | "curious" | "angry" | "hurt" };
}) {
  const blinkRef = useRef<THREE.Group>(null);
  const browL = useRef<THREE.Mesh>(null);
  const browR = useRef<THREE.Mesh>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const pupils = useRef<(THREE.Mesh | null)[]>([]);
  const eye = unit * size * 0.16;
  const y = unit * size * 0.8;
  const x = unit * size * 0.105;
  // The fitted orange head reaches roughly 0.34 units along its front (-Z).
  // Seat the eye blocks across that face so they protrude instead of hiding inside it.
  const z = -unit * size * 0.36;

  useFrame(({ clock }) => {
    const node = blinkRef.current;
    if (!node) return;
    const t = clock.elapsedTime;
    const state = mood.current;
    const interval = state === "calm" ? 3.6 + hash(seed, 41) * 3.2 : 1.8 + hash(seed, 41) * 1.4;
    const phase = (t + hash(seed, 73) * interval) % interval;
    const blink = phase < 0.16 ? Math.max(0.08, Math.abs(phase - 0.08) / 0.08) : 1;
    // Angry Punks squint; hurt ones screw their eyes half shut.
    const squint = state === "angry" ? 0.55 : state === "hurt" ? 0.35 : 1;
    node.scale.y = blink * squint;

    // Brows: flat and calm, angled down when angry, raised when curious.
    const tilt = state === "angry" ? 0.5 : state === "hurt" ? 0.32 : state === "curious" ? -0.22 : 0;
    const lift =
      state === "curious" ? eye * 0.35 : state === "angry" ? -eye * 0.12 : eye * 0.12;
    if (browL.current) {
      browL.current.rotation.z = -tilt;
      browL.current.position.y = eye * 0.78 + lift;
    }
    if (browR.current) {
      browR.current.rotation.z = tilt;
      browR.current.position.y = eye * 0.78 + lift;
    }

    // Mouth: small line when calm, wide open snarl when angry, wobble when hurt.
    if (mouthRef.current) {
      const open =
        state === "angry"
          ? 0.85 + Math.abs(Math.sin(t * 8 + seed)) * 0.5
          : state === "hurt"
            ? 0.7
            : state === "curious"
              ? 0.4 + Math.sin(t * 2 + seed) * 0.15
              : 0.22;
      mouthRef.current.scale.set(state === "angry" ? 1.25 : 1, open, 1);
    }

    // Pupils drift about when idle, lock forward when angry.
    for (const pupil of pupils.current) {
      if (!pupil) continue;
      const look = state === "angry" ? 0 : Math.sin(t * 0.8 + seed) * eye * 0.16;
      pupil.position.x = look;
      pupil.position.y = state === "calm" ? Math.sin(t * 0.55 + seed) * eye * 0.08 : 0;
    }
  });

  return (
    <group ref={blinkRef} position={[0, y, z]}>
      {[-1, 1].map((side, i) => (
        <group key={side} position={[x * side, 0, 0]}>
          <mesh>
            <boxGeometry args={[eye, eye, eye * 0.34]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh
            ref={(node) => {
              pupils.current[i] = node;
            }}
            position={[0, 0, -eye * 0.2]}
          >
            <boxGeometry args={[eye * 0.44, eye * 0.44, eye * 0.08]} />
            <meshBasicMaterial color="#0a0a0a" />
          </mesh>
          <mesh
            ref={side < 0 ? browL : browR}
            position={[0, eye * 0.78, -eye * 0.2]}
          >
            <boxGeometry args={[eye * 1.05, eye * 0.2, eye * 0.1]} />
            <meshBasicMaterial color="#0a0a0a" />
          </mesh>
        </group>
      ))}
      <mesh ref={mouthRef} position={[0, -eye * 0.95, -eye * 0.2]}>
        <boxGeometry args={[eye * 0.9, eye * 0.4, eye * 0.1]} />
        <meshBasicMaterial color="#0a0a0a" />
      </mesh>
    </group>
  );
}

function PunkBody({ unit, size }: { unit: number; size: number }) {
  const gltf = useGLTF(PUNK_URL);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const { actions } = useAnimations(gltf.animations, scene);

  const fitted = useMemo(() => {
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;
      }
    });
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene);
    const span = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = (unit * size) / Math.max(span.x, span.y, span.z, 0.0001);
    return { scale, center, minY: bounds.min.y };
  }, [scene, unit, size]);

  useEffect(() => {
    const clips = Object.values(actions);
    for (const action of clips) action?.reset().play();
    return () => {
      for (const action of clips) action?.stop();
    };
  }, [actions]);

  return (
    <group scale={fitted.scale} position={[0, -fitted.minY * fitted.scale, 0]}>
      <group position={[-fitted.center.x, 0, -fitted.center.z]}>
        <Primitive object={scene} />
      </group>
    </group>
  );
}

export function Punks({
  unit,
  pose,
  onBite,
}: {
  unit: number;
  pose: { current: { x: number; z: number } | null };
  onBite?: ((damage: number, label: string) => void) | undefined;
}) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  /** when each mob was last provoked */
  const rage = useRef<number[]>(Array.from({ length: MOBS }, () => 0));

  const punks = useRef<Punk[]>(
    (() => {
      const list: Punk[] = [];
      let id = 4_000;
      for (let mob = 0; mob < MOBS; mob++) {
        const count = MOB_MIN + Math.floor(hash(mob + 1, 9) * (MOB_MAX - MOB_MIN + 1));
        for (let index = 0; index < count; index++) {
          const roll = hash(mob * 31 + index, 17);
          // A mob mixes babies and adults, so the same crowd reads as a family.
          const size = roll < 0.35 ? 0.5 + roll * 0.4 : 0.9 + roll * 0.5;
          const hp = Math.round(30 + size * 60);
          list.push({
            id: id++,
            label: size < 0.75 ? "PUNK PUP" : "PUNK",
            hostile: false,
            hp,
            maxHp: hp,
            x: 0,
            z: 0,
            bodyY: unit * size * 0.5,
            bodyRadius: unit * size * 0.28,
            xp: Math.round(40 + size * 70),
            hitAt: 0,
            deadUntil: 0,
            mob,
            size,
            seed: mob * 7.7 + index * 2.3,
            heading: hash(index, mob) * Math.PI * 2,
            lastBite: 0,
            mood: { current: "calm" },
          });
        }
      }
      return list;
    })(),
  );

  useEffect(() => {
    registerBeastGroup("punks", punks.current);
    return () => registerBeastGroup("punks", []);
  }, []);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const player = pose.current;
    const now = performance.now();
    const reach = unit * 40;

    // Any wounded Punk sets the whole mob off — they never fight alone.
    for (const punk of punks.current) {
      if (punk.hp < punk.maxHp && now - punk.hitAt < 1_000 && rage.current[punk.mob] !== now) {
        if (!rage.current[punk.mob] || now - rage.current[punk.mob]! > 1_500) playSfx("beast");
        rage.current[punk.mob] = now;
      }
    }

    punks.current.forEach((punk, index) => {
      const node = groups.current?.[index];
      if (!node) return;
      const angry = now - (rage.current[punk.mob] ?? 0) < RAGE_MS;
      punk.hostile = angry;

      if (punk.deadUntil) {
        node.visible = true;
        node.rotation.set(0, punk.heading + Math.PI, Math.PI / 2.1);
        node.position.set(punk.x, unit * 0.02, punk.z);
        return;
      }
      node.rotation.z = 0;

      const speed = unit * (angry ? 1.05 : 0.5) * (0.7 + punk.size * 0.4);
      let steer = Math.sin(now / 1_500 + punk.seed) * delta * 1.6;
      let travel = speed;

      // Mob cohesion: drift back toward the middle of your own crowd.
      let mobX = 0;
      let mobZ = 0;
      let mates = 0;
      for (const mate of punks.current) {
        if (mate.mob !== punk.mob || mate.deadUntil) continue;
        mobX += mate.x;
        mobZ += mate.z;
        mates++;
      }
      if (mates > 1) {
        mobX /= mates;
        mobZ /= mates;
        const spread = Math.hypot(mobX - punk.x, mobZ - punk.z);
        if (spread > unit * 2.6) {
          const home = Math.atan2(mobX - punk.x, mobZ - punk.z);
          const diff = ((home - punk.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          steer = diff * Math.min(1, delta * 2.5);
        }
      }

      if (player) {
        const dx = player.x - punk.x;
        const dz = player.z - punk.z;
        const away = Math.hypot(dx, dz);
        const toPlayer = Math.atan2(dx, dz);
        if (angry && away < unit * 20) {
          const diff = ((toPlayer - punk.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          steer = diff * Math.min(1, delta * 3.2);
          travel = speed * 1.2;
          const standoff = unit * (0.8 + punk.size * 0.3);
          if (away < standoff * 1.3) travel = speed * 0.1;
          if (away < standoff * 1.9 && now - punk.lastBite > 1_500) {
            punk.lastBite = now;
            playSfx("hit");
            onBite?.(Math.round(5 + punk.size * 7), punk.label);
          }
        } else if (!angry && away < unit * 2.2) {
          // Friendly, but they keep their personal space.
          const back = toPlayer + Math.PI;
          const diff = ((back - punk.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          steer = diff * Math.min(1, delta * 3);
          travel = speed * 1.2;
        }
      }

      punk.heading += steer;
      punk.x += Math.sin(punk.heading) * travel * delta;
      punk.z += Math.cos(punk.heading) * travel * delta;

      if (player) {
        const dx = punk.x - player.x;
        const dz = punk.z - player.z;
        const away = Math.hypot(dx, dz) || 0.0001;
        const standoff = unit * (0.6 + punk.size * 0.3);
        if (away < standoff) {
          punk.x = player.x + (dx / away) * standoff;
          punk.z = player.z + (dz / away) * standoff;
        }
        // A mob that wandered out of sight walks back in together.
        if (away > reach) {
          const angle = punk.mob * 2.1 + now / 9_000;
          const ring = unit * (16 + punk.mob * 8);
          punk.x = player.x + Math.cos(angle) * ring + Math.cos(punk.seed) * unit * 1.6;
          punk.z = player.z + Math.sin(angle) * ring + Math.sin(punk.seed) * unit * 1.6;
        }
      }

      const stride = Math.abs(Math.sin(now / 190 + punk.seed)) * unit * punk.size * 0.03;
      punk.bodyY = unit * punk.size * 0.5;
      node.position.set(punk.x, stride, punk.z);
      // The model's face points down its own -Z, so turn it to walk face-first.
      node.rotation.y = punk.heading + Math.PI;
      // A struck Punk rocks back so the hit reads.
      const sinceHit = now - punk.hitAt;
      node.rotation.x = sinceHit < 260 ? -Math.sin((sinceHit / 260) * Math.PI) * 0.3 : 0;
    });
  });

  return (
    <group>
      {punks.current.map((punk, index) => (
        <group
          key={punk.id}
          ref={(node) => {
            groups.current[index] = node;
          }}
        >
          <Suspense fallback={null}>
            <PunkBody unit={unit} size={punk.size} />
          </Suspense>
          <Eyes unit={unit} size={punk.size} seed={punk.seed} />
        </group>
      ))}
    </group>
  );
}

/**
 * THE DJ EVENT — PEPE AND THE BITMAPPERS.
 *
 * Every so often the sand throws a party. The schedule is derived from clock
 * time alone, so every visitor in the world is inside the same window at the
 * same moment without any server coordination: the day is cut into slots, a
 * hash decides which rare slot is a party, and the crew only appears then.
 *
 * When a set is live, the crew is inscribed on chain and shows up on the plaza
 * at 0.BITMAP with a lit rig, speaker stacks and a four-on-the-floor loop that
 * swells as you walk up to the decks.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { Primitive } from "@/components/game/Primitive";
import { setDjLevel, setMusicDuck, startDjSet, stopDjSet } from "@/lib/world-audio";

/** on-chain GLB of Pepe and the Bitmappers */
export const PEPE_BITMAPPERS_INSCRIPTION =
  "2295ed920a400624ab5fb75c3b1b08c3d852149ccaf5ef0b4881b39b9706fa43i0";
const PEPE_URL = `https://ordinals.com/content/${PEPE_BITMAPPERS_INSCRIPTION}`;

/** the world is cut into 20 minute slots; roughly one in twelve throws a party */
const SLOT_MS = 20 * 60_000;
const CHANCE = 1 / 12;
/** how long a set runs once it starts */
const SET_MS = 6 * 60_000;

function hash(n: number) {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

export type DjWindow = {
  live: boolean;
  /** ms until the set ends (when live) or until the next possible slot */
  endsAt: number;
  /** the next slot that is a party, in ms since epoch */
  nextAt: number;
};

/** Is a set running right now? Pure clock maths — same answer for everyone. */
export function djEventWindow(now = Date.now()): DjWindow {
  const slot = Math.floor(now / SLOT_MS);
  const live = hash(slot) < CHANCE && now - slot * SLOT_MS < SET_MS;
  let nextAt = 0;
  for (let ahead = live ? 1 : 0; ahead < 24 * 6; ahead++) {
    const candidate = slot + ahead;
    if (hash(candidate) < CHANCE && candidate * SLOT_MS > now) {
      nextAt = candidate * SLOT_MS;
      break;
    }
  }
  return { live, endsAt: slot * SLOT_MS + SET_MS, nextAt };
}

/** React view of the schedule, re-checked every ten seconds. */
export function useDjEvent(): DjWindow {
  const [state, setState] = useState<DjWindow>(() => djEventWindow());
  useEffect(() => {
    const tick = () => setState(djEventWindow());
    tick();
    const timer = window.setInterval(tick, 10_000);
    return () => window.clearInterval(timer);
  }, []);
  return state;
}

function Crew({ unit }: { unit: number }) {
  const gltf = useGLTF(PEPE_URL);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const { actions } = useAnimations(gltf.animations, scene);
  const group = useRef<THREE.Group>(null);

  const fit = useMemo(() => {
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
    // the crew reads about three strides across the stage
    const scale = (unit * 3) / Math.max(span.x, span.y, span.z, 0.0001);
    return { scale, center, minY: bounds.min.y };
  }, [scene, unit]);

  useEffect(() => {
    const clips = Object.values(actions);
    for (const action of clips) action?.reset().play();
    return () => {
      for (const action of clips) action?.stop();
    };
  }, [actions]);

  // they bounce on the beat even if the model ships no clips
  useFrame(({ clock }) => {
    const node = group.current;
    if (!node) return;
    const beat = clock.elapsedTime * (124 / 60) * Math.PI;
    node.position.y = Math.abs(Math.sin(beat)) * unit * 0.09;
    node.rotation.z = Math.sin(beat * 0.5) * 0.03;
  });

  return (
    <group ref={group} scale={fit.scale} position={[0, -fit.minY * fit.scale, 0]}>
      <group position={[-fit.center.x, 0, -fit.center.z]}>
        <Primitive object={scene} />
      </group>
    </group>
  );
}

/** Speaker stacks, a lit deck and sweeping beams around the crew. */
function Rig({ unit, bitcoin }: { unit: number; bitcoin: string }) {
  const beams = useRef<THREE.Group>(null);
  const floor = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (beams.current) beams.current.rotation.y = t * 1.1;
    const pulse = 0.4 + Math.abs(Math.sin(t * (124 / 60) * Math.PI)) * 0.6;
    const mat = floor.current?.material as THREE.MeshBasicMaterial | undefined;
    if (mat) mat.opacity = 0.12 + pulse * 0.24;
  });

  const dark = new THREE.MeshStandardMaterial({ color: "#111318", roughness: 0.7, metalness: 0.2 });

  return (
    <group>
      {/* dance floor glow */}
      <mesh ref={floor} rotation-x={-Math.PI / 2} position={[0, unit * 0.02, 0]}>
        <circleGeometry args={[unit * 7, 40]} />
        <meshBasicMaterial color={bitcoin} transparent opacity={0.2} />
      </mesh>
      {/* deck table */}
      <mesh material={dark} position={[0, unit * 0.5, -unit * 1.2]}>
        <boxGeometry args={[unit * 3, unit * 0.22, unit * 0.9]} />
      </mesh>
      {/* speaker stacks */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * unit * 3.2, 0, -unit * 1.1]}>
          {[0, 1].map((level) => (
            <mesh key={level} material={dark} position={[0, unit * (0.7 + level * 1.35), 0]}>
              <boxGeometry args={[unit * 1.2, unit * 1.3, unit * 1.1]} />
            </mesh>
          ))}
          <mesh position={[0, unit * 2.05, -unit * 0.56]}>
            <circleGeometry args={[unit * 0.4, 20]} />
            <meshBasicMaterial color={bitcoin} transparent opacity={0.5} />
          </mesh>
        </group>
      ))}
      {/* sweeping beams */}
      <group ref={beams} position={[0, unit * 3.6, -unit * 1.2]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={i}
            rotation={[0.9, (i * Math.PI) / 2, 0]}
            position={[Math.cos((i * Math.PI) / 2) * unit * 0.6, 0, Math.sin((i * Math.PI) / 2) * unit * 0.6]}
          >
            <coneGeometry args={[unit * 0.8, unit * 7, 12, 1, true]} />
            <meshBasicMaterial
              color={bitcoin}
              transparent
              opacity={0.09}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
      <pointLight position={[0, unit * 3, -unit * 1.2]} intensity={4} distance={unit * 20} color={bitcoin} />
    </group>
  );
}

/**
 * The party itself. Renders nothing at all outside a live window, so the crew
 * really is a rare sight, and only makes sound while you are near the stage.
 */
export function DjEvent({
  unit,
  pose,
  bitcoin,
  stage = { x: 0, z: 0 },
}: {
  unit: number;
  pose: { current: { x: number; z: number } | null };
  bitcoin: string;
  /** where the rig stands in world units — the plaza at 0.BITMAP by default */
  stage?: { x: number; z: number };
}) {
  const { live } = useDjEvent();

  useEffect(() => {
    if (!live) return;
    startDjSet();
    return () => stopDjSet();
  }, [live]);

  // the beat swells as you close in on the decks
  useFrame(() => {
    if (!live) return;
    const me = pose.current;
    if (!me) return;
    const distance = Math.hypot(me.x - stage.x, me.z - stage.z);
    const range = unit * 60;
    setDjLevel(Math.max(0, 1 - distance / range) ** 1.6);
  });

  if (!live) return null;

  return (
    <group position={[stage.x, 0, stage.z]}>
      <Rig unit={unit} bitcoin={bitcoin} />
      <Suspense fallback={null}>
        <Crew unit={unit} />
      </Suspense>
    </group>
  );
}

useGLTF.preload(PEPE_URL);

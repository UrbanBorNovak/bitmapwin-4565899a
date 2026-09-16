/**
 * PUNK EYES — the face every Punk wears.
 *
 * Two flat white blocks on the front of the head, each holding a solid black
 * square pupil that shifts with the creature's mood: pupils slide gently while
 * it is calm, lock forward when it is angry, and the whole face squints or
 * screws half shut when it is hurt. No brows and no mouth — the reference face
 * is eyes only.
 *
 * Shared by the Punk mobs and the Perfect Punks so both read the same way.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type CreatureMood = { current: "calm" | "curious" | "angry" | "hurt" };

function hash(a: number, b: number) {
  const n = Math.sin(a * 91.7 + b * 47.3) * 43758.5453;
  return n - Math.floor(n);
}

export function CreatureEyes({
  unit,
  size,
  seed,
  mood,
}: {
  unit: number;
  size: number;
  seed: number;
  mood: CreatureMood;
}) {
  const blinkRef = useRef<THREE.Group>(null);
  const pupils = useRef<(THREE.Mesh | null)[]>([]);
  const eye = unit * size * 0.16;
  const eyeW = eye * 1.5;
  const eyeH = eye * 0.75;
  const pupilW = eyeW * 0.5;
  const y = unit * size * 0.8;
  const x = unit * size * 0.115;
  // The fitted head reaches roughly a third of a unit along its front (-Z).
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
    const squint = state === "angry" ? 0.55 : state === "hurt" ? 0.35 : 1;
    node.scale.y = blink * squint;

    for (const pupil of pupils.current) {
      if (!pupil) continue;
      const range = (eyeW - pupilW) * 0.5;
      pupil.position.x = state === "angry" ? -range : Math.sin(t * 0.7 + seed) * range;
    }
  });

  return (
    <group ref={blinkRef} position={[0, y, z]}>
      {[-1, 1].map((side, i) => (
        <group key={side} position={[x * side, 0, 0]}>
          <mesh>
            <boxGeometry args={[eyeW, eyeH, eye * 0.3]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh
            ref={(node) => {
              pupils.current[i] = node;
            }}
            position={[0, 0, -eye * 0.18]}
          >
            <boxGeometry args={[pupilW, eyeH, eye * 0.08]} />
            <meshBasicMaterial color="#0a0a0a" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

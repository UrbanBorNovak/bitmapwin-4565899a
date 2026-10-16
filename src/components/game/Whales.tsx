/**
 * WHALES — the big swimmers of the inland seas.
 *
 * Each sea carries a small pod of inscribed whales that roam its open middle,
 * steered by the same fly brain the settlers use. Now and then one breaches:
 * it launches clear of the water and crashes back in. Pods are seeded from
 * the sea's own id; only the pods near you are drawn or animated.
 */
import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SEAS, seaRadiusAt, type SeaMass } from "@/lib/world-sea";
import { waterSurfaceY } from "@/lib/world-terrain";
import type { PlayerState } from "@/lib/player-state";
import { createFlyBrain, type FlyBrain } from "@/lib/fly-brain";
import { InscribedModel, contentUrl } from "./InscribedParts";

/** The inscribed whale, read once from chain and reused by every copy. */
import { WHALE_INSCRIPTION } from "@/lib/creature-codex";
export { WHALE_INSCRIPTION };

/** Whales stay inside this fraction of the coast, i.e. the open middle. */
const CORE = 0.4;
const BREACH_SECONDS = 2.2;

type Whale = {
  sea: SeaMass;
  size: number;
  dive: number;
  phase: number;
  brain: FlyBrain;
  x: number;
  z: number;
  yaw: number;
  /** seconds until the next breach, then time into the current one */
  nextBreach: number;
  breach: number;
};

function seed(n: number, salt: number) {
  const v = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function buildPod(unit: number): Whale[] {
  const whales: Whale[] = [];
  for (const sea of SEAS) {
    const span = Math.min(sea.rx, sea.rz);
    const count = Math.min(3, Math.max(1, Math.floor(seed(sea.id, 21) * 2 + span / (unit * 260))));
    for (let i = 0; i < count; i++) {
      const s = sea.id * 7 + i;
      const a = seed(s, 24) * Math.PI * 2;
      const r = seed(s, 22) * CORE * 0.6;
      whales.push({
        sea,
        size: unit * (5 + seed(s, 25) * 3),
        dive: unit * (0.5 + seed(s, 26) * 0.8),
        phase: a,
        brain: createFlyBrain(seed(s, 27) * 10),
        x: sea.x + Math.cos(a) * sea.rx * r,
        z: sea.z + Math.sin(a) * sea.rz * r,
        yaw: a,
        nextBreach: 6 + seed(s, 28) * 20,
        breach: -1,
      });
    }
  }
  return whales;
}

export const Whales = memo(function Whales({
  unit,
  pose,
}: {
  unit: number;
  pose: React.MutableRefObject<PlayerState | null>;
}) {
  const group = useRef<THREE.Group>(null);
  const whales = useMemo(() => buildPod(unit), [unit]);

  useFrame(({ clock }, rawDelta) => {
    const node = group.current;
    const player = pose.current;
    if (!node) return;
    const dt = Math.min(rawDelta, 0.05);
    const t = clock.elapsedTime;
    const range = unit * 260;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]!;
      const w = whales[i]!;
      const { sea } = w;
      if (player && Math.hypot(player.x - w.x, player.z - w.z) > range) {
        child.visible = false;
        continue;
      }
      child.visible = true;

      // Brain steers toward a slowly drifting point near the sea's centre.
      const wa = w.phase + t * 0.03;
      const tx = sea.x + Math.cos(wa) * sea.rx * CORE * 0.35;
      const tz = sea.z + Math.sin(wa) * sea.rz * CORE * 0.35;
      const scale = Math.max(w.size, 0.0001);
      const act = w.brain.think(
        {
          now: t * 1000,
          hp: 100,
          maxHp: 100,
          snared: false,
          heading: w.yaw,
          playerDistance: null,
          playerAngle: 0,
          workDistance: Math.hypot(tx - w.x, tz - w.z) / scale,
          workAngle: Math.atan2(tx - w.x, tz - w.z),
          worker: true,
          hostile: false,
          vendor: false,
        },
        dt,
      );
      w.yaw += act.steer * 0.6;
      const speed = unit * (1.2 + (w.breach >= 0 ? 3 : 0)) * Math.max(0.35, act.throttle);
      w.x += Math.sin(w.yaw) * speed * dt;
      w.z += Math.cos(w.yaw) * speed * dt;

      // Hard fence: never leave the open middle of the sea.
      const nx = (w.x - sea.x) / sea.rx;
      const nz = (w.z - sea.z) / sea.rz;
      const ang = Math.atan2(nz, nx);
      const limit = seaRadiusAt(sea, ang) * CORE;
      const d = Math.hypot(nx, nz);
      if (d > limit) {
        w.x = sea.x + (nx / d) * limit * sea.rx;
        w.z = sea.z + (nz / d) * limit * sea.rz;
        w.yaw = Math.atan2(sea.x - w.x, sea.z - w.z);
      }

      // Breach timer.
      if (w.breach < 0) {
        w.nextBreach -= dt;
        if (w.nextBreach <= 0) w.breach = 0;
      } else {
        w.breach += dt;
        if (w.breach > BREACH_SECONDS) {
          w.breach = -1;
          w.nextBreach = 12 + seed(i + Math.floor(t), 29) * 25;
        }
      }

      const surface = waterSurfaceY(sea.x, sea.z);
      const breath = Math.sin(t * 0.35 + w.phase * 3);
      const surfaced = Math.max(0, breath);
      let y = surface - w.dive * (0.3 + (1 - surfaced) * 0.45) - w.size * (0.2 - surfaced * 0.1);
      let pitch = breath * 0.05;
      if (w.breach >= 0) {
        const p = w.breach / BREACH_SECONDS; // 0..1
        const arc = 4 * p * (1 - p); // 0 → 1 → 0
        y = surface - w.size * 0.25 + arc * w.size * 0.75;
        pitch = (0.5 - p) * 1.4; // nose up, then nose down into the splash
      }
      child.position.set(w.x, y, w.z);
      child.rotation.set(0, 0, 0);
      child.rotation.y = w.yaw - Math.PI / 2;
      child.rotation.z = pitch;
    }
  });

  return (
    <group ref={group}>
      {whales.map((whale, i) => (
        <group key={i}>
          <InscribedModel url={contentUrl(WHALE_INSCRIPTION)} size={whale.size} />
        </group>
      ))}
    </group>
  );
});

/**
 * TERRITORY GUARDIANS — every awakened Block-DNA Guardian patrols its home
 * BITMAP, steered by the same fly brain as the settlers and whales. Only the
 * ones near you are drawn.
 */
import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import * as THREE from "three";
import { WORLD_CELL, WORLD_GRID, cellX, cellZ, type PlayerState } from "@/lib/player-state";
import { groundY } from "@/lib/world-terrain";
import { createFlyBrain, type FlyBrain } from "@/lib/fly-brain";
import { allGuardiansQuery, type AwakeGuardian } from "@/lib/bitmon-queries";
import { GuardianBody } from "@/components/bitmon/GuardianBody";
import { SafeHtml } from "@/components/game/SafeHtml";

type Walker = { g: AwakeGuardian; hx: number; hz: number; x: number; z: number; yaw: number; brain: FlyBrain; phase: number };

const Guardian = memo(function Guardian({ w, unit, pose }: { w: Walker; unit: number; pose: React.MutableRefObject<PlayerState | null> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }, raw) => {
    const node = ref.current;
    const p = pose.current;
    if (!node) return;
    const near = !p || Math.hypot(p.x - w.hx, p.z - w.hz) < WORLD_CELL * 2.5;
    node.visible = near;
    if (!near) return;
    const dt = Math.min(raw, 0.05);
    const t = clock.elapsedTime;
    const size = unit * 1.6;
    const wa = w.phase + t * 0.05;
    const tx = w.hx + Math.cos(wa) * WORLD_CELL * 0.28;
    const tz = w.hz + Math.sin(wa) * WORLD_CELL * 0.28;
    const pd = p ? Math.hypot(p.x - w.x, p.z - w.z) / size : null;
    const act = w.brain.think(
      {
        now: t * 1000, hp: 100, maxHp: 100, snared: false, heading: w.yaw,
        playerDistance: pd !== null && pd < 12 ? pd : null,
        playerAngle: p ? Math.atan2(p.x - w.x, p.z - w.z) : 0,
        workDistance: Math.hypot(tx - w.x, tz - w.z) / size,
        workAngle: Math.atan2(tx - w.x, tz - w.z),
        worker: true, hostile: false, vendor: true,
      },
      dt,
    );
    w.yaw += act.steer * 0.7;
    const speed = unit * (0.6 + w.g.speed / 60) * Math.max(0.2, act.throttle);
    w.x += Math.sin(w.yaw) * speed * dt;
    w.z += Math.cos(w.yaw) * speed * dt;
    // stay on its own BITMAP
    const half = WORLD_CELL * 0.42;
    if (Math.abs(w.x - w.hx) > half || Math.abs(w.z - w.hz) > half) {
      w.x = THREE.MathUtils.clamp(w.x, w.hx - half, w.hx + half);
      w.z = THREE.MathUtils.clamp(w.z, w.hz - half, w.hz + half);
      w.yaw = Math.atan2(w.hx - w.x, w.hz - w.z);
    }
    node.position.set(w.x, groundY(w.x, w.z) + Math.abs(Math.sin(t * 6 * act.throttle)) * unit * 0.05, w.z);
    node.rotation.y = w.yaw;
  });
  return (
    <group ref={ref}>
      <GuardianBody species={w.g.species} rarity={w.g.rarity} body={w.g.body} accent={w.g.accent} unit={unit * 1.6} height={w.g.height} />
      <SafeHtml position={[0, unit * 3.2, 0]} center distanceFactor={unit * 40} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap border border-bitcoin/60 bg-background/80 px-1.5 py-0.5 font-mono text-[9px] text-bitcoin">
          {w.g.species} · LV {w.g.level} · {w.g.height}
        </div>
      </SafeHtml>
    </group>
  );
});

export const TerritoryGuardians = memo(function TerritoryGuardians({ unit, pose }: { unit: number; pose: React.MutableRefObject<PlayerState | null> }) {
  const { data } = useQuery(allGuardiansQuery());
  const walkers = useMemo<Walker[]>(
    () =>
      (data ?? []).map((g) => {
        const col = g.height % WORLD_GRID;
        const row = Math.floor(g.height / WORLD_GRID);
        const hx = cellX(col);
        const hz = cellZ(row);
        return { g, hx, hz, x: hx, z: hz, yaw: 0, brain: createFlyBrain((g.height % 997) / 97), phase: (g.height % 360) * 0.0174 };
      }),
    [data],
  );
  return <group>{walkers.map((w) => <Guardian key={w.g.height} w={w} unit={unit} pose={pose} />)}</group>;
});

/**
 * TERRITORY GUARDIANS — every awakened Block-DNA Guardian patrols its home
 * BITMAP, steered by the same fly brain as the settlers and whales. Only the
 * ones near you are drawn.
 */
import { memo, useMemo, useRef, useState } from "react";
import { playSfx } from "@/lib/world-audio";
import { useFrame } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import * as THREE from "three";
import { WORLD_CELL, WORLD_GRID, cellX, cellZ, type PlayerState } from "@/lib/player-state";
import { groundY } from "@/lib/world-terrain";
import { createFlyBrain, type FlyBrain } from "@/lib/fly-brain";
import { allGuardiansQuery, type AwakeGuardian } from "@/lib/bitmon-queries";
import { liveDispatchesQuery, recentGuardianRaidsQuery } from "@/lib/guardian-dispatch-queries";
import { settleRaidsFn } from "@/lib/guardian-raid.functions";
import { dispatchPosition, isLive, type Dispatch } from "@/lib/guardian-dispatch";
import { GuardianBody } from "@/components/bitmon/GuardianBody";
import { SafeHtml } from "@/components/game/SafeHtml";
import { mountedGuardian, encounterSnapshot, guardianBite, setNearGuardian } from "@/lib/guardian-encounter";

/** Commune prompt radius, in BITMAP widths. */
const COMMUNE = 0.35;
const BITE_RANGE = 0.12;

type Walker = {
  g: AwakeGuardian; hx: number; hz: number; x: number; z: number; yaw: number; brain: FlyBrain; phase: number;
  /** progress 0..4 around the BITMAP's border square */
  lap: number; dir: 1 | -1; roarUntil: number; roarReady: number; inside: boolean;
  lastRoarReq: number; biteReady: number; lunge: number;
  /** commanded route shared by every player, if deployed */
  order: Dispatch | null;
};

type LandRaidResult = {
  height: number;
  latestSpoils: number;
  recentSpoils: number;
  wins: number;
};

/** Patrol ring: the guardian walks the border of its BITMAP, just inside the edge. */
const EDGE = 0.4;
/** A visitor crossing this distance from the guardian triggers a roar. */
const ALERT = 0.55;
const ROAR_SECONDS = 1.6;
const ROAR_COOLDOWN = 9;

function perimeterPoint(lap: number, hx: number, hz: number, r: number): [number, number] {
  const s = ((lap % 4) + 4) % 4;
  const side = Math.floor(s);
  const f = s - side;
  const a = -r + f * 2 * r;
  switch (side) {
    case 0: return [hx + a, hz - r];
    case 1: return [hx + r, hz + a];
    case 2: return [hx - a, hz + r];
    default: return [hx - r, hz - a];
  }
}

const Guardian = memo(function Guardian({ w, unit, pose }: { w: Walker; unit: number; pose: React.MutableRefObject<PlayerState | null> }) {
  const ref = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const [roaring, setRoaring] = useState(false);
  useFrame(({ clock }, raw) => {
    const node = ref.current;
    const p = pose.current;
    if (!node) return;
    const ord = w.order && isLive(w.order, Date.now()) ? w.order : null;
    if (ord) {
      // Commanded: position comes from shared server timestamps, so all players agree.
      const at = dispatchPosition(ord, Date.now());
      w.x = at.x; w.z = at.z;
      if (at.moving) w.yaw += Math.atan2(Math.sin(at.yaw - w.yaw), Math.cos(at.yaw - w.yaw)) * 0.15;
      const nearO = !p || Math.hypot(p.x - w.x, p.z - w.z) < WORLD_CELL * 2.5;
      node.visible = nearO;
      if (!nearO) return;
      const tt = clock.elapsedTime;
      node.position.set(w.x, groundY(w.x, w.z) + (at.moving ? Math.abs(Math.sin(tt * 6)) * unit * 0.05 : 0), w.z);
      node.rotation.y = w.yaw;
      return;
    }
    const near = (!p || Math.hypot(p.x - (w.order ? w.x : w.hx), p.z - (w.order ? w.z : w.hz)) < WORLD_CELL * 2.5) && mountedGuardian()?.height !== w.g.height;
    node.visible = near;
    if (!near) return;
    const dt = Math.min(raw, 0.05);
    const t = clock.elapsedTime;
    const size = unit * 1.6;
    const r = WORLD_CELL * EDGE;
    const visitorDist = p ? Math.hypot(p.x - w.x, p.z - w.z) : Infinity;
    const close = visitorDist < WORLD_CELL * ALERT;

    // Roar once when a visitor steps into range, then cool down.
    if (close && !w.inside && t >= w.roarReady) {
      w.roarUntil = t + ROAR_SECONDS;
      w.roarReady = t + ROAR_COOLDOWN;
      playSfx("beast");
      setRoaring(true);
    }
    w.inside = close;
    const enc = encounterSnapshot();
    // Roar on request from the encounter panel.
    const req = enc.roarAt[w.g.height] ?? 0;
    if (req > w.lastRoarReq) {
      w.lastRoarReq = req;
      w.roarUntil = t + ROAR_SECONDS;
      playSfx("beast");
      setRoaring(true);
    }
    const commune = visitorDist < WORLD_CELL * COMMUNE;
    if (commune) setNearGuardian(w.g);
    else if (enc.near?.height === w.g.height) setNearGuardian(null);
    const sparring = enc.spar?.height === w.g.height && !enc.spar.over;
    const isRoaring = t < w.roarUntil;
    if (!isRoaring && roaring) setRoaring(false);

    if (sparring && p) {
      // Friendly spar: face the visitor, close in, lunge and nip.
      const want = Math.atan2(p.x - w.x, p.z - w.z);
      const diff = Math.atan2(Math.sin(want - w.yaw), Math.cos(want - w.yaw));
      w.yaw += diff * (1 - Math.exp(-10 * dt));
      const reach = WORLD_CELL * BITE_RANGE;
      if (visitorDist > reach * 0.7) {
        const sp = unit * (1.2 + w.g.speed / 40);
        w.x += Math.sin(w.yaw) * sp * dt;
        w.z += Math.cos(w.yaw) * sp * dt;
      }
      if (visitorDist < reach && t >= w.biteReady) {
        w.biteReady = t + Math.max(0.9, 2.2 - w.g.speed / 60);
        w.lunge = t;
        playSfx("beast");
        guardianBite(4 + w.g.bite / 6);
      }
    } else if (isRoaring && p) {
      // Plant the feet and face the intruder.
      const want = Math.atan2(p.x - w.x, p.z - w.z);
      const diff = Math.atan2(Math.sin(want - w.yaw), Math.cos(want - w.yaw));
      w.yaw += diff * (1 - Math.exp(-8 * dt));
    } else {
      // Walk the border; look a little ahead along the ring.
      const speed = unit * (0.6 + w.g.speed / 60);
      w.lap += (w.dir * speed * dt) / (2 * r);
      const [tx, tz] = perimeterPoint(w.lap + w.dir * 0.08, w.hx, w.hz, r);
      const act = w.brain.think(
        {
          now: t * 1000, hp: 100, maxHp: 100, snared: false, heading: w.yaw,
          playerDistance: null, playerAngle: 0,
          workDistance: Math.hypot(tx - w.x, tz - w.z) / size,
          workAngle: Math.atan2(tx - w.x, tz - w.z),
          worker: true, hostile: false, vendor: true,
        },
        dt,
      );
      const want = Math.atan2(tx - w.x, tz - w.z);
      const diff = Math.atan2(Math.sin(want - w.yaw), Math.cos(want - w.yaw));
      w.yaw += diff * (1 - Math.exp(-5 * dt)) + act.steer * 0.05;
      const [px, pz] = perimeterPoint(w.lap, w.hx, w.hz, r);
      const k = 1 - Math.exp(-4 * dt);
      w.x += (px - w.x) * k;
      w.z += (pz - w.z) * k;
    }
    const half = WORLD_CELL * 0.45;
    w.x = THREE.MathUtils.clamp(w.x, w.hx - half, w.hx + half);
    w.z = THREE.MathUtils.clamp(w.z, w.hz - half, w.hz + half);
    const bob = isRoaring ? 0 : Math.abs(Math.sin(t * 6)) * unit * 0.05;
    node.position.set(w.x, groundY(w.x, w.z) + bob, w.z);
    node.rotation.y = w.yaw;
    if (body.current) {
      // Rear up and swell while roaring.
      const q = isRoaring ? Math.sin(((w.roarUntil - t) / ROAR_SECONDS) * Math.PI) : 0;
      const l = t - w.lunge < 0.35 ? Math.sin(((t - w.lunge) / 0.35) * Math.PI) : 0;
      body.current.rotation.x = -q * 0.35 + l * 0.4;
      body.current.position.z = l * unit * 0.6;
      body.current.scale.setScalar(1 + q * 0.18);
    }
  });
  return (
    <group ref={ref}>
      <group ref={body}>
        <GuardianBody species={w.g.species} rarity={w.g.rarity} body={w.g.body} accent={w.g.accent} unit={unit * 1.6} height={w.g.height} inscribed={!!w.g.inscriptionId} />
      </group>
      <SafeHtml position={[0, unit * 3.2, 0]} center distanceFactor={unit * 40} style={{ pointerEvents: "none" }}>
        <div className={`whitespace-nowrap border bg-background/80 px-1.5 py-0.5 font-mono text-[9px] ${roaring ? "border-bitcoin text-bitcoin animate-pulse" : "border-bitcoin/60 text-bitcoin"}`}>
          {roaring ? `ROAR · ${w.g.height}.BITMAP GUARDIAN` : w.order && isLive(w.order, Date.now()) ? `${w.order.repeat ? "WALKER " : ""}${w.order.directive.toUpperCase()} · ${w.g.height}.BITMAP${w.order.target != null ? ` → ${w.order.target}` : ""}` : `${w.g.species} · LV ${w.g.level} · ${w.g.height}`}
        </div>
      </SafeHtml>
    </group>
  );
});

export const TerritoryGuardians = memo(function TerritoryGuardians({ unit, pose }: { unit: number; pose: React.MutableRefObject<PlayerState | null> }) {
  const { data } = useQuery(allGuardiansQuery());
  const { data: orders } = useQuery(liveDispatchesQuery());
  const { data: raids } = useQuery(recentGuardianRaidsQuery());
  // Anyone in the Oasis helps settle due raid laps; results are deterministic and idempotent.
  useQuery({ queryKey: ["guardian-raids", "settle"], queryFn: () => settleRaidsFn().catch(() => null), refetchInterval: 60_000, enabled: (orders?.length ?? 0) > 0 });
  const walkers = useMemo<Walker[]>(
    () =>
      (data ?? []).map((g) => {
        const col = g.height % WORLD_GRID;
        const row = Math.floor(g.height / WORLD_GRID);
        const hx = cellX(col);
        const hz = cellZ(row);
        const lap = (g.height % 400) / 100;
        const [sx, sz] = perimeterPoint(lap, hx, hz, WORLD_CELL * EDGE);
        return { g, hx, hz, x: sx, z: sz, yaw: 0, brain: createFlyBrain((g.height % 997) / 97), phase: (g.height % 360) * 0.0174, lap, dir: g.height % 2 ? 1 : -1, roarUntil: 0, roarReady: 0, inside: false, lastRoarReq: Date.now(), biteReady: 0, lunge: -9, order: null };
      }),
    [data],
  );
  // Attach live orders without rebuilding walkers (keeps their positions).
  const byHeight = useMemo(() => new Map((orders ?? []).map((o) => [o.height, o])), [orders]);
  for (const w of walkers) w.order = byHeight.get(w.g.height) ?? null;
  const raidResults = useMemo(() => {
    const byWinner = new Map<number, LandRaidResult>();
    for (const raid of raids ?? []) {
      const prior = byWinner.get(raid.winnerHeight);
      if (prior) {
        prior.recentSpoils += raid.spoils;
        prior.wins += 1;
      } else {
        byWinner.set(raid.winnerHeight, {
          height: raid.winnerHeight,
          latestSpoils: raid.spoils,
          recentSpoils: raid.spoils,
          wins: 1,
        });
      }
    }
    return [...byWinner.values()];
  }, [raids]);
  return (
    <group>
      {walkers.map((w) => <Guardian key={w.g.height} w={w} unit={unit} pose={pose} />)}
      {walkers.map((w) => <Beacon key={`b${w.g.height}`} x={w.hx} z={w.hz} />)}
      {raidResults.map((result) => <RaidLandMarker key={result.height} result={result} unit={unit} pose={pose} />)}
    </group>
  );
});

/** Public raid outcome anchored to the winning Guardian's home BITMAP. */
const RaidLandMarker = memo(function RaidLandMarker({
  result,
  unit,
  pose,
}: {
  result: LandRaidResult;
  unit: number;
  pose: React.MutableRefObject<PlayerState | null>;
}) {
  const ref = useRef<THREE.Group>(null);
  const col = result.height % WORLD_GRID;
  const row = Math.floor(result.height / WORLD_GRID);
  const x = cellX(col);
  const z = cellZ(row);
  const y = groundY(x, z) + unit * 4.25;

  useFrame(() => {
    const node = ref.current;
    if (!node) return;
    const player = pose.current;
    node.visible = !player || Math.hypot(player.x - x, player.z - z) < WORLD_CELL * 3.5;
  });

  return (
    <group ref={ref} position={[x, y, z]}>
      <SafeHtml center distanceFactor={unit * 42} style={{ pointerEvents: "none" }}>
        <div className="min-w-max border border-signal bg-background/90 px-2.5 py-1.5 text-center font-mono shadow-lg backdrop-blur-sm">
          <p className="text-[8px] tracking-[0.22em] text-signal">RAID WINNER</p>
          <p className="mt-0.5 text-[10px] text-foreground">{result.height}.BITMAP</p>
          <p className="mt-0.5 text-[10px] text-bitcoin">+{result.latestSpoils} BIT SPOILS</p>
          {result.wins > 1 ? (
            <p className="mt-0.5 text-[8px] text-muted-foreground">{result.wins} RECENT WINS · {result.recentSpoils} BIT</p>
          ) : null}
        </div>
      </SafeHtml>
    </group>
  );
});

/** Cyan light column over each Guardian's home BITMAP, visible from the horizon. */
const Beacon = memo(function Beacon({ x, z }: { x: number; z: number }) {
  const h = WORLD_CELL * 6;
  return (
    <mesh position={[x, groundY(x, z) + h / 2, z]} renderOrder={3}>
      <cylinderGeometry args={[WORLD_CELL * 0.04, WORLD_CELL * 0.08, h, 8, 1, true]} />
      <meshBasicMaterial color="#38e1ff" transparent opacity={0.22} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
});

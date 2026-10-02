/**
 * IRON WALKERS — two giant four-legged voxel war machines stalking the land
 * around 0.BITMAP. Their health is shared by everyone in the Oasis: every hit
 * from every signed-in player drains the same pool, and whoever lands the
 * killing blow takes the kill on the IRON WALKERS board.
 *
 * Their route is a pure function of the clock, so every player sees them in
 * the same place without any extra network traffic.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { hitWalkerFn } from "@/lib/walker-raid.functions";
import { registerBeastGroup, type BeastEntity } from "@/lib/world-entities";
import { WORLD_CELL, cellX, cellZ } from "@/lib/player-state";
import { groundY } from "@/lib/world-terrain";
import { readCharacter } from "@/lib/character";
import { playSfx } from "@/lib/world-audio";
import { SafeHtml } from "@/components/game/SafeHtml";

type WalkerId = "walker-a" | "walker-b";

/* ---------------------------- voxel construction --------------------------- */

type Vox = [x: number, y: number, z: number, w: number, h: number, d: number, color: string];

const C = {
  hull: "#c9ccd0",
  plate: "#b3b7bc",
  dark: "#7d838a",
  shadow: "#565b61",
  vent: "#3a3e43",
  glow: "#ff5a2e",
  rust: "#9a8f80",
};

function build(boxes: Vox[]): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const color = new THREE.Color();
  for (const [x, y, z, w, h, d, hex] of boxes) {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    g.translate(x, y, z);
    color.set(hex);
    // Faint per-voxel tone jitter keeps big panels from reading as flat plastic.
    const j = 0.94 + (Math.abs(Math.sin(x * 12.9 + y * 78.2 + z * 37.7)) % 0.1);
    const n = g.attributes["position"]!.count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      cols[i * 3] = color.r * j;
      cols[i * 3 + 1] = color.g * j;
      cols[i * 3 + 2] = color.b * j;
    }
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    parts.push(g);
  }
  const merged = mergeGeometries(parts, false)!;
  for (const p of parts) p.dispose();
  return merged;
}

/** Hull: long armoured box with plates, vents, ridge, hatches. Origin = hull centre. */
function hullBoxes(): Vox[] {
  const b: Vox[] = [];
  b.push([0, 0, 0, 20, 8, 10, C.hull]);
  // tapered roof
  b.push([0, 4.6, 0, 18, 1.2, 8.4, C.plate]);
  b.push([0, 5.6, 0, 14, 0.8, 6, C.hull]);
  b.push([-1, 6.2, 0, 6, 0.6, 3, C.dark]); // roof hatch
  // underbelly
  b.push([0, -4.4, 0, 17, 0.8, 8.6, C.dark]);
  b.push([0, -4.9, 0, 10, 0.4, 5, C.shadow]);
  // side armour plates in a grid
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const px = -7.5 + i * 5;
      b.push([px, 1.2, s * 5.15, 4.4, 3.4, 0.3, i % 2 ? C.plate : C.hull]);
      b.push([px, -2.4, s * 5.15, 4.4, 2.6, 0.3, C.plate]);
      b.push([px + 1.6, 1.2, s * 5.32, 0.5, 0.5, 0.1, C.dark]); // bolts
      b.push([px - 1.6, -2.4, s * 5.32, 0.5, 0.5, 0.1, C.dark]);
    }
    // vent stacks
    for (let k = 0; k < 5; k++) b.push([5 + k * 0.7, 0.4, s * 5.35, 0.3, 2.6, 0.2, C.vent]);
    // side door
    b.push([-2.5, -0.6, s * 5.3, 3, 4.4, 0.25, C.dark]);
    b.push([-2.5, -0.6, s * 5.45, 2.4, 3.8, 0.1, C.shadow]);
    // shoulder hubs where legs attach
    for (const hx of [-7, 7]) {
      b.push([hx, -3.2, s * 5.3, 3.6, 3.6, 0.8, C.dark]);
      b.push([hx, -3.2, s * 5.8, 2.2, 2.2, 0.5, C.plate]);
      b.push([hx, -3.2, s * 6.1, 1, 1, 0.3, C.shadow]);
    }
  }
  // rear: engine block + greebles
  b.push([-10.4, 0, 0, 1, 6, 8, C.plate]);
  for (let k = 0; k < 4; k++) b.push([-11, -1.8 + k * 1.2, 0, 0.3, 0.5, 6, C.vent]);
  b.push([-10.6, 3.2, -2.5, 1.2, 1.2, 1.2, C.dark]);
  b.push([-10.6, 3.2, 2.5, 1.2, 1.2, 1.2, C.dark]);
  // front collar
  b.push([10.3, 0.5, 0, 0.8, 6, 8, C.plate]);
  b.push([10.8, 0.5, 0, 0.5, 3.2, 3.2, C.dark]);
  // weathering streaks
  b.push([3, -1, 5.2, 0.4, 5, 0.12, C.rust]);
  b.push([-6, 0, -5.2, 0.4, 4, 0.12, C.rust]);
  return b;
}

/** Neck: flexible segmented tube. Origin at the hull front. */
function neckBoxes(): Vox[] {
  const b: Vox[] = [];
  for (let i = 0; i < 4; i++) {
    const s = 3.2 - i * 0.15;
    b.push([0.6 + i * 1.1, 0, 0, 0.9, s, s, i % 2 ? C.dark : C.shadow]);
  }
  return b;
}

/** Head: cockpit with viewports, chin cannons, cheek blasters. Origin at the neck joint. */
function headBoxes(): Vox[] {
  const b: Vox[] = [];
  b.push([3.6, 0, 0, 7, 4.6, 5.4, C.hull]);
  b.push([3.4, 2.6, 0, 6, 0.8, 4.4, C.plate]);
  b.push([7.4, -0.3, 0, 1.2, 3.6, 4.6, C.plate]); // snout
  b.push([8.1, 0.6, 0, 0.3, 0.6, 3.4, C.vent]); // viewport slit
  b.push([8.1, -0.3, 0, 0.3, 0.3, 2.4, C.glow]);
  b.push([5.5, 1.2, 2.75, 3, 0.5, 0.2, C.vent]);
  b.push([5.5, 1.2, -2.75, 3, 0.5, 0.2, C.vent]);
  b.push([1.5, -1.8, 0, 3, 1.2, 4.8, C.dark]);
  for (const s of [-1, 1]) {
    // cheek blasters
    b.push([6, -1.6, s * 3.2, 2, 1.4, 1.4, C.dark]);
    b.push([8.4, -1.6, s * 3.2, 3.2, 0.5, 0.5, C.shadow]);
    b.push([10.1, -1.6, s * 3.2, 0.3, 0.6, 0.6, C.glow]);
    // chin cannons
    b.push([7.4, -2.8, s * 0.9, 1.6, 1, 1, C.dark]);
    b.push([9.6, -2.8, s * 0.9, 3, 0.45, 0.45, C.shadow]);
    b.push([11.2, -2.8, s * 0.9, 0.3, 0.55, 0.55, C.glow]);
    // side armour
    b.push([3, 0.2, s * 2.85, 4, 2.6, 0.3, C.plate]);
  }
  return b;
}

/** Thigh, pivot at hip (top). */
function thighBoxes(): Vox[] {
  return [
    [0, -0.2, 0, 2.4, 2.4, 2.4, C.dark],
    [0, -4, 0, 2.2, 7, 1.8, C.hull],
    [0.9, -4, 0, 0.4, 6, 1.4, C.plate],
    [-0.9, -4, 0, 0.4, 6, 1.2, C.shadow], // hydraulic
    [0, -4, 1, 1.4, 5, 0.3, C.plate],
    [0, -4, -1, 1.4, 5, 0.3, C.plate],
    [0, -8, 0, 2.8, 2.8, 2.8, C.dark], // knee joint
    [0, -8, 1.5, 1.8, 1.8, 0.3, C.plate],
    [0, -8, -1.5, 1.8, 1.8, 0.3, C.plate],
  ];
}

/** Shin, pivot at knee. */
function shinBoxes(): Vox[] {
  return [
    [0, -4.6, 0, 1.8, 8.4, 1.8, C.hull],
    [-0.8, -4, 0, 0.5, 7, 1.2, C.plate],
    [0.75, -5, 0, 0.35, 5, 0.6, C.shadow],
    [0, -1.2, 0, 2.2, 1.2, 2.2, C.plate],
    [0, -8.8, 0, 2, 1.6, 2, C.dark], // ankle
  ];
}

/** Foot pad, pivot at ankle. */
function footBoxes(): Vox[] {
  const b: Vox[] = [
    [0, -0.6, 0, 4.2, 1.2, 4.2, C.plate],
    [0, -0.05, 0, 3.2, 0.4, 3.2, C.hull],
  ];
  for (const [dx, dz] of [[1.9, 1.9], [-1.9, 1.9], [1.9, -1.9], [-1.9, -1.9]] as const) {
    b.push([dx, -1, dz, 1, 0.6, 1, C.dark]); // toes
  }
  return b;
}

/* --------------------------------- behaviour -------------------------------- */

const MAX_HP = 6000;
const LOOP_SECONDS = 900;
const SCALE = 1; // multiplied by unit

type Raid = BeastEntity & {
  walkerId: WalkerId;
  phase: number;
  heading: number;
  pending: number;
  respawnAt: number;
};

function makeRaid(walkerId: WalkerId, index: number, unit: number): Raid {
  return {
    id: 9_700 + index,
    label: "IRON WALKER",
    hostile: true,
    hp: MAX_HP,
    maxHp: MAX_HP,
    x: 0,
    z: 0,
    bodyY: unit * 22,
    bodyRadius: unit * 11,
    xp: 4_000,
    hitAt: 0,
    deadUntil: 0,
    walkerId,
    phase: index * 0.5,
    heading: 0,
    pending: 0,
    respawnAt: 0,
  };
}

/** Deterministic patrol loop around the first BITMAP rows, shared by every client. */
function routeAt(t: number, index: number) {
  const cx = cellX(4);
  const cz = cellZ(4);
  const r = WORLD_CELL * (2.6 + index * 0.9);
  const a = ((t / LOOP_SECONDS) * Math.PI * 2 + index * Math.PI) * (index ? -1 : 1);
  return { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r * 0.7 };
}

type LegRef = { hip: THREE.Group | null; knee: THREE.Group | null; ankle: THREE.Group | null };

export const IronWalkers = memo(function IronWalkers({
  unit,
  pose,
}: {
  unit: number;
  pose: { current: { x: number; z: number } | null };
}) {
  const raids = useMemo(() => [makeRaid("walker-a", 0, unit), makeRaid("walker-b", 1, unit)], [unit]);
  const geo = useMemo(
    () => ({
      hull: build(hullBoxes()),
      neck: build(neckBoxes()),
      head: build(headBoxes()),
      thigh: build(thighBoxes()),
      shin: build(shinBoxes()),
      foot: build(footBoxes()),
    }),
    [],
  );
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.25 }),
    [],
  );
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose());
      material.dispose();
    },
    [geo, material],
  );

  const roots = useRef<(THREE.Group | null)[]>([]);
  const bodies = useRef<(THREE.Group | null)[]>([]);
  const heads = useRef<(THREE.Group | null)[]>([]);
  const legs = useRef<LegRef[][]>(raids.map(() => [0, 1, 2, 3].map(() => ({ hip: null, knee: null, ankle: null }))));
  const bolts = useRef<(THREE.Mesh | null)[]>([]);
  const [hud, setHud] = useState(() => raids.map((r) => ({ hp: r.hp, down: 0 })));
  const warned = useRef(false);

  // Shared health: read the live pool, and push our own hits in small batches.
  useEffect(() => {
    let alive = true;
    const sync = async () => {
      const { data } = await supabase.from("walker_raids").select("id, hp, max_hp, respawn_at");
      if (!alive || !data) return;
      for (const row of data) {
        const r = raids.find((x) => x.walkerId === row.id);
        if (!r) continue;
        const respawn = row.respawn_at ? Date.parse(row.respawn_at) : 0;
        r.maxHp = row.max_hp;
        if (respawn && respawn > Date.now()) {
          r.hp = 0;
          r.respawnAt = respawn;
          r.deadUntil = performance.now() + (respawn - Date.now());
        } else {
          r.respawnAt = 0;
          r.deadUntil = 0;
          r.hp = respawn ? row.max_hp : Math.max(0, row.hp - r.pending);
        }
      }
    };
    void sync();
    const poll = window.setInterval(sync, 3_000);
    const flush = window.setInterval(() => {
      for (const r of raids) {
        if (r.pending <= 0) continue;
        const damage = Math.min(80, Math.round(r.pending));
        r.pending -= damage;
        const name = readCharacter()?.name?.trim() || "VISITOR";
        void hitWalkerFn({ data: { walker: r.walkerId, name: name.slice(0, 32), damage } })
          .then((res) => {
            if (!res.ok) return;
            r.hp = res.hp;
            if (res.killed) {
              playSfx("beast");
              toast.success("IRON WALKER DOWN · KILL CREDITED TO YOU");
            }
          })
          .catch(() => {
            r.pending = 0;
            if (!warned.current) {
              warned.current = true;
              toast("SIGN IN SO YOUR WALKER HITS COUNT FOR THE RAID BOARD");
            }
          });
      }
    }, 400);
    for (const r of raids) r.onHit = (dealt) => { r.pending += dealt; };
    registerBeastGroup("iron-walkers", raids);
    return () => {
      alive = false;
      window.clearInterval(poll);
      window.clearInterval(flush);
      registerBeastGroup("iron-walkers", []);
    };
  }, [raids]);

  // Cheap HUD refresh, off the frame loop.
  useEffect(() => {
    const id = window.setInterval(() => {
      setHud(raids.map((r) => ({ hp: r.hp, down: r.respawnAt ? Math.max(0, Math.ceil((r.respawnAt - Date.now()) / 1000)) : 0 })));
    }, 500);
    return () => window.clearInterval(id);
  }, [raids]);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const t = Date.now() / 1000;
    const player = pose.current;
    raids.forEach((r, i) => {
      const root = roots.current[i];
      const body = bodies.current[i];
      if (!root || !body) return;
      const p = routeAt(t, i);
      const ahead = routeAt(t + 2, i);
      r.x = p.x;
      r.z = p.z;
      r.heading = Math.atan2(ahead.x - p.x, ahead.z - p.z) - Math.PI / 2;
      const down = r.deadUntil > 0;
      root.position.set(p.x, groundY(p.x, p.z), p.z);
      root.rotation.y = THREE.MathUtils.damp(root.rotation.y, -r.heading, 1.2, dt);

      // Heavy gait: diagonal pairs, slow phase, hull sway.
      if (!down) r.phase += dt * 0.9;
      const ph = r.phase;
      body.position.y = THREE.MathUtils.damp(body.position.y, down ? 8 : 22 + Math.sin(ph * 2) * 0.35, down ? 0.8 : 6, dt);
      body.rotation.z = THREE.MathUtils.damp(body.rotation.z, down ? 0.35 : Math.sin(ph) * 0.02, 1, dt);
      body.rotation.x = Math.sin(ph * 2) * 0.012;
      legs.current[i]!.forEach((leg, k) => {
        const off = k === 0 || k === 3 ? 0 : Math.PI;
        const s = Math.sin(ph + off);
        const lift = Math.max(0, Math.cos(ph + off));
        if (leg.hip) leg.hip.rotation.z = down ? 0.9 : s * 0.32;
        if (leg.knee) leg.knee.rotation.z = down ? -1.6 : -lift * 0.5;
        if (leg.ankle) leg.ankle.rotation.z = down ? 0.7 : -(s * 0.32 - lift * 0.5);
      });

      // Head tracks the nearest player within range, and the cannons fire.
      const head = heads.current[i];
      const bolt = bolts.current[i];
      let aim = 0;
      let inRange = false;
      if (player && !down) {
        const dx = player.x - p.x;
        const dz = player.z - p.z;
        inRange = Math.hypot(dx, dz) < unit * 140;
        if (inRange) {
          const local = Math.atan2(dz, dx) + root.rotation.y;
          aim = THREE.MathUtils.clamp(Math.atan2(Math.sin(local), Math.cos(local)), -0.7, 0.7) * -1;
        }
      }
      if (head) head.rotation.y = THREE.MathUtils.damp(head.rotation.y, aim, 2, dt);
      if (bolt) {
        const cycle = (t * 1.3 + i * 0.4) % 1;
        bolt.visible = inRange && cycle < 0.35;
        bolt.position.x = 12 + cycle * 120;
      }
      // Flinch when struck.
      const since = performance.now() - r.hitAt;
      if (since < 260) body.rotation.x += Math.sin((since / 260) * Math.PI) * 0.02;
    });
  });

  const legPos: [number, number][] = [[7, 5.9], [7, -5.9], [-7, 5.9], [-7, -5.9]];

  return (
    <group>
      {raids.map((r, i) => (
        <group key={r.walkerId} ref={(n) => { roots.current[i] = n; }} scale={unit * SCALE}>
          <group ref={(n) => { bodies.current[i] = n; }} position={[0, 22, 0]}>
            <mesh geometry={geo.hull} material={material} castShadow />
            <group position={[10.6, 0.4, 0]}>
              <mesh geometry={geo.neck} material={material} castShadow />
              <group position={[4.4, -0.4, 0]} ref={(n) => { heads.current[i] = n; }}>
                <mesh geometry={geo.head} material={material} castShadow />
                <mesh ref={(n) => { bolts.current[i] = n; }} position={[12, -2.8, 0]} visible={false}>
                  <boxGeometry args={[8, 0.35, 0.35]} />
                  <meshBasicMaterial color={C.glow} toneMapped={false} />
                </mesh>
              </group>
            </group>
            {legPos.map(([lx, lz], k) => (
              <group
                key={k}
                position={[lx, -3.2, lz]}
                ref={(n) => { legs.current[i]![k]!.hip = n; }}
              >
                <mesh geometry={geo.thigh} material={material} castShadow />
                <group position={[0, -8, 0]} ref={(n) => { legs.current[i]![k]!.knee = n; }}>
                  <mesh geometry={geo.shin} material={material} castShadow />
                  <group position={[0, -9.6, 0]} ref={(n) => { legs.current[i]![k]!.ankle = n; }}>
                    <mesh geometry={geo.foot} material={material} castShadow receiveShadow />
                  </group>
                </group>
              </group>
            ))}
            <SafeHtml center position={[0, 10, 0]} distanceFactor={0.6} style={{ pointerEvents: "none" }} zIndexRange={[8, 0]}>
              <div className="flex w-[180px] flex-col items-center gap-1 font-mono text-[10px] uppercase" data-no-translate>
                <span className="border border-border bg-background/90 px-1.5 py-[2px] text-bitcoin">
                  IRON WALKER · JOINT FORCES
                </span>
                <span className="h-1.5 w-full border border-border bg-background/80">
                  <span
                    className="block h-full bg-bitcoin"
                    style={{ width: `${Math.round(((hud[i]?.hp ?? 0) / Math.max(1, r.maxHp)) * 100)}%` }}
                  />
                </span>
                <span className="border border-border bg-background/90 px-1.5 py-[2px] text-signal">
                  {hud[i]?.down ? `DOWN · RETURNS IN ${hud[i]!.down}S` : `${hud[i]?.hp ?? 0} / ${r.maxHp} HP`}
                </span>
              </div>
            </SafeHtml>
          </group>
        </group>
      ))}
    </group>
  );
});

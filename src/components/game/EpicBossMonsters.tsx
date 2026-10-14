/**
 * EPIC BOSS MONSTERS — voxel sculptures of Valakas, Antharas and Queen Ant
 * standing in their Oasis lairs. Health comes from the shared epic_bosses
 * state (same pool Guardians strike from the Command Centre); a slain boss
 * vanishes until its respawn time. Each boss is two merged meshes.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { cellX, cellZ } from "@/lib/player-state";
import { groundY } from "@/lib/world-terrain";
import { bossBySlug } from "@/lib/epic-bosses";
import { bossesStateFn } from "@/lib/epic-bosses.functions";
import { SafeHtml } from "@/components/game/SafeHtml";

type Vox = [x: number, y: number, z: number, w: number, h: number, d: number, color: string, rx?: number, ry?: number, rz?: number];
type Sculpt = { lit: Vox[]; glow: Vox[]; wings?: Vox[] };

function bake(boxes: Vox[]): THREE.BufferGeometry | null {
  if (!boxes.length) return null;
  const c = new THREE.Color(), e = new THREE.Euler(), m = new THREE.Matrix4();
  const parts = boxes.map(([x, y, z, w, h, d, col, rx = 0, ry = 0, rz = 0]) => {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    g.applyMatrix4(m.makeRotationFromEuler(e.set(rx, ry, rz)).setPosition(x, y, z));
    c.set(col);
    const j = 0.92 + (Math.abs(Math.sin(x * 12.9 + y * 78.2 + z * 37.7)) % 0.12);
    const n = g.attributes["position"]!.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const k = j * (1 - ((i / 6) | 0) % 3 * 0.05);
      arr[i * 3] = c.r * k; arr[i * 3 + 1] = c.g * k; arr[i * 3 + 2] = c.b * k;
    }
    g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    return g;
  });
  const out = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return out;
}

/* Shared dragon body; palette + horn/plate style differ. +z = head, +y = up. */
function dragon(p: { hide: string; plate: string; belly: string; horn: string; eye: string; core: string; membrane: string; rocky: boolean }): Sculpt {
  const lit: Vox[] = [], glow: Vox[] = [], wings: Vox[] = [];
  // torso: stacked barrel
  for (let i = 0; i < 7; i++) {
    const z = -6 + i * 2, w = 9 - Math.abs(i - 3) * 0.9, h = 7 - Math.abs(i - 3) * 0.7;
    lit.push([0, 10, z, w, h, 2.1, i % 2 ? p.hide : p.plate]);
    lit.push([0, 10 - h / 2 + 0.4, z, w - 2, 1, 2, p.belly]);
    // spine plates / crags
    lit.push([0, 10 + h / 2 + (p.rocky ? 1.4 : 1), z, p.rocky ? 2.6 : 1, p.rocky ? 2.4 : 2.6, 1.4, p.horn, p.rocky ? 0.2 : 0]);
  }
  // glowing chest core
  glow.push([0, 9, 5.2, 3, 2.4, 0.6, p.core], [0, 8, 3, 4, 0.6, 3, p.core]);
  // neck rising forward
  for (let i = 0; i < 5; i++) lit.push([0, 12 + i * 1.6, 7 + i * 1.5, 4 - i * 0.25, 3.4, 2, i % 2 ? p.hide : p.plate, -0.5]);
  // head
  const hy = 20.5, hz = 15.5;
  lit.push([0, hy, hz, 5, 3.6, 5, p.hide], [0, hy - 1.4, hz + 3.6, 3.8, 1.4, 3.6, p.plate], [0, hy + 0.2, hz + 3.4, 4, 1.4, 3.4, p.hide]);
  lit.push([0, hy - 2.6, hz + 2.6, 3.4, 1, 3.6, p.belly]); // lower jaw
  for (let t = 0; t < 4; t++) lit.push([-1.4 + t * 0.95, hy - 1.9, hz + 4.8, 0.35, 0.8, 0.35, "#f2ead8"]); // teeth
  glow.push([0, hy - 1.9, hz + 3, 2.6, 0.5, 2.6, p.core]); // fire in the maw
  for (const sx of [-1, 1]) {
    glow.push([sx * 1.6, hy + 1, hz + 2.4, 1, 0.7, 0.4, p.eye]);
    // horns: three segments sweeping back
    for (let k = 0; k < 3; k++) lit.push([sx * (2 + k * 0.6), hy + 2.2 + k * 1.1, hz - 1 - k * 1.3, p.rocky ? 1.6 - k * 0.3 : 1 - k * 0.2, 1.6, 1.6, p.horn, -0.6, 0, sx * -0.3]);
    // legs: thigh → shin → foot with claws
    for (const lz of [-4, 3.5]) {
      lit.push([sx * 5, 8, lz, 3, 5, 3.4, p.hide], [sx * 5.4, 4, lz + 0.4, 2.4, 4, 2.6, p.plate], [sx * 5.4, 1, lz + 1, 3.2, 2, 3.8, p.hide]);
      for (let c = 0; c < 3; c++) lit.push([sx * 5.4 + (c - 1) * 1, 0.4, lz + 3.2, 0.5, 0.8, 1.2, p.horn]);
    }
    // wings: arm bone, finger bones, membrane panels
    wings.push([sx * 6, 15, 0, 8, 1, 1, p.hide, 0, 0, sx * 0.35]);
    for (let f = 0; f < 4; f++) {
      wings.push([sx * (12 + f * 1.5), 17 - f * 2.5, -1 - f * 1.5, 1, 9 - f, 0.8, p.hide, 0.3, 0, sx * (0.2 + f * 0.25)]);
      wings.push([sx * (11 + f * 1.4), 13 - f * 2, -1.6 - f * 1.5, 4, 7 - f, 0.3, p.membrane, 0.3, 0, sx * (0.2 + f * 0.25)]);
    }
  }
  // tail tapering behind, with tip spikes
  for (let i = 0; i < 9; i++) {
    const s = 4 - i * 0.38;
    lit.push([Math.sin(i * 0.5) * 1.2, 9 - i * 0.7, -8 - i * 2, s, s * 0.9, 2.2, i % 2 ? p.hide : p.plate]);
    if (i % 2 === 0) lit.push([Math.sin(i * 0.5) * 1.2, 9 - i * 0.7 + s * 0.6, -8 - i * 2, 0.6, 1.4, 0.8, p.horn]);
  }
  glow.push([Math.sin(4) * 1.2, 2.4, -26.5, 1.4, 1.4, 1.4, p.core]);
  if (!p.rocky) for (let i = 0; i < 6; i++) glow.push([(i % 2 ? 1 : -1) * 3.5, 10 + (i % 3), -4 + i * 1.8, 0.4, 2.4, 0.4, p.core]); // lava seams
  else for (let i = 0; i < 6; i++) lit.push([(i % 2 ? 1 : -1) * 4.2, 12.5, -5 + i * 2, 1.4, 0.6, 1.4, "#4f7a3a"]); // moss
  return { lit, glow, wings };
}

function queenAnt(): Sculpt {
  const CH = "#3a280e", PL = "#6b4a1a", RIM = "#a07a2c", GOLD = "#ffd24a", JOINT = "#1e140a";
  const lit: Vox[] = [], glow: Vox[] = [];
  // giant abdomen: segmented, tilted back
  for (let i = 0; i < 6; i++) {
    const s = 9 - Math.abs(i - 2) * 1.4, z = -6 - i * 2.4;
    lit.push([0, 7 + i * 0.4, z, s, s * 0.85, 2.3, i % 2 ? CH : PL]);
    glow.push([0, 7 + i * 0.4 + s * 0.43, z, s * 0.5, 0.3, 1.6, GOLD]);
  }
  // thorax with spikes
  lit.push([0, 8, 0, 5, 4, 6, PL], [0, 10.4, 0, 3.6, 1, 4.4, RIM]);
  for (let k = 0; k < 3; k++) lit.push([0, 11.4 + k * 0.2, -1.6 + k * 1.6, 0.6, 1.8, 0.6, RIM]);
  // head + crown + mandibles
  lit.push([0, 9.4, 5, 4.6, 3.6, 3.6, CH]);
  for (let k = -2; k <= 2; k++) lit.push([k * 0.9, 12 + (2 - Math.abs(k)) * 0.5, 5, 0.6, 1.6 + (2 - Math.abs(k)) * 0.6, 0.6, GOLD]);
  for (const sx of [-1, 1]) {
    glow.push([sx * 1.4, 10.2, 6.8, 1, 1, 0.4, "#ff3a2a"]);
    lit.push([sx * 1.6, 8, 8, 0.8, 0.8, 3, RIM, 0, sx * -0.4, 0], [sx * 0.6, 8, 9.6, 1.4, 0.7, 0.7, RIM]);
    // antennae
    lit.push([sx * 1.4, 12.6, 7, 0.4, 0.4, 3.6, JOINT, -0.6, sx * 0.3, 0]);
    // six legs
    for (let l = 0; l < 3; l++) {
      const z = 2 - l * 2.4, ry = sx * (0.5 - l * 0.5);
      lit.push(
        [sx * 3.6, 8, z, 3, 0.9, 0.9, JOINT, 0, ry, sx * -0.5],
        [sx * 6, 7.4, z + (1 - l) * 0.8, 0.9, 4, 0.9, PL, 0, ry, sx * 0.5],
        [sx * 7.6, 2.6, z + (1 - l) * 1.2, 0.8, 5, 0.8, CH, 0, ry, sx * 0.15],
        [sx * 8, 0.3, z + (1 - l) * 1.3, 1.4, 0.6, 1, JOINT],
      );
    }
    // vestigial royal wings
    lit.push([sx * 3, 11.5, -4, 4, 0.2, 8, "#d9c79a", 0.3, 0, sx * 0.4]);
  }
  return { lit, glow };
}

/** The enormous Queen in her nest: queen at the centre, ringed by royal guards and glowing larvae. */
function antNest(): Sculpt {
  const q = queenAnt();
  const lit = [...q.lit], glow = [...q.glow];
  // nest mound
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; lit.push([Math.cos(a) * 16, 0.6, Math.sin(a) * 16 - 4, 6, 1.6 + (i % 3) * 0.6, 4, i % 2 ? "#5a4224" : "#4a361c", 0, -a, 0]); }
  // royal guards: small ants facing out
  for (let g = 0; g < 4; g++) {
    const a = (g / 4) * Math.PI * 2 + 0.4, cx = Math.cos(a) * 12, cz = Math.sin(a) * 12 - 4;
    lit.push([cx, 2.4, cz, 2.4, 2, 3.4, "#3a280e", 0, -a, 0], [cx + Math.cos(a) * 2.2, 2.8, cz + Math.sin(a) * 2.2, 1.8, 1.6, 1.8, "#6b4a1a"]);
    for (const s of [-1, 1]) lit.push([cx + s * 1.6, 1, cz, 2.6, 0.4, 0.4, "#1e140a", 0, -a, s * 0.6]);
    glow.push([cx + Math.cos(a) * 3, 3.2, cz + Math.sin(a) * 3, 0.5, 0.5, 0.5, "#ff3a2a"]);
  }
  // larvae
  for (let l = 0; l < 10; l++) { const a = l * 2.4, r = 5 + (l % 3) * 2; glow.push([Math.cos(a) * r, 0.7, -14 + Math.sin(a) * r * 0.6, 1.4, 1, 2, "#fff2b0"]); }
  return { lit, glow };
}

/** Baium: a seated stone titan on a throne with a halo. */
function baium(): Sculpt {
  const S = "#8f9aa8", D = "#5c6470", G = "#8fd3ff", lit: Vox[] = [], glow: Vox[] = [];
  lit.push([0, 3, -3, 14, 6, 10, D], [0, 13, -7, 14, 18, 2, D]); // throne
  lit.push([0, 10, -2, 7, 8, 5, S], [0, 16, -2, 5, 4, 4, S], [0, 19.5, -1.6, 3.6, 3.6, 3.6, S]); // torso + head
  for (const s of [-1, 1]) {
    lit.push([s * 5, 12, -1, 2.6, 7, 2.6, S, 0, 0, s * 0.2], [s * 6, 7.5, 1.4, 2.2, 2.2, 5, D]); // arms on rests
    lit.push([s * 2.2, 6.5, 2.5, 2.8, 2.6, 7, S], [s * 2.2, 2.6, 5.6, 2.6, 5.4, 2.6, S]); // legs
    glow.push([s * 0.8, 20, 0.2, 0.7, 0.5, 0.3, G]);
  }
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; glow.push([Math.cos(a) * 4.4, 21 + Math.sin(a) * 4.4, -3, 0.8, 0.8, 0.4, G]); }
  return { lit, glow };
}

/** Zaken: a skeletal pirate lord standing on a ship deck. */
function zaken(): Sculpt {
  const B = "#d8d0bf", C = "#2a1840", W = "#5a3a1e", lit: Vox[] = [], glow: Vox[] = [];
  lit.push([0, 0.8, 0, 12, 1.6, 22, W], [0, 2.4, 10, 6, 1.6, 3, W]); // deck
  lit.push([0, 8, 0, 4, 6, 2.6, B], [0, 12.5, 0, 6, 4, 3, C], [0, 16, 0, 3, 3, 3, B], [0, 18, 0, 5, 1, 5, C], [0, 19.5, 0, 3, 2, 3, C]); // body, coat, skull, hat
  for (const s of [-1, 1]) {
    lit.push([s * 1.2, 3.8, 0, 1, 4.4, 1, B], [s * 3.6, 12, 0, 1, 6, 1, B, 0, 0, s * 0.3]);
    glow.push([s * 0.7, 16.3, 1.55, 0.6, 0.6, 0.2, "#b06aff"]);
  }
  lit.push([4.6, 13, 2.5, 0.4, 0.4, 6, "#c0c0c8"]); // cutlass
  lit.push([0, 12, -8, 0.8, 22, 0.8, W], [0, 18, -8, 10, 8, 0.3, "#1a1a1a"]); // mast + sail
  return { lit, glow };
}

/** Orfen: a vast spore-spider over a fungus bed. */
function orfen(): Sculpt {
  const H = "#2f4a2a", P = "#5c7a3a", lit: Vox[] = [], glow: Vox[] = [];
  lit.push([0, 6, -3, 9, 6, 10, H], [0, 6, 4, 6, 4, 5, P]);
  for (const s of [-1, 1]) for (let l = 0; l < 4; l++) {
    const z = 5 - l * 3;
    lit.push([s * 7, 8.5, z, 6, 1, 1, H, 0, 0, s * -0.5], [s * 11, 4, z + (1.5 - l) * 0.6, 1, 9, 1, P, 0, 0, s * 0.25]);
  }
  for (let e = 0; e < 6; e++) glow.push([(e - 2.5) * 0.9, 7 + (e % 2) * 0.6, 6.6, 0.5, 0.5, 0.3, "#4fe08a"]);
  for (let m = 0; m < 9; m++) { const a = m * 2.1, r = 13 + (m % 3) * 2; lit.push([Math.cos(a) * r, 1.5, Math.sin(a) * r, 0.8, 3, 0.8, "#c9b892"]); glow.push([Math.cos(a) * r, 3.4, Math.sin(a) * r, 3, 1, 3, "#4fe08a"]); }
  return { lit, glow };
}

/** Core: a floating crystal construct with orbiting susceptor drones. */
function coreConstruct(): Sculpt {
  const lit: Vox[] = [], glow: Vox[] = [];
  lit.push([0, 12, 0, 8, 8, 8, "#2a4a5a", Math.PI / 4, Math.PI / 4, 0]);
  glow.push([0, 12, 0, 4, 4, 4, "#3fe0ff", Math.PI / 4, 0, Math.PI / 4]);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; lit.push([Math.cos(a) * 9, 9 + (i % 2) * 6, Math.sin(a) * 9, 2, 2, 2, "#506878", a, a, 0]); glow.push([Math.cos(a) * 9, 9 + (i % 2) * 6, Math.sin(a) * 9, 0.8, 0.8, 0.8, "#3fe0ff"]); }
  for (let p = 0; p < 4; p++) { const a = (p / 4) * Math.PI * 2 + 0.78; lit.push([Math.cos(a) * 6, 2, Math.sin(a) * 6, 2, 4, 2, "#3a4048"]); }
  return { lit, glow };
}

type BossDef = { slug: string; cell: number; scale: number; glow: string; sculpt: () => Sculpt };
/** Lair cells (row 0 near genesis) — keep in sync with LAIR_CELLS in BitmapWorld3D. */
export const BOSS_LAIR_CELLS = [30, 60, 12, 90, 120, 150, 180];
const DEFS: BossDef[] = [
  { slug: "valakas", cell: 30, scale: 3, glow: "#ff5a1a", sculpt: () => dragon({ hide: "#2a1410", plate: "#4a1f14", belly: "#6e2c16", horn: "#120a08", eye: "#ffd04a", core: "#ff5a1a", membrane: "#5c1a10", rocky: false }) },
  { slug: "antharas", cell: 60, scale: 3, glow: "#5cff9a", sculpt: () => dragon({ hide: "#5a5240", plate: "#6e6650", belly: "#8a7d5c", horn: "#3a3428", eye: "#5cff9a", core: "#c9a24a", membrane: "#4a4434", rocky: true }) },
  { slug: "queen-ant", cell: 12, scale: 4.5, glow: "#ffd24a", sculpt: antNest },
  { slug: "baium", cell: 90, scale: 3, glow: "#8fd3ff", sculpt: baium },
  { slug: "zaken", cell: 120, scale: 3, glow: "#b06aff", sculpt: zaken },
  { slug: "orfen", cell: 150, scale: 3, glow: "#4fe08a", sculpt: orfen },
  { slug: "core", cell: 180, scale: 3, glow: "#3fe0ff", sculpt: coreConstruct },
];

const BossMonster = memo(function BossMonster({ def, unit, hp, maxHp }: { def: BossDef; unit: number; hp: number; maxHp: number }) {
  const geo = useMemo(() => {
    const s = def.sculpt();
    return { lit: bake(s.lit), glow: bake(s.glow), wings: s.wings ? bake(s.wings) : null };
  }, [def]);
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const wing = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => {
    const x = cellX(def.cell), z = cellZ(def.cell);
    return [x, groundY(x, z), z] as const;
  }, [def.cell]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (body.current) {
      body.current.position.y = Math.sin(t * 1.2) * 0.25; // breathing
      body.current.rotation.y = Math.sin(t * 0.15) * 0.6; // slow patrol turn
    }
    if (wing.current) wing.current.scale.y = 1 + Math.sin(t * 1.6) * 0.08;
  });
  const boss = bossBySlug(def.slug)!;
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  // Each drop in shared health (a Guardian strike from the Command Centre)
  // floats as a damage number and makes the body flinch.
  const prev = useRef(hp);
  const [hits, setHits] = useState<{ id: number; dmg: number }[]>([]);
  const flinch = useRef(0);
  useEffect(() => {
    const dmg = prev.current - hp;
    prev.current = hp;
    if (dmg <= 0) return;
    flinch.current = 1;
    const id = Date.now() + Math.random();
    setHits((h) => [...h.slice(-4), { id, dmg }]);
    const t = window.setTimeout(() => setHits((h) => h.filter((x) => x.id !== id)), 1800);
    return () => window.clearTimeout(t);
  }, [hp]);
  useFrame((_, d) => {
    if (!body.current || flinch.current <= 0) return;
    flinch.current = Math.max(0, flinch.current - d * 2.5);
    body.current.position.x = Math.sin(flinch.current * 40) * flinch.current * 0.6;
  });
  return (
    <group ref={root} position={pos} scale={unit * def.scale}>
      <group ref={body}>
        {geo.lit ? <mesh geometry={geo.lit} castShadow><meshStandardMaterial vertexColors roughness={0.85} /></mesh> : null}
        {geo.wings ? <mesh ref={wing} geometry={geo.wings} castShadow><meshStandardMaterial vertexColors roughness={0.9} side={THREE.DoubleSide} /></mesh> : null}
        {geo.glow ? <mesh geometry={geo.glow}><meshStandardMaterial vertexColors emissive={def.glow} emissiveIntensity={1.6} toneMapped={false} /></mesh> : null}
        <pointLight color={def.glow} intensity={6} distance={40} position={[0, 10, 4]} />
      </group>
      <SafeHtml center position={[0, 30, 0]} distanceFactor={0.6} style={{ pointerEvents: "none" }} zIndexRange={[8, 0]}>
        <div className="hud-panel relative min-w-40 px-2 py-1 font-mono text-[10px] text-bitcoin" data-no-translate>
          {hits.map((h, i) => (
            <span key={h.id} className="boss-hit absolute -top-4 font-display text-sm text-destructive" style={{ left: `${30 + i * 12}%` }}>
              -{h.dmg}
            </span>
          ))}
          <div className="flex justify-between gap-3"><span>☠ {boss.name.toUpperCase()}</span><span>LV {boss.level}</span></div>
          <div className="mt-1 h-1 w-full bg-border"><div className="h-full bg-bitcoin transition-[width] duration-700" style={{ width: `${pct}%` }} /></div>
          <div className="mt-0.5 text-muted-foreground">{hp}/{maxHp} · RAID FROM COMMAND CENTRE</div>
        </div>
      </SafeHtml>
    </group>
  );
});

export function EpicBossMonsters({ unit }: { unit: number }) {
  const state = useQuery({ queryKey: ["epic-bosses"], queryFn: () => bossesStateFn(), refetchInterval: 20_000 });
  const by = new Map((state.data?.bosses ?? []).map((b) => [b.slug, b]));
  return (
    <>
      {DEFS.map((d) => {
        const s = by.get(d.slug);
        const max = bossBySlug(d.slug)!.maxHp;
        if (s?.respawnAt) return null; // slain — gone until respawn
        return <BossMonster key={d.slug} def={d} unit={unit} hp={s?.hp ?? max} maxHp={max} />;
      })}
    </>
  );
}

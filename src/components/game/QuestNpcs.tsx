/**
 * Biternam characters standing at their landmarks: a small voxel figure on
 * a glowing ring, bobbing; the ring brightens while you are close enough to talk.
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { CREW_PIXEL_AVATAR, QUEST_NPCS, itemSpot, npcSpot, pendingItems, useQuestState, type QuestItem, type QuestNpc } from "@/lib/biternam-quests";
import { ToonPixelRig } from "@/components/toon/ToonPixelRig";
import { groundY } from "@/lib/world-terrain";
import { LANDMARKS } from "@/lib/world-landmarks";
import { WORLD_CELL } from "@/lib/player-state";
import { INTERIOR_DOORS } from "@/lib/biternam-doors";

/** A glowing retro doorway beside each landmark that has a Biternam interior. */
function Door({ id, unit }: { id: string; unit: number }) {
  const lm = LANDMARKS.find((l) => l.id === id);
  const d = INTERIOR_DOORS[id]!;
  const glow = useRef<Mesh>(null);
  useFrame(({ clock }) => { if (glow.current) (glow.current.material as { opacity: number }).opacity = 0.45 + Math.sin(clock.elapsedTime * 3) * 0.2; });
  if (!lm) return null;
  const r = (lm.radius + 0.35) * WORLD_CELL;
  const x = lm.cell[0] * WORLD_CELL + Math.cos(lm.yaw + Math.PI / 4) * r;
  const z = lm.cell[1] * WORLD_CELL + Math.sin(lm.yaw + Math.PI / 4) * r;
  const s = unit * 1.6;
  return (
    <group position={[x, groundY(x, z), z]} rotation-y={Math.atan2(lm.cell[0] * WORLD_CELL - x, lm.cell[1] * WORLD_CELL - z) + Math.PI}>
      <mesh position={[-s * 0.45, s * 0.75, 0]}><boxGeometry args={[s * 0.12, s * 1.5, s * 0.12]} /><meshStandardMaterial color="#2a2420" /></mesh>
      <mesh position={[s * 0.45, s * 0.75, 0]}><boxGeometry args={[s * 0.12, s * 1.5, s * 0.12]} /><meshStandardMaterial color="#2a2420" /></mesh>
      <mesh position={[0, s * 1.55, 0]}><boxGeometry args={[s * 1.05, s * 0.16, s * 0.14]} /><meshStandardMaterial color={d.color} emissive={d.color} emissiveIntensity={1.6} /></mesh>
      <mesh ref={glow} position={[0, s * 0.72, 0]}><planeGeometry args={[s * 0.78, s * 1.44]} /><meshBasicMaterial color={d.color} transparent opacity={0.5} side={2} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, s * 0.02, s * 0.4]}><planeGeometry args={[s * 0.9, s * 0.6]} /><meshBasicMaterial color={d.color} transparent opacity={0.35} /></mesh>
    </group>
  );
}

type Look = { body: string; head: string; accent: string };
const DROID: Look = { body: "#7a7f86", head: "#a9b0b8", accent: "#28e0ff" };
const LOOK: Record<string, Look> = {
  droid: { body: "#7a7f86", head: "#a9b0b8", accent: "#28e0ff" },
  curator: { body: "#3b2f4a", head: "#e9c9a8", accent: "#f7931a" },
  wierdamoto: { body: "#111114", head: "#f4f1ea", accent: "#c41e1e" },
  sentry: { body: "#1b2733", head: "#28e0ff", accent: "#ff3355" },
  dev9: { body: "#1a1c20", head: "#d8b89a", accent: "#c8ccd2" }, // black tux, silver
  tornado: { body: "#1f3a6b", head: "#e6c3a0", accent: "#ff4433" }, // news-desk blue, ON AIR red
  bop: { body: "#2a2f3a", head: "#f0cfae", accent: "#39ff88" }, // hoodie, terminal green
  nine: { body: "#5b2a86", head: "#e2b896", accent: "#ffd23f" }, // culture purple, gold
  urban: { body: "#ff6f00", head: "#e8c6a2", accent: "#00f0ff" }, // hazard orange, blueprint cyan
  dabber: { body: "#245436", head: "#e4be9b", accent: "#ffb703" }, // olive, amber haze
  bitlodo: { body: "#232328", head: "#ebd0b5", accent: "#00e5ff" }, // director vest, tally light
  mononaut: { body: "#2f3e46", head: "#e2c2a4", accent: "#f7931a" }, // trenchcoat, orange loupe
  sunset: { body: "#3a0ca3", head: "#ebd2b9", accent: "#f72585" }, // twilight, synth pink
  jahbooble: { body: "#1f7a3a", head: "#8a5a3c", accent: "#ffd23f" },
  "mr-shiddy": { body: "#5a4a32", head: "#e0b894", accent: "#ff8c1a" },
  "space-monnkey": { body: "#6a2fd6", head: "#8b5a2b", accent: "#39ff88" },
  dudeamoto: { body: "#8a6a4a", head: "#e6c3a0", accent: "#f7931a" },
  "putin-x": { body: "#1c1f26", head: "#e2c2a4", accent: "#d52b1e" },
  "elon-x": { body: "#14161a", head: "#e8c6a2", accent: "#ffffff" },
  ladybird: { body: "#c8102e", head: "#f0cfae", accent: "#141414" }, // red shell, black spots
};

function Npc({ npc, unit, active }: { npc: QuestNpc; unit: number; active: boolean }) {
  const p = npcSpot(npc);
  const g = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const grid = useRef<Mesh>(null);
  const sparks = useRef<Group>(null);
  const architect = npc.id === "urban";
  const look = LOOK[npc.id] ?? DROID;
  const s = unit * 1.4;
  const skin = CREW_PIXEL_AVATAR[npc.id];
  const still = useRef(false);
  const voxel = (
    <>
      <mesh position={[-s * 0.1, s * 0.25, 0]}><boxGeometry args={[s * 0.14, s * 0.5, s * 0.16]} /><meshStandardMaterial color={look.body} /></mesh>
      <mesh position={[s * 0.1, s * 0.25, 0]}><boxGeometry args={[s * 0.14, s * 0.5, s * 0.16]} /><meshStandardMaterial color={look.body} /></mesh>
      <mesh position={[0, s * 0.75, 0]}><boxGeometry args={[s * 0.42, s * 0.5, s * 0.24]} /><meshStandardMaterial color={look.body} /></mesh>
      <mesh position={[0, s * 1.18, 0]}><boxGeometry args={[s * 0.32, s * 0.32, s * 0.3]} /><meshStandardMaterial color={look.head} /></mesh>
      <mesh position={[0, s * 1.2, s * 0.16]}><boxGeometry args={[s * 0.24, s * 0.06, s * 0.02]} /><meshBasicMaterial color={look.accent} /></mesh>
    </>
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (g.current) {
      g.current.position.set(p.x, groundY(p.x, p.z) + Math.sin(t * 2) * s * 0.03, p.z);
      g.current.rotation.y = -p.yaw + Math.sin(t * 0.6) * 0.3;
    }
    if (grid.current) grid.current.rotation.z = t * 0.5;
    if (sparks.current) sparks.current.children.forEach((c, i) => { const k = (t * 0.4 + i / 6) % 1; c.position.set(Math.cos(i * 2.1 + t) * s * 0.5, k * s * 2, Math.sin(i * 2.1 + t) * s * 0.5); c.scale.setScalar(1 - k); });
    if (ring.current) ring.current.scale.setScalar(active ? 1.15 + Math.sin(t * 6) * 0.05 : 1);
  });
  return (
    <group ref={g}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={s * 0.02}>
        <ringGeometry args={[s * 0.45, s * 0.55, 24]} />
        <meshBasicMaterial color={look.accent} transparent opacity={active ? 0.95 : 0.5} />
      </mesh>
      {architect && (
        <>
          {/* Architect's blueprint compass: a rotating gold schematic under the cyan ring */}
          <mesh ref={grid} rotation-x={-Math.PI / 2} position-y={s * 0.015}>
            <ringGeometry args={[s * 0.62, s * 0.7, 8, 1]} />
            <meshBasicMaterial color="#ffe14d" wireframe transparent opacity={0.8} />
          </mesh>
          <group ref={sparks}>
            {Array.from({ length: 6 }, (_, i) => <mesh key={i}><boxGeometry args={[s * 0.05, s * 0.05, s * 0.05]} /><meshBasicMaterial color="#00f0ff" /></mesh>)}
          </group>
        </>
      )}
      {skin ? (
        <group scale={s * 1.1}>
          <ToonPixelRig inscriptionId={skin} pose="idle" movingRef={still} fallback={voxel} />
        </group>
      ) : voxel}
      <mesh position={[0, s * 1.75, 0]}><octahedronGeometry args={[s * 0.1]} /><meshBasicMaterial color={look.accent} /></mesh>
    </group>
  );
}

/** A spinning glowing pickup; only shown while its quest step is current. */
function Item({ item, unit }: { item: QuestItem; unit: number }) {
  const p = itemSpot(item);
  const g = useRef<Group>(null);
  const s = unit * 1.2;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (g.current && p) { g.current.position.set(p.x, groundY(p.x, p.z) + s * (0.9 + Math.sin(t * 2.4) * 0.12), p.z); g.current.rotation.y = t * 1.6; }
  });
  if (!p) return null;
  return (
    <group ref={g}>
      <mesh><octahedronGeometry args={[s * 0.28]} /><meshStandardMaterial color="#f7931a" emissive="#f7931a" emissiveIntensity={1.4} /></mesh>
      <mesh rotation-x={Math.PI / 2}><torusGeometry args={[s * 0.45, s * 0.03, 6, 24]} /><meshBasicMaterial color="#28e0ff" /></mesh>
    </group>
  );
}

export function QuestNpcs({ unit }: { unit: number }) {
  const { nearId, progress } = useQuestState();
  return (
    <>
      {QUEST_NPCS.map((n) => <Npc key={n.id} npc={n} unit={unit} active={nearId === n.id} />)}
      {Object.keys(INTERIOR_DOORS).map((id) => <Door key={id} id={id} unit={unit} />)}
      {pendingItems(progress).map((it) => <Item key={it.id} item={it} unit={unit} />)}
    </>
  );
}

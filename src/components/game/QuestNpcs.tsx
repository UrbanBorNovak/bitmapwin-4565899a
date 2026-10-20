/**
 * Biternam characters standing at their landmarks: a small voxel figure on
 * a glowing ring, bobbing; the ring brightens while you are close enough to talk.
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { QUEST_NPCS, npcSpot, useQuestState, type QuestNpc } from "@/lib/biternam-quests";
import { groundY } from "@/lib/world-terrain";

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
  urban: { body: "#d9771f", head: "#e8c6a2", accent: "#ffe14d" }, // engineer orange, hi-vis
};

function Npc({ npc, unit, active }: { npc: QuestNpc; unit: number; active: boolean }) {
  const p = npcSpot(npc);
  const g = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const look = LOOK[npc.id] ?? DROID;
  const s = unit * 1.4;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (g.current) {
      g.current.position.set(p.x, groundY(p.x, p.z) + Math.sin(t * 2) * s * 0.03, p.z);
      g.current.rotation.y = -p.yaw + Math.sin(t * 0.6) * 0.3;
    }
    if (ring.current) ring.current.scale.setScalar(active ? 1.15 + Math.sin(t * 6) * 0.05 : 1);
  });
  return (
    <group ref={g}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={s * 0.02}>
        <ringGeometry args={[s * 0.45, s * 0.55, 24]} />
        <meshBasicMaterial color={look.accent} transparent opacity={active ? 0.95 : 0.5} />
      </mesh>
      <mesh position={[-s * 0.1, s * 0.25, 0]}><boxGeometry args={[s * 0.14, s * 0.5, s * 0.16]} /><meshStandardMaterial color={look.body} /></mesh>
      <mesh position={[s * 0.1, s * 0.25, 0]}><boxGeometry args={[s * 0.14, s * 0.5, s * 0.16]} /><meshStandardMaterial color={look.body} /></mesh>
      <mesh position={[0, s * 0.75, 0]}><boxGeometry args={[s * 0.42, s * 0.5, s * 0.24]} /><meshStandardMaterial color={look.body} /></mesh>
      <mesh position={[0, s * 1.18, 0]}><boxGeometry args={[s * 0.32, s * 0.32, s * 0.3]} /><meshStandardMaterial color={look.head} /></mesh>
      <mesh position={[0, s * 1.2, s * 0.16]}><boxGeometry args={[s * 0.24, s * 0.06, s * 0.02]} /><meshBasicMaterial color={look.accent} /></mesh>
      <mesh position={[0, s * 1.75, 0]}><octahedronGeometry args={[s * 0.1]} /><meshBasicMaterial color={look.accent} /></mesh>
    </group>
  );
}

export function QuestNpcs({ unit }: { unit: number }) {
  const { nearId } = useQuestState();
  return <>{QUEST_NPCS.map((n) => <Npc key={n.id} npc={n} unit={unit} active={nearId === n.id} />)}</>;
}

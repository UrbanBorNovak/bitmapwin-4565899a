/**
 * SHADOW ARCHWAYS — an obsidian gate stands on every BITMAP that hosts a
 * Shadow Gate event. Only nearby archways are drawn. No holder data is read.
 */
import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import * as THREE from "three";
import { WORLD_CELL, WORLD_GRID, cellX, cellZ, type PlayerState } from "@/lib/player-state";
import { groundY } from "@/lib/world-terrain";
import { getAllShadowGatesFn } from "@/lib/shadow-assets.functions";
import { SafeHtml } from "@/components/game/SafeHtml";
import { toast } from "sonner";
import { getPass } from "@/lib/shadow-vault";
import { keycardOpens, relicStore } from "@/lib/sealed-relics";
import { enterShadowRoom } from "@/lib/shadow-room";
import { tracyCue } from "@/lib/tracy-com";


type Spot = { block: number; slug: string; title: string; active: boolean; x: number; z: number; y: number; yaw: number };

const Arch = memo(function Arch({ s, unit, pose }: { s: Spot; unit: number; pose: React.MutableRefObject<PlayerState | null> }) {
  const ref = useRef<THREE.Group>(null);
  const veil = useRef<THREE.MeshStandardMaterial>(null);
  const armed = useRef(true);
  useFrame(({ clock }) => {
    const p = pose.current;
    const node = ref.current;
    if (!node) return;
    const dist = p ? Math.hypot(p.x - s.x, p.z - s.z) : Infinity;
    node.visible = !p || dist < WORLD_CELL * 3;
    if (veil.current) veil.current.emissiveIntensity = s.active ? 0.9 + Math.sin(clock.elapsedTime * 1.6) * 0.5 : 0.1;
    // STEPPING THROUGH — the pass is checked on this device only.
    const reach = unit * 2.6;
    if (dist > reach * 2.2) armed.current = true;
    if (!armed.current || dist > reach) return;
    armed.current = false;
    if (!s.active) {
      toast.error("GATEWAY SEALED", { description: `${s.title} IS CLOSED.` });
      tracyCue({ kind: "sealed", title: s.title, reason: "closed" });
      return;
    }
    if (!getPass(s.slug) && !keycardOpens(relicStore.get(), s.slug)) {
      void relicStore.refresh();
      toast("GATEWAY SEALED", { description: `NO SHADOW PASS OR SEALED KEYCARD (6 CONFIRMATIONS) FOR ${s.title}.` });
      tracyCue({ kind: "sealed", title: s.title, reason: "no-pass" });
      return;
    }
    enterShadowRoom({ slug: s.slug, title: s.title });
  });

  const h = unit * 6;
  const w = unit * 4;
  const t = unit * 0.7;
  const obsidian = { color: "#0c0a12", roughness: 0.18, metalness: 0.6 } as const;
  return (
    <group ref={ref} position={[s.x, s.y, s.z]} rotation={[0, s.yaw, 0]}>
      <mesh position={[0, unit * 0.15, 0]}>
        <boxGeometry args={[w + t * 3, unit * 0.3, t * 2.4]} />
        <meshStandardMaterial {...obsidian} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * (w + t)) / 2, h / 2, 0]}>
          <boxGeometry args={[t, h, t * 1.4]} />
          <meshStandardMaterial {...obsidian} />
        </mesh>
      ))}
      <mesh position={[0, h, 0]}>
        <torusGeometry args={[(w + t) / 2, t / 2, 8, 24, Math.PI]} />
        <meshStandardMaterial {...obsidian} />
      </mesh>
      <mesh position={[0, h / 2 + unit * 0.2, 0]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial ref={veil} color="#05030a" emissive="#22d3ee" emissiveIntensity={0.9} transparent opacity={s.active ? 0.55 : 0.25} side={THREE.DoubleSide} />
      </mesh>
      {s.block === 819245 ? (
        <group position={[0, 0, -unit * 9]}>
          <mesh position={[0, unit * 3, 0]}>
            <boxGeometry args={[unit * 12, unit * 6, unit * 8]} />
            <meshStandardMaterial color="#2a1a10" roughness={0.9} />
          </mesh>
          <mesh position={[0, unit * 7.5, 0]} rotation-y={Math.PI / 4}>
            <coneGeometry args={[unit * 9, unit * 3.5, 4]} />
            <meshStandardMaterial color="#14100c" roughness={0.8} />
          </mesh>
          {[-3.5, 3.5].map((x) => (
            <mesh key={x} position={[unit * x, unit * 3.4, unit * 4.05]}>
              <planeGeometry args={[unit * 2, unit * 1.6]} />
              <meshStandardMaterial color="#1a0d02" emissive="#f7931a" emissiveIntensity={1.6} />
            </mesh>
          ))}
          <pointLight position={[0, unit * 4, unit * 6]} color="#f7931a" intensity={2} distance={unit * 30} />
          <SafeHtml position={[0, unit * 10.5, 0]} center distanceFactor={unit * 40} style={{ pointerEvents: "none" }}>
            <div className="whitespace-nowrap font-mono text-[10px] tracking-[0.3em] text-bitcoin">THE ORANGE TAVERN</div>
          </SafeHtml>
        </group>
      ) : null}
      <SafeHtml position={[0, h + unit * 3, 0]} center distanceFactor={unit * 40} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap border border-signal/60 bg-background/80 px-1.5 py-0.5 font-mono text-[9px] text-signal">
          ◈ {s.title} · {s.active ? "SHADOW GATE" : "SEALED"}
        </div>
      </SafeHtml>
    </group>
  );
});

export const ShadowArchways = memo(function ShadowArchways({ unit, pose }: { unit: number; pose: React.MutableRefObject<PlayerState | null> }) {
  const { data } = useQuery({ queryKey: ["shadow-gates-all"], queryFn: () => getAllShadowGatesFn(), staleTime: 60_000 });
  const spots = useMemo<Spot[]>(() => {
    // one archway per BITMAP, set off-centre so it doesn't sit on the guardian
    const seen = new Set<number>();
    return (data ?? []).flatMap((g) => {
      if (seen.has(g.territoryBlock)) return [];
      seen.add(g.territoryBlock);
      const x = cellX(g.territoryBlock % WORLD_GRID) + WORLD_CELL * 0.22;
      const z = cellZ(Math.floor(g.territoryBlock / WORLD_GRID)) - WORLD_CELL * 0.22;
      return [{ block: g.territoryBlock, slug: g.slug, title: g.title, active: g.isActive, x, z, y: groundY(x, z), yaw: Math.PI / 4 }];
    });
  }, [data]);
  return <group>{spots.map((s) => <Arch key={s.slug} s={s} unit={unit} pose={pose} />)}</group>;
});

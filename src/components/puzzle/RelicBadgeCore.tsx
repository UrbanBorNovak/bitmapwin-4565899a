import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import * as THREE from "three";
import { ForgeBuild3D } from "@/components/game/ForgeBuild3D";
import { OnchainGuardianBody } from "@/components/bitmon/OnchainGuardianBody";
import { guardianDnaQuery } from "@/lib/bitmon-queries";
import type { RelicDraft } from "@/lib/puzzle-relic";

const ORANGE = "#f7931a", CYAN = "#22e1ff", DIM = "#3a4555";
const TILE = 1.1;

/** Height parsed from "<n>.bitmap"; null when no BITMAP is linked. */
export const relicHeight = (d: RelicDraft): number | null => {
  const m = d.bitmap?.match(/^(\d+)\.bitmap$/);
  return m ? Number(m[1]) : null;
};

/** Small floating label drawn to a sprite (used for the "missing" fallbacks). */
function Tag({ text, y, color }: { text: string; y: number; color: string }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 256; c.height = 48;
    const g = c.getContext("2d")!;
    g.font = "bold 22px 'Space Mono', monospace"; g.textAlign = "center"; g.fillStyle = color;
    g.fillText(text, 128, 32);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [text, color]);
  return <sprite position={[0, y, 0]} scale={[0.9, 0.17, 1]}><spriteMaterial map={tex} transparent depthWrite={false} /></sprite>;
}

/** Inscribed Guardian from its block DNA; dormant beacon when none or still loading. */
function GuardianSlot({ height, linked }: { height: number; linked: boolean }) {
  const dna = useQuery({ ...guardianDnaQuery(height), enabled: linked, staleTime: Infinity });
  if (linked && dna.data) {
    return <group position={[0.3, 0.06, 0.25]} scale={0.11}><OnchainGuardianBody dna={dna.data} unit={1} /></group>;
  }
  return (
    <group position={[0.3, 0.06, 0.25]}>
      <mesh position-y={0.08}><octahedronGeometry args={[0.07]} /><meshBasicMaterial color={DIM} wireframe /></mesh>
      <Tag text={linked ? "GUARDIAN LOADING" : "NO GUARDIAN"} y={0.28} color="#7d8796" />
    </group>
  );
}

/** Centre diorama: BITMAP tile → its inscribed Land Forge build → its inscribed Guardian. */
export function RelicBadgeCore({ draft }: { draft: RelicDraft }) {
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (spin.current) spin.current.rotation.y += Math.min(dt, 0.05) * 0.5; });
  const height = relicHeight(draft);

  return (
    <group position={[0, -0.45, 0.55]} rotation={[0.45, 0, 0]}>
      <group ref={spin}>
        {height == null ? (
          <>
            <mesh rotation-x={-Math.PI / 2}><ringGeometry args={[0.35, 0.4, 32]} /><meshBasicMaterial color={DIM} side={THREE.DoubleSide} /></mesh>
            <Tag text="NO BITMAP LINKED" y={0.2} color="#7d8796" />
          </>
        ) : (
          <>
            {/* BITMAP land tile */}
            <mesh position-y={-0.03}><boxGeometry args={[TILE, 0.06, TILE]} /><meshStandardMaterial color="#121a24" metalness={0.4} roughness={0.6} /></mesh>
            <lineSegments position-y={0.001}>
              <edgesGeometry args={[new THREE.BoxGeometry(TILE, 0.001, TILE)]} />
              <lineBasicMaterial color={ORANGE} />
            </lineSegments>
            {/* Voxel build, or an unbuilt boundary */}
            {draft.build ? (
              <ForgeBuild3D height={height} position={[0, 0, 0]} cell={TILE} />
            ) : (
              <>
                <mesh position-y={0.25}><boxGeometry args={[TILE * 0.9, 0.5, TILE * 0.9]} /><meshBasicMaterial color={CYAN} wireframe transparent opacity={0.35} /></mesh>
                <Tag text="UNBUILT LAND" y={0.65} color={CYAN} />
              </>
            )}
            <GuardianSlot height={height} linked={!!draft.guardian} />
          </>
        )}
      </group>
    </group>
  );
}

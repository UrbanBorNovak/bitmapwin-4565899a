/** 3D compare view: the land's existing inscribed build, the agent's proposed blocks as a ghost, and any registered model. */
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { ForgeBuild3D } from "@/components/game/ForgeBuild3D";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import { BLOCKS } from "@/lib/voxel-world";

const SPAN = 64;
const COLORS = Object.fromEntries(BLOCKS.map((b) => [b.id, new THREE.Color(b.top)]));
const noRaycast = () => {};

function Ghost({ blocks }: { blocks: [number, number, number, string][] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    blocks.forEach(([x, y, z, k], i) => {
      o.position.set(x - SPAN / 2, y + 0.5, z - SPAN / 2);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, COLORS[k] ?? COLORS["stone"]!);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [blocks]);
  if (!blocks.length) return null;
  return (
    <instancedMesh key={blocks.length} ref={ref} args={[undefined, undefined, blocks.length]} raycast={noRaycast}>
      <boxGeometry args={[0.96, 0.96, 0.96]} />
      <meshStandardMaterial transparent opacity={0.45} depthWrite={false} emissive="#3fd6e6" emissiveIntensity={0.25} />
    </instancedMesh>
  );
}

export default function ProposalGhost3D({ height, blocks, model, showLand, showGhost }: {
  height: number; blocks: [number, number, number, string][]; model: string | null; showLand: boolean; showGhost: boolean;
}) {
  const grid = useMemo(() => new THREE.GridHelper(SPAN, 16, "#f7931a", "#2a2a2a"), []);
  return (
    <SafeCanvas dpr={[1, 1.5]} camera={{ position: [60, 55, 60], fov: 40 }} gl={{ powerPreference: "low-power" }}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[40, 80, 30]} intensity={1.5} />
      <primitive object={grid} />
      <Suspense fallback={null}>
        {showLand && <ForgeBuild3D height={height} position={[0, 0, 0]} cell={40} />}
        {model && <InscribedModel url={contentUrl(model)} size={SPAN / 4} />}
      </Suspense>
      {showGhost && <Ghost blocks={blocks} />}
      <OrbitControls makeDefault target={[0, 8, 0]} enablePan={false} />
    </SafeCanvas>
  );
}

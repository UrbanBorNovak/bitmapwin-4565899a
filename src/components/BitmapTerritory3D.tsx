import { SafeCanvas } from "@/components/game/SafeCanvas";
import { SafeOrbitControls } from "@/components/game/SafeOrbitControls";
import { useQuery } from "@tanstack/react-query";
import { Suspense, useMemo } from "react";
import { GuardianBody } from "@/components/bitmon/GuardianBody";
import type { AwakeGuardian } from "@/lib/bitmon-queries";
import { packParcels } from "@/components/TerritoryCanvas";
import { blockSizeMapQuery } from "@/lib/block-bytes";
import { ForgeBuild3D } from "@/components/game/ForgeBuild3D";

const PALETTE = ["#ffb45a", "#f7931a", "#e6810e", "#c96d08", "#a95a06"];

function Plots({ classes }: { classes: number[] }) {
  const packed = useMemo(() => packParcels(classes), [classes]);
  const half = packed.grid / 2;

  // one instanced-style mesh per size class keeps big blocks cheap to draw
  const groups = useMemo(() => {
    const byClass = new Map<number, { x: number; z: number; size: number }[]>();
    packed.parcels.forEach((p) => {
      const list = byClass.get(p.size) ?? [];
      list.push({ x: p.x + p.size / 2 - half, z: p.y + p.size / 2 - half, size: p.size });
      byClass.set(p.size, list);
    });
    return [...byClass.entries()].sort((a, b) => a[0] - b[0]);
  }, [packed, half]);

  return (
    <group scale={[1 / half, 1 / half, 1 / half]}>
      {groups.map(([size, plots]) => (
        <group key={`c${size}`}>
          {plots.map((plot, i) => (
            <mesh key={`p${size}-${i}`} position={[plot.x, (size * size) / 6, plot.z]}>
              <boxGeometry args={[size * 0.86, (size * size) / 3, size * 0.86]} />
              <meshStandardMaterial
                color={PALETTE[Math.min(PALETTE.length - 1, size - 1)] ?? "#f7931a"}
                roughness={0.55}
                metalness={0.15}
              />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[packed.grid * 1.05, packed.grid * 1.05]} />
        <meshStandardMaterial color="#0b0b0b" roughness={1} />
      </mesh>
    </group>
  );
}

/** The block's real transaction parcels, extruded into land you can orbit. */
export function BitmapTerritory3D({ height, guardian }: { height: number; guardian?: AwakeGuardian | null }) {
  const { data, isError } = useQuery(blockSizeMapQuery(height));

  if (!data?.classes?.length) {
    return (
      <div className="flex aspect-square w-full items-center justify-center border border-border bg-background font-mono text-[10px] text-muted-foreground">
        {isError ? "INDEX BUSY" : "SYNC"}
      </div>
    );
  }

  return (
    <div className="aspect-square w-full border border-primary/40 bg-background">
      <SafeCanvas camera={{ position: [1.7, 1.5, 1.7], fov: 40 }} dpr={[1, 1.75]}>
        <color attach="background" args={["#080808"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 5, 2]} intensity={1.15} color="#ffd7a3" />
        <directionalLight position={[-3, 2, -2]} intensity={0.35} color="#f7931a" />
        <Plots classes={data.classes} />
        {/* Inscribed Land Forge build: 64-cell canvas spans the same 2-unit plot (cell/40 per block). */}
        <Suspense fallback={null}><ForgeBuild3D height={height} position={[0, 0, 0]} cell={1.25} /></Suspense>
        {guardian && (
          <Suspense fallback={null}>
            <group position={[0, 0.25, 0]} scale={0.32}>
              <GuardianBody species={guardian.species} rarity={guardian.rarity} body={guardian.body} accent={guardian.accent} height={guardian.height} />
            </group>
          </Suspense>
        )}
        <SafeOrbitControls
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.6}
          minDistance={1.2}
          maxDistance={4}
          maxPolarAngle={Math.PI / 2.15}
        />
      </SafeCanvas>
    </div>
  );
}

export default BitmapTerritory3D;

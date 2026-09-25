import { ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Environment, Lightformer } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { packParcels } from "@/components/TerritoryCanvas";
import { blockSizeMapQuery } from "@/lib/block-bytes";
import type { CardState } from "@/lib/game/types";

const PARCEL_COLORS = ["#e7d9b8", "#f6aa47", "#f7931a", "#bd6d19", "#637b52"];

type Plot = { x: number; z: number; size: number };

function ParcelInstances({ plots, grid, color }: { plots: Plot[]; grid: number; color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const unit = 2.75 / grid;

    plots.forEach((plot, index) => {
      const width = plot.size * unit * 0.9;
      const height = 0.08 + plot.size * 0.055;
      position.set((plot.x + plot.size / 2 - grid / 2) * unit, height / 2, (plot.z + plot.size / 2 - grid / 2) * unit);
      scale.set(width, height, width);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [grid, plots]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, plots.length]} castShadow receiveShadow>
      <boxGeometry />
      <meshStandardMaterial color={color} roughness={0.64} metalness={0.22} />
    </instancedMesh>
  );
}

function BitmapLand({ classes, dormant }: { classes: number[]; dormant: boolean }) {
  const packed = useMemo(() => packParcels(classes), [classes]);
  const groups = useMemo(() => {
    const grouped = new Map<number, Plot[]>();
    packed.parcels.forEach((parcel) => {
      const plots = grouped.get(parcel.size) ?? [];
      plots.push({ x: parcel.x, z: parcel.y, size: parcel.size });
      grouped.set(parcel.size, plots);
    });
    return [...grouped.entries()];
  }, [packed]);

  return (
    <group rotation-y={-0.34} position={[0, -0.16, 0]}>
      <mesh position={[0, -0.07, 0]} receiveShadow>
        <boxGeometry args={[2.96, 0.12, 2.96]} />
        <meshStandardMaterial color="#090b0a" roughness={0.92} metalness={0.08} />
      </mesh>
      {groups.map(([size, plots]) => (
        <ParcelInstances
          key={size}
          plots={plots}
          grid={packed.grid}
          color={dormant ? "#5e5b55" : (PARCEL_COLORS[Math.min(size - 1, PARCEL_COLORS.length - 1)] ?? "#f7931a")}
        />
      ))}
    </group>
  );
}

function Stage({ classes, dormant }: { classes: number[]; dormant: boolean }) {
  return (
    <SafeCanvas
      shadows
      dpr={1}
      camera={{ position: [3.7, 3.25, 4.2], fov: 31, near: 0.1, far: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
    >
      <ambientLight intensity={0.72} />
      <directionalLight position={[3, 5, 4]} intensity={2.1} castShadow shadow-mapSize-width={512} shadow-mapSize-height={512} />
      <directionalLight position={[-4, 2, -3]} intensity={0.55} color="#63d9e6" />
      <BitmapLand classes={classes} dormant={dormant} />
      <Environment>
        <Lightformer intensity={1.8} position={[0, 5, 2]} scale={[8, 8, 1]} />
        <Lightformer intensity={0.8} color="#f7931a" position={[-4, 1, 0]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} />
      </Environment>
    </SafeCanvas>
  );
}

export function CardBitmap3D({ height, state, className = "" }: { height: number; state: CardState; className?: string }) {
  const { data, isError } = useQuery(blockSizeMapQuery(height));
  const classes = data?.classes;

  return (
    <div
      className={`pointer-events-none overflow-hidden ${className}`}
      role="img"
      aria-label={`${height}.BITMAP transaction parcels in 3D`}
      data-no-translate
    >
      {classes?.length ? (
        <ClientOnly fallback={null}>
          <Stage classes={classes} dormant={state === "DORMANT"} />
        </ClientOnly>
      ) : (
        <span className="absolute inset-0 grid place-items-center font-mono text-[6px] text-muted-foreground">
          {isError ? "INDEX BUSY" : "SYNC"}
        </span>
      )}
    </div>
  );
}
import { Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";

/** Turntable of a creature's on-chain 3D model, loaded straight from its inscription. */
export function CreatureModel3D({ inscription, yaw = 0, label }: { inscription: string; yaw?: number | undefined; label: string }) {
  const fallback = (
    <div className="grid size-full place-items-center font-mono text-[11px] text-muted-foreground">
      &gt; LOADING MODEL<span className="blink">_</span>
    </div>
  );
  return (
    <div className="size-full" aria-label={`${label} 3D model`}>
      <ClientOnly fallback={fallback}>
        <SafeCanvas dpr={[1, 1.5]} camera={{ position: [2.6, 1.8, 3.2], fov: 35 }} gl={{ powerPreference: "low-power" }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[4, 6, 3]} intensity={1.6} />
          <Environment>
            <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
            <Lightformer intensity={1} color="#7fd6e6" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
          </Environment>
          <Suspense fallback={null}>
            <group position={[0, -1, 0]}>
              <InscribedModel url={contentUrl(inscription)} size={2} yaw={yaw} />
            </group>
          </Suspense>
          <OrbitControls enablePan={false} autoRotate autoRotateSpeed={1.4} minDistance={2.5} maxDistance={7} target={[0, 0, 0]} />
        </SafeCanvas>
      </ClientOnly>
    </div>
  );
}

import { Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Bounds, Center, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import { CritterBody } from "@/components/game/DesertLife";
import { GuardianBody } from "@/components/bitmon/GuardianBody";
import type { CritterKind } from "@/lib/bestiary";
import type { GuardianRarity, GuardianSpecies } from "@/lib/bitmon";

/** Same body tones the Oasis uses in its dark theme. */
const VIEW_COLORS = { foreground: "#e8e4dc", background: "#050505", muted: "#8b8780", border: "#2a2a2a", bitcoin: "#f7931a" };

/**
 * Turntable of a creature exactly as the Oasis draws it: an inscribed model
 * loaded from chain, or the Oasis's own desert-animal body for wildlife.
 */
export function CreatureModel3D({
  inscription,
  kind,
  guardian,
  yaw = 0,
  label,
}: {
  inscription?: string | undefined;
  kind?: CritterKind | undefined;
  guardian?: { species: GuardianSpecies; rarity: GuardianRarity; body: string; accent: string; height?: number } | undefined;
  yaw?: number | undefined;
  label: string;
}) {
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
            <Bounds fit clip observe margin={1.3}>
              <Center rotation-y={0.6}>
                {guardian ? (
                  <GuardianBody species={guardian.species} rarity={guardian.rarity} body={guardian.body} accent={guardian.accent} unit={1.4} height={guardian.height} />
                ) : inscription ? (
                  <InscribedModel url={contentUrl(inscription)} size={2} yaw={yaw} />
                ) : kind ? (
                  <CritterBody kind={kind} unit={4} colors={VIEW_COLORS} />
                ) : null}
              </Center>
            </Bounds>
          </Suspense>
          <OrbitControls makeDefault enablePan={false} autoRotate autoRotateSpeed={1.4} />
        </SafeCanvas>
      </ClientOnly>
    </div>
  );
}

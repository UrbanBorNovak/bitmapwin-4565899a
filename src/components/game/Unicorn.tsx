/**
 * THE UNICORN — the rarest sighting in the Oasis, an inscribed animal rather
 * than a voxel one, sized to the avatar and sharing one set of geometry buffers
 * across every sighting.
 */

import { Suspense, memo } from "react";
import { useGLTF } from "@react-three/drei";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";

export const UNICORN_INSCRIPTION =
  "e41dc7fdac3d125b902ed5a4373238b48b0cecd5eb46642223be5b11b14fa317i0";

const UNICORN_URL = contentUrl(UNICORN_INSCRIPTION);
const noRaycast = () => {};

export const UnicornBody = memo(function UnicornBody({ unit }: { unit: number }) {
  return (
    <Suspense
      fallback={
        <mesh position={[0, unit * 0.55, 0]} raycast={noRaycast}>
          <boxGeometry args={[unit * 0.22, unit * 0.3, unit * 0.66]} />
          <meshLambertMaterial color="#e8e2ef" flatShading />
        </mesh>
      }
    >
      {/* Facing along +Z like the other animals, so the wander code still steers it. */}
      <InscribedModel url={UNICORN_URL} size={unit * 1.05} yaw={0} />
    </Suspense>
  );
});

useGLTF.preload(UNICORN_URL);

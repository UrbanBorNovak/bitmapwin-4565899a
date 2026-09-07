/**
 * THE ANTELOPE — an inscribed animal rather than a voxel one, sized to the
 * avatar and sharing one set of geometry buffers across the herd.
 */

import { Suspense, memo } from "react";
import { useGLTF } from "@react-three/drei";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";

export const ANTELOPE_INSCRIPTION =
  "b92b9e12f5af28bd23413ccf5ea9f23a71daa82a7a629c34e374c5cc5ac18725i0";

const ANTELOPE_URL = contentUrl(ANTELOPE_INSCRIPTION);
const noRaycast = () => {};

export const AntelopeBody = memo(function AntelopeBody({ unit }: { unit: number }) {
  return (
    <Suspense
      fallback={
        <mesh position={[0, unit * 0.5, 0]} raycast={noRaycast}>
          <boxGeometry args={[unit * 0.2, unit * 0.26, unit * 0.6]} />
          <meshLambertMaterial color="#b8965f" flatShading />
        </mesh>
      }
    >
      {/* Facing along +Z like the voxel animals, so the wander code still steers it. */}
      <InscribedModel url={ANTELOPE_URL} size={unit * 0.9} yaw={Math.PI} />
    </Suspense>
  );
});

useGLTF.preload(ANTELOPE_URL);

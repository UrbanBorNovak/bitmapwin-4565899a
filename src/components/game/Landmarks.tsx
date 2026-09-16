/**
 * LANDMARKS — the inscribed cafe, tower, torii gate, arena and Bitcoin statue
 * that stand on fixed BITMAPS around the genesis plaza.
 *
 * Only the landmarks near the avatar are drawn, and while they are on screen
 * they register solid circles so nobody walks or drives through the walls.
 */

import { Suspense, memo, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import { LANDMARKS, landmarkSolids, landmarkSpot, type LandmarkSpec } from "@/lib/world-landmarks";
import { WORLD_CELL } from "@/lib/player-state";
import { dropSolids, registerSolids } from "@/lib/world-solids";

const noRaycast = () => {};

/** Landmarks are permanent, so their walls stay solid for the whole session. */
function useLandmarkSolids() {
  useEffect(() => {
    const solids = LANDMARKS.flatMap(landmarkSolids);
    registerSolids(solids);
    return () => dropSolids(solids.map((solid) => solid.key));
  }, []);
}

function Landmark({ spec }: { spec: LandmarkSpec }) {
  const spot = useMemo(() => landmarkSpot(spec), [spec]);
  const size = spec.span * WORLD_CELL;
  return (
    <group position={[spot.x, 0, spot.z]}>
      <Suspense
        fallback={
          <mesh position={[0, size * 0.5, 0]} raycast={noRaycast}>
            <boxGeometry args={[size * 0.6, size, size * 0.6]} />
            <meshLambertMaterial color="#4a4a4a" flatShading />
          </mesh>
        }
      >
        <InscribedModel url={contentUrl(spec.inscription)} size={size} yaw={spec.yaw} />
      </Suspense>
    </group>
  );
}

export const Landmarks = memo(function Landmarks() {
  useLandmarkSolids();
  // Only five of them stand in the whole world, so all five stay loaded.
  return (
    <>
      {LANDMARKS.map((spec) => (
        <Landmark key={spec.id} spec={spec} />
      ))}
    </>
  );
});

for (const spec of LANDMARKS) useGLTF.preload(contentUrl(spec.inscription));

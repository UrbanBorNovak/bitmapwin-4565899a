import { Suspense, memo, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import { WORLD_CELL } from "@/lib/player-state";
import { PLAZA } from "@/lib/world-landmarks";
import { dropSolids, registerSolids } from "@/lib/world-solids";

const CASTLE_WALL = "95d9f6d66ec84350564763dc5548884f52014adc9fae5860fca2a5bc75605deai0";
const UPPER_FENCE = "c8c0afdb0b9a9aea005a8a8af22bb20324142bead8260e8010f60a00cfd39fe9i0";
const TOWER_CORNER = "5f8291e4972434bc81696f10879e066edd9d36f1434ed52ff0f4d616fde4ec27i0";
const RIGHT_END = "75afb16b76fcaa35c33397c099e5f42b4b9d51343bfe729c9aeac98e6bdf8375i0";

const URLS = {
  wall: contentUrl(CASTLE_WALL),
  fence: contentUrl(UPPER_FENCE),
  tower: contentUrl(TOWER_CORNER),
  end: contentUrl(RIGHT_END),
};

const PIECES = [
  { id: "back", url: URLS.wall, x: 0, z: -3.2, size: 2.8, yaw: Math.PI / 2 },
  { id: "left", url: URLS.wall, x: -3.2, z: 0, size: 2.8, yaw: 0 },
  { id: "right", url: URLS.wall, x: 3.2, z: 0, size: 2.8, yaw: 0 },
  { id: "front-left", url: URLS.fence, x: -2.2, z: 3.2, size: 2.6, yaw: Math.PI / 2 },
  { id: "front-right", url: URLS.end, x: 2.2, z: 3.2, size: 2.6, yaw: Math.PI / 2 },
  { id: "tower-nw", url: URLS.tower, x: -3.2, z: -3.2, size: 3.4, yaw: 0 },
  { id: "tower-ne", url: URLS.tower, x: 3.2, z: -3.2, size: 3.4, yaw: Math.PI / 2 },
] as const;

const ORIGIN = { x: PLAZA.x + WORLD_CELL * 14, z: PLAZA.z - WORLD_CELL * 12 };

export const CastleDistrict = memo(function CastleDistrict() {
  useEffect(() => {
    const solids = PIECES.map((piece) => ({
      key: `castle:${piece.id}`,
      x: ORIGIN.x + piece.x * WORLD_CELL,
      z: ORIGIN.z + piece.z * WORLD_CELL,
      radius: WORLD_CELL * (piece.id.startsWith("tower") ? 0.82 : 0.68),
    }));
    registerSolids(solids);
    return () => dropSolids(solids.map((solid) => solid.key));
  }, []);

  return (
    <group position={[ORIGIN.x, 0, ORIGIN.z]}>
      {PIECES.map((piece) => (
        <group key={piece.id} position={[piece.x * WORLD_CELL, 0, piece.z * WORLD_CELL]}>
          <Suspense fallback={null}>
            <InscribedModel url={piece.url} size={piece.size * WORLD_CELL} yaw={piece.yaw} />
          </Suspense>
        </group>
      ))}
    </group>
  );
});

for (const url of Object.values(URLS)) useGLTF.preload(url);
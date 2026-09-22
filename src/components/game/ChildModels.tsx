/**
 * LAND MODELS — a model child inscription standing on its BITMAP.
 *
 * When a BITMAP has a child inscription that is a 3D model, the world places it
 * on top of that land. Only the tile you stand on, its neighbours and the tile
 * under inspection are asked about, so the chain is read sparingly. The model is
 * never collidable: you walk under and around it.
 */

import { Component, memo, Suspense, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import type { PlayerState } from "@/lib/player-state";
import { WORLD_CELL, WORLD_GRID, cellX, cellZ, colAt, rowAt } from "@/lib/player-state";
import { groundY } from "@/lib/world-terrain";
import { childModelQuery } from "@/lib/child-model";
import { InscribedModel } from "@/components/game/InscribedParts";

/** Roughly half a BITMAP across — a building you can see from the next tile. */
const MODEL_SIZE = WORLD_CELL * 0.5;
/** A breath of air under the model so it reads as placed on the land. */
const LIFT = WORLD_CELL * 0.01;

/** The same bytes relayed through our own origin, so WebGL will accept them. */
const modelUrl = (inscription: string) => `/api/public/inscription/${inscription}`;

/** A model that fails to decode leaves the land as it was. */
class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Asks the chain about one tile and stands its model on the land. */
const ModelOnLand = memo(function ModelOnLand({ height }: { height: number }) {
  const { data: model } = useQuery(childModelQuery(height));

  const place = useMemo(() => {
    const col = height % WORLD_GRID;
    const row = Math.floor(height / WORLD_GRID);
    const x = cellX(col);
    const z = cellZ(row);
    return { x, z, y: groundY(x, z) + LIFT };
  }, [height]);

  if (!model) return null;
  return (
    <group position={[place.x, place.y, place.z]}>
      <Quiet>
        <Suspense fallback={null}>
          <InscribedModel url={modelUrl(model.inscriptionId)} size={MODEL_SIZE} />
        </Suspense>
      </Quiet>
    </group>
  );
});

/** Every BITMAP with a model within reach of the avatar. */
export const ChildModels = memo(function ChildModels({
  pose,
  focus = null,
}: {
  pose: React.RefObject<PlayerState>;
  /** The BITMAP under inspection from above, shown even before you walk it. */
  focus?: number | null;
}) {
  const [around, setAround] = useState<number[]>([]);
  const centre = useRef(Number.NaN);

  useFrame(() => {
    const player = pose.current;
    if (!player) return;
    const col = colAt(player.x);
    const row = rowAt(player.z);
    const here = row * WORLD_GRID + col;
    if (here === centre.current) return;
    centre.current = here;
    const next: number[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const c = col + dc;
        const r = row + dr;
        if (c < 0 || r < 0 || c >= WORLD_GRID || r >= WORLD_GRID) continue;
        next.push(r * WORLD_GRID + c);
      }
    }
    setAround(next.sort((a, b) => a - b));
  });

  const heights = useMemo(() => {
    const all = new Set(around);
    if (focus !== null && focus >= 0) all.add(focus);
    return Array.from(all).sort((a, b) => a - b);
  }, [around, focus]);

  return (
    <>
      {heights.map((height) => (
        <ModelOnLand key={height} height={height} />
      ))}
    </>
  );
});

import { queryOptions } from "@tanstack/react-query";
import { getBssScene } from "@/lib/bss.functions";
import { BSS_SPAN } from "@/lib/bss/format";
import type { BssLoad, BssObject, BssScene } from "@/lib/bss/types";

export type { BssLoad, BssObject, BssScene } from "@/lib/bss/types";

export const bssSceneQuery = (height: number | null) =>
  queryOptions({
    queryKey: ["bss-scene", height],
    queryFn: () => getBssScene({ data: { height: height as number } }) as Promise<BssLoad>,
    enabled: height !== null,
    staleTime: 30 * 60_000,
    retry: 1,
  });

/** A BSS object placed in world units, ready for the renderer. */
export type BssPlacement = {
  key: string;
  kind: BssObject["kind"];
  inscriptionId: string | null;
  /** World-unit position, relative to the centre of the BITMAP's cell. */
  position: [number, number, number];
  /** Radians. */
  rotation: [number, number, number];
  /** World-unit size of the object. */
  size: number;
};

const RAD = Math.PI / 180;

/**
 * Converts a decoded scene into world placements. One BITMAP is `cell` wide and
 * BSS spans 10,000 units across that same square, so the scene lands exactly on
 * the land it was inscribed for.
 */
export function bssToWorld(scene: BssScene, cell: number, maxObjects = 400): BssPlacement[] {
  const unit = cell / BSS_SPAN;
  const half = BSS_SPAN / 2;
  return scene.objects.slice(0, maxObjects).map((object, index) => ({
    key: `${index}-${object.bind ?? object.kind}`,
    kind: object.kind,
    inscriptionId: object.inscriptionId,
    position: [
      (object.position.x - half) * unit,
      object.position.y * unit,
      (object.position.z - half) * unit,
    ],
    rotation: [object.rotation.x * RAD, object.rotation.y * RAD, object.rotation.z * RAD],
    size: Math.max(0.0001, Math.abs(object.scale) * unit),
  }));
}

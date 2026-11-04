import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Live chain scan: owner address of each valid parcel of a BITMAP (public chain facts). */
export const parcelOwnersFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ height: z.number().int().min(0).max(10_000_000) }).parse(d))
  .handler(async ({ data }): Promise<{ index: number; owner: string | null }[]> => {
    try {
      const { parcelHoldersFor } = await import("@/lib/parcel-fief.server");
      const r = await parcelHoldersFor(data.height);
      return (r?.parcels ?? []).map((p) => ({ index: p.index, owner: p.ownerAddress }));
    } catch { return []; }
  });

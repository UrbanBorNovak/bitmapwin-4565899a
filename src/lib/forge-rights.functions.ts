import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ForgeRights = { role: "bitmap" | "parcel" | "none"; parcels: number[]; holder: string | null };

/** Live chain check: does this address hold the BITMAP, or any of its parcels? */
export const forgeRightsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ height: z.number().int().min(0).max(10_000_000), address: z.string().min(20).max(100) }).parse(d))
  .handler(async ({ data }): Promise<ForgeRights> => {
    const addr = data.address.toLowerCase();
    let holder: string | null = null;
    try {
      const { locateBitmapHolder } = await import("@/lib/locate-bitmap.server");
      holder = (await locateBitmapHolder(data.height)).ownerAddress;
    } catch { holder = null; }
    if (holder && holder.toLowerCase() === addr) return { role: "bitmap", parcels: [], holder };
    try {
      const { parcelHoldersFor } = await import("@/lib/parcel-fief.server");
      const r = await parcelHoldersFor(data.height);
      const parcels = (r?.parcels ?? []).filter((p) => p.ownerAddress?.toLowerCase() === addr).map((p) => p.index);
      if (parcels.length) return { role: "parcel", parcels, holder };
    } catch { /* chain scan unavailable */ }
    return { role: "none", parcels: [], holder };
  });

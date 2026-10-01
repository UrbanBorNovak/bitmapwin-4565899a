/**
 * OASIS PARCELS — valid child-parcel indexes for one BITMAP, so the 3D world
 * can light up exactly the parcels that carry a real `{index}.{height}.bitmap`
 * child inscription. Everything resolves from the indexed registry plus the
 * ord recursive endpoints; nothing is synthesised.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type OasisParcel = { index: number; owner: string | null; inscriptionId: string; inscriptionNumber: number };
const cache = new Map<number, { expires: number; indexes: number[]; parcels: OasisParcel[] }>();
const TTL = 5 * 60_000;

export const getValidParcelIndexes = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ height: z.number().int().min(0).max(1_048_575) }).parse(data),
  )
  .handler(async ({ data }) => {
    const hit = cache.get(data.height);
    if (hit && hit.expires > Date.now()) return { height: data.height, indexes: hit.indexes, parcels: hit.parcels };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("bitmap_index")
      .select("inscription_id")
      .eq("block_height", data.height)
      .not("inscription_id", "is", null)
      .limit(1)
      .maybeSingle();

    let indexes: number[] = [];
    let parcels: OasisParcel[] = [];
    if (row?.inscription_id) {
      const { scanParcels } = await import("@/lib/parcels.server");
      const scan = await scanParcels(data.height, row.inscription_id);
      const valid = scan.parcels.filter((p) => p.valid);
      indexes = valid.map((p) => p.index);
      parcels = valid.map((p) => ({
        index: p.index,
        owner: p.ownerAddress,
        inscriptionId: p.inscriptionId,
        inscriptionNumber: p.inscriptionNumber,
      }));
    }

    cache.set(data.height, { expires: Date.now() + TTL, indexes, parcels });
    if (cache.size > 64) cache.delete(cache.keys().next().value as number);
    return { height: data.height, indexes, parcels };
  });

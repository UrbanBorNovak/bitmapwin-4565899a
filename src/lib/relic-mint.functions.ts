import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Live chain lookup of who holds <height>.bitmap right now (never browser-claimed). */
export const relicHolderFn = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ height: z.number().int().min(0).max(9_999_999) }).parse(i))
  .handler(async ({ data }) => {
    const { bitmapInscriptionFor } = await import("@/lib/land-skin.server");
    const { fetchParentSpend } = await import("@/lib/ord-parents");
    const id = await bitmapInscriptionFor(data.height).catch(() => null);
    if (!id) return { holderAddress: null as string | null, bitmapId: null as string | null, note: `COULD NOT FIND ${data.height}.BITMAP` };
    const spend = await fetchParentSpend(id.toLowerCase(), "wallet").catch(() => null);
    if (!spend) return { holderAddress: null as string | null, bitmapId: id, note: "COULD NOT LOCATE THE BITMAP ON CHAIN RIGHT NOW" };
    return { holderAddress: spend.address as string | null, bitmapId: id, note: "" };
  });

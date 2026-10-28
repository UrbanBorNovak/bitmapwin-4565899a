import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Before a bot builds, the signed-in owner must hold the BITMAP (or parcel)
 * live on mainnet from one of their linked wallets. Returns the ground the
 * bot may use: the whole 64-cell canvas, or the parcel's Mondrian rect.
 * Read-only: writes nothing, moves no funds.
 */
export const checkBotGroundFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    height: z.number().int().min(0).max(2_000_000),
    parcelIndex: z.number().int().min(0).nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: links, error } = await context.supabase.from("wallet_links").select("address").eq("user_id", context.userId);
    if (error) return { ok: false as const, reason: "Could not read your linked wallets." };
    const mine = new Set((links ?? []).map((l) => l.address.toLowerCase()));
    if (!mine.size) return { ok: false as const, reason: "Link a wallet to your account first." };
    const { buildBlockBytes } = await import("@/lib/block-bytes.server");
    const block = await buildBlockBytes(data.height).catch(() => null);
    const txCount = block?.txCount ?? null;
    if (data.parcelIndex === null) {
      const { locateBitmapHolder } = await import("@/lib/locate-bitmap.server");
      const holder = (await locateBitmapHolder(data.height).catch(() => null))?.ownerAddress ?? null;
      if (!holder) return { ok: false as const, reason: `Could not find who holds ${data.height}.BITMAP right now.` };
      if (!mine.has(holder.toLowerCase())) return { ok: false as const, reason: `None of your linked wallets holds ${data.height}.BITMAP.` };
      return { ok: true as const, role: "bitmap" as const, txCount, rect: null };
    }
    const { parcelHoldersFor } = await import("@/lib/parcel-fief.server");
    const ph = await parcelHoldersFor(data.height).catch(() => null);
    const p = ph?.parcels.find((x) => x.index === data.parcelIndex);
    if (!p?.ownerAddress || !mine.has(p.ownerAddress.toLowerCase())) return { ok: false as const, reason: `None of your linked wallets holds parcel ${data.parcelIndex} of ${data.height}.BITMAP.` };
    if (!block || block.covered < block.txCount) return { ok: false as const, reason: "Block data is still loading — the parcel's tile can't be worked out yet. Try again shortly." };
    const { parcelRects } = await import("@/lib/forge-parcels");
    const r = parcelRects([...block.bytes]).find((x) => x.index === data.parcelIndex);
    if (!r) return { ok: false as const, reason: "This parcel has no tile on the BITMAP." };
    return { ok: true as const, role: "parcel" as const, txCount, rect: { index: r.index, x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1, cells: [...r.cells] } };
  });

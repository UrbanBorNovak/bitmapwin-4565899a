import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, myAddresses } from "../addresses";
import { fetchPortfolioActivity } from "@/lib/portfolio-activity";

export default defineTool({
  name: "get_portfolio_activity",
  title: "Get my portfolio activity",
  description:
    "Aggregated activity stream across every bitmap the signed-in holder owns or watches: new visits, bids, on-chain trades, build updates, lease activity and BIT events, ranked so the most important bitmaps come first. Includes an 'attention' list of what needs the holder's action.",
  inputSchema: {
    windowHours: z
      .number()
      .int()
      .min(1)
      .max(720)
      .optional()
      .describe("Look-back window in hours (default 24). Visit change % compares to the window before it."),
    limit: z.number().int().min(1).max(100).optional().describe("Max bitmaps to return (default 25)."),
    includeWatched: z
      .boolean()
      .optional()
      .describe("Include bitmaps on the watchlist even when not held (default true)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ windowHours, limit, includeWatched }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const addresses = await myAddresses(ctx);

    const heldHeights = new Set<number>();
    if (addresses.length > 0) {
      const [idx, pages, bought] = await Promise.all([
        supabase.from("bitmap_index").select("block_height").in("owner_address", addresses).limit(5000),
        supabase.from("parcel_pages").select("bitmap_height").in("owner_address", addresses).limit(5000),
        supabase.from("trades").select("bitmap_height").in("buyer_address", addresses).limit(5000),
      ]);
      const err = [idx, pages, bought].find((r) => r.error)?.error;
      if (err) return errorResult(err.message);
      for (const r of idx.data ?? []) heldHeights.add(Number(r.block_height));
      for (const r of pages.data ?? []) heldHeights.add(Number(r.bitmap_height));
      for (const r of bought.data ?? []) heldHeights.add(Number(r.bitmap_height));
    }

    let watchedHeights: number[] = [];
    if (includeWatched !== false) {
      const watches = await supabase.from("bitmap_watches").select("bitmap_height").limit(500);
      if (watches.error) return errorResult(watches.error.message);
      watchedHeights = (watches.data ?? []).map((r) => Number(r.bitmap_height));
    }

    if (heldHeights.size === 0 && watchedHeights.length === 0)
      return errorResult(
        "No bitmaps found for this account yet. Link a verified wallet or watch a bitmap first.",
      );

    const payload = await fetchPortfolioActivity(supabase, {
      addresses,
      heldHeights: [...heldHeights],
      watchedHeights,
      ...(windowHours === undefined ? {} : { windowHours }),
      ...(limit === undefined ? {} : { limit }),
    });

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});

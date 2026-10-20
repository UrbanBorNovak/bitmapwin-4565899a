import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult } from "../addresses";

export default defineTool({
  name: "get_floor_prices",
  title: "Get floor prices",
  description: "Cheapest open marketplace listings (sats) overall and within an optional block-height range, from real open offers only.",
  inputSchema: {
    minHeight: z.number().int().min(0).optional().describe("Lowest block height."),
    maxHeight: z.number().int().min(0).optional().describe("Highest block height."),
    limit: z.number().int().min(1).max(25).optional().describe("How many cheapest listings to return (default 5)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ minHeight, maxHeight, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const { AGENT_SCHEMA } = await import("@/lib/agent-build-schema");
    const supabase = supabaseForUser(ctx);
    let q = supabase.from("offers").select("id, bitmap_height, price_sats")
      .eq("status", "open").not("price_sats", "is", null).not("bitmap_height", "is", null)
      .order("price_sats", { ascending: true }).limit(limit ?? 5);
    if (minHeight !== undefined) q = q.gte("bitmap_height", minHeight);
    if (maxHeight !== undefined) q = q.lte("bitmap_height", maxHeight);
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    const listings = (data ?? []).map((r) => ({
      offerId: r.id, bitmap: `${r.bitmap_height}.bitmap`, height: Number(r.bitmap_height), priceSats: Number(r.price_sats),
      buy: `https://bitmapwin.app/bitmap/${r.bitmap_height}`,
    }));
    const payload = {
      schema: AGENT_SCHEMA, floorSats: listings[0]?.priceSats ?? null, buyerFeePct: 2, listings,
      note: "Buying always requires the holder's own wallet signature on the buy page; agents never sign.",
    };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});

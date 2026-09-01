import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult } from "../addresses";

export default defineTool({
  name: "get_bitmap",
  title: "Get bitmap",
  description:
    "Get one bitmap by block height: registry claim, block stats, its build page and its live bids.",
  inputSchema: {
    height: z.number().int().nonnegative().describe("Bitcoin block height, e.g. 840000."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ height }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const [claim, stats, build, bids] = await Promise.all([
      supabase
        .from("bitmap_index")
        .select("block_height, inscription_id, owner_address, is_valid, content")
        .eq("block_height", height)
        .maybeSingle(),
      supabase.from("block_stats").select("*").eq("height", height).maybeSingle(),
      supabase
        .from("parcel_pages")
        .select("title, description, build_kind, owner_address, updated_at")
        .eq("bitmap_height", height)
        .maybeSingle(),
      supabase
        .from("bids")
        .select("price_sats, bidder_address, status, created_at")
        .eq("bitmap_height", height)
        .eq("status", "open")
        .order("price_sats", { ascending: false })
        .limit(10),
    ]);

    const payload = {
      name: `${height}.bitmap`,
      height,
      claim: claim.data ?? null,
      blockStats: stats.data ?? null,
      build: build.data ?? null,
      openBids: bids.data ?? [],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});

import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult } from "../addresses";

export default defineTool({
  name: "search_bitmaps",
  title: "Search bitmaps",
  description:
    "Search the Bitmap Unhinged registry of valid bitmap claims by block-height range or holder address.",
  inputSchema: {
    minHeight: z.number().int().nonnegative().optional().describe("Lowest block height to include."),
    maxHeight: z.number().int().nonnegative().optional().describe("Highest block height to include."),
    ownerAddress: z.string().trim().optional().describe("Only bitmaps held by this Bitcoin address."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ minHeight, maxHeight, ownerAddress, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("bitmap_index")
      .select("block_height, inscription_id, owner_address, is_valid")
      .eq("is_valid", true)
      .order("block_height", { ascending: true })
      .limit(limit ?? 25);
    if (minHeight !== undefined) q = q.gte("block_height", minHeight);
    if (maxHeight !== undefined) q = q.lte("block_height", maxHeight);
    if (ownerAddress) q = q.eq("owner_address", ownerAddress);
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    const rows = (data ?? []).map((r) => ({
      name: `${r.block_height}.bitmap`,
      height: r.block_height,
      inscriptionId: r.inscription_id,
      owner: r.owner_address,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { bitmaps: rows },
    };
  },
});

import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, myAddresses } from "../addresses";

export default defineTool({
  name: "my_bitmaps",
  title: "My bitmaps",
  description:
    "List the bitmaps held by the Bitcoin addresses linked to the signed-in Bitmap Unhinged account.",
  inputSchema: {
    limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const addresses = await myAddresses(ctx);
    if (addresses.length === 0)
      return errorResult("No verified wallet address is linked to this account yet.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("bitmap_index")
      .select("block_height, inscription_id, owner_address")
      .in("owner_address", addresses)
      .eq("is_valid", true)
      .order("block_height", { ascending: true })
      .limit(limit ?? 50);
    if (error) return errorResult(error.message);
    const rows = (data ?? []).map((r) => ({
      name: `${r.block_height}.bitmap`,
      height: r.block_height,
      inscriptionId: r.inscription_id,
      owner: r.owner_address,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify({ addresses, bitmaps: rows }, null, 2) }],
      structuredContent: { addresses, bitmaps: rows },
    };
  },
});

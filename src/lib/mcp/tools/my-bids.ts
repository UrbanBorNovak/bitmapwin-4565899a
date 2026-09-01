import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, myAddresses } from "../addresses";

export default defineTool({
  name: "my_bids",
  title: "My bids",
  description:
    "List bids placed by the signed-in account's linked addresses, and incoming bids on the bitmaps it holds.",
  inputSchema: {
    status: z.string().trim().optional().describe("Filter by bid status, e.g. open, accepted, declined."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows per side (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const addresses = await myAddresses(ctx);
    if (addresses.length === 0)
      return errorResult("No verified wallet address is linked to this account yet.");
    const supabase = supabaseForUser(ctx);
    const take = limit ?? 25;

    let outgoing = supabase
      .from("bids")
      .select("id, bitmap_height, price_sats, bidder_address, status, note, created_at")
      .in("bidder_address", addresses)
      .order("created_at", { ascending: false })
      .limit(take);
    if (status) outgoing = outgoing.eq("status", status);

    const held = await supabase
      .from("bitmap_index")
      .select("block_height")
      .in("owner_address", addresses)
      .eq("is_valid", true)
      .limit(500);
    const heights = (held.data ?? []).map((r) => r.block_height);

    let incoming = supabase
      .from("bids")
      .select("id, bitmap_height, price_sats, bidder_address, status, note, created_at")
      .in("bitmap_height", heights.length > 0 ? heights : [-1])
      .order("price_sats", { ascending: false })
      .limit(take);
    if (status) incoming = incoming.eq("status", status);

    const [out, inc] = await Promise.all([outgoing, incoming]);
    if (out.error) return errorResult(out.error.message);
    if (inc.error) return errorResult(inc.error.message);
    const payload = { placedByMe: out.data ?? [], onMyBitmaps: inc.data ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});

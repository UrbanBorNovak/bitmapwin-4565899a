import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult } from "../addresses";

export default defineTool({
  name: "my_watchlist",
  title: "My watched bitmaps",
  description: "The bitmaps the signed-in account watches, with the signals enabled for each one.",
  inputSchema: {
    limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("bitmap_watches")
      .select("bitmap_height, note, created_at, watch_bids, watch_visits, watch_builds, watch_leases, watch_trades, watch_coins")
      .order("created_at", { ascending: false })
      .limit(limit ?? 100);
    if (error) return errorResult(error.message);

    const watching = (data ?? []).map((r) => ({
      height: Number(r.bitmap_height),
      name: `${r.bitmap_height}.bitmap`,
      note: r.note,
      since: r.created_at,
      signals: {
        bids: r.watch_bids,
        visits: r.watch_visits,
        builds: r.watch_builds,
        leases: r.watch_leases,
        trades: r.watch_trades,
        coins: r.watch_coins,
      },
    }));
    const payload = { count: watching.length, watching };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});

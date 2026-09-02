import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult } from "../addresses";

export default defineTool({
  name: "watch_bitmap",
  title: "Watch a bitmap",
  description:
    "Start (or stop) watching a bitmap for the signed-in account. Watched bitmaps show up in get_portfolio_activity even when the account does not hold them, with per-signal toggles for bids, visits, build updates, lease activity, on-chain trades and BIT activity.",
  inputSchema: {
    height: z.number().int().nonnegative().describe("Bitcoin block height of the bitmap, e.g. 420690."),
    watch: z.boolean().optional().describe("false stops watching this bitmap (default true)."),
    bids: z.boolean().optional().describe("Watch new bids (default true)."),
    visits: z.boolean().optional().describe("Watch new visits (default true)."),
    builds: z.boolean().optional().describe("Watch build updates (default true)."),
    leases: z.boolean().optional().describe("Watch lease activity (default true)."),
    trades: z.boolean().optional().describe("Watch on-chain trades (default true)."),
    coins: z.boolean().optional().describe("Watch BIT activity (default true)."),
    note: z.string().max(280).optional().describe("Optional note about why this bitmap is watched."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const userId = ctx.getUserId();
    if (!userId) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { height, watch, bids, visits, builds, leases, trades, coins, note } = input;

    if (watch === false) {
      const { error } = await supabase
        .from("bitmap_watches")
        .delete()
        .eq("user_id", userId)
        .eq("bitmap_height", height);
      if (error) return errorResult(error.message);
      const payload = { bitmap: height, name: `${height}.bitmap`, watching: false };
      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }

    const { data, error } = await supabase
      .from("bitmap_watches")
      .upsert(
        {
          user_id: userId,
          bitmap_height: height,
          note: note ?? null,
          watch_bids: bids ?? true,
          watch_visits: visits ?? true,
          watch_builds: builds ?? true,
          watch_leases: leases ?? true,
          watch_trades: trades ?? true,
          watch_coins: coins ?? true,
        },
        { onConflict: "user_id,bitmap_height" },
      )
      .select("bitmap_height, note, watch_bids, watch_visits, watch_builds, watch_leases, watch_trades, watch_coins")
      .single();
    if (error) return errorResult(error.message);

    const payload = {
      bitmap: height,
      name: `${height}.bitmap`,
      watching: true,
      note: data.note,
      signals: {
        bids: data.watch_bids,
        visits: data.watch_visits,
        builds: data.watch_builds,
        leases: data.watch_leases,
        trades: data.watch_trades,
        coins: data.watch_coins,
      },
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});

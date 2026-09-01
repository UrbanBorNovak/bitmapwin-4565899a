import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, myAddresses } from "../addresses";

export default defineTool({
  name: "my_bit_balance",
  title: "My BIT balance",
  description:
    "Show the BIT coin balance, lifetime earnings and recent ledger entries for the signed-in account's linked addresses.",
  inputSchema: {
    ledgerLimit: z.number().int().min(1).max(50).optional().describe("Recent ledger rows to include (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ ledgerLimit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const addresses = await myAddresses(ctx);
    if (addresses.length === 0)
      return errorResult("No verified wallet address is linked to this account yet.");
    const supabase = supabaseForUser(ctx);
    const [balances, ledger] = await Promise.all([
      supabase.from("coin_balances").select("address, balance, earned_total").in("address", addresses),
      supabase
        .from("coin_ledger")
        .select("*")
        .in("address", addresses)
        .order("created_at", { ascending: false })
        .limit(ledgerLimit ?? 10),
    ]);
    if (balances.error) return errorResult(balances.error.message);
    if (ledger.error) return errorResult(ledger.error.message);
    const total = (balances.data ?? []).reduce((sum, r) => sum + Number(r.balance ?? 0), 0);
    const payload = { totalBit: total, byAddress: balances.data ?? [], recentLedger: ledger.data ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});

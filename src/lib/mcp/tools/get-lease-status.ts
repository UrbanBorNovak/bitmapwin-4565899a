import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult } from "../addresses";

export default defineTool({
  name: "get_lease_status",
  title: "Get lease status",
  description: "Show the active lease on a BITMAP (lessee, BIT rate, start/end) and any open lease offers. Leases are BIT-only and grant build + shop rights for their term.",
  inputSchema: { height: z.number().int().min(0).max(10_000_000).describe("BITMAP block height.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ height }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const { AGENT_SCHEMA } = await import("@/lib/agent-build-schema");
    const supabase = supabaseForUser(ctx);
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase.from("leases")
      .select("lessee_address, owner_address, rate_coins_per_day, days, starts_at, ends_at, status")
      .eq("bitmap_height", height).eq("status", "active").gt("ends_at", nowIso)
      .order("ends_at", { ascending: false }).limit(1);
    if (error) return errorResult(error.message);
    const l = data?.[0];
    const active = l ? {
      lessee: l.lessee_address, owner: l.owner_address, rateBitPerDay: Number(l.rate_coins_per_day),
      days: Number(l.days), startsAt: l.starts_at, endsAt: l.ends_at, rights: ["build", "shop"],
    } : null;
    const payload = {
      schema: AGENT_SCHEMA, bitmap: `${height}.bitmap`, height, leased: !!active, active,
      note: active ? "Only the active lessee may build during this term." : "No active lease; the BITMAP holder controls the land.",
    };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});

import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult } from "../addresses";

export default defineTool({
  name: "my_build_proposals",
  title: "My build proposals",
  description: "List the signed-in holder's saved build proposals and whether each was applied or rejected.",
  inputSchema: { limit: z.number().int().min(1).max(50).optional().describe("Max rows (default 20).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const { data, error } = await supabaseForUser(ctx).from("build_proposals")
      .select("id, bitmap_height, parcel_index, role, block_count, model_inscription_id, note, status, created_at, decided_at")
      .order("created_at", { ascending: false }).limit(limit ?? 20);
    if (error) return errorResult(error.message);
    const rows = (data ?? []).map((r) => ({ id: r.id, bitmap: `${r.bitmap_height}.bitmap`, parcelIndex: r.parcel_index, role: r.role,
      blocks: r.block_count, model: r.model_inscription_id, note: r.note, status: r.status, createdAt: r.created_at, decidedAt: r.decided_at }));
    return { content: [{ type: "text", text: JSON.stringify(rows) }], structuredContent: { proposals: rows } };
  },
});

import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult } from "../addresses";

export default defineTool({
  name: "recent_builds",
  title: "Recent builds",
  description: "List recently updated bitmap build pages (info pages, galleries, shops, 3D worlds).",
  inputSchema: {
    kind: z.string().trim().optional().describe("Filter by build kind, e.g. info, gallery, shop, game3d, game2d."),
    limit: z.number().int().min(1).max(50).optional().describe("Max rows to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ kind, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("parcel_pages")
      .select("bitmap_height, title, description, build_kind, owner_address, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit ?? 20);
    if (kind) q = q.eq("build_kind", kind);
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    const rows = (data ?? []).map((r) => ({
      bitmap: `${r.bitmap_height}.bitmap`,
      height: r.bitmap_height,
      title: r.title,
      description: r.description,
      kind: r.build_kind,
      builder: r.owner_address,
      updatedAt: r.updated_at,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { builds: rows },
    };
  },
});

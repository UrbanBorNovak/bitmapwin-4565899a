import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult } from "../addresses";

export default defineTool({
  name: "inspect_build",
  title: "Inspect existing build",
  description: "Show what is already built on a BITMAP: the chain-verified Land Forge build, parcel-holder builds, HTML on the land and any placed Model Registry model.",
  inputSchema: { height: z.number().int().min(0).max(10_000_000).describe("Bitcoin block height.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ height }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const { forgeBuildForHeight, forgeLandFor } = await import("@/lib/forge.server");
    const { AGENT_SCHEMA } = await import("@/lib/agent-build-schema");
    const supabase = supabaseForUser(ctx);
    const [build, land, model] = await Promise.all([
      forgeBuildForHeight(height).catch(() => null),
      forgeLandFor(height).catch(() => null),
      supabase.from("bitmap_models").select("inscription_id, scale, rotation_y, height_offset").eq("bitmap_height", height).maybeSingle(),
    ]);
    const payload = {
      schema: AGENT_SCHEMA, bitmap: `${height}.bitmap`, height,
      districtBuild: build ? { inscriptionId: build.inscriptionId, blockCount: build.blockCount, span: build.span ?? 64, archetype: build.archetype, data: build.data } : null,
      parcelBuilds: (land?.parcels ?? []).map((p) => ({ index: p.index, rect: [...p.rect], inscriptionId: p.inscriptionId })),
      rejectedParcelBuilds: (land?.rejected ?? []).length,
      htmlOnLand: (land?.html ?? []).length,
      model: model.data ? { inscriptionId: model.data.inscription_id, scale: Number(model.data.scale), rotationY: Number(model.data.rotation_y), lift: Number(model.data.height_offset) } : null,
    };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});

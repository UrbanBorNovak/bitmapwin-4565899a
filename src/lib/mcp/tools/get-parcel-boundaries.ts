import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult } from "../addresses";

export default defineTool({
  name: "get_parcel_boundaries",
  title: "Get parcel boundaries",
  description: "Derive a BITMAP's parcel tiles on the 64-cell Forge canvas from its block's real transaction sizes (Parcel Floor Metric, one owner per cell).",
  inputSchema: { height: z.number().int().min(0).max(10_000_000).describe("Bitcoin block height.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ height }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const { buildBlockBytes } = await import("@/lib/block-bytes.server");
    const { parcelRects } = await import("@/lib/forge-parcels");
    const { parcelBoundaryJson, AGENT_SCHEMA } = await import("@/lib/agent-build-schema");
    const block = await buildBlockBytes(height).catch(() => null);
    if (!block) return errorResult("Could not read this block from the chain right now.");
    const complete = block.covered >= block.txCount;
    const parcels = complete ? parcelRects([...block.bytes]).map(parcelBoundaryJson) : [];
    const payload = {
      schema: AGENT_SCHEMA, bitmap: `${height}.bitmap`, height, span: 64, txCount: block.txCount, complete,
      note: complete ? "rect = [x0, z0, x1, z1); only owned cells accept a parcel holder's blocks." : "Block size map incomplete; no parcel verdict is possible.",
      parcels,
    };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});

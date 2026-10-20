import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult } from "../addresses";

export default defineTool({
  name: "discover_open_parcels",
  title: "Discover open parcels",
  description: "For one BITMAP, list every parcel tile (Mondrian rect) with its live on-chain holder and whether it already carries a verified build, so agents can find unbuilt ground.",
  inputSchema: { height: z.number().int().min(0).max(10_000_000).describe("BITMAP block height.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ height }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const { buildBlockBytes } = await import("@/lib/block-bytes.server");
    const { parcelHoldersFor } = await import("@/lib/parcel-fief.server");
    const { forgeLandFor } = await import("@/lib/forge.server");
    const { parcelRects } = await import("@/lib/forge-parcels");
    const { parcelBoundaryJson, AGENT_SCHEMA } = await import("@/lib/agent-build-schema");
    const [block, holders, land] = await Promise.all([
      buildBlockBytes(height).catch(() => null),
      parcelHoldersFor(height).catch(() => null),
      forgeLandFor(height).catch(() => null),
    ]);
    if (!block) return errorResult("Could not read this block from the chain right now.");
    if (block.covered < block.txCount) return errorResult("Block size map incomplete; no parcel verdict is possible.");
    const owner = new Map((holders?.parcels ?? []).map((p) => [p.index, p.ownerAddress ?? null]));
    const built = new Set((land?.parcels ?? []).map((p) => p.index));
    const parcels = parcelRects([...block.bytes]).filter((r) => r.cells.size > 0).map((r) => ({
      ...parcelBoundaryJson(r), inscribed: owner.has(r.index), holder: owner.get(r.index) ?? null, built: built.has(r.index),
    }));
    const payload = {
      schema: AGENT_SCHEMA, bitmap: `${height}.bitmap`, height, txCount: block.txCount,
      openCount: parcels.filter((p) => !p.built).length, parcels,
      note: "inscribed=false means no parcel child claims that tx index yet; built=false means no verified parcel build.",
    };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});

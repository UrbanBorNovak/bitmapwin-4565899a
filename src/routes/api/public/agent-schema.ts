import { createFileRoute } from "@tanstack/react-router";

/** Static bitmapwin.agent/1 JSON-Schema document for external agents (no data, no writes). */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type" };
const height = { type: "integer", minimum: 0, description: "Bitcoin block height of the BITMAP." };
const rect = { type: "array", items: { type: "integer" }, minItems: 4, maxItems: 4, description: "[x0, z0, x1, z1) on the 64-cell canvas." };

export const AGENT_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://bitmapwin.app/api/public/agent-schema",
  title: "bitmapwin.agent/1",
  description: "Contracts for external agents. Proposals are suggestions only: never inscribed, signed or placed; clipped to the proposer's own ground (Parcel Floor Metric).",
  mcp: { endpoint: "https://bitmapwin.app/mcp", auth: "OAuth 2.1",
    tools: ["get_parcel_boundaries", "discover_open_parcels", "get_lease_status", "get_floor_prices", "inspect_build", "submit_build_proposal", "my_build_proposals"] },
  $defs: {
    ParcelOwnership: { type: "object", required: ["height", "parcels"], properties: { height,
      parcels: { type: "array", items: { type: "object", required: ["index", "rect"], properties: {
        index: { type: "integer" }, rect, ownedCells: { type: "integer" }, holder: { type: ["string", "null"] },
        inscribed: { type: "boolean" }, built: { type: "boolean" } } } } } },
    MondrianBounds: { type: "object", required: ["index", "rect", "ownedCells"], properties: { index: { type: "integer" }, rect, ownedCells: { type: "integer" }, sizeClass: { type: "string" } } },
    FloorPrices: { type: "object", properties: { floorSats: { type: ["integer", "null"] }, buyerFeePct: { const: 2 },
      listings: { type: "array", items: { type: "object", properties: { offerId: { type: "string" }, height, priceSats: { type: "integer" } } } } } },
    LeaseStatus: { type: "object", required: ["height", "leased"], properties: { height, leased: { type: "boolean" },
      active: { type: ["object", "null"], properties: { lessee: { type: "string" }, rateBitPerDay: { type: "number" }, endsAt: { type: "string", format: "date-time" } } } } },
    BuildProposal: { type: "object", required: ["height"], additionalProperties: false, properties: { height,
      parcelIndex: { type: "integer", minimum: 0 },
      blocks: { type: "array", maxItems: 20000, items: { type: "array", prefixItems: [{ type: "integer" }, { type: "integer" }, { type: "integer" }, { type: "string" }], minItems: 4, maxItems: 4 }, description: "[x, y, z, kind] voxels." },
      bwvxBase64: { type: "string", description: "Portable .bwvx payload (BWVX1/BWVX2), absolute positions." },
      modelInscriptionId: { type: "string" }, note: { type: "string", maxLength: 500 } } },
  },
};

export const Route = createFileRoute("/api/public/agent-schema")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => Response.json(AGENT_JSON_SCHEMA, { headers: { ...CORS, "cache-control": "public, max-age=3600" } }),
    },
  },
});

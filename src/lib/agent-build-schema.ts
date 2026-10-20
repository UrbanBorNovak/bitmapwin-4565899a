/**
 * Standard agent schemas (bitmapwin.agent/1). Pure + browser-safe so MCP tools,
 * the app and tests share one contract. Proposals are suggestions only: they
 * never inscribe, sign or place anything, and are clipped to the proposer's
 * own ground by the Parcel Floor Metric (one owner per cell).
 */
import { z } from "zod";
import { BLOCKS, type BlockId } from "@/lib/voxel-world";
import { FORGE_MAX_BLOCKS, FORGE_SPAN } from "@/lib/voxel-populate";
import { inRect, type ParcelRect } from "@/lib/forge-parcels";
import { isRegisteredModel } from "@/lib/model-registry";
import type { TplBlock } from "@/lib/voxel-templates";

export const AGENT_SCHEMA = "bitmapwin.agent/1";
export const BLOCK_KINDS = BLOCKS.map((b) => b.id) as BlockId[];

export const buildProposalSchema = {
  height: z.number().int().min(0).max(10_000_000).describe("BITMAP block height."),
  parcelIndex: z.number().int().min(0).optional().describe("Parcel tx index when building as a parcel holder; omit to build as the BITMAP holder."),
  blocks: z.array(z.tuple([z.number().int(), z.number().int(), z.number().int(), z.string()]))
    .max(FORGE_MAX_BLOCKS).describe("Voxels [x, y, z, kind] on the 64-cell canvas; kind is a Forge block id."),
  modelInscriptionId: z.string().optional().describe("Optional Model Registry inscription id (BITMAP holder only)."),
  note: z.string().max(500).optional().describe("Why the agent proposes this build."),
};

export type ProposalRole = "bitmap" | "parcel" | "none";
export type ProposalVerdict = {
  ok: boolean;
  reason: string | null;
  blocks: TplBlock[];
  dropped: { outOfBounds: number; notYourGround: number; unknownKind: number; duplicate: number };
};

/**
 * Applies ownership + placement rules. BITMAP holders may use the whole canvas;
 * parcel holders only the cells their parcel exclusively owns.
 */
export function validateBuildProposal(
  input: { blocks: [number, number, number, string][]; parcelIndex?: number | undefined; modelInscriptionId?: string | undefined },
  rights: { role: ProposalRole; parcels: number[] },
  rects: ParcelRect[] | null,
): ProposalVerdict {
  const dropped = { outOfBounds: 0, notYourGround: 0, unknownKind: 0, duplicate: 0 };
  const fail = (reason: string): ProposalVerdict => ({ ok: false, reason, blocks: [], dropped });
  if (rights.role === "none") return fail("This wallet holds neither the BITMAP nor any of its parcels.");
  let rect: ParcelRect | null = null;
  if (input.parcelIndex !== undefined || rights.role === "parcel") {
    const idx = input.parcelIndex ?? rights.parcels[0];
    if (idx === undefined || (rights.role === "parcel" && !rights.parcels.includes(idx))) return fail("You do not hold that parcel.");
    if (!rects) return fail("This block's parcel map is incomplete, so parcel ground cannot be verified.");
    rect = rects.find((r) => r.index === idx) ?? null;
    if (!rect || rect.cells.size === 0) return fail("That parcel owns no build ground.");
  }
  if (input.modelInscriptionId && (rights.role !== "bitmap" || rect)) return fail("Only the BITMAP holder can place a model.");
  if (input.modelInscriptionId && !isRegisteredModel(input.modelInscriptionId)) return fail("That model is not in the Model Registry.");
  const kinds = new Set<string>(BLOCK_KINDS);
  const seen = new Set<number>();
  const blocks: TplBlock[] = [];
  for (const [x, y, z, k] of input.blocks) {
    if (x < 0 || z < 0 || y < 0 || x >= FORGE_SPAN || z >= FORGE_SPAN || y >= FORGE_SPAN) { dropped.outOfBounds++; continue; }
    if (!kinds.has(k)) { dropped.unknownKind++; continue; }
    if (rect && !inRect(rect, x, z)) { dropped.notYourGround++; continue; }
    const key = (x * FORGE_SPAN + y) * FORGE_SPAN + z;
    if (seen.has(key)) { dropped.duplicate++; continue; }
    seen.add(key);
    blocks.push({ dx: x, dy: y, dz: z, k: k as BlockId });
  }
  if (blocks.length === 0 && !input.modelInscriptionId) return fail("No blocks remain after applying placement rules.");
  return { ok: true, reason: null, blocks, dropped };
}

/** Public parcel boundary shape returned to agents. */
export const parcelBoundaryJson = (r: ParcelRect) => ({
  index: r.index, name: `${r.index}`, rect: [r.x0, r.z0, r.x1, r.z1], ownedCells: r.cells.size, sizeClass: r.size,
});

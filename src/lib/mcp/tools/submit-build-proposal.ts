import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";
import { errorResult, myAddresses } from "../addresses";
import { buildProposalSchema } from "@/lib/agent-build-schema";

export default defineTool({
  name: "submit_build_proposal",
  title: "Submit build proposal",
  description: "Save a structured voxel build proposal (voxel tuples and/or a base64 .bwvx payload) for a BITMAP or parcel you hold. Ownership is checked live on chain and blocks are clipped to your own ground; nothing is inscribed, signed or placed — you review it in Land Forge.",
  inputSchema: buildProposalSchema,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const addresses = await myAddresses(ctx);
    if (addresses.length === 0) return errorResult("Link a wallet to your account first.");
    const { locateBitmapHolder } = await import("@/lib/locate-bitmap.server");
    const { parcelHoldersFor } = await import("@/lib/parcel-fief.server");
    const { buildBlockBytes } = await import("@/lib/block-bytes.server");
    const { parcelRects } = await import("@/lib/forge-parcels");
    const { validateBuildProposal, AGENT_SCHEMA } = await import("@/lib/agent-build-schema");
    const mine = new Set(addresses.map((a) => a.toLowerCase()));
    const holder = (await locateBitmapHolder(input.height).catch(() => null))?.ownerAddress ?? null;
    let role: "bitmap" | "parcel" | "none" = "none";
    let proposer = holder && mine.has(holder.toLowerCase()) ? holder : null;
    let parcels: number[] = [];
    if (proposer && input.parcelIndex === undefined) role = "bitmap";
    else {
      const ph = await parcelHoldersFor(input.height).catch(() => null);
      const held = (ph?.parcels ?? []).filter((p) => p.ownerAddress && mine.has(p.ownerAddress.toLowerCase()));
      parcels = held.map((p) => p.index);
      if (held.length) { role = "parcel"; proposer = held.find((p) => p.index === input.parcelIndex)?.ownerAddress ?? held[0]!.ownerAddress!; }
    }
    const block = role === "parcel" ? await buildBlockBytes(input.height).catch(() => null) : null;
    const rects = block && block.covered >= block.txCount ? parcelRects([...block.bytes]) : null;
    let tuples = input.blocks ?? [];
    if (input.bwvxBase64) {
      const { bwvxToTuples } = await import("@/lib/agent-build-schema");
      try { tuples = [...tuples, ...bwvxToTuples(input.bwvxBase64)]; } catch (e) { return errorResult(`Invalid .bwvx payload: ${(e as Error).message}`); }
    }
    const verdict = validateBuildProposal({ ...input, blocks: tuples }, { role, parcels }, rects);
    if (!verdict.ok || !proposer || role === "none") return errorResult(verdict.reason ?? "Not allowed.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.from("build_proposals").insert({
      user_id: ctx.getUserId()!, bitmap_height: input.height,
      parcel_index: role === "parcel" ? (input.parcelIndex ?? parcels[0]!) : null,
      proposer_address: proposer, role, block_count: verdict.blocks.length,
      blocks: verdict.blocks.map((b) => [b.dx, b.dy, b.dz, b.k]),
      model_inscription_id: input.modelInscriptionId ?? null, note: input.note ?? null,
    }).select("id, status").single();
    if (error) return errorResult(error.message);
    const payload = { schema: AGENT_SCHEMA, proposalId: data.id, status: data.status, role, accepted: verdict.blocks.length, dropped: verdict.dropped,
      review: `https://bitmapwin.app/forge?bitmap=${input.height}` };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});

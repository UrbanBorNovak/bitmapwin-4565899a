/**
 * Protocol recipes for humans and AI agents: the Guardian lifecycle and the
 * Land Forge build pipeline, described as ordered steps + tool schemas.
 * Docs-only contract — it never signs, pays or broadcasts anything.
 */

export type ProtocolStep = { id: string; title: string; route: string; detail: string; cost: string };

export const GUARDIAN_STEPS: ProtocolStep[] = [
  { id: "summon", title: "SUMMON", route: "/mint", detail: "Pick a BITMAP. Its block data (/r/blockinfo/<height>) decides body, wings, palette and name — no randomness.", cost: "Exact payment, one Guardian per block" },
  { id: "inscribe", title: "INSCRIBE", route: "/mint", detail: "Inscribe a Tag 11 delegate to the V7 Guardian master. Any Ordinals explorer renders the same 3D Guardian.", cost: "1,000 sat tribute + miner fee" },
  { id: "breed", title: "BREED", route: "/breed", detail: "Pair two inscribed Guardians (sire + dam). Offspring genome is a pure crossover seeded by both inscription ids.", cost: "546 sat pet tribute + miner fee" },
  { id: "verify", title: "VERIFY PEDIGREE", route: "/pet/$id", detail: "The pet page re-derives the genome from both parents and compares it with the inscribed metadata.", cost: "Free" },
];

export const FORGE_STEPS: ProtocolStep[] = [
  { id: "target", title: "PICK A BITMAP", route: "/forge", detail: "Enter or select a BITMAP you hold. The floor shows its real parcel layout from the block.", cost: "Free" },
  { id: "compose", title: "COMPOSE", route: "/forge", detail: "Place own blocks (up to 12,000) and drag up to 24 inscribed community pieces anywhere. M moves, R rotates.", cost: "Free to design" },
  { id: "encode", title: "ENCODE", route: "/forge", detail: "Choose Recursive (pieces referenced by id), Lean BWVX2 (greedy boxes) or standalone 3D HTML.", cost: "Smallest payload wins" },
  { id: "inscribe", title: "REINSCRIBE ON THE SAT", route: "/forge", detail: "Pay commit, sign the parent claim. The BITMAP sat goes in at input 0 and comes back at output 0; piece makers are paid in the reveal.", cost: "Miner fee + ≥546 sats per maker" },
];

export type AgentTool = { name: string; description: string; input: Record<string, string>; output: string };

export const AGENT_TOOLS: AgentTool[] = [
  { name: "guardian.resolve", description: "Read the Guardian for a BITMAP: DNA, on-chain name, inscription id if inscribed.", input: { height: "integer block height" }, output: "{ height, name, species, inscribed, inscriptionId | null }" },
  { name: "guardian.breed", description: "Deterministically preview a pet from two inscribed Guardian inscription ids. Same inputs always give the same pet.", input: { sireId: "inscription id", damId: "inscription id" }, output: "{ genome, traits, sire, dam }" },
  { name: "forge.encode", description: "Encode voxels [x,y,z,color] (color 0–10) as BWVX1 or BWVX2, returning the smaller.", input: { height: "integer", voxels: "Array<[x,y,z,color]>" }, output: "{ f: 'BWVX1'|'BWVX2', h, d: base64 }" },
  { name: "forge.assemble", description: "Build a BWVX_ASM recursive manifest from inscribed pieces + placements (max 24).", input: { height: "integer", pieces: "Array<{ id, x, y, z, rot }>", own: "optional voxels" }, output: "{ f: 'BWVX_ASM', h, parts, d? }" },
  { name: "emporium.verifyResident", description: "Check on chain whether an address holds a Bitmap Emporium Resident portrait (image child of 717328.bitmap) or a valid 717328 parcel. Public, read-only.", input: { address: "Bitcoin address" }, output: "{ address, height: 717328, resident, portraits: inscription ids, parcels: Array<{ index, inscriptionId }>, checkedAt }" },
  { name: "forge.tributes", description: "List the reveal outputs owed to verified piece makers (≥546 sats each, max 8).", input: { pieceIds: "inscription ids" }, output: "Array<{ address, sats }>" },
];

export const BWVX_SPEC = `Collection: THE OTHERTHINGS (umbrella brand)
  children: Guardians, Land (BITMAPs), Forge builds, Pets
  note: brand grouping only. Verified Ordinals parentage = Tag 3 parent spent in reveal.

CBOR metadata (RFC 8949)
  f  "BWVX1" | "BWVX2" | "BWVX_ASM"
  h  block height (integer)
  d  base64 payload  (legacy readers: meta.d ?? meta.b)
  p  optional parcel anchor
  l  optional lineage / tribute list
BWVX1  4 bytes per voxel  [X, Y, Z, ColorIdx]   palette 0–10
BWVX2  greedy boxes       [X, Y, Z, W, H, D, ColorIdx]
ASM    parts: [{ id, x, y, z, rot }]  fetched live via /r/metadata/<id>`;

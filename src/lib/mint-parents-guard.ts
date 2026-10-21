import { MASTER_PARENT_ID } from "@/lib/collection-parent";

export type ParentCheckInput = {
  parents: { inscriptionId: string; address?: string }[];
  bitmapParentId: string | null;
  masterInscriptionId: string | null;
  notes?: string[];
  notAwake?: boolean;
};
export type MissingParent = "BITMAP" | "COLLECTION";

/**
 * Fail closed: a voxel build may only be priced/signed when BOTH the matching
 * BITMAP (or held parcel) and the verified collection parent are resolved AND
 * actually included as spends. Anything else names what is missing.
 */
export function checkMintParents(res: ParentCheckInput): { ok: true } | { ok: false; missing: MissingParent[]; message: string } {
  const ids = new Set(res.parents.map((p) => p.inscriptionId.toLowerCase()));
  const missing: MissingParent[] = [];
  if (!res.bitmapParentId || !ids.has(res.bitmapParentId.toLowerCase())) missing.push("BITMAP");
  const master = res.masterInscriptionId?.toLowerCase() ?? null;
  if (master !== MASTER_PARENT_ID || !ids.has(MASTER_PARENT_ID)) missing.push("COLLECTION");
  if (!missing.length) return { ok: true };
  const label = { BITMAP: "THE MATCHING BITMAP PARENT", COLLECTION: "THE VERIFIED COLLECTION PARENT" } as const;
  const why = (res.notes ?? []).filter(Boolean).join(" · ");
  return { ok: false, missing, message: `MINT STOPPED — MISSING ${missing.map((m) => label[m]).join(" AND ")}${why ? ` (${why})` : ""}. NOTHING WAS SIGNED OR PAID.` };
}

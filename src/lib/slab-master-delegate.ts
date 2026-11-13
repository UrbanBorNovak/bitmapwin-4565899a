/**
 * BW-SLAB-MASTER-1: the Living Slab master renderer (Tag 11 delegate).
 * The master HTML is inscribed once. Each lean grade inscribes an empty body,
 * points Tag 11 at the master and carries its facts in Tag 5 metadata
 * (the same SlabCertFacts object as BW-SLAB-1). The master reads
 * /r/metadata/<self>, draws the card, then runs the newest BW-SLAB-MOD-1 module.
 */
import masterHtml from "@/lib/slab-master.html?raw";
import { SLAB_PROTOCOL, type SlabCertFacts } from "@/lib/slab-cert";

/** Set once the master is inscribed; until then grades inscribe the standalone card. */
export const SLAB_MASTER_DELEGATE_ID: string | null = "74dd215ccc6438ea94e7e8c82456b0f6a04d19238aab2453e8167b6c0c162131i0";
export const SLAB_MASTER_PROTOCOL = "BW-SLAB-MASTER-1";

export const isSlabMasterDelegate = (id: string | null | undefined) =>
  !!id && !!SLAB_MASTER_DELEGATE_ID && id === SLAB_MASTER_DELEGATE_ID;

/** Tag 5 metadata for a lean grade: exactly the certificate facts. */
export function slabDelegateMetadata(f: SlabCertFacts): Record<string, unknown> {
  return { ...f };
}

/** Facts from decoded Tag 5 metadata, or null when it is not a slab grade. */
export function parseSlabMeta(m: unknown): SlabCertFacts | null {
  if (!m || typeof m !== "object") return null;
  const f = m as SlabCertFacts;
  if (f.p !== SLAB_PROTOCOL || !Number.isInteger(f.h) || !Number.isInteger(f.grade)) return null;
  if (typeof f.name !== "string" || typeof f.cert !== "string" || !f.subs || typeof f.subs !== "object") return null;
  return f;
}

export function slabMasterHtml(): string {
  return masterHtml;
}

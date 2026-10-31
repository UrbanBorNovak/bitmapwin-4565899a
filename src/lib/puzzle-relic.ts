/**
 * Near-miss Relic previews. A find qualifies at RELIC_MIN_CHARS+ matching
 * Hash160 characters (the same threshold the server re-derives from the key
 * before it records a find). The preview keeps the exact match count out of 40
 * and only attaches land/build/Guardian facts that were read from chain.
 * Inscribing stays OFF until parentage and proof validation are verified.
 */
export const RELIC_MIN_CHARS = 5;
export const RELIC_TOTAL_CHARS = 40;
/** Hard switch: no relic inscription can be signed while false. */
export const RELIC_SIGNING_ENABLED = false;

export const qualifiesForRelic = (n: number) => Number.isInteger(n) && n >= RELIC_MIN_CHARS && n < RELIC_TOTAL_CHARS;

export type RelicProof = { verified: boolean; nibbles: number | null; foundAt: string | null };
export type RelicLand = {
  height: number | null;
  build: { inscriptionId: string; blockCount: number } | null;
  guardian: string | null;
};

export type RelicDraft = {
  p: "bitmapwin-relic"; v: 0; kind: "near-miss";
  match: string; nibbles: number; hash: string;
  proof: "server-verified" | "unverified";
  bitmap?: string; build?: string; guardian?: string;
  /** set only on the built-in demo; a demo can never be inscribed */
  demo?: true;
};

/** The JSON a relic would carry. Match count is copied verbatim, never rounded or upgraded. */
export function relicDraft(find: { nibbles: number; hash: string }, proof: RelicProof, land: RelicLand): RelicDraft {
  const d: RelicDraft = {
    p: "bitmapwin-relic", v: 0, kind: "near-miss",
    match: `${find.nibbles}/${RELIC_TOTAL_CHARS}`, nibbles: find.nibbles, hash: find.hash,
    proof: proof.verified && proof.nibbles === find.nibbles ? "server-verified" : "unverified",
  };
  if (land.height != null) d.bitmap = `${land.height}.bitmap`;
  if (land.height != null && land.build) d.build = land.build.inscriptionId;
  if (land.height != null && land.guardian) d.guardian = land.guardian;
  return d;
}

/** Why signing is blocked. Always blocked while RELIC_SIGNING_ENABLED is false. */
export function relicSigningBlockers(proof: RelicProof, find: { nibbles: number }): string[] {
  const out: string[] = [];
  if (!RELIC_SIGNING_ENABLED) out.push("Relic inscribing is switched off until parentage and proof checks are audited.");
  if (!proof.verified) out.push("This find has no server-verified record yet.");
  else if (proof.nibbles !== find.nibbles) out.push("Recorded match count differs from this find.");
  if (!qualifiesForRelic(find.nibbles)) out.push(`Needs ${RELIC_MIN_CHARS}+ matching characters.`);
  return out;
}

/** Fixed sample for previewing the badge. Not a real find: unverified, flagged demo, never signable. */
export const DEMO_RELIC: RelicDraft = {
  p: "bitmapwin-relic", v: 0, kind: "near-miss", match: "6/40", nibbles: 6,
  hash: "f6f543000000000000000000000000000000000d", proof: "unverified", bitmap: "840000.bitmap", demo: true,
};

/** Blockers for any draft; a demo is always blocked regardless of other state. */
export function draftSigningBlockers(d: RelicDraft): string[] {
  const out: string[] = [];
  if (d.demo) out.push("Demo badge: sample data, not a real find. It can never be inscribed.");
  if (!RELIC_SIGNING_ENABLED) out.push("Relic inscribing is switched off until parentage and proof checks are audited.");
  return out;
}

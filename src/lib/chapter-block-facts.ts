/** Verified per-block facts for chapters. Each field is either from a recorded/explorer source or null — never guessed. */
export type ChapterFacts = {
  height: number;
  txCount: number | null;
  avgFeeRate: number | null;
  minedAt: string | null;
  source: "records" | "explorer" | "mixed" | "unavailable";
  /** Why some field is missing, for honest display. */
  note: string | null;
};

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
export const EXPLORERS = ["https://mempool.space/api", "https://mempool.emzy.de/api"];

/** /block-height answers with a bare hash in plain text, so read text and parse JSON only when it is JSON. */
async function json<T>(f: Fetch, path: string): Promise<T | null> {
  for (const base of EXPLORERS) {
    try {
      const r = await f(`${base}${path}`, { signal: AbortSignal.timeout(8000) });
      if (r.status === 404) return null;
      if (!r.ok) continue;
      const body = (await r.text()).trim();
      try { return JSON.parse(body) as T; } catch { return body as T; }
    } catch { /* next mirror */ }
  }
  throw new Error("EXPLORER_UNAVAILABLE");
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

/** Merge stored records with a live explorer read for whatever is still missing. Hash must match the height. */
export async function resolveChapterFacts(
  height: number,
  stored: { txCount: number | null; avgFeeRate: number | null; minedAt: string | null },
  f: Fetch = fetch,
): Promise<ChapterFacts> {
  let { txCount, avgFeeRate, minedAt } = stored;
  const had = [txCount, avgFeeRate, minedAt].some((v) => v != null);
  if (txCount != null && avgFeeRate != null && minedAt != null) return { height, txCount, avgFeeRate, minedAt, source: "records", note: null };
  let note: string | null = null, used = false;
  try {
    const hash = await json<string>(f, `/block-height/${height}`);
    if (typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash)) {
      note = "BLOCK NOT MINED YET";
    } else {
      const b = await json<{ id?: string; height?: number; tx_count?: number; timestamp?: number; extras?: { avgFeeRate?: number } }>(f, `/v1/block/${hash}`);
      if (!b || b.id !== hash || b.height !== height) note = "EXPLORER RETURNED A DIFFERENT BLOCK";
      else {
        used = true;
        txCount ??= num(b.tx_count);
        avgFeeRate ??= num(b.extras?.avgFeeRate);
        if (minedAt == null && num(b.timestamp) != null) minedAt = new Date(b.timestamp! * 1000).toISOString();
        if (txCount == null || avgFeeRate == null || minedAt == null) note = "SOME FIELDS NOT REPORTED";
      }
    }
  } catch { note = "BLOCK EXPLORER UNREACHABLE"; }
  const source = used ? (had ? "mixed" : "explorer") : had ? "records" : "unavailable";
  return { height, txCount, avgFeeRate, minedAt, source, note };
}

/** How current the trade indexer is, judged only from its own last-run timestamp. */
export type Freshness = "live" | "delayed" | "stale" | "unknown";

export const LIVE_MAX_MS = 15 * 60_000;
export const DELAYED_MAX_MS = 60 * 60_000;

export function feedFreshness(lastRunAt: string | null | undefined, now = Date.now()): Freshness {
  if (!lastRunAt) return "unknown";
  const t = Date.parse(lastRunAt);
  if (!Number.isFinite(t)) return "unknown";
  const age = now - t;
  if (age <= LIVE_MAX_MS) return "live";
  if (age <= DELAYED_MAX_MS) return "delayed";
  return "stale";
}

/** Exact UTC stamp, e.g. "2026-10-11 17:14 UTC". */
export function utcStamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

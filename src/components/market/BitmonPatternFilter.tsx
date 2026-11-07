import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BLOCK_STATS_MAX_HEIGHT, blockStatsQuery } from "@/lib/block-stats";

/**
 * Bitmon shape-pattern filter: real Bitmons are @bitlodo's block shape groups
 * (block_stats.pattern), not Guardians. Pick a block, the filter keeps every
 * BITMAP sharing its verified pattern record.
 */
export function BitmonPatternFilter({ pattern, onPattern, count, loading, error, tooCommon }: { pattern: number | null; onPattern: (p: number | null) => void; count: number | null; loading: boolean; error: boolean; tooCommon?: number | null }) {
  const [input, setInput] = useState("");
  const h = Number(input);
  const valid = input !== "" && Number.isInteger(h) && h >= 0;
  const covered = valid && h <= BLOCK_STATS_MAX_HEIGHT;
  const stats = useQuery({ ...blockStatsQuery(h), enabled: covered });
  const found = stats.data?.pattern ?? null;

  return (
    <section className="min-w-0 rounded border border-border bg-card/60 p-3 backdrop-blur-sm" aria-label="Bitmon shape patterns">
      <header className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
        <span className="tracking-widest text-accent">BITMON PATTERNS</span>
        <span className="text-muted-foreground">BLOCK SHAPE GROUPS · VERIFIED BLOCK RECORDS 0–{BLOCK_STATS_MAX_HEIGHT.toLocaleString("en-US")} · NOT GUARDIANS</span>
        {pattern !== null && (
          <button type="button" onClick={() => onPattern(null)} className="ml-auto rounded border border-bitcoin px-2 py-1 text-bitcoin hover:bg-bitcoin/10">RESET PATTERN ✕</button>
        )}
      </header>
      <form className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px]" onSubmit={(e) => { e.preventDefault(); if (found !== null) onPattern(found); }}>
        <label className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">SAME BITMON AS BLOCK</span>
          <input value={input} onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="e.g. 5000" aria-label="Block height for Bitmon pattern"
            className="h-8 w-28 border border-input bg-card px-2 text-foreground outline-none focus:border-signal" />
        </label>
        <button type="submit" disabled={found === null} className="h-8 rounded border border-primary px-3 text-primary disabled:opacity-40">APPLY</button>
        <span className="text-muted-foreground">
          {!valid ? "" : !covered ? "NO VERIFIED PATTERN RECORD ABOVE THIS HEIGHT" : stats.isPending ? "READING RECORD…" : stats.isError ? "RECORD UNAVAILABLE" : found === null ? "NOT A BITMON — NO PATTERN RECORD" : <span data-no-translate>PATTERN #{found}</span>}
        </span>
      </form>
      {pattern !== null && (
        <p className="mt-2 font-mono text-[10px] text-muted-foreground" data-no-translate>
          ACTIVE: PATTERN #{pattern} · {loading ? "READING GROUP…" : tooCommon ? `${tooCommon.toLocaleString("en-US")} BLOCKS SHARE THIS SHAPE — TOO COMMON TO FILTER, NOTHING SHOWN` : error ? "GROUP UNAVAILABLE — NOTHING MATCHES" : `${count ?? 0} BLOCKS SHARE THIS SHAPE`} · BLOCKS WITHOUT A RECORD NEVER MATCH
        </p>
      )}
    </section>
  );
}

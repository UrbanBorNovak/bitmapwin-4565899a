import { useMemo, useState } from "react";
import { hex } from "@scure/base";
import { PUZZLE_71, hash160Of } from "@/lib/puzzle-sweep";
import { FULL_HASH_CHARS, nearTier, type NearMiss } from "@/lib/bitmap-lottery";

/**
 * 40-cell Hash160 strip: the target's 40 hex characters, with the newest
 * near-miss candidate lit up cell by cell where its prefix matches.
 * Purely visual; prefix matches are coincidence, not progress.
 */
export function HashStrip({ nears, bestNear, scanned, on }: { nears: NearMiss[]; bestNear: number; scanned: number; on: boolean }) {
  const target = useMemo(() => hex.encode(hash160Of(PUZZLE_71.address)), []);
  const [pick, setPick] = useState<number | null>(null);
  const shown = pick !== null ? nears[pick] : nears[0];
  const n = shown?.nibbles ?? 0;
  const sessionBest = nears.reduce((a, x) => Math.max(a, x.nibbles), 0);

  return (
    <section className="mt-6 rounded border border-accent/40 bg-card/60 p-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label text-accent">HASH160 STRIP · {n}/{FULL_HASH_CHARS}</p>
        <p className="text-muted-foreground">{on ? "LIVE" : "SCANNER OFF"}</p>
      </div>
      <div className="mt-3 grid grid-cols-10 gap-1 sm:grid-cols-20" data-no-translate>
        {Array.from({ length: FULL_HASH_CHARS }, (_, i) => {
          const hit = i < n;
          const c = shown?.hash[i];
          return (
            <div key={i} className={`flex flex-col items-center rounded border py-1 font-mono transition-colors ${hit ? "border-bitcoin bg-bitcoin/15 text-bitcoin" : "border-border text-muted-foreground"}`}>
              <span className="text-[10px] opacity-60">{target[i]}</span>
              <span className="text-sm">{c ?? "·"}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Top row: the prize address's 40 characters. Bottom row: {shown ? "a hash your scanner produced" : "waits for your scanner's first 4-character match"}.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="THIS HASH" value={shown ? `${n}/40 · ${nearTier(n).id}` : "—"} />
        <Stat label="SESSION BEST" value={sessionBest ? `${sessionBest}/40` : "—"} />
        <Stat label="DEVICE BEST" value={bestNear ? `${bestNear}/40` : "—"} />
        <Stat label="4+ MATCHES" value={`${nears.length} · ${scanned.toLocaleString()} keys`} />
      </div>
      {nears.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {nears.map((x, i) => (
            <button key={x.at + "-" + i} onClick={() => setPick(i === pick ? null : i)} className={`rounded border px-2 py-0.5 ${(pick ?? 0) === i ? "border-accent text-accent" : "border-border text-muted-foreground"}`}>{x.nibbles}/40</button>
          ))}
        </div>
      )}
      <p className="mt-2 rounded border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-[10px] text-foreground">Lit cells are luck, not progress. Each new key is a fresh coin flip; only all 40 matching unlocks the prize, and no partial match pays.</p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-border p-2"><p className="label text-muted-foreground">{label}</p><p className="mt-0.5 text-foreground">{value}</p></div>;
}

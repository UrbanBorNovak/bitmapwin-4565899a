import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useVerifiedBitmons } from "@/lib/use-verified-bitmons";
import { confirmedRarity } from "@/lib/bitmon-verify";
import { offersQuery } from "@/lib/offers";
import { formatSats } from "@/lib/trades";
import type { GuardianRarity } from "@/lib/bitmon";

export const BITMON_RARITIES: GuardianRarity[] = ["MYTHIC", "EPIC", "RARE", "COMMON"];

/** Bitmons rubrique: BITMAPs whose Guardian child is inscribed on chain, with live floor and rarity filter. */
export function BitmonsShelf({ rarity, onRarity, onOpen }: { rarity: GuardianRarity | "ALL"; onRarity: (r: GuardianRarity | "ALL") => void; onOpen: () => void }) {
  const { inhabited, checks } = useVerifiedBitmons();
  const offers = useQuery(offersQuery());
  const stats = useMemo(() => {
    const on = inhabited.data ?? new Map<number, string>();
    const counts: Record<string, number> = {};
    let unverified = 0, mismatch = 0;
    for (const c of checks.values()) { const r = confirmedRarity(c); if (r) counts[r] = (counts[r] ?? 0) + 1; else unverified++; if (c.status === "mismatch") mismatch++; }
    const asks = (offers.data ?? []).filter((o) => o.status === "open" && o.priceSats > 0 && o.bitmapHeight !== null && on.has(o.bitmapHeight));
    const floor = asks.length ? Math.min(...asks.map((a) => a.priceSats)) : null;
    return { total: on.size, counts, listed: asks.length, floor, unverified, mismatch };
  }, [inhabited.data, checks, offers.data]);

  return (
    <section className="rounded border border-border bg-card/60 p-3 backdrop-blur-sm" aria-label="Bitmons">
      <header className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
        <span className="tracking-widest text-accent">BITMONS</span>
        <span className="text-muted-foreground">BITMAPS WITH AN INSCRIBED GUARDIAN CHILD · VERIFIED ON CHAIN</span>
        <div className="ml-auto flex gap-1">
          <button onClick={onOpen} className="rounded border border-primary px-2 py-1 text-primary">BROWSE BITMONS</button>
          <Link to="/collections/guardians" className="rounded border border-border px-2 py-1 text-muted-foreground hover:text-accent">GUARDIAN MARKET →</Link>
          <Link to="/mint" className="rounded border border-border px-2 py-1 text-muted-foreground hover:text-accent">AWAKEN →</Link>
        </div>
      </header>
      <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
        <div><dt className="text-muted-foreground">INHABITED</dt><dd className="text-base text-foreground">{inhabited.isPending ? "…" : stats.total}</dd></div>
        <div><dt className="text-muted-foreground">LISTED</dt><dd className="text-base text-foreground">{stats.listed}</dd></div>
        <div><dt className="text-muted-foreground">FLOOR</dt><dd className="text-base text-primary">{stats.floor !== null ? formatSats(stats.floor) : "—"}</dd></div>
        <div><dt className="text-muted-foreground">RARITY</dt><dd className="flex flex-wrap gap-1 pt-1">
          {(["ALL", ...BITMON_RARITIES] as const).map((r) => (
            <button key={r} onClick={() => { onRarity(r); onOpen(); }} aria-pressed={rarity === r}
              className={`rounded border px-1.5 py-0.5 ${rarity === r ? "border-accent text-accent" : "border-border text-muted-foreground"}`}>
              {r}{r !== "ALL" && <span className="ml-1 opacity-70">{stats.counts[r] ?? 0}</span>}
            </button>
          ))}
        </dd></div>
      </dl>
      <p className="mt-2 font-mono text-[10px] text-muted-foreground">
        RARITY RE-DERIVED FROM EACH INSCRIBED BLOCK.
        {stats.unverified > 0 && <span className="ml-1 text-destructive">{stats.unverified} UNVERIFIED — BLOCK DATA NOT READ YET, NOT COUNTED OR FILTERABLE.</span>}
        {stats.mismatch > 0 && <span className="ml-1 text-accent">{stats.mismatch} STORED LABEL{stats.mismatch > 1 ? "S" : ""} CORRECTED TO CHAIN.</span>}
      </p>
      {!inhabited.isPending && stats.total === 0 && <p className="mt-2 font-mono text-[11px] text-muted-foreground">NO INSCRIBED BITMONS FOUND ON CHAIN YET.</p>}
    </section>
  );
}

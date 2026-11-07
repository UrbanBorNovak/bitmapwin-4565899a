import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useVerifiedBitmons } from "@/lib/use-verified-bitmons";
import { confirmedRarity } from "@/lib/bitmon-verify";
import { offersQuery } from "@/lib/offers";
import { formatSats } from "@/lib/trades";
import { SPECIES, type GuardianRarity, type GuardianSpecies } from "@/lib/bitmon";

export const BITMON_RARITIES: GuardianRarity[] = ["MYTHIC", "EPIC", "RARE", "COMMON"];

/** Bitmons rubrique: BITMAPs whose Guardian child is inscribed on chain, with live floor and rarity filter. */
export function BitmonsShelf({ rarity, onRarity, onOpen, species = "ALL", onSpecies, onReset }: { onReset?: () => void; rarity: GuardianRarity | "ALL"; onRarity: (r: GuardianRarity | "ALL") => void; onOpen: () => void; species?: GuardianSpecies | "ALL"; onSpecies?: (s: GuardianSpecies | "ALL") => void }) {
  const { inhabited, checks } = useVerifiedBitmons();
  const offers = useQuery(offersQuery());
  const stats = useMemo(() => {
    const on = inhabited.data ?? new Map<number, string>();
    const counts: Record<string, number> = {};
    const kinds: Record<string, number> = {};
    let unverified = 0, mismatch = 0;
    for (const c of checks.values()) { const r = confirmedRarity(c); if (r) counts[r] = (counts[r] ?? 0) + 1; else unverified++; if (c.status === "mismatch") mismatch++; if (c.status !== "unverified") kinds[c.species] = (kinds[c.species] ?? 0) + 1; }
    const asks = (offers.data ?? []).filter((o) => o.status === "open" && o.priceSats > 0 && o.bitmapHeight !== null && on.has(o.bitmapHeight));
    const floor = asks.length ? Math.min(...asks.map((a) => a.priceSats)) : null;
    return { total: on.size, counts, kinds, listed: asks.length, floor, unverified, mismatch };
  }, [inhabited.data, checks, offers.data]);

  return (
    <section className="@container min-w-0 rounded border border-border bg-card/60 p-3 backdrop-blur-sm" aria-label="Guardians">
      <header className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
        <span className="tracking-widest text-accent">INSCRIBED GUARDIANS</span>
        <span className="text-muted-foreground">BITMAPS WITH AN INSCRIBED GUARDIAN CHILD · VERIFIED ON CHAIN</span>
        <div className="flex flex-wrap gap-1 @lg:ml-auto">
          <button onClick={onOpen} className="rounded border border-primary px-2 py-1 text-primary">BROWSE GUARDIANS</button>
          {onReset && (rarity !== "ALL" || species !== "ALL") && (
            <button type="button" onClick={onReset} className="rounded border border-bitcoin px-2 py-1 text-bitcoin hover:bg-bitcoin/10">RESET GUARDIAN FILTERS ✕</button>
          )}
          <Link to="/collections/guardians" className="rounded border border-border px-2 py-1 text-muted-foreground hover:text-accent">GUARDIAN MARKET →</Link>
          <Link to="/mint" className="rounded border border-border px-2 py-1 text-muted-foreground hover:text-accent">AWAKEN →</Link>
        </div>
      </header>
      <dl className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px] @lg:grid-cols-4">
        <div><dt className="text-muted-foreground">INHABITED</dt><dd className="text-base text-foreground">{inhabited.isPending ? "…" : stats.total}</dd></div>
        <div><dt className="text-muted-foreground">LISTED</dt><dd className="text-base text-foreground">{stats.listed}</dd></div>
        <div><dt className="text-muted-foreground">FLOOR</dt><dd className="text-base text-primary">{stats.floor !== null ? formatSats(stats.floor) : "—"}</dd></div>
        <div className="col-span-3 @lg:col-span-1"><dt className="text-muted-foreground">RARITY</dt><dd className="flex flex-wrap gap-1 pt-1">
          {(["ALL", ...BITMON_RARITIES] as const).map((r) => (
            <button key={r} onClick={() => { onRarity(r); onOpen(); }} aria-pressed={rarity === r}
              className={`rounded border px-1.5 py-0.5 ${rarity === r ? "border-accent text-accent" : "border-border text-muted-foreground"}`}>
              {r}{r !== "ALL" && <span className="ml-1 opacity-70">{stats.counts[r] ?? 0}</span>}
            </button>
          ))}
        </dd></div>
      </dl>
      {onSpecies && (
        <div className="mt-3 flex flex-wrap items-center gap-1 font-mono text-[10px]" role="group" aria-label="Guardian species">
          <span className="mr-1 text-muted-foreground">CREATURE</span>
          {(["ALL", ...SPECIES.map((s) => s.name)] as const).map((s) => (
            <button key={s} type="button" onClick={() => { onSpecies(s); onOpen(); }} aria-pressed={species === s}
              className={`rounded border px-1.5 py-0.5 ${species === s ? "border-accent text-accent" : "border-border text-muted-foreground hover:text-accent"}`} data-no-translate>
              {s}{s !== "ALL" && <span className="ml-1 opacity-70">{stats.kinds[s] ?? 0}</span>}
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 font-mono text-[10px] text-muted-foreground">
        GUARDIAN SPECIES AND RARITY ARE READ FROM EACH INSCRIBED BLOCK.
        {stats.unverified > 0 && <span className="ml-1 text-destructive">{stats.unverified} UNVERIFIED — BLOCK DATA NOT READ YET, NOT COUNTED OR FILTERABLE.</span>}
        {stats.mismatch > 0 && <span className="ml-1 text-accent">{stats.mismatch} STORED LABEL{stats.mismatch > 1 ? "S" : ""} CORRECTED TO CHAIN.</span>}
      </p>
      {!inhabited.isPending && stats.total === 0 && <p className="mt-2 font-mono text-[11px] text-muted-foreground">NO INSCRIBED GUARDIANS FOUND ON CHAIN YET.</p>}
    </section>
  );
}

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { daysLeft, earningsFor, formatBit, leasesQuery } from "@/lib/leases";
import { shortenAddress } from "@/lib/registry";

/**
 * Holder earnings dashboard: BIT rent collected, active leases and what
 * expires next.
 */
export function LeaseEarnings({ addresses }: { addresses: string[] }) {
  const leases = useQuery(leasesQuery(500));
  const owned = useMemo(() => {
    const set = new Set(addresses.map((a) => a.toLowerCase()));
    return (leases.data ?? []).filter((l) => set.has(l.ownerAddress.toLowerCase()));
  }, [leases.data, addresses]);
  const rented = useMemo(() => {
    const set = new Set(addresses.map((a) => a.toLowerCase()));
    return (leases.data ?? []).filter((l) => set.has(l.lesseeAddress.toLowerCase()));
  }, [leases.data, addresses]);

  const stats = earningsFor(owned, addresses[0] ?? null);
  const totals = {
    totalCoins: owned.reduce((sum, l) => sum + l.totalCoins, 0),
    perDayCoins: owned
      .filter((l) => l.status === "active" && daysLeft(l.endsAt) > 0)
      .reduce((sum, l) => sum + l.rateCoinsPerDay, 0),
    active: owned.filter((l) => l.status === "active" && daysLeft(l.endsAt) > 0).length,
  };

  return (
    <section className="border border-border p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-sans text-sm font-bold tracking-widest">RENT EARNINGS</h2>
        <Link to="/leases" className="font-mono text-[11px] text-muted-foreground hover:text-foreground">
          LEASE MARKET →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="COLLECTED" value={formatBit(totals.totalCoins)} />
        <Stat label="PER DAY" value={formatBit(totals.perDayCoins)} />
        <Stat label="ACTIVE" value={String(totals.active)} />
        <Stat label="LEASES" value={String(owned.length)} />
      </div>

      {stats.nextExpiry ? (
        <p className="font-mono text-[11px] text-muted-foreground">
          &gt; NEXT LEASE ENDS IN {daysLeft(stats.nextExpiry)} DAY(S)<span className="blink">_</span>
        </p>
      ) : null}

      {owned.length > 0 ? (
        <ul className="space-y-1 font-mono text-[11px]">
          {owned.slice(0, 8).map((l) => (
            <li key={l.id} className="flex flex-wrap justify-between gap-2">
              <Link to="/bitmap/$block" params={{ block: String(l.bitmapHeight) }} className="hover:text-accent">
                {l.bitmapHeight}.BITMAP
              </Link>
              <span className="text-muted-foreground">
                {shortenAddress(l.lesseeAddress)} · {formatBit(l.totalCoins)} ·{" "}
                {l.status === "active" && daysLeft(l.endsAt) > 0
                  ? `${daysLeft(l.endsAt)}D LEFT`
                  : "ENDED"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-mono text-[11px] text-muted-foreground">
          &gt; NO RENT YET — OFFER A BITMAP FOR LEASE FROM ITS PAGE<span className="blink">_</span>
        </p>
      )}

      {rented.length > 0 ? (
        <div className="border-t border-border pt-3">
          <p className="label mb-2">BITMAPS I RENT</p>
          <ul className="space-y-1 font-mono text-[11px]">
            {rented.slice(0, 8).map((l) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-2">
                <Link to="/bitmap/$block" params={{ block: String(l.bitmapHeight) }} className="hover:text-accent">
                  {l.bitmapHeight}.BITMAP
                </Link>
                <span className="text-muted-foreground">
                  {l.status === "active" && daysLeft(l.endsAt) > 0
                    ? `BUILD RIGHTS · ${daysLeft(l.endsAt)}D LEFT`
                    : "EXPIRED"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="font-mono text-sm">{value}</p>
    </div>
  );
}

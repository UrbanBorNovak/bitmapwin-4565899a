import { useMemo, useState } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Club } from "@/lib/clubs";

/**
 * Holder concentration for one club: how many bitmaps in the height range each
 * address actually holds, read from the on-chain resolved owner index.
 */

const PAGE = 1000;
const MAX_ROWS = 10_000;

async function fetchClubOwners(min: number, max: number): Promise<string[]> {
  const owners: string[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await supabase
      .from("bitmap_index")
      .select("owner_address")
      .eq("is_valid", true)
      .not("owner_address", "is", null)
      .gte("block_height", min)
      .lte("block_height", max)
      .order("block_height", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) if (row.owner_address) owners.push(row.owner_address);
    if (rows.length < PAGE) break;
  }
  return owners;
}

const clubOwnersQuery = (club: Club) =>
  queryOptions({
    queryKey: ["club-owners", club.id],
    queryFn: () => fetchClubOwners(club.min, club.max),
    staleTime: 300_000,
  });

function shortAddr(a: string) {
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-5)}` : a;
}

const BUCKETS = [
  { label: "1", test: (n: number) => n === 1 },
  { label: "2–5", test: (n: number) => n >= 2 && n <= 5 },
  { label: "6–20", test: (n: number) => n >= 6 && n <= 20 },
  { label: "21–100", test: (n: number) => n >= 21 && n <= 100 },
  { label: "100+", test: (n: number) => n > 100 },
];

export function ClubHolderChart({ club }: { club: Club }) {
  const owners = useQuery(clubOwnersQuery(club));
  const [hoveredAddress, setHoveredAddress] = useState<string | null>(null);
  const [hoveredBucket, setHoveredBucket] = useState<string | null>(null);

  const model = useMemo(() => {
    const rows = owners.data ?? [];
    if (rows.length === 0) return null;
    const counts = new Map<string, number>();
    for (const a of rows) counts.set(a, (counts.get(a) ?? 0) + 1);
    const ranked = [...counts.entries()]
      .map(([address, held]) => ({ address, held }))
      .sort((a, b) => b.held - a.held);
    const total = rows.length;
    const top = ranked.slice(0, 12);
    const maxHeld = top[0]?.held ?? 1;
    const top10 = ranked.slice(0, 10).reduce((s, r) => s + r.held, 0);
    const singles = ranked.filter((r) => r.held === 1).length;
    const buckets = BUCKETS.map((b) => ({
      label: b.label,
      holders: ranked.filter((r) => b.test(r.held)).length,
    }));
    const maxBucket = Math.max(1, ...buckets.map((b) => b.holders));
    return {
      total,
      holders: ranked.length,
      top,
      maxHeld,
      avg: total / ranked.length,
      top10Share: (top10 / total) * 100,
      singles,
      buckets,
      maxBucket,
      truncated: total >= MAX_ROWS,
    };
  }, [owners.data]);

  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
        <div className="border-l-2 border-primary pl-3">
          <h2 className="font-mono text-sm font-bold uppercase text-foreground">HOLDER CONCENTRATION</h2>
          <p className="label mt-1">ON-CHAIN OWNERSHIP DISTRIBUTION</p>
        </div>
        <span className="label">
          {owners.isPending
            ? "READING OWNER INDEX…"
            : model
              ? `${model.holders.toLocaleString("en-US")} ADDRESSES · ${model.total.toLocaleString("en-US")} OWNED ${club.short} BITMAPS${model.truncated ? " (SAMPLE)" : ""}`
              : club.short}
        </span>
      </header>

      {model ? (
        <>
          <div className="grid grid-cols-2 divide-x divide-y divide-border border-b border-border sm:grid-cols-4 sm:divide-y-0">
            <Metric k="AVG PER ADDRESS" v={model.avg.toFixed(2)} />
            <Metric k="LARGEST HOLDER" v={`${model.maxHeld.toLocaleString("en-US")} BITMAPS`} accent />
            <Metric k="TOP 10 SHARE" v={`${model.top10Share.toFixed(1)}%`} />
            <Metric k="SINGLE-BITMAP HOLDERS" v={model.singles.toLocaleString("en-US")} />
          </div>

          <div className="space-y-2 p-5">
            {model.top.map((row, i) => (
              <div
                key={row.address}
                className="flex items-center gap-3 transition-opacity duration-200"
                style={{ opacity: hoveredAddress && hoveredAddress !== row.address ? 0.28 : 1 }}
                onPointerEnter={() => setHoveredAddress(row.address)}
                onPointerLeave={() => setHoveredAddress(null)}
              >
                <span className="label w-8 shrink-0">#{String(i + 1).padStart(2, "0")}</span>
                <Link
                  to="/profile/$address"
                  params={{ address: row.address }}
                  className="w-[9rem] shrink-0 truncate font-mono text-xs hover:text-primary"
                  title={row.address}
                >
                  {shortAddr(row.address)}
                </Link>
                <div className="h-4 flex-1 overflow-hidden border border-border bg-surface">
                  <div
                    className="club-holder-bar h-full"
                    style={{ width: `${Math.max(2, (row.held / model.maxHeld) * 100)}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right font-mono text-xs">
                  {row.held.toLocaleString("en-US")} ·{" "}
                  <span className="text-muted-foreground">
                    {((row.held / model.total) * 100).toFixed(1)}%
                  </span>
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-5 gap-2 border-t border-border px-5 pt-5">
            {model.buckets.map((b) => (
              <div
                key={b.label}
                className="flex flex-col items-center justify-end gap-2 transition-opacity duration-200"
                style={{ opacity: hoveredBucket && hoveredBucket !== b.label ? 0.28 : 1 }}
                onPointerEnter={() => setHoveredBucket(b.label)}
                onPointerLeave={() => setHoveredBucket(null)}
              >
                <span className="font-mono text-[11px] text-muted-foreground">
                  {b.holders.toLocaleString("en-US")}
                </span>
                <div className="flex h-24 w-full items-end overflow-hidden border border-border bg-surface">
                  <div
                    className="club-holder-column w-full"
                    style={{ height: `${Math.max(2, (b.holders / model.maxBucket) * 100)}%` }}
                  />
                </div>
                <span className="label">{b.label}</span>
              </div>
            ))}
          </div>
          <p className="label px-5 pb-5 pt-2 text-muted-foreground">
            ADDRESSES GROUPED BY HOW MANY {club.short} BITMAPS THEY HOLD
          </p>
        </>
      ) : (
        <div className="flex h-[220px] items-center justify-center">
          <span className="label text-muted-foreground">
            {owners.isPending ? "SYNC" : "NO RESOLVED OWNERS IN THIS CLUB YET"}
          </span>
        </div>
      )}
    </section>
  );
}

function Metric({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="p-3">
      <div className="label">{k}</div>
      <div className={`mt-1 font-mono text-sm ${accent ? "text-primary" : ""}`}>{v}</div>
    </div>
  );
}

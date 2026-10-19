import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { offersQuery } from "@/lib/offers";
import { openBidsQuery } from "@/lib/bids";
import { fetchRecentTrades } from "@/lib/trade-store";
import { formatSats } from "@/lib/trades";
import { CLUBS, inClub } from "@/lib/clubs";
import { hasTrait, OFFICIAL_TRAITS, TRAIT_GROUPS } from "@/lib/traits";
import { GALLERY_COLLECTIONS } from "@/lib/bitmap-collections";
import { inhabitedQuery } from "@/lib/inhabited.functions";
import { useGalleryIndex } from "@/lib/use-gallery-index";
import { sortMatrix, traitMatrix, type MatrixSegment, type MatrixSort } from "@/lib/trait-matrix";

const SEGMENTS: MatrixSegment[] = [
  ...CLUBS.filter((c) => !c.future).map((c) => ({ key: `club:${c.id}`, kind: "club" as const, id: c.id, label: c.short, group: "CLUBS", match: (h: number) => inClub(h, c) })),
  ...OFFICIAL_TRAITS.map((t) => ({ key: `trait:${t.id}`, kind: "trait" as const, id: t.id, label: t.label, group: TRAIT_GROUPS.find((g) => g.id === t.group)?.label ?? t.group, match: (h: number) => hasTrait(h, t.id) })),
];

/** Trait Floor Radar: live floors, listed density and 24h volume per club/trait; clicking a row pivots the terminal. */
export function TraitMatrix({ activeKey, onPick, scoped = false }: { activeKey: string | null; scoped?: boolean; onPick: (seg: MatrixSegment | null) => void }) {
  const offers = useQuery(offersQuery());
  const bids = useQuery(openBidsQuery(500));
  const tape = useQuery({ queryKey: ["live-trades-feed"], queryFn: () => fetchRecentTrades(150), staleTime: 15_000, refetchInterval: 60_000 });
  const [now, setNow] = useState(0);
  useEffect(() => setNow(Date.now()), [tape.dataUpdatedAt]);
  const [sort, setSort] = useState<MatrixSort>("listed");
  const [q, setQ] = useState("");
  const [hideEmpty, setHideEmpty] = useState(true);

  const gi = useGalleryIndex();
  const inhabited = useQuery(inhabitedQuery());
  const segments = useMemo<MatrixSegment[]>(() => [
    ...GALLERY_COLLECTIONS.map((g) => {
      const miss = g.maxHeight !== undefined ? 0 : gi.missing(g.id);
      const note = g.maxHeight !== undefined ? undefined : gi.error ? "INDEX UNAVAILABLE" : gi.loading ? "RESOLVING L1…" : miss ? `${miss} WITHOUT BLOCK RECORD` : undefined;
      return { key: `gallery:${g.id}`, kind: "gallery" as const, id: g.id, label: g.short, group: "GALLERIES", match: (h: number) => gi.match(g.id, h), note };
    }),
    { key: "bitmons", kind: "gallery" as const, id: "bitmons", label: "GUARDIANS", group: "GUARDIANS", match: (h: number) => !!inhabited.data?.has(h), note: inhabited.isPending ? "READING CHAIN…" : inhabited.isError ? "INDEX UNAVAILABLE" : undefined },
    ...SEGMENTS,
  ], [gi, inhabited.data, inhabited.isPending, inhabited.isError]);
  const rows = useMemo(() => {
    const asks = (offers.data ?? []).filter((o) => o.status === "open" && o.priceSats > 0).map((o) => ({ priceSats: o.priceSats, height: o.bitmapHeight }));
    const bs = (bids.data ?? []).filter((b) => b.priceSats > 0).map((b) => ({ priceSats: b.priceSats, height: b.bitmapHeight }));
    const sales = (tape.data ?? []).filter((t) => t.price_sats > 0).map((t) => ({ priceSats: t.price_sats, height: t.bitmap_height, at: new Date(t.block_time ?? t.created_at).getTime() }));
    return traitMatrix(segments, asks, bs, sales, now);
  }, [offers.data, bids.data, tape.data, now, segments]);

  const shown = sortMatrix(rows, sort).filter((r) => (!hideEmpty || r.listed || r.vol24 || r.bestBid || r.seg.key === activeKey || r.seg.kind === "gallery") && (!q || r.seg.label.toLowerCase().includes(q.toLowerCase()) || r.seg.group.toLowerCase().includes(q.toLowerCase())));
  const loading = offers.isPending || bids.isPending;

  return (
    <section className="min-w-0 max-w-full rounded border border-border bg-card/60 backdrop-blur-sm" aria-label="Trait floor radar">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 font-mono text-[11px]">
        <span className="tracking-widest text-accent">TRAIT FLOOR RADAR</span>
        <span className="text-muted-foreground">CLICK A ROW TO PIVOT BOOK · DEPTH · TAPE</span>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="FILTER TRAITS" aria-label="Filter traits" className="w-32 rounded border border-border bg-background px-2 py-1 text-[11px]" />
          {(["listed", "floor", "volume"] as MatrixSort[]).map((s) => (
            <button key={s} onClick={() => setSort(s)} className={`rounded border px-2 py-1 ${sort === s ? "border-accent text-accent" : "border-border text-muted-foreground"}`}>{s === "listed" ? "DENSITY" : s === "floor" ? "FLOOR" : "24H VOL"}</button>
          ))}
          <button onClick={() => setHideEmpty((v) => !v)} className={`rounded border px-2 py-1 ${hideEmpty ? "border-border text-muted-foreground" : "border-accent text-accent"}`}>{hideEmpty ? "SHOW EMPTY" : "HIDE EMPTY"}</button>
          {(activeKey || scoped) && <button onClick={() => onPick(null)} className="rounded border border-primary px-2 py-1 text-primary">RESET TO FULL MARKET</button>}
        </div>
      </header>
      <div className="max-h-80 overflow-auto">
        <table className="w-full font-mono text-[11px]">
          <thead className="sticky top-0 bg-card text-muted-foreground">
            <tr className="text-left"><th className="px-3 py-1">TRAIT</th><th className="px-2">GROUP</th><th className="px-2 text-right">FLOOR</th><th className="px-2 text-right">BEST BID</th><th className="px-2 text-right">LISTED</th><th className="px-2 text-right">DENSITY</th><th className="px-3 text-right">24H VOL</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">READING BOOK…</td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">{q ? "NO TRAIT MATCHES THAT FILTER" : "NO TRAIT HAS LISTINGS, BIDS OR 24H SALES RIGHT NOW — TAP SHOW EMPTY"}</td></tr>
            ) : shown.map((r) => {
              const active = r.seg.key === activeKey;
              return (
                <tr key={r.seg.key} onClick={() => onPick(active ? null : r.seg)} aria-pressed={active} className={`cursor-pointer border-t border-border/50 hover:bg-accent/10 ${active ? "bg-accent/15 text-accent" : ""}`}>
                  <td className="px-3 py-1">{active ? "◉ " : ""}{r.seg.label}{r.seg.note && <span className={`ml-2 text-[10px] ${r.seg.note === "INDEX UNAVAILABLE" ? "text-destructive" : "text-muted-foreground"}`}>{r.seg.note}</span>}</td>
                  <td className="px-2 text-muted-foreground">{r.seg.group}</td>
                  <td className="px-2 text-right text-primary">{r.floor !== null ? formatSats(r.floor) : "—"}</td>
                  <td className="px-2 text-right">{r.bestBid !== null ? formatSats(r.bestBid) : "—"}</td>
                  <td className="px-2 text-right">{r.listed}</td>
                  <td className="px-2 text-right">
                    <span className="inline-block h-1.5 w-12 rounded bg-muted align-middle"><span className="block h-full rounded bg-accent" style={{ width: `${Math.round(r.share * 100)}%` }} /></span> {(r.share * 100).toFixed(0)}%
                  </td>
                  <td className="px-3 text-right">{r.vol24 ? `${formatSats(r.vol24)} · ${r.fills24}` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

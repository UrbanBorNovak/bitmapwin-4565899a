import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { shortenAddress } from "@/lib/registry";

type Ledger = {
  eras: { vanguard: number; rush: number; consolidation: number; modern: number; total: number };
  vanguard: { address: string; held: number; first_genesis: number; lowest_block: number }[];
  diamond: { address: string; held: number; vanguard: number }[];
  traders: { address: string; trades: number; buys: number; sells: number; volume_sats: number }[];
  traced_sales: number;
};

const fmt = (n: number) => Number(n).toLocaleString("en-US");
const ERAS = [
  ["vanguard", "GENESIS VANGUARD", "792,435 – 793,499"],
  ["rush", "THE GREAT RUSH", "793,500 – 795,999"],
  ["consolidation", "CONSOLIDATION", "796,000 – 799,999"],
  ["modern", "MODERN FRONTIER", "800,000 +"],
] as const;

function Addr({ a }: { a: string }) {
  return <Link to="/profile/$address" params={{ address: a }} className="text-bitcoin hover:underline" data-no-translate>{shortenAddress(a)}</Link>;
}

/** Holder ledger built from indexed BITMAP inscriptions and traced on-chain sales. */
export function ArchaeologyLedger() {
  const q = useQuery({
    queryKey: ["archaeology-ledger"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("archaeology_ledger" as never);
      if (error) throw error;
      return data as unknown as Ledger;
    },
    staleTime: 10 * 60_000,
  });
  const d = q.data;

  return (
    <section className="mt-12">
      <p className="label text-bitcoin">05 · HOLDER LEDGER</p>
      <h2 className="display mt-2 text-xl md:text-2xl">ERAS, GENESIS HOLDERS &amp; DIAMOND HANDS</h2>
      <p className="mt-2 max-w-3xl font-mono text-[11px] leading-relaxed text-muted-foreground">
        Counted from {d ? fmt(d.eras.total) : "…"} indexed BITMAP inscriptions by the Bitcoin block each was inscribed in, and {d ? fmt(d.traced_sales) : "…"} traced on-chain sales. Wallets are current indexed holders, not necessarily the original minters.
      </p>
      {q.isError ? <p className="mt-6 font-mono text-[11px] text-destructive">LEDGER UNAVAILABLE — <button className="underline" onClick={() => void q.refetch()}>RETRY</button></p> : null}

      <div className="mt-6 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {ERAS.map(([k, label, range]) => {
          const pct = d && d.eras.total ? (d.eras[k] / d.eras.total) * 100 : 0;
          return (
            <div key={k} className="bg-card p-4">
              <p className="label">{label}</p>
              <p className="display mt-2 text-2xl text-bitcoin" data-no-translate>{d ? fmt(d.eras[k]) : "—"}</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">INSCRIBED IN BLOCKS {range}</p>
              <div className="mt-3 h-1 bg-border"><div className="h-1 bg-signal" style={{ width: `${Math.max(pct, 0.3)}%` }} /></div>
              <p className="mt-1 font-mono text-[10px] text-signal" data-no-translate>{d ? `${pct < 0.1 ? pct.toFixed(3) : pct.toFixed(1)}% OF INDEX` : ""}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Board title="GENESIS VANGUARD HOLDERS" note="Wallets holding the most of the first 224 BITMAPs ever inscribed.">
          {d?.vanguard.map((r, i) => <Row key={r.address} i={i} left={<Addr a={r.address} />} mid={`LOWEST ${r.lowest_block}.BITMAP · FROM BLOCK ${fmt(r.first_genesis)}`} right={`${r.held}`} />)}
        </Board>
        <Board title="DIAMOND HANDS" note="Largest holders of 2023 BITMAPs (Vanguard + Great Rush) with zero traced sales.">
          {d?.diamond.map((r, i) => <Row key={r.address} i={i} left={<Addr a={r.address} />} mid={r.vanguard ? `${r.vanguard} VANGUARD` : "NEVER SOLD (TRACED)"} right={fmt(r.held)} />)}
        </Board>
      </div>

      <div className="mt-6">
        <Board title="MOST ACTIVE TRADERS" note="Traced on-chain BITMAP sales, buys and sells combined.">
          {d?.traders.map((r, i) => <Row key={r.address} i={i} left={<Addr a={r.address} />} mid={`${r.buys} BUYS · ${r.sells} SELLS · ${fmt(r.volume_sats)} SATS`} right={`${r.trades}`} />)}
        </Board>
      </div>
    </section>
  );
}

function Board({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-card">
      <header className="border-b border-border p-3"><p className="label text-signal">{title}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{note}</p></header>
      <ol>{children ?? <li className="p-3 font-mono text-[11px] text-muted-foreground">READING THE CHAIN…</li>}</ol>
    </div>
  );
}

function Row({ i, left, mid, right }: { i: number; left: React.ReactNode; mid: string; right: string }) {
  return (
    <li className="flex items-center gap-3 border-b border-border/60 px-3 py-2 font-mono text-[11px] last:border-b-0">
      <span className="w-5 text-muted-foreground">{i + 1}</span>
      <span className="shrink-0">{left}</span>
      <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">{mid}</span>
      <span className="text-foreground" data-no-translate>{right}</span>
    </li>
  );
}

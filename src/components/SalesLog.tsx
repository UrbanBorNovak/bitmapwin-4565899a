import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { recentTradesQuery } from "@/lib/trade-store";
import { formatSats } from "@/lib/trades";

/**
 * Terminal-style log of every real on-chain bitmap sale, newest first.
 * Rows come straight from traced Bitcoin transactions that paid the seller.
 */

function short(address: string | null) {
  if (!address) return "UNKNOWN";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function when(row: { block_time: string | null; created_at: string }) {
  const iso = row.block_time ?? row.created_at;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}


export function SalesLog({ limit = 40 }: { limit?: number }) {
  const { data, isPending } = useQuery(recentTradesQuery(120));
  const sales = (data ?? [])
    .filter((row) => {
      if (row.price_sats <= 0) return false;
      const t = new Date(row.block_time ?? row.created_at).getTime();
      return Number.isFinite(t);
    })
    .slice(0, limit);

  return (
    <section className="border border-border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="border-l-2 border-primary pl-3 font-mono text-sm font-bold text-foreground">
            SALES LOG
          </h2>
          <p className="label mt-2 pl-[14px]">CONFIRMED ON-CHAIN SALES</p>
        </div>
        <span className="label">{sales.length} SALE(S)</span>
      </div>


      {isPending ? (
        <p className="p-6 font-mono text-xs text-muted-foreground">
          &gt; READING SALES FROM CHAIN<span className="blink">_</span>
        </p>
      ) : sales.length === 0 ? (
        <p className="p-6 font-mono text-xs text-muted-foreground">&gt; NO SALES RECORDED YET</p>
      ) : (
        <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
          {sales.map((row) => (
            <li
              key={row.txid}
              className="grid grid-cols-1 gap-2 p-4 font-mono text-[11px] sm:grid-cols-12 sm:items-center"
            >
              <Link
                to="/bitmap/$block"
                params={{ block: String(row.bitmap_height) }}
                className="font-bold uppercase text-foreground hover:text-primary sm:col-span-3"
              >
                {row.bitmap_height}.BITMAP
              </Link>
              <span className="text-primary sm:col-span-2">{formatSats(row.price_sats)}</span>
              <span className="text-muted-foreground sm:col-span-3">
                {short(row.seller_address)} → {short(row.buyer_address)}
              </span>
              <span className="text-muted-foreground sm:col-span-2">{when(row)}</span>
              <span className="sm:col-span-2 sm:text-right">
                {row.block_height ? (
                  <a
                    href={`https://mempool.space/tx/${row.txid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground underline hover:text-primary"
                  >
                    BLK {row.block_height}
                  </a>
                ) : (
                  <a
                    href={`https://mempool.space/tx/${row.txid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    IN MEMPOOL
                  </a>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

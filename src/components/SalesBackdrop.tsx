import { useQuery } from "@tanstack/react-query";
import { recentTradesQuery } from "@/lib/trade-store";
import { formatSats } from "@/lib/trades";

/**
 * Ambient background feed of real on-chain bitmap sales. Purely decorative:
 * fixed behind the app, non-interactive, and only ever showing traded rows that
 * actually paid the seller.
 */
export function SalesBackdrop() {
  const { data } = useQuery({ ...recentTradesQuery(60), staleTime: 60_000 });

  const sales = (data ?? []).filter((row) => row.price_sats > 0).slice(0, 40);
  if (sales.length === 0) return null;

  const lines = sales.map((row) => {
    const buyer = row.buyer_address ? `${row.buyer_address.slice(0, 6)}…${row.buyer_address.slice(-4)}` : "UNKNOWN";
    const block = row.block_height ? `BLK ${row.block_height}` : "MEMPOOL";
    return `${row.bitmap_height}.BITMAP · ${formatSats(row.price_sats)} · ${buyer} · ${block}`;
  });

  // duplicated so each column loops seamlessly
  const columns = [0, 1, 2].map((col) => {
    const shifted = [...lines.slice(col * 4), ...lines.slice(0, col * 4)];
    return [...shifted, ...shifted];
  });

  return (
    <div aria-hidden data-no-translate className="sales-backdrop">
      {columns.map((column, index) => (
        <div
          key={index}
          className="sales-backdrop__column"
          style={{ animationDuration: `${70 + index * 26}s`, animationDelay: `-${index * 12}s` }}
        >
          {column.map((line, i) => (
            <span key={`${index}-${i}`} className="sales-backdrop__line">
              {line}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

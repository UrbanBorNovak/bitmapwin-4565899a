import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { COIN, coinBalanceQuery, coinLedgerQuery, formatBit, reasonLabel } from "@/lib/coins";

/** BIT balance and recent movement for the addresses this wallet controls. */
export function CoinWallet({ addresses }: { addresses: string[] }) {
  const unique = Array.from(new Set(addresses.filter(Boolean)));
  const balances = useQuery(coinBalanceQuery(unique));
  const ledger = useQuery(coinLedgerQuery(unique, 8));

  const balance = (balances.data ?? []).reduce((sum, b) => sum + b.balance, 0);
  const earned = (balances.data ?? []).reduce((sum, b) => sum + b.earnedTotal, 0);

  return (
    <section className="border border-border p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-sans text-sm font-bold tracking-widest">{COIN} BALANCE</h2>
        <Link to="/coins" className="font-mono text-[11px] text-muted-foreground hover:text-foreground">
          {COIN} ECONOMY →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="label">SPENDABLE</p>
          <p className="font-mono text-sm">{formatBit(balance)}</p>
        </div>
        <div>
          <p className="label">LIFETIME EARNED</p>
          <p className="font-mono text-sm">{formatBit(earned)}</p>
        </div>
      </div>

      {(ledger.data ?? []).length === 0 ? (
        <p className="font-mono text-[11px] text-muted-foreground">
          &gt; EARN {COIN} DAILY FROM BUILD VISITORS, TRADES AND LEASES
          <span className="blink">_</span>
        </p>
      ) : (
        <ul className="space-y-1 font-mono text-[11px]">
          {(ledger.data ?? []).map((entry) => (
            <li key={entry.id} className="flex justify-between gap-2">
              <span>{reasonLabel(entry.reason)}</span>
              <span className={entry.delta >= 0 ? "text-accent" : "text-muted-foreground"}>
                {entry.delta >= 0 ? "+" : "−"}
                {formatBit(Math.abs(entry.delta))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

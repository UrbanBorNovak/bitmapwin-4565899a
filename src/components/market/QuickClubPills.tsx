import { useMemo } from "react";
import { CLUBS, inClub, type ClubId } from "@/lib/clubs";
import { formatSats } from "@/lib/trades";
import type { RegistryParcel } from "@/lib/registry";
import { useFees } from "@/components/market/TradeSlip";

/** Satflow-style one-tap height pills with live floor + listing count, plus network fee tag. */
export function QuickClubPills({ listed, active, onPick }: { listed: RegistryParcel[]; active: ClubId | "any"; onPick: (c: ClubId | "any") => void }) {
  const fees = useFees();
  const stats = useMemo(() => CLUBS.filter((c) => !c.future).map((c) => {
    const asks = listed.filter((p) => p.listedSats && inClub(p.bitmapHeight, c)).map((p) => p.listedSats!);
    return { c, count: asks.length, floor: asks.length ? Math.min(...asks) : null };
  }), [listed]);
  return (
    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 border-t border-border pt-2" role="group" aria-label="Quick height filters">
      {stats.map(({ c, count, floor }) => {
        const on = active === c.id;
        return (
          <button key={c.id} type="button" aria-pressed={on} onClick={() => onPick(on ? "any" : c.id)}
            className={`flex h-8 items-center gap-2 border px-2 font-mono text-[10px] ${on ? "border-bitcoin bg-bitcoin/10 text-bitcoin" : "border-border text-muted-foreground hover:border-signal hover:text-signal"}`}>
            <span>{c.short}</span>
            <span className="opacity-80" data-no-translate>{floor ? `FLOOR ${formatSats(floor)}` : "NO ASKS"} · {count}</span>
          </button>
        );
      })}
      <span className="w-full font-mono text-[10px] text-signal sm:ml-auto sm:w-auto" data-no-translate title="Live network fee rate from mempool.space">
        {fees.data ? `FEES ${fees.data.fastestFee} / ${fees.data.halfHourFee} / ${fees.data.economyFee} SAT/VB` : "FEES —"}
      </span>
    </div>
  );
}

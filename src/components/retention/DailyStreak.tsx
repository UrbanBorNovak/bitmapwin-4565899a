import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { claimDailyStreakFn, dailyStreakStatusFn } from "@/lib/coins.functions";
import { STREAK_BIT } from "@/lib/daily-streak";
import { useWalletSession } from "@/lib/wallet-session";
import { useChainTip } from "@/lib/use-chain-tip";

/** Daily tribute: one BIT claim per UTC day, rising for 7 consecutive days. */
export function DailyStreak() {
  const wallet = useWalletSession();
  const address = wallet?.ordinalsAddress || wallet?.paymentAddress || null;
  const statusFn = useServerFn(dailyStreakStatusFn);
  const claimFn = useServerFn(claimDailyStreakFn);
  const qc = useQueryClient();
  const tip = useChainTip();
  const status = useQuery({ queryKey: ["daily-streak", address], enabled: !!address, queryFn: () => statusFn(), retry: false });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const s = status.data;
  const day = s ? (s.claimedToday ? s.streak : s.nextStreak) : 0;

  async function claim() {
    if (!address) return;
    setBusy(true); setNote(null);
    try {
      const r = await claimFn({ data: { address } });
      setNote(r.ok ? (r.already ? "ALREADY CLAIMED TODAY" : `+${r.bit} BIT · DAY ${r.streak} STREAK`) : r.error);
      void qc.invalidateQueries();
    } catch { setNote("SIGN IN AND VERIFY YOUR WALLET TO CLAIM"); }
    finally { setBusy(false); }
  }

  const halving = typeof tip === "number" ? 210_000 - (tip % 210_000) : null;
  return (
    <section data-no-translate className="mx-auto mt-6 max-w-3xl border border-border bg-card/50 p-4 font-mono text-xs backdrop-blur" aria-label="Daily tribute">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10px] tracking-[0.3em] text-signal">DAILY TRIBUTE · MORNING BRIEF</p>
        <p className="text-[10px] text-muted-foreground">
          {typeof tip === "number" ? `BLOCK #${tip.toLocaleString("en-US")} · ${halving?.toLocaleString("en-US")} TO HALVING` : "READING CHAIN TIP…"}
        </p>
      </div>
      <div className="mt-3 flex gap-1">
        {STREAK_BIT.map((b, i) => (
          <div key={i} className={`flex-1 border px-1 py-1.5 text-center ${i < day ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground"}`}>
            <p className="text-[9px]">D{i + 1}</p><p className="tabular-nums">{b}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {!address ? (
          <p className="text-muted-foreground">Connect a verified wallet to claim BIT every day. Miss a day and the streak resets.</p>
        ) : s?.claimedToday ? (
          <p className="text-signal">CLAIMED · DAY {s.streak} STREAK · COME BACK TOMORROW FOR {STREAK_BIT[Math.min(s.streak, 6)]} BIT</p>
        ) : (
          <button onClick={claim} disabled={busy || status.isLoading} className="btn-term px-3 py-1.5">
            {busy ? "CLAIMING…" : status.isError ? "CLAIM TODAY'S TRIBUTE" : `CLAIM ${s?.nextBit ?? STREAK_BIT[0]} BIT`}
          </button>
        )}
        {note && <span className="text-muted-foreground">{note}</span>}
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { lotterySetPool, useLottery } from "@/lib/bitmap-lottery";
import { poolStatsFn } from "@/lib/puzzle-pool.functions";
import { SLICE_COUNT, SLICE_SIZE, isWorkerAddress } from "@/lib/puzzle-pool";
import { POOL_DIVIDEND_PERCENT, PUZZLE_71 } from "@/lib/puzzle-sweep";
import { useWalletSession } from "@/lib/wallet-session";

const short = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;

export function PoolPanel() {
  const lot = useLottery();
  const wallet = useWalletSession();
  const [addr, setAddr] = useState("");
  useEffect(() => { if (!addr && wallet?.paymentAddress) setAddr(wallet.paymentAddress); }, [wallet?.paymentAddress, addr]);
  const stats = useQuery({ queryKey: ["puzzle-pool-stats", lot.poolDone], queryFn: () => poolStatsFn(), refetchInterval: 60_000 });
  const s = stats.data;
  const keys = s ? BigInt(s.slices) * SLICE_SIZE : 0n;

  return (
    <section className="mt-6 rounded border border-accent/40 bg-card/60 p-4 text-xs">
      <p className="label text-accent">SHARED SCANNING POOL</p>
      <p className="mt-2 text-muted-foreground">
        The site splits #71 into {SLICE_COUNT.toLocaleString()} slices of {Number(SLICE_SIZE).toLocaleString()} keys and hands each visitor an unused one, so no two browsers repeat work.
        A finished slice must include its lowest key hash as proof; the server re-checks it before counting it.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Box label="SLICES DONE" value={s ? s.slices.toLocaleString() : "…"} />
        <Box label="KEYS CHECKED BY POOL" value={s ? keys.toLocaleString() : "…"} />
        <Box label="PROSPECTORS" value={s ? s.workers.toLocaleString() : "…"} />
      </div>

      {lot.poolWorker ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">CREDITING <span className="text-foreground" data-no-translate>{short(lot.poolWorker)}</span> · {lot.poolDone} SLICES FROM THIS DEVICE</span>
          {lot.poolMsg && <span className="text-accent">{lot.poolMsg}</span>}
          <button onClick={() => lotterySetPool(null)} className="ml-auto rounded border border-border px-3 py-1 text-muted-foreground">[ LEAVE POOL · SCAN SOLO ]</button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={addr} onChange={(e) => setAddr(e.target.value.trim())} placeholder="Your Bitcoin address for credit"
            className="min-w-[260px] flex-1 rounded border border-border bg-background px-3 py-1" data-no-translate />
          <button disabled={!isWorkerAddress(addr)} onClick={() => lotterySetPool(addr)}
            className="rounded bg-primary px-4 py-1 text-primary-foreground disabled:opacity-50">[ JOIN POOL ]</button>
        </div>
      )}

      {s && s.top.length > 0 && (
        <table className="mt-4 w-full">
          <thead><tr className="text-left text-muted-foreground"><th>#</th><th>ADDRESS</th><th>SLICES</th><th>CREDIT</th><th>DIVIDEND IF SOLVED</th></tr></thead>
          <tbody>
            {s.top.map((t, i) => (
              <tr key={t.worker}><td>{i + 1}</td><td data-no-translate>{short(t.worker)}</td><td>{t.slices}</td><td className="text-bitcoin">{(t.share * 100).toFixed(2)}%</td><td className="text-bitcoin">{(t.share * PUZZLE_71.rewardBtc * POOL_DIVIDEND_PERCENT / 100).toFixed(4)} BTC</td></tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        Credit is a public record of who did the work. Whoever's browser finds the key still holds it and signs the sweep (80% to them, 20% treasury). Half of the treasury share — {POOL_DIVIDEND_PERCENT}% of the prize — is pledged to contributors by verified slices; the treasury pays it after the sweep confirms, so it is a promise, not enforced by Bitcoin —
        the pool cannot force a payout. Your address is shown on this board.
      </p>
    </section>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border px-3 py-2">
      <p className="label text-muted-foreground">{label}</p>
      <p className="display mt-1 text-base">{value}</p>
    </div>
  );
}

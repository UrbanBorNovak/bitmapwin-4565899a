import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PUZZLE_71 } from "@/lib/puzzle-sweep";
import { KeyVaultPanel } from "@/components/puzzle/KeyVaultPanel";
import { LOTTERY_POWER, lotteryBoot, lotterySetEngine, lotterySetPower, webgpuAvailable, lotteryToggle, useLottery } from "@/lib/bitmap-lottery";

const fmtRate = (r: number) => (r >= 1000 ? `${(r / 1000).toFixed(1)}k` : String(r));

/** Always-on floating Bitmap Lottery toggle, docked bottom-right on every page. */
export function BitmapLotteryWidget() {
  const s = useLottery();
  const path = useRouterState({ select: (x) => x.location.pathname });
  const [open, setOpen] = useState(false);
  useEffect(() => { lotteryBoot(); }, []);
  const [gpuOk, setGpuOk] = useState(false);
  useEffect(() => setGpuOk(webgpuAvailable()), []);
  useEffect(() => { if (s.found) setOpen(true); }, [s.found]);
  const jackpot = useQuery({
    queryKey: ["lottery-jackpot"], staleTime: 300_000, retry: 0,
    queryFn: async () => {
      const a = await (await fetch(`https://mempool.space/api/address/${PUZZLE_71.address}`)).json();
      return (a.chain_stats.funded_txo_sum - a.chain_stats.spent_txo_sum) / 1e8;
    },
  });
  if (path.startsWith("/embed")) return null;
  const pot = jackpot.data != null ? `${jackpot.data.toFixed(2)} BTC` : "7.10 BTC";

  return (
    <div className="fixed bottom-20 right-3 z-50 font-mono text-xs sm:bottom-4" data-no-translate={false}>
      {open && (
        <div className="mb-2 max-h-[70vh] w-72 overflow-y-auto rounded border border-border bg-background/85 p-3 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="label text-accent">BITMAP LOTTERY</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close lottery panel">×</button>
          </div>
          <p className="display mt-1 text-xl text-bitcoin">{pot}</p>
          <p className="text-[10px] text-muted-foreground">JACKPOT · BITCOIN PUZZLE #71</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Cell label="SPEED" value={`${fmtRate(s.rate)} KEYS/S`} live={s.on} />
            <Cell label="TICKETS" value={s.scanned.toLocaleString()} />
          </div>
          {s.slice && <p className="mt-2 truncate text-[10px] text-muted-foreground">SLICE <span className="text-accent" data-no-translate>0x{s.slice}</span></p>}
          <div className="mt-3 flex gap-1">
            {LOTTERY_POWER.map((p) => (
              <button key={p.id} onClick={() => lotterySetPower(p.id)}
                className={`flex-1 rounded border px-1 py-1 text-[10px] ${s.power === p.id ? "border-accent text-accent" : "border-border text-muted-foreground"}`}>
                {p.id}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1">
            {(["CPU", "GPU"] as const).map((e) => (
              <button key={e} onClick={() => lotterySetEngine(e)} disabled={e === "GPU" && !gpuOk}
                className={`flex-1 rounded border px-1 py-1 text-[10px] disabled:opacity-40 ${s.engine === e ? "border-accent text-accent" : "border-border text-muted-foreground"}`}>
                {e === "CPU" ? "CPU" : "WEBGPU · BETA"}
              </button>
            ))}
          </div>
          <p className="mt-1 truncate text-[10px] text-muted-foreground" data-no-translate>
            {s.gpuStatus === "testing" ? "GPU SELF-TEST…" : s.gpuStatus === "ok" && s.engine === "GPU" ? `GPU OK · ${s.gpuNote}` : s.gpuStatus === "failed" ? `GPU OFF · ${s.gpuNote} · USING CPU` : gpuOk ? "ENGINE · " + s.engine : "WEBGPU NOT SUPPORTED HERE · CPU"}
          </p>
          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
            The prize is real BTC already sitting on Bitcoin since 2015. No smart contract is needed: whoever finds the key signs the spend on their own device, 80% to you and 20% to the treasury (half of that is pledged to pool contributors). Odds are astronomically low, so treat it as a free lottery ticket. Keys never leave this device. No BIT is paid.
          </p>
          <div className="mt-3"><KeyVaultPanel compact /></div>
          <Link to="/puzzle" onClick={() => setOpen(false)} className="mt-2 block text-accent underline">OPEN SWEEP TERMINAL →</Link>
        </div>
      )}
      <div className="flex items-center gap-2 rounded-full border border-border bg-background/80 py-1 pl-3 pr-1 shadow-lg backdrop-blur-md">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2" aria-expanded={open} aria-label="Bitmap Lottery details">
          <span className={`h-2 w-2 rounded-full ${s.found ? "bg-primary animate-pulse" : s.on ? "bg-accent animate-pulse" : "bg-muted-foreground/50"}`} />
          <span className="text-foreground">LOTTERY</span>
          <span className="hidden text-bitcoin sm:inline">{pot}</span>
          {s.on && <span className="text-accent">{fmtRate(s.rate)}/s</span>}
        </button>
        {s.found ? (
          <Link to="/puzzle" className="rounded-full bg-primary px-3 py-1 text-primary-foreground">KEY FOUND!</Link>
        ) : (
          <button role="switch" aria-checked={s.on} aria-label="Turn Bitmap Lottery on or off" onClick={lotteryToggle}
            className={`relative h-6 w-11 rounded-full border transition-colors ${s.on ? "border-accent bg-accent/25" : "border-border bg-muted"}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${s.on ? "left-6 bg-accent" : "left-0.5 bg-muted-foreground"}`} />
          </button>
        )}
      </div>
    </div>
  );
}

function Cell({ label, value, live }: { label: string; value: string; live?: boolean }) {
  return (
    <div className="border border-border px-2 py-1">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className={live ? "text-accent" : "text-foreground"}>{value}</p>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { chainTipQuery, myPropsQuery, PROP_MARKETS, STAKES, type PropMarket } from "@/lib/block-props";
import { placeBlockPropFn, settleBlockPropsFn } from "@/lib/block-props.functions";
import { coinBalanceQuery } from "@/lib/coins";
import { useWalletSession } from "@/lib/wallet-session";
import { playSfx } from "@/lib/world-audio";

/** NEXT-BLOCK PROPS — 1-click BIT predictions settled by real Bitcoin blocks. */
export function MempoolSportsbook() {
  const wallet = useWalletSession();
  const address = wallet?.ordinalsAddress || wallet?.paymentAddress || null;
  const tip = useQuery(chainTipQuery());
  const slips = useQuery(myPropsQuery());
  const balances = useQuery(coinBalanceQuery(address ? [address] : []));
  const place = useServerFn(placeBlockPropFn);
  const settle = useServerFn(settleBlockPropsFn);
  const qc = useQueryClient();

  const [stake, setStake] = useState<number>(STAKES[0]);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const lastTip = useRef<number | null>(null);

  const tipHeight = tip.data?.height ?? null;
  const target = tipHeight == null ? null : tipHeight + 1;
  const balance = balances.data?.[0]?.balance ?? 0;
  const open = (slips.data ?? []).filter((s) => s.status === "open");

  // A new block landed: ask the server to settle this player's open slips.
  useEffect(() => {
    if (tipHeight == null) return;
    const previous = lastTip.current;
    lastTip.current = tipHeight;
    if (previous == null || previous === tipHeight || !address) return;
    void (async () => {
      try {
        const res = await settle({});
        if (res.settled.length === 0) return;
        const won = res.settled.filter((s) => s.won);
        if (won.length) {
          setFlash(true);
          playSfx("levelup");
          window.setTimeout(() => setFlash(false), 2900);
          toast.success(`+${won.reduce((n, s) => n + s.payout, 0)} BIT PAID`, { description: won[0]?.outcome ?? "" });
        } else {
          playSfx("empty");
          toast(`SLIP LOST · ${res.settled[0]?.outcome ?? ""}`);
        }
        void qc.invalidateQueries();
      } catch {
        /* settlement retries on the next block */
      }
    })();
  }, [tipHeight, address, settle, qc]);

  async function bet(market: PropMarket, pick: string) {
    if (target == null) return;
    if (!address) {
      toast.error("CONNECT A VERIFIED WALLET TO PLACE A SLIP");
      return;
    }

    setBusy(`${market}:${pick}`);
    try {
      const res = await place({ data: { address, market, pick, stake, targetHeight: target } });
      if (!res.ok) {
        playSfx("empty");
        return void toast.error(res.error);
      }
      playSfx("ui");
      toast.success(`${pick} LOCKED ON BLOCK ${res.targetHeight.toLocaleString("en-US")}`, { description: `${stake} BIT AT ${res.multiplier}×` });
      void qc.invalidateQueries();
    } catch {
      toast.error("SIGN IN AND VERIFY YOUR WALLET TO PLACE A SLIP");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section data-no-translate className={`border border-border bg-card ${flash ? "prop-win" : ""}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="label flex items-center gap-2">
          <span className="size-1.5 bg-bitcoin lc-blink" aria-hidden /> NEXT-BLOCK PROPS
        </h2>
        <p className="font-mono text-[10px] text-muted-foreground">
          {target == null ? "READING THE CHAIN_" : `SETTLES ON BLOCK ${target.toLocaleString("en-US")}`} · BALANCE {balance.toLocaleString("en-US")} BIT
        </p>
      </header>

      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="label text-[0.5rem] text-muted-foreground">STAKE</span>
        {STAKES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStake(s)}
            className={`btn-term px-2 py-1 font-mono text-[10px] ${stake === s ? "border-bitcoin text-bitcoin" : ""}`}
          >
            {s} BIT
          </button>
        ))}
      </div>

      <div className="grid gap-0 sm:grid-cols-3">
        {PROP_MARKETS.map((m) => (
          <div key={m.market} className="border-b border-border px-3 py-2 sm:border-b-0 sm:border-r sm:last:border-r-0">
            <p className="label text-[0.5rem] text-signal">{m.title}</p>
            <p className="mb-2 font-mono text-[9px] text-muted-foreground">{m.note}</p>
            <div className="flex flex-col gap-1.5">
              {m.options.map((o) => {
                const taken = open.find((s) => s.market === m.market && s.targetHeight === target);
                const mine = taken?.pick === o.pick;
                return (
                  <button
                    key={o.pick}
                    type="button"
                    disabled={busy !== null || target == null || Boolean(taken)}
                    onClick={() => bet(m.market, o.pick)}
                    className={`btn-term flex items-center justify-between gap-2 px-2 py-1.5 font-mono text-[10px] ${mine ? "border-bitcoin text-bitcoin" : ""}`}
                  >
                    <span>{mine ? `${o.label} · LOCKED` : o.label}</span>
                    <span className="text-bitcoin">{o.multiplier.toFixed(2)}×</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-3 py-2">
        <p className="label text-[0.5rem] text-muted-foreground">YOUR SLIPS</p>
        {slips.data?.length ? (
          <ol className="mt-1 space-y-1">
            {slips.data.slice(0, 6).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
                <span className={s.status === "won" ? "text-bitcoin" : s.status === "lost" ? "text-muted-foreground" : "text-signal"}>
                  {s.status === "open" ? "OPEN" : s.status === "won" ? `WON +${s.payout}` : "LOST"}
                </span>
                <span className="text-foreground">
                  {s.pick} · {s.stake} BIT · {s.multiplier.toFixed(2)}× · BLOCK {s.targetHeight.toLocaleString("en-US")}
                </span>
                {s.outcome ? <span className="text-muted-foreground">{s.outcome}</span> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            &gt; {address ? "NO SLIPS YET — PICK A SIDE OF THE NEXT BLOCK_" : "CONNECT A VERIFIED WALLET TO PLAY THE NEXT BLOCK_"}
          </p>
        )}
        <p className="mt-2 font-mono text-[9px] text-muted-foreground">
          &gt; EVERY SLIP SETTLES ON REAL MINED BLOCKS · FEE PRESSURE USES THE LATEST 10-BLOCK MEDIAN FROM MEMPOOL.SPACE
        </p>
      </div>
    </section>
  );
}

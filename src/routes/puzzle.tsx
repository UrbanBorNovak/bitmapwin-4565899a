import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { PoolPanel } from "@/components/puzzle/PoolPanel";
import { GoldenTicket, NearMissFeed } from "@/components/puzzle/GoldenTicket";
import { BlockHuntPanel } from "@/components/puzzle/BlockHuntPanel";
import { CommunityRecord } from "@/components/puzzle/CommunityRecord";
import { HashStrip } from "@/components/puzzle/HashStrip";
import { LOTTERY_POWER, lotteryBoot, lotterySetEngine, lotterySetPower, webgpuAvailable, lotteryStart, lotteryStop, useLottery } from "@/lib/bitmap-lottery";
import { hex } from "@scure/base";
import { useWalletSession } from "@/lib/wallet-session";
import { PUZZLE_71, SLIPSTREAM, SWEEP_TREASURY_PERCENT, buildSweep, hash160Of, keyMatches, slipstreamFeeRate, slipstreamStatusUrl, submitSlipstream } from "@/lib/puzzle-sweep";
import { KeyVaultPanel } from "@/components/puzzle/KeyVaultPanel";
import { CONFIRM_PHRASE, confirmMatches, downloadKeyBackup, guardUnload, safeError } from "@/lib/puzzle-secret";

export const Route = createFileRoute("/puzzle")({
  head: () => ({
    meta: [
      { title: "Bitmap Lottery · Puzzle #71 — bitmapwin" },
      { name: "description", content: "Scan Bitcoin Puzzle #71 keys in your browser while you explore. Any found key is swept on your device." },
      { property: "og:title", content: "Bitmap Lottery · Puzzle #71 — bitmapwin" },
      { property: "og:description", content: "A background key scanner for the 7.1 BTC Bitcoin Puzzle #71, running on your device." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PuzzlePage,
});

function PuzzlePage() {
  const wallet = useWalletSession();
  const lot = useLottery();
  const [gpuOk, setGpuOk] = useState(false);
  useEffect(() => setGpuOk(webgpuAvailable()), []);
  const { on, scanned, rate, slice, found } = lot;
  const duty = lot.power;
  const setDuty = lotterySetPower;
  const DUTIES = LOTTERY_POWER;
  const [balance, setBalance] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);
  // Signed sweep lives only in component memory; never stored or logged.
  const [signed, setSigned] = useState<{ hex: string; player: bigint; treasury: bigint; fee: bigint; feeRate: number } | null>(null);
  const [ack, setAck] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    lotteryBoot();
    fetch(`https://mempool.space/api/address/${PUZZLE_71.address}`)
      .then((r) => r.json())
      .then((a) => setBalance(a.chain_stats.funded_txo_sum - a.chain_stats.spent_txo_sum))
      .catch(() => setBalance(null));
  }, []);

  const start = lotteryStart;
  const stop = lotteryStop;

  // No cleanup: the found-key guard must outlive this page (the lottery runs site-wide).
  useEffect(() => { guardUnload(!!found && !txid); }, [found, txid]);

  /** Step 1: sign on the device. Nothing leaves the browser. */
  async function sign() {
    if (!found || !wallet) return;
    setBusy(true);
    try {
      setStatus("CHECKING KEY…");
      const priv = hex.decode(found);
      if (!keyMatches(priv, hash160Of(PUZZLE_71.address))) throw new Error("This key does not unlock puzzle #71");
      setStatus("READING SLIPSTREAM FEE RATE…");
      const feeRate = await slipstreamFeeRate();
      setStatus("SIGNING ON THIS DEVICE…");
      const tx = await buildSweep({ priv, puzzleAddress: PUZZLE_71.address, payTo: wallet.paymentAddress, feeRate });
      setSigned({ hex: tx.hex, player: tx.player, treasury: tx.treasury, fee: tx.fee, feeRate });
      setStatus("SIGNED · NOT SENT. REVIEW AND CONFIRM BELOW.");
    } catch (e) { setStatus(`FAILED: ${safeError(e)}`); }
    finally { setBusy(false); }
  }

  /** Step 2: only after explicit confirmation. */
  async function submit() {
    if (!signed || !ack || !confirmMatches(typed)) return;
    setBusy(true);
    try {
      setStatus("SUBMITTING PRIVATELY TO MARA SLIPSTREAM…");
      setTxid(await submitSlipstream(signed.hex));
      setStatus("QUEUED WITH MARA · NOT IN PUBLIC MEMPOOL · WAIT FOR A MARA BLOCK");
    } catch (e) { setStatus(`FAILED: ${safeError(e)}`); }
    finally { setBusy(false); }
  }

  const keyspace = 2 ** 70;
  const SPEED_NAMES = ["Gentle", "Normal", "Turbo", "Max"];
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <section className="text-center">
        <p className="label text-accent">BITCOIN TREASURE HUNT</p>
        <h1 className="display mt-2 text-4xl">
          Win <span className="text-bitcoin">{balance == null ? "7.10" : (balance / 1e8).toFixed(2)} BTC</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
          A Bitcoin treasure chest has been locked since 2015. Your computer tries free keys to open it. It's free, and everything stays on your device.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Winning is extremely unlikely. Think of it as a free lottery ticket.</p>
      </section>

      <ol className="mt-8 space-y-4">
        <StepCard n={1} title="Turn it on">
          <button onClick={on ? stop : start} disabled={!!found} className="w-full rounded-lg bg-primary px-6 py-4 font-mono text-lg text-primary-foreground disabled:opacity-50">
            {on ? "■ STOP HUNTING" : "▶ START HUNTING"}
          </button>
          <p className="mt-3 text-sm text-muted-foreground">How hard should your computer work?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DUTIES.map((d, i) => (
              <button key={d.id} onClick={() => setDuty(d.id)} className={`rounded-full border px-4 py-1.5 text-sm ${duty === d.id ? "border-accent text-accent" : "border-border text-muted-foreground"}`}>{SPEED_NAMES[i] ?? d.id}</button>
            ))}
          </div>
        </StepCard>

        <StepCard n={2} title="Watch it count">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Keys tried" value={scanned.toLocaleString()} />
            <Stat label="Keys per second" value={Math.round(rate).toLocaleString()} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{on ? "Hunting… you can use the rest of the site while this runs." : "Press Start to begin."}</p>
          <HashStrip nears={lot.nears} bestNear={lot.bestNear} scanned={scanned} on={on} />
        </StepCard>

        <StepCard n={3} title="If you win">
          <p className="text-sm text-muted-foreground">
            A big gold box appears on this page. Connect your wallet and follow the steps. You get {100 - SWEEP_TREASURY_PERCENT}%, and the bitmapwin treasury gets {SWEEP_TREASURY_PERCENT}%.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Tip: set a backup password under "Advanced" so a win is never lost if the tab closes.</p>
        </StepCard>
      </ol>

      <details className="mt-8 rounded-lg border border-border bg-card/60 p-4 font-mono">
        <summary className="cursor-pointer text-sm text-accent">🛠 ADVANCED TOOLS (for experts)</summary>
        <CommunityRecord />
        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          <Stat label="SHARE OF RANGE" value={`${((scanned / keyspace) * 100).toExponential(2)}%`} />
          <Stat label="BOUNTY" value={balance == null ? "…" : `${(balance / 1e8).toFixed(8)} BTC`} accent />
        </section>
        <div className="mt-4 rounded border border-border bg-card/60 p-4 text-xs">
          <p className="text-muted-foreground">TARGET <span className="text-foreground" data-no-translate>{PUZZLE_71.address}</span></p>
          <p className="mt-1 text-muted-foreground">RANGE <span data-no-translate>0x{PUZZLE_71.startHex} – 0x{PUZZLE_71.endHex}</span></p>
          {slice && <p className="mt-1 text-muted-foreground">SLICE <span className="text-accent" data-no-translate>0x{slice}</span></p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="label text-muted-foreground">ENGINE</span>
            <button onClick={() => lotterySetEngine("CPU")} className={`rounded border px-3 py-1 ${lot.engine === "CPU" ? "border-accent text-accent" : "border-border text-muted-foreground"}`}>CPU WORKER</button>
            <button onClick={() => lotterySetEngine("GPU")} disabled={!gpuOk} className={`rounded border px-3 py-1 disabled:opacity-40 ${lot.engine === "GPU" ? "border-accent text-accent" : "border-border text-muted-foreground"}`}>WEBGPU · EXPERIMENTAL</button>
            <span className="text-[11px] text-muted-foreground" data-no-translate>
              {lot.gpuStatus === "testing" && "GPU SELF-TEST…"}
              {lot.gpuStatus === "ok" && lot.engine === "GPU" && `GPU OK · ${lot.gpuNote}`}
              {lot.gpuStatus === "failed" && `GPU OFF · ${lot.gpuNote} · USING CPU`}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">WebGPU runs on your graphics card in Chrome/Edge desktop. It must pass a self-test against the CPU first, and every find is re-checked on the CPU. Native GPU rigs are still far faster.</p>
          <p className="mt-3 text-[11px] text-muted-foreground">Scanning pays no BIT — key counts reported by a browser can't be proven, so they never earn coins.</p>
        </div>
        <div className="mt-4"><KeyVaultPanel /></div>
        <NearMissFeed nears={lot.nears} bestNear={lot.bestNear} />
        <GoldenTicket />
        <PoolPanel />
        <BlockHuntPanel />
        <a href="/speed-bounty" className="mt-4 block text-xs text-primary">→ KANGAROO SPEED BOUNTIES · race known-pubkey keys</a>
      </details>

      {found && (
        <section className="mt-6 rounded border border-primary p-4 text-xs">
          <p className="display text-lg text-primary">KEY FOUND — HELD IN THIS TAB ONLY</p>
          <p className="mt-2 text-muted-foreground">The key never goes to our servers. Unless you set a backup passphrase (see ENCRYPTED KEY BACKUP), it is only in this tab and closing or reloading loses it. A plain backup file is unencrypted — keep it offline. The sweep pays your wallet {100 - SWEEP_TREASURY_PERCENT}% (minus network fee) and the bitmapwin treasury {SWEEP_TREASURY_PERCENT}%.</p>
          <button onClick={() => downloadKeyBackup(found)} className="mt-2 rounded border border-primary px-3 py-1 text-primary">[ SAVE KEY BACKUP FILE ]</button>
          <div className="mt-2 rounded border border-destructive p-2 text-muted-foreground">
            <p className="text-destructive">NEVER BROADCAST THIS PUBLICLY.</p>
            <p className="mt-1">Signing reveals the public key. Bots watching the public mempool recover a puzzle key in seconds and replace your transaction — this is how #66 and #69 were stolen in 2024. Disabling RBF, a huge fee or an accelerator do not help.</p>
            <p className="mt-1">This sweep goes only to MARA Slipstream, which keeps it out of the public mempool until MARA mines a block: about 3.5 hours on average, up to 16+ hours. Do not panic and paste it into a block explorer while you wait.</p>
            <p className="mt-1">Limit: MARA sees the transaction first. You are trusting their reputation instead of a bot's restraint.</p>
          </div>
          <p className="mt-2">PAY TO: <span data-no-translate>{wallet?.paymentAddress ?? "CONNECT A WALLET FIRST"}</span></p>
          {!signed && <button onClick={sign} disabled={!wallet || busy} className="mt-3 rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">[ 1 · SIGN SWEEP ON THIS DEVICE ]</button>}
          {signed && !txid && (
            <div className="mt-3 rounded border border-primary p-3">
              <p className="label text-primary">2 · CONFIRM PRIVATE SUBMISSION</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>YOU RECEIVE <span className="text-foreground" data-no-translate>{(Number(signed.player) / 1e8).toFixed(8)} BTC</span> → <span data-no-translate>{wallet?.paymentAddress}</span></li>
                <li>TREASURY <span className="text-foreground" data-no-translate>{(Number(signed.treasury) / 1e8).toFixed(8)} BTC</span> · FEE <span data-no-translate>{Number(signed.fee).toLocaleString()} sats ({signed.feeRate} sat/vB)</span></li>
                <li>SENT ONLY TO MARA SLIPSTREAM. Nothing is sent until you confirm.</li>
              </ul>
              <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I understand MARA sees this transaction and I may wait many hours.</label>
              <p className="mt-2 text-muted-foreground">Type <span className="text-foreground" data-no-translate>{CONFIRM_PHRASE}</span> to confirm:</p>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="mt-1 w-full rounded border border-border bg-background px-2 py-1" data-no-translate />
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={submit} disabled={!ack || !confirmMatches(typed) || busy} className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">[ SUBMIT TO MARA SLIPSTREAM ]</button>
                <button onClick={() => { setSigned(null); setAck(false); setTyped(""); setStatus("SIGNED SWEEP DISCARDED"); }} className="rounded border border-border px-4 py-2">[ CANCEL ]</button>
              </div>
              <details className="mt-2"><summary className="cursor-pointer text-muted-foreground">Manual route: show signed hex (paste only at slipstream.mara.com)</summary>
                <textarea readOnly value={signed.hex} className="mt-1 h-20 w-full rounded border border-border bg-background p-1 text-[10px]" data-no-translate />
                <a className="text-accent underline" href={SLIPSTREAM} target="_blank" rel="noreferrer">OPEN SLIPSTREAM →</a>
              </details>
            </div>
          )}
          {status && <p className="mt-2">{status}</p>}
          {txid && <a className="mt-1 block text-accent underline" href={slipstreamStatusUrl(txid)} target="_blank" rel="noreferrer">TRACK ON SLIPSTREAM →</a>}
        </section>
      )}

      <section className="mt-6 rounded border border-border bg-card/60 p-4 text-xs">
        <p className="label text-accent">HOW PUZZLE #71 WORKS · NO SMART CONTRACT</p>
        <ol className="mt-3 list-decimal space-y-2 pl-4 text-muted-foreground">
          <li><span className="text-foreground">The prize is already on Bitcoin.</span> Since 2015 the bounty sits at a normal address. Its private key is known to lie in the 71-bit range above.</li>
          <li><span className="text-foreground">Your browser buys free tickets.</span> It checks random keys in the background. Nothing is sent to us and scanning costs nothing.</li>
          <li><span className="text-foreground">Whoever holds the key owns the coins.</span> A found key lets your own device sign the spend. No operator has to approve or pay anything.</li>
          <li><span className="text-foreground">Fixed split, written in the transaction.</span> The sweep pays your wallet {100 - SWEEP_TREASURY_PERCENT}% (minus network fee) and the treasury {SWEEP_TREASURY_PERCENT}%. Anyone can check it on mempool.</li>
        </ol>
        <p className="mt-3 text-[11px] text-muted-foreground">Odds are about 1 in 1.18 × 10²¹ per range. Treat it as a free lottery ticket, not income.</p>
      </section>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border border-border px-3 py-2">
      <p className="label text-muted-foreground">{label}</p>
      <p className={`display mt-1 text-base ${accent ? "text-bitcoin" : ""}`}>{value}</p>
    </div>
  );
}

function StepCard({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="rounded-lg border border-border bg-card/60 p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="display flex h-9 w-9 items-center justify-center rounded-full bg-primary text-lg text-primary-foreground">{n}</span>
        <h2 className="display text-xl">{title}</h2>
      </div>
      {children}
    </li>
  );
}

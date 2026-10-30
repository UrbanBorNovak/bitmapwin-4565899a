import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PoolPanel } from "@/components/puzzle/PoolPanel";
import { GoldenTicket, NearMissFeed } from "@/components/puzzle/GoldenTicket";
import { BlockHuntPanel } from "@/components/puzzle/BlockHuntPanel";
import { LOTTERY_POWER, lotteryBoot, lotterySetPower, lotteryStart, lotteryStop, useLottery } from "@/lib/bitmap-lottery";
import { hex } from "@scure/base";
import { useWalletSession } from "@/lib/wallet-session";
import { PUZZLE_71, SLIPSTREAM, SWEEP_TREASURY_PERCENT, buildSweep, hash160Of, keyMatches, slipstreamFeeRate, slipstreamStatusUrl, submitSlipstream } from "@/lib/puzzle-sweep";

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
  const { on, scanned, rate, slice, found } = lot;
  const duty = lot.power;
  const setDuty = lotterySetPower;
  const DUTIES = LOTTERY_POWER;
  const [balance, setBalance] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);
  const [signedHex, setSignedHex] = useState<string | null>(null);

  useEffect(() => {
    lotteryBoot();
    fetch(`https://mempool.space/api/address/${PUZZLE_71.address}`)
      .then((r) => r.json())
      .then((a) => setBalance(a.chain_stats.funded_txo_sum - a.chain_stats.spent_txo_sum))
      .catch(() => setBalance(null));
  }, []);

  const start = lotteryStart;
  const stop = lotteryStop;

  async function sweep() {
    if (!found || !wallet) return;
    try {
      setStatus("CHECKING KEY…");
      const priv = hex.decode(found);
      if (!keyMatches(priv, hash160Of(PUZZLE_71.address))) throw new Error("Stored key does not unlock puzzle #71");
      setStatus("READING SLIPSTREAM FEE RATE…");
      const feeRate = await slipstreamFeeRate();
      setStatus("SIGNING ON THIS DEVICE…");
      const tx = await buildSweep({ priv, puzzleAddress: PUZZLE_71.address, payTo: wallet.paymentAddress, feeRate });
      setSignedHex(tx.hex);
      setStatus("SUBMITTING PRIVATELY TO MARA SLIPSTREAM…");
      setTxid(await submitSlipstream(tx.hex));
      setStatus(`QUEUED WITH MARA · NOT IN PUBLIC MEMPOOL · WAIT FOR A MARA BLOCK · YOU ${(Number(tx.player) / 1e8).toFixed(8)} BTC · TREASURY ${(Number(tx.treasury) / 1e8).toFixed(8)} BTC`);
    } catch (e) { setStatus(`FAILED: ${(e as Error).message}`); }
  }

  const keyspace = 2 ** 70;
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 font-mono">
      <p className="label text-accent">BITCOIN PUZZLE RIG</p>
      <h1 className="display mt-2 text-3xl">BITMAP LOTTERY · PUZZLE #71</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Your browser checks random keys from the #71 range in the background. Keys and any find stay on this device.
        Honest odds: the range holds about 1.18 sextillion keys — a browser will almost certainly never find it. This is a lottery ticket, not income.
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        <Stat label="BOUNTY" value={balance == null ? "…" : `${(balance / 1e8).toFixed(2)} BTC`} accent />
        <Stat label="SPEED" value={`${(rate / 1000).toFixed(1)} kKEYS/s`} />
        <Stat label="CHECKED HERE" value={scanned.toLocaleString()} />
        <Stat label="SHARE OF RANGE" value={`${((scanned / keyspace) * 100).toExponential(2)}%`} />
      </section>

      <div className="mt-4 rounded border border-border bg-card/60 p-4 text-xs">
        <p className="text-muted-foreground">TARGET <span className="text-foreground" data-no-translate>{PUZZLE_71.address}</span></p>
        <p className="mt-1 text-muted-foreground">RANGE <span data-no-translate>0x{PUZZLE_71.startHex} – 0x{PUZZLE_71.endHex}</span></p>
        {slice && <p className="mt-1 text-muted-foreground">SLICE <span className="text-accent" data-no-translate>0x{slice}</span></p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {DUTIES.map((d) => (
            <button key={d.id} onClick={() => setDuty(d.id)} className={`rounded border px-3 py-1 ${duty === d.id ? "border-accent text-accent" : "border-border text-muted-foreground"}`}>{d.id}</button>
          ))}
          <button onClick={on ? stop : start} disabled={!!found} className="ml-auto rounded bg-primary px-4 py-1 text-primary-foreground disabled:opacity-50">
            {on ? "[ STOP ]" : "[ TURN LOTTERY ON ]"}
          </button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Scanning pays no BIT — key counts reported by a browser can't be proven, so they never earn coins.</p>
      </div>

      <NearMissFeed nears={lot.nears} bestNear={lot.bestNear} />
      <GoldenTicket />
      <PoolPanel />
      <BlockHuntPanel />
      <a href="/speed-bounty" className="mt-4 block font-mono text-xs text-primary">→ KANGAROO SPEED BOUNTIES · race known-pubkey keys</a>

      {found && (
        <section className="mt-6 rounded border border-primary p-4 text-xs">
          <p className="display text-lg text-primary">KEY FOUND — SAVED ON THIS DEVICE</p>
          <p className="mt-2 text-muted-foreground">A backup file was downloaded. The sweep pays your wallet {100 - SWEEP_TREASURY_PERCENT}% (minus network fee) and the bitmapwin treasury {SWEEP_TREASURY_PERCENT}%.</p>
          <div className="mt-2 rounded border border-destructive p-2 text-muted-foreground">
            <p className="text-destructive">NEVER BROADCAST THIS PUBLICLY.</p>
            <p className="mt-1">Signing reveals the public key. Bots watching the public mempool recover a puzzle key in seconds and replace your transaction — this is how #66 and #69 were stolen in 2024. Disabling RBF, a huge fee or an accelerator do not help.</p>
            <p className="mt-1">This sweep goes only to MARA Slipstream, which keeps it out of the public mempool until MARA mines a block: about 3.5 hours on average, up to 16+ hours. Do not panic and paste it into a block explorer while you wait.</p>
            <p className="mt-1">Limit: MARA sees the transaction first. You are trusting their reputation instead of a bot's restraint.</p>
          </div>
          <p className="mt-2">PAY TO: <span data-no-translate>{wallet?.paymentAddress ?? "CONNECT A WALLET FIRST"}</span></p>
          <button onClick={sweep} disabled={!wallet || !!txid} className="mt-3 rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">[ SIGN & SUBMIT PRIVATELY · MARA SLIPSTREAM ]</button>
          {status && <p className="mt-2">{status}</p>}
          {signedHex && !txid && (
            <div className="mt-2">
              <p className="text-muted-foreground">Signed hex (paste only at slipstream.mara.com):</p>
              <textarea readOnly value={signedHex} className="mt-1 h-20 w-full rounded border border-border bg-background p-1 text-[10px]" data-no-translate />
              <a className="text-accent underline" href={SLIPSTREAM} target="_blank" rel="noreferrer">OPEN SLIPSTREAM →</a>
            </div>
          )}
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

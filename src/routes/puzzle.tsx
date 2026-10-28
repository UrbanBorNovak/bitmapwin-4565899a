import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { hex } from "@scure/base";
import { useWalletSession } from "@/lib/wallet-session";
import { PUZZLE_71, SWEEP_TREASURY_PERCENT, broadcast, buildSweep, hash160Of, keyMatches } from "@/lib/puzzle-sweep";

export const Route = createFileRoute("/puzzle")({
  head: () => ({
    meta: [
      { title: "Puzzle Cracker #71 — bitmapwin" },
      { name: "description", content: "Scan Bitcoin Puzzle #71 keys in your browser while you explore. Any found key is swept on your device." },
      { property: "og:title", content: "Puzzle Cracker #71 — bitmapwin" },
      { property: "og:description", content: "A background key scanner for the 7.1 BTC Bitcoin Puzzle #71, running on your device." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PuzzlePage,
});

const FOUND_KEY = "bitmap.puzzle.found";
const DUTIES = [
  { id: "ECO", duty: 0.15 },
  { id: "BALANCED", duty: 0.5 },
  { id: "OVERCLOCK", duty: 1 },
] as const;

function PuzzlePage() {
  const wallet = useWalletSession();
  const worker = useRef<Worker | null>(null);
  const [on, setOn] = useState(false);
  const [duty, setDuty] = useState<(typeof DUTIES)[number]["id"]>("BALANCED");
  const [scanned, setScanned] = useState(0);
  const [rate, setRate] = useState(0);
  const [slice, setSlice] = useState<string | null>(null);
  const [found, setFound] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);
  const window5 = useRef<{ t: number; n: number }[]>([]);

  useEffect(() => {
    const k = localStorage.getItem(FOUND_KEY);
    if (k) setFound(k);
    fetch(`https://mempool.space/api/address/${PUZZLE_71.address}`)
      .then((r) => r.json())
      .then((a) => setBalance(a.chain_stats.funded_txo_sum - a.chain_stats.spent_txo_sum))
      .catch(() => setBalance(null));
    return () => worker.current?.terminate();
  }, []);

  const dutyVal = DUTIES.find((d) => d.id === duty)!.duty;
  useEffect(() => { worker.current?.postMessage({ type: "duty", duty: dutyVal }); }, [dutyVal]);

  function start() {
    if (!worker.current) {
      const w = new Worker(new URL("../lib/puzzle-worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (e) => {
        const m = e.data;
        if (m.type === "batch") {
          setScanned((s) => s + m.count);
          const now = performance.now();
          window5.current.push({ t: now, n: m.count });
          window5.current = window5.current.filter((x) => now - x.t < 5000);
          const n = window5.current.reduce((a, b) => a + b.n, 0);
          setRate(Math.round(n / 5));
        } else if (m.type === "slice") setSlice(m.startHex);
        else if (m.type === "found") {
          localStorage.setItem(FOUND_KEY, m.keyHex);
          const blob = new Blob([`PUZZLE #71 KEY\n${m.keyHex}\n${new Date().toISOString()}\n`], { type: "text/plain" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob); a.download = "puzzle71-key.txt"; a.click();
          setFound(m.keyHex); setOn(false);
        }
      };
      worker.current = w;
    }
    worker.current.postMessage({ type: "start", startHex: PUZZLE_71.startHex, endHex: PUZZLE_71.endHex, target: Array.from(hash160Of(PUZZLE_71.address)), duty: dutyVal });
    setOn(true);
  }
  function stop() { worker.current?.postMessage({ type: "stop" }); setOn(false); setRate(0); }

  async function sweep() {
    if (!found || !wallet) return;
    try {
      setStatus("CHECKING KEY…");
      const priv = hex.decode(found);
      if (!keyMatches(priv, hash160Of(PUZZLE_71.address))) throw new Error("Stored key does not unlock puzzle #71");
      const fees = await fetch("https://mempool.space/api/v1/fees/recommended").then((r) => r.json());
      setStatus("SIGNING ON THIS DEVICE…");
      const tx = await buildSweep({ priv, puzzleAddress: PUZZLE_71.address, payTo: wallet.paymentAddress, feeRate: Math.ceil(fees.fastestFee * 1.5) });
      setStatus("BROADCASTING…");
      setTxid(await broadcast(tx.hex));
      setStatus(`SENT · YOU ${(Number(tx.player) / 1e8).toFixed(8)} BTC · TREASURY ${(Number(tx.treasury) / 1e8).toFixed(8)} BTC`);
    } catch (e) { setStatus(`FAILED: ${(e as Error).message}`); }
  }

  const keyspace = 2 ** 70;
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 font-mono">
      <p className="label text-accent">BITCOIN PUZZLE RIG</p>
      <h1 className="display mt-2 text-3xl">PUZZLE #71 CRACKER</h1>
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
            {on ? "[ STOP ]" : "[ START SCANNING ]"}
          </button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Scanning pays no BIT — key counts reported by a browser can't be proven, so they never earn coins.</p>
      </div>

      {found && (
        <section className="mt-6 rounded border border-primary p-4 text-xs">
          <p className="display text-lg text-primary">KEY FOUND — SAVED ON THIS DEVICE</p>
          <p className="mt-2 text-muted-foreground">A backup file was downloaded. The sweep pays your wallet {100 - SWEEP_TREASURY_PERCENT}% (minus network fee) and the bitmapwin treasury {SWEEP_TREASURY_PERCENT}%.</p>
          <p className="mt-2 text-muted-foreground">Warning: broadcasting reveals the key's public half; bots can then race to replace your transaction. Consider submitting through a private miner service instead.</p>
          <p className="mt-2">PAY TO: <span data-no-translate>{wallet?.paymentAddress ?? "CONNECT A WALLET FIRST"}</span></p>
          <button onClick={sweep} disabled={!wallet || !!txid} className="mt-3 rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">[ SIGN & BROADCAST SWEEP ]</button>
          {status && <p className="mt-2">{status}</p>}
          {txid && <a className="mt-1 block text-accent underline" href={`https://mempool.space/tx/${txid}`} target="_blank" rel="noreferrer">VIEW ON MEMPOOL →</a>}
        </section>
      )}
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

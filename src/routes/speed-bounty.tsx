import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { practiceTarget } from "@/lib/kangaroo";
import { SpeedBountyPool } from "@/components/puzzle/SpeedBountyPool";

export const Route = createFileRoute("/speed-bounty")({
  head: () => ({
    meta: [
      { title: "Kangaroo Speed Bounties — bitmapwin" },
      { name: "description", content: "Race Pollard's Kangaroo in your browser to recover keys whose public key is known." },
      { property: "og:title", content: "Kangaroo Speed Bounties — bitmapwin" },
      { property: "og:description", content: "Known-public-key key races solved in √W steps, right on your device." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SpeedBounty,
});

const LEVELS = [28, 32, 36, 40];
type Run = { bits: number; pubHex: string; lo: bigint; hi: bigint; k: bigint };

function SpeedBounty() {
  const [bits, setBits] = useState(32);
  const [run, setRun] = useState<Run | null>(null);
  const [tick, setTick] = useState({ steps: 0, dps: 0, ms: 0 });
  const [found, setFound] = useState<{ keyHex: string; ms: number; ok: boolean } | null>(null);
  const [best, setBest] = useState<Record<number, number>>({});
  const w = useRef<Worker | null>(null);

  useEffect(() => {
    try { setBest(JSON.parse(localStorage.getItem("kangaroo-best") || "{}")); } catch { /* none */ }
    return () => w.current?.terminate();
  }, []);

  function start() {
    w.current?.terminate();
    const t = practiceTarget(bits);
    const r = { bits, ...t };
    setRun(r); setFound(null); setTick({ steps: 0, dps: 0, ms: 0 });
    const worker = new Worker(new URL("../lib/kangaroo-worker.ts", import.meta.url), { type: "module" });
    w.current = worker;
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "tick") setTick(m);
      if (m.type === "found") {
        const ok = BigInt("0x" + m.keyHex) === r.k;
        setFound({ keyHex: m.keyHex, ms: m.ms, ok });
        if (ok) setBest((b) => {
          const n = b[r.bits] && b[r.bits]! < m.ms ? b : { ...b, [r.bits]: m.ms };
          localStorage.setItem("kangaroo-best", JSON.stringify(n));
          return n;
        });
      }
    };
    worker.postMessage({ type: "start", pubHex: t.pubHex, loHex: t.lo.toString(16), hiHex: t.hi.toString(16), herd: 16 });
  }
  function stop() { w.current?.terminate(); w.current = null; setRun(null); }

  const running = !!run && !found;
  const expected = 2 * Math.sqrt(2 ** (bits - 1));
  const rate = tick.ms > 0 ? tick.steps / (tick.ms / 1000) : 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 font-mono text-sm">
      <p className="text-xs tracking-widest text-accent">SPEED BOUNTY · POLLARD'S KANGAROO</p>
      <h1 className="mt-2 font-display text-3xl text-foreground">Catch the wild kangaroo</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        When a key's public key is known and its range is small, Kangaroo finds it in about √W steps instead of W.
        A tame herd hops from known points, a wild herd hops from the target; when they land on the same marked spot, the key falls out.
        This only works for revealed public keys — not Puzzle #71.
      </p>

      <section className="mt-8 rounded-md border border-border bg-card/60 p-5 backdrop-blur">
        <p className="text-xs text-muted-foreground">PRACTICE RACE · KEY IS MADE AND SOLVED ON THIS DEVICE · NO PRIZE</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {LEVELS.map((b) => (
            <button key={b} disabled={running} onClick={() => setBits(b)}
              className={`rounded border px-3 py-1 ${bits === b ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
              {b}-BIT{best[b] ? ` · ${(best[b]! / 1000).toFixed(1)}s` : ""}
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          {!running
            ? <button onClick={start} className="rounded bg-primary px-4 py-2 text-primary-foreground">[ RELEASE THE KANGAROOS ]</button>
            : <button onClick={stop} className="rounded border border-border px-4 py-2">[ STOP ]</button>}
        </div>
        {run && (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Stat k="TARGET PUBKEY" v={run.pubHex.slice(0, 22) + "…"} />
            <Stat k="RANGE" v={`2^${run.bits - 1} … 2^${run.bits}`} />
            <Stat k="HOPS" v={`${tick.steps.toLocaleString()} / ~${Math.round(expected).toLocaleString()} expected`} />
            <Stat k="SPEED" v={`${Math.round(rate).toLocaleString()} hops/s`} />
            <Stat k="MARKED SPOTS" v={tick.dps.toLocaleString()} />
            <Stat k="TIME" v={`${(tick.ms / 1000).toFixed(1)}s`} />
          </div>
        )}
        {found && (
          <p className={`mt-4 ${found.ok ? "text-accent" : "text-destructive"}`}>
            {found.ok ? `TRAPPED · key 0x${found.keyHex} in ${(found.ms / 1000).toFixed(2)}s` : "Collision did not verify — try again."}
          </p>
        )}
      </section>

      <SpeedBountyPool />

      <section className="mt-6 rounded-md border border-border bg-card/40 p-5">
        <p className="text-xs text-muted-foreground">LIVE FUNDED BOUNTIES</p>
        <p className="mt-2 text-muted-foreground">None scheduled yet. Funded Friday-night drops will appear here with their public key and address.</p>
        <Link to="/puzzle" className="mt-3 inline-block text-primary">→ Puzzle #71 pool</Link>
      </section>
    </main>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return <div className="rounded border border-border px-3 py-2"><p className="text-[10px] text-muted-foreground">{k}</p><p className="text-foreground">{v}</p></div>;
}

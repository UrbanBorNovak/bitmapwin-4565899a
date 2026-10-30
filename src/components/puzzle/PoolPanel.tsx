import { useEffect, useState } from "react";
import { SwarmStinger } from "@/components/brand/BrandMarks";
import { useQuery } from "@tanstack/react-query";
import { lotterySetPool, lotteryStart, useLottery } from "@/lib/bitmap-lottery";
import { ScanProgress } from "./ScanProgress";
import { poolStatsFn } from "@/lib/puzzle-pool.functions";
import { runTestSlice } from "@/lib/puzzle-test-run";
import { HEAT_CELLS, HEAT_CELL_SLICES, HEAT_SIDE, SLICE_COUNT, SLICE_SIZE, isWorkerAddress } from "@/lib/puzzle-pool";
import { POOL_DIVIDEND_PERCENT, PUZZLE_71 } from "@/lib/puzzle-sweep";
import { useWalletSession } from "@/lib/wallet-session";
import { SCANNER_PRESETS, buildKit } from "@/lib/rig-kit";

const short = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;

export function PoolPanel() {
  const lot = useLottery();
  const wallet = useWalletSession();
  const [addr, setAddr] = useState("");
  useEffect(() => { if (!addr && wallet?.paymentAddress) setAddr(wallet.paymentAddress); }, [wallet?.paymentAddress, addr]);
  const stats = useQuery({ queryKey: ["puzzle-pool-stats", lot.poolDone], queryFn: () => poolStatsFn({ data: {} }), refetchInterval: 15_000 });
  const s = stats.data;
  const keys = s ? BigInt(s.slices) * SLICE_SIZE : 0n;

  return (
    <section className="mt-6 rounded border border-accent/40 bg-card/60 p-4 text-xs">
      <div className="flex items-center gap-3">
        <SwarmStinger className="size-12 shrink-0" />
        <div>
          <p className="label text-accent">SHARED SCANNING POOL</p>
          <p className="display text-sm text-foreground">THE SWARM</p>
        </div>
      </div>
      <p className="mt-2 text-muted-foreground">
        The site splits #71 into {SLICE_COUNT.toLocaleString()} slices of {Number(SLICE_SIZE).toLocaleString()} keys and hands each visitor an unused one, so no two browsers repeat work.
        Every slice hides 3 secret trap keys at random spots. A slice only counts when the scanner returns all three. That is strong evidence of scanning, but not a guarantee that every key in the slice was checked.
      </p>
      <details className="mt-2 text-[11px] text-muted-foreground">
        <summary className="label cursor-pointer">WHAT TRAP KEYS CAN'T CATCH</summary>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          <li>Partial scans: someone who checks most of a slice still finds all 3 traps fairly often (scan 90% → about 73% chance), so some skipped work can earn credit.</li>
          <li>Hidden prize: a scanner could find the real #71 key, keep it, and report only the traps. The pool can't see this; the 80/20 split only applies if the finder uses our sweep.</li>
          <li>Broken or wrong scanners: a buggy rig may hit the traps yet miss other keys, leaving gaps nobody revisits.</li>
          <li>Many identities: one person can use many worker addresses; credit shows work, not unique people.</li>
          <li>Trust in the site: trap keys come from a server secret, so you rely on the pool to place them fairly and keep them private.</li>
        </ul>
        <p className="mt-1">Credit is a public record of verified trap hits, not proof of full coverage or a guaranteed payout.</p>
      </details>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Box label="SLICES DONE" value={s ? s.slices.toLocaleString() : "…"} />
        <Box label="KEYS CHECKED BY POOL" value={s ? keys.toLocaleString() : "…"} />
        <Box label="PROSPECTORS" value={s ? s.workers.toLocaleString() : "…"} />
      </div>

      {s?.heat && <RangeHeatmap done={s.heat.done} open={s.heat.open} active={s.active ?? 0} />}

      {lot.poolWorker ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">CREDITING <span className="text-foreground" data-no-translate>{short(lot.poolWorker)}</span> · {lot.poolDone} SLICES FROM THIS DEVICE</span>
          {lot.poolMsg && <span className="text-accent">{lot.poolMsg}</span>}
          {!lot.on && <button onClick={lotteryStart} className="rounded bg-primary px-3 py-1 text-primary-foreground">[ START SCANNING ]</button>}
          <button onClick={() => lotterySetPool(null)} className="ml-auto rounded border border-border px-3 py-1 text-muted-foreground">[ LEAVE POOL · SCAN SOLO ]</button>
          {lot.on && <ScanProgress done={lot.poolScanned} size={lot.poolSize} rate={lot.rate} />}
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

      <TestPool addr={lot.poolWorker ?? addr} />

      <RigLaunchKit worker={addr} />
      <RigApi />

      <p className="mt-3 text-[11px] text-muted-foreground">
        Credit is a public record of who did the work. Whoever's browser finds the key still holds it and signs the sweep (80% to them, 20% treasury). Half of the treasury share — {POOL_DIVIDEND_PERCENT}% of the prize — is pledged to contributors by verified slices; the treasury pays it after the sweep confirms, so it is a promise, not enforced by Bitcoin —
        the pool cannot force a payout. Your address is shown on this board.
      </p>
    </section>
  );
}

function RangeHeatmap({ done, open, active }: { done: Record<string, number>; open: Record<string, number>; active: number }) {
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="label text-muted-foreground">#71 RANGE MAP · {HEAT_CELLS.toLocaleString()} CHUNKS · LIVE</p>
        <p className="text-[11px] text-muted-foreground">
          <span className="mr-1 inline-block h-2 w-2 bg-bitcoin" /> SCANNED
          <span className="ml-3 mr-1 inline-block h-2 w-2 bg-signal" /> BEING SCANNED NOW ({active})
        </p>
      </div>
      <div className="mt-2 grid aspect-square w-full max-w-md gap-px bg-border p-px" style={{ gridTemplateColumns: `repeat(${HEAT_SIDE}, 1fr)` }}>
        {Array.from({ length: HEAT_CELLS }, (_, i) => (
          <div key={i} title={`chunk ${i}`} className={open[i] ? "bg-signal" : done[i] ? "bg-bitcoin" : "bg-background"}
            style={done[i] && !open[i] ? { opacity: Math.min(1, 0.4 + done[i] / 4) } : undefined} />
        ))}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Each chunk is {HEAT_CELL_SLICES.toLocaleString()} slices. A lit chunk has at least one finished or leased slice — the range is huge, so it fills slowly.</p>
    </div>
  );
}

function TestPool({ addr }: { addr: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stats = useQuery({ queryKey: ["puzzle-test-stats", status], queryFn: () => poolStatsFn({ data: { pool: "test" } }) });
  const run = async () => {
    setBusy(true);
    try { const r = await runTestSlice(addr, setStatus); setStatus(r.ok ? r.message : `REJECTED · ${r.message}`); }
    catch (e) { setStatus(`FAILED · ${(e as Error).message}`); }
    finally { setBusy(false); }
  };
  return (
    <div className="mt-4 border border-border p-3">
      <p className="label text-signal">TEST RANGE · NO PRIZE</p>
      <p className="mt-1 text-[11px] text-muted-foreground">A tiny practice range (65,536 keys per slice) that runs the full claim → scan → trap-key proof in a few seconds. Credit here is separate from #71.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button disabled={busy || !isWorkerAddress(addr)} onClick={run} className="rounded border border-signal px-3 py-1 text-signal disabled:opacity-50">[ RUN TEST SLICE ]</button>
        {!isWorkerAddress(addr) && <span className="text-[11px] text-muted-foreground">Enter your address above first.</span>}
        {status && <span data-testid="test-status" className={status.startsWith("CREDITED") ? "text-signal" : "text-muted-foreground"}>{status}</span>}
        {stats.data && <span className="ml-auto text-[11px] text-muted-foreground">TEST SLICES DONE: <span data-testid="test-done">{stats.data.slices}</span></span>}
      </div>
    </div>
  );
}

function RigLaunchKit({ worker }: { worker: string }) {
  const [os, setOs] = useState<"linux" | "windows">("linux");
  const [preset, setPreset] = useState(SCANNER_PRESETS[0].id);
  const [pool, setPool] = useState<"71" | "test">("test");
  const [copied, setCopied] = useState(false);
  const p = SCANNER_PRESETS.find((x) => x.id === preset) ?? SCANNER_PRESETS[0];
  const [cmd, setCmd] = useState(p.linux);
  useEffect(() => setCmd(os === "windows" ? p.windows : p.linux), [os, p]);
  const ok = isWorkerAddress(worker);
  const file = os === "windows" ? "swarm-rig.ps1" : "swarm-rig.sh";
  const run = os === "windows" ? `powershell -ExecutionPolicy Bypass -File .\\${file}` : `chmod +x ${file} && ./${file}`;
  const download = () => {
    const blob = new Blob([buildKit(os, worker, cmd, pool)], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = file;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const tab = (on: boolean) => `rounded border px-2 py-1 ${on ? "border-primary text-primary" : "border-border text-muted-foreground"}`;
  return (
    <div className="mt-4 border border-primary/40 p-3">
      <p className="label text-primary">GPU RIG LAUNCH KIT · 1-CLICK</p>
      <p className="mt-1 text-[11px] text-muted-foreground">Download a script with your address and scanner already set. Run it next to your scanner program.</p>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
        <button className={tab(os === "linux")} onClick={() => setOs("linux")}>LINUX / MAC</button>
        <button className={tab(os === "windows")} onClick={() => setOs("windows")}>WINDOWS</button>
        <span className="mx-1 text-border">|</span>
        {SCANNER_PRESETS.map((s) => (
          <button key={s.id} className={tab(preset === s.id)} onClick={() => setPreset(s.id)}>{s.label}</button>
        ))}
        <span className="mx-1 text-border">|</span>
        <button className={tab(pool === "test")} onClick={() => setPool("test")}>PRACTICE POOL</button>
        <button className={tab(pool === "71")} onClick={() => setPool("71")}>#71 POOL</button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{p.note}</p>
      <label className="mt-2 block text-[11px] text-muted-foreground">SCANNER COMMAND</label>
      <input value={cmd} onChange={(e) => setCmd(e.target.value)} className="mt-1 w-full border border-border bg-background px-2 py-1 font-mono text-[11px]" data-no-translate />
      <p className="mt-2 text-[11px] text-muted-foreground">WORKER: <span className="font-mono" data-no-translate>{ok ? worker : "enter your address above first"}</span></p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button disabled={!ok} onClick={download} className="rounded border border-primary px-3 py-1 text-primary disabled:opacity-50">[ DOWNLOAD {file.toUpperCase()} ]</button>
        <button onClick={() => { navigator.clipboard.writeText(run); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="rounded border border-border px-3 py-1 text-muted-foreground">{copied ? "COPIED" : "[ COPY RUN COMMAND ]"}</button>
      </div>
      <pre className="mt-2 overflow-x-auto bg-background p-2 text-[11px]" data-no-translate>{run}</pre>
      <p className="mt-2 text-[11px] text-muted-foreground">{os === "linux" ? "Needs curl, jq and sha256sum." : "Needs only built-in PowerShell."} Try the practice pool first. If a 4th key turns up it may be the prize: the script saves it to found-&lt;slice&gt;.txt on your computer and never uploads it. Scanner flags differ between versions, so check yours.</p>
    </div>
  );
}

function RigApi() {
  const one = "curl -s https://bitmapwin.app/api/public/puzzle/71/rig.sh | WORKER=<your-btc-address> SCANNER='<scanner> {start} {end} {targets} {out}' bash";
  return (
    <details className="mt-4 border border-border p-3">
      <summary className="label cursor-pointer text-accent">RIG API · BRING YOUR OWN GPU</summary>
      <p className="mt-2 text-muted-foreground">Point any range scanner at the pool. It gets a slice, the puzzle address and 3 trap addresses; it must print every key it matches.</p>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all bg-background p-2 text-[11px]" data-no-translate>{one}</pre>
      <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground" data-no-translate>
        <li>Practice first: use /api/public/puzzle/test/… (or POOL=test in the script) — same rules, no prize.</li>
        <li>GET /api/public/puzzle/71/range?worker=ADDR → index, token, startHex, endHex, targetAddress, canaryAddresses[3]</li>
        <li>POST /api/public/puzzle/71/share {"{"} index, token, canaryProof {"}"} — canaryProof = sha256 of the 3 trap keys (64-hex, sorted, joined)</li>
      </ul>
      <p className="mt-2 text-[11px] text-muted-foreground">The wrapper needs curl, jq and sha256sum. Use a scanner that supports a key range and multiple addresses (VanitySearch/KeyHunt forks); its exact flags vary, so check its docs. If it finds a 4th key, that may be the prize — the script saves it locally and never uploads it.</p>
      <p className="mt-2 text-[11px] text-muted-foreground">Returning all 3 trap keys shows your rig scanned the slice; it does not prove every key was checked. A rig that skips part of the range can still pass sometimes, and the pool cannot tell if a rig hides a real prize key.</p>
    </details>
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

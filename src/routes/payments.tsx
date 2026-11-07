import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { listAllJobs, type InscribeJob } from "@/lib/shadow-inscribe";

export const Route = createFileRoute("/payments")({
  head: () => ({
    meta: [
      { title: "Inscription Payment History — BITMAPWIN" },
      { name: "description", content: "See every inscription fee payment and where it stands: paid, waiting, inscribing or inscribed on Bitcoin." },
      { property: "og:title", content: "Inscription Payment History — BITMAPWIN" },
      { property: "og:description", content: "Track each inscription fee payment from paid to inscribed on Bitcoin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentsPage,
});

const API = "https://mempool.space/api";
type Stage = "PAYMENT PENDING" | "PAID · NEEDS STEP 2" | "PAID · KEY NOT ON THIS DEVICE" | "INSCRIBING · PENDING" | "INSCRIBED · CONFIRMED" | "UNKNOWN";
type Row = { address: string; sats: number; commitTxid?: string | undefined; revealTxid?: string | undefined; stage: Stage; hasKey: boolean; time?: number | undefined };

async function j<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(API + path, { signal: AbortSignal.timeout(10_000) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

type Utxo = { txid: string; value: number; status: { confirmed: boolean; block_time?: number } };
type Tx = { txid: string; status: { confirmed: boolean; block_time?: number }; vin: { prevout?: { scriptpubkey_address?: string } }[]; vout: { scriptpubkey_address?: string; value: number }[] };

/** Where one one-time address stands, read live from Bitcoin. */
async function stageOf(address: string, job: InscribeJob | undefined): Promise<Omit<Row, "address" | "hasKey">> {
  if (job?.revealTxid) {
    const st = await j<{ confirmed: boolean; block_time?: number }>(`/tx/${job.revealTxid}/status`);
    return { sats: job.commitAmount, commitTxid: job.commitTxid, revealTxid: job.revealTxid, stage: st?.confirmed ? "INSCRIBED · CONFIRMED" : "INSCRIBING · PENDING", time: st?.block_time };
  }
  const utxos = (await j<Utxo[]>(`/address/${address}/utxo`)) ?? [];
  const u = utxos[0];
  if (u) {
    if (!u.status.confirmed) return { sats: u.value, commitTxid: u.txid, stage: "PAYMENT PENDING" };
    return { sats: u.value, commitTxid: u.txid, stage: job ? "PAID · NEEDS STEP 2" : "PAID · KEY NOT ON THIS DEVICE", time: u.status.block_time };
  }
  // Nothing unspent: either never paid, or already spent by a reveal.
  const txs = (await j<Tx[]>(`/address/${address}/txs`)) ?? [];
  const spend = txs.find((t) => t.vin.some((v) => v.prevout?.scriptpubkey_address === address));
  const fund = txs.find((t) => t.vout.some((o) => o.scriptpubkey_address === address));
  if (spend) return { sats: fund?.vout.find((o) => o.scriptpubkey_address === address)?.value ?? 0, commitTxid: fund?.txid, revealTxid: spend.txid, stage: spend.status.confirmed ? "INSCRIBED · CONFIRMED" : "INSCRIBING · PENDING", time: spend.status.block_time };
  if (job && !job.commitTxid) return { sats: job.commitAmount, stage: "UNKNOWN" };
  return { sats: job?.commitAmount ?? 0, commitTxid: job?.commitTxid, stage: "PAYMENT PENDING" };
}

const TONE: Record<Stage, string> = {
  "PAYMENT PENDING": "text-signal",
  "PAID · NEEDS STEP 2": "text-bitcoin",
  "PAID · KEY NOT ON THIS DEVICE": "text-destructive",
  "INSCRIBING · PENDING": "text-signal",
  "INSCRIBED · CONFIRMED": "text-bitcoin",
  UNKNOWN: "text-muted-foreground",
};

function PaymentsPage() {
  const [wallet, setWallet] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);

  const scan = async (walletAddr: string) => {
    setBusy(true);
    const jobs = listAllJobs();
    const byAddr = new Map(jobs.map((x) => [x.commitAddress, x]));
    const addrs = new Set(jobs.filter((x) => x.commitTxid || x.revealTxid).map((x) => x.commitAddress));
    // Also find one-time taproot addresses this wallet paid, even if the key is gone.
    if (walletAddr) {
      const txs = (await j<Tx[]>(`/address/${walletAddr}/txs`)) ?? [];
      for (const t of txs) {
        if (!t.vin.some((v) => v.prevout?.scriptpubkey_address === walletAddr)) continue;
        for (const o of t.vout) {
          const a = o.scriptpubkey_address;
          if (a && a !== walletAddr && /^bc1p/i.test(a) && o.value > 1_000 && o.value < 100_000) addrs.add(a);
        }
      }
    }
    const out: Row[] = [];
    for (const a of addrs) out.push({ address: a, hasKey: byAddr.has(a), ...(await stageOf(a, byAddr.get(a))) });
    out.sort((x, y) => (y.time ?? 9e12) - (x.time ?? 9e12));
    setRows(out);
    setBusy(false);
  };

  useEffect(() => {
    void scan("");
  }, []);

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-8">
      <p className="label text-signal">BITMAPWIN / PAYMENTS</p>
      <h1 className="display mt-2 text-4xl">INSCRIPTION PAYMENTS</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Every fee you paid to inscribe, and where it stands on Bitcoin. Add your paying wallet address to also find payments made on another browser.
      </p>

      <form
        className="mt-6 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void scan(wallet.trim());
        }}
      >
        <input
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          placeholder="YOUR PAYING WALLET ADDRESS (OPTIONAL)"
          className="min-w-[260px] flex-1 border border-border bg-background px-3 py-2 font-mono text-xs"
        />
        <button disabled={busy} className="border border-bitcoin px-3 py-2 font-mono text-xs text-bitcoin hover:bg-bitcoin hover:text-background disabled:opacity-40">
          {busy ? "CHECKING BITCOIN…" : "◆ CHECK"}
        </button>
      </form>

      <div className="mt-6 space-y-2">
        {rows === null ? <p className="font-mono text-xs text-signal">CHECKING BITCOIN…</p> : null}
        {rows?.length === 0 ? <p className="font-mono text-xs text-muted-foreground">NO INSCRIPTION PAYMENTS FOUND.</p> : null}
        {rows?.map((r) => (
          <div key={r.address} className="panel border border-border p-3 font-mono text-[11px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={TONE[r.stage]}>● {r.stage}</span>
              <span className="text-muted-foreground">
                {r.sats.toLocaleString("en-US")} SATS{r.time ? ` · ${new Date(r.time * 1000).toLocaleString()}` : ""}
              </span>
            </div>
            <p className="mt-1 break-all text-muted-foreground">{r.address}</p>
            <div className="mt-1 flex flex-wrap gap-3">
              {r.commitTxid ? <a className="text-signal underline" target="_blank" rel="noreferrer" href={`https://mempool.space/tx/${r.commitTxid}`}>PAYMENT ↗</a> : null}
              {r.revealTxid ? <a className="text-signal underline" target="_blank" rel="noreferrer" href={`https://ordinals.com/inscription/${r.revealTxid}i0`}>INSCRIPTION ↗</a> : null}
              {r.stage === "PAID · NEEDS STEP 2" ? <Link to="/mint" className="text-bitcoin underline">FINISH STEP 2 ON THE MINT PAGE →</Link> : null}
            </div>
            {r.stage === "PAID · KEY NOT ON THIS DEVICE" ? (
              <p className="mt-1 text-muted-foreground">THE ONE-TIME KEY FOR THIS PAYMENT IS NOT IN THIS BROWSER. TRY THE BROWSER YOU PAID FROM, OR A SAVED RECOVERY FILE.</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

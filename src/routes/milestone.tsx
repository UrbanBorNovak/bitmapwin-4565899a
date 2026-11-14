import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MILESTONE_PRESETS, momentToUnix, checkMoment, gapLabel } from "@/lib/milestone-block";

export const Route = createFileRoute("/milestone")({
  component: MilestonePage,
  head: () => ({
    meta: [
      { title: "Milestone Block Matcher · Find the Bitcoin block of your day · BitmapWIN" },
      { name: "description", content: "Enter a birth, wedding or first-buy moment and find the exact Bitcoin block mined then — and its BITMAP." },
      { property: "og:title", content: "Which Bitcoin block was mined on your day?" },
      { property: "og:description", content: "Match any real-world moment to the Bitcoin block mined at that minute, straight from the chain." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const API = "https://mempool.space/api";
type Found = { height: number; hash: string; timestamp: number; txCount?: number; pool?: string; size?: number; moment?: number };

async function blockAtHeight(h: number): Promise<Found> {
  const hash = await (await fetch(`${API}/block-height/${h}`)).text();
  return details({ height: h, hash, timestamp: 0 });
}
async function blockAtTime(unix: number): Promise<Found> {
  const r = await fetch(`${API}/v1/mining/blocks/timestamp/${unix}`);
  if (!r.ok) throw new Error("lookup failed");
  const b = await r.json();
  return details({ height: b.height, hash: b.hash, timestamp: 0, moment: unix });
}
async function details(f: Found): Promise<Found> {
  const r = await fetch(`${API}/v1/block/${f.hash}`);
  if (!r.ok) throw new Error("block details failed");
  const b = await r.json();
  return { ...f, timestamp: b.timestamp, txCount: b.tx_count, size: b.size, pool: b.extras?.pool?.name };
}

function MilestonePage() {
  const [value, setValue] = useState("");
  const [utc, setUtc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [found, setFound] = useState<Found | null>(null);

  const run = async (fn: () => Promise<Found>) => {
    setBusy(true); setErr(null); setFound(null);
    try { setFound(await fn()); } catch { setErr("Couldn't reach the block source. Try again in a moment."); }
    finally { setBusy(false); }
  };
  const search = () => {
    const unix = momentToUnix(value, utc);
    if (unix == null) return setErr("Pick a date (and time if you know it).");
    const c = checkMoment(unix, Math.floor(Date.now() / 1000));
    if (c === "pre-genesis") return setErr("That moment is before Bitcoin's first block (3 Jan 2009). Try the genesis block below, or an anniversary after 2009.");
    if (c === "future") return setErr("That moment hasn't been mined yet.");
    run(() => blockAtTime(unix));
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs tracking-widest text-muted-foreground">MILESTONE BLOCK MATCHER</p>
        <h1 className="font-display text-3xl">Which block was mined on your day?</h1>
        <p className="text-muted-foreground">A birth, a wedding, your first sats. Enter the moment and see the Bitcoin block mined then — every block is a BITMAP.</p>
      </header>

      <section className="rounded-lg border border-border bg-card/60 p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)}
            className="flex-1 min-w-[220px] rounded-md border border-border bg-background px-3 py-2 font-mono text-sm" aria-label="Date and time" />
          <label className="flex items-center gap-2 font-mono text-xs">
            <input type="checkbox" checked={utc} onChange={(e) => setUtc(e.target.checked)} /> TIME IS UTC
          </label>
          <button onClick={search} disabled={busy} className="rounded-md bg-primary px-4 py-2 font-mono text-sm text-primary-foreground disabled:opacity-50">
            {busy ? "SEARCHING…" : "FIND MY BLOCK"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{utc ? "Time read as UTC." : "Time read in your device's timezone."} No date is stored.</p>
        <div className="flex flex-wrap gap-2">
          {MILESTONE_PRESETS.map((p) => (
            <button key={p.height} onClick={() => run(() => blockAtHeight(p.height))}
              className="rounded border border-border px-2 py-1 font-mono text-xs hover:border-primary">{p.label} · {p.height.toLocaleString("en-US")}</button>
          ))}
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
      </section>

      {found && (
        <section className="rounded-lg border border-primary/40 bg-card/60 p-5 space-y-4">
          <div>
            <p className="font-mono text-xs text-muted-foreground">YOUR BLOCK</p>
            <h2 className="font-display text-4xl text-primary">{found.height.toLocaleString("en-US")}.bitmap</h2>
            <p className="mt-1">Mined {new Date(found.timestamp * 1000).toUTCString()}
              {found.moment != null && <> — {gapLabel(found.moment, found.timestamp)} your moment</>}.</p>
          </div>
          <dl className="grid grid-cols-3 gap-3 font-mono text-sm">
            <div><dt className="text-xs text-muted-foreground">TRANSACTIONS</dt><dd className="text-accent">{found.txCount?.toLocaleString("en-US") ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">MINED BY</dt><dd className="text-accent">{found.pool ?? "Unknown"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">SIZE</dt><dd className="text-accent">{found.size ? `${(found.size / 1e6).toFixed(2)} MB` : "—"}</dd></div>
          </dl>
          <p className="text-xs text-muted-foreground">Shows the last block mined at or before your moment. Miners set block times, so they can be off by up to about two hours.</p>
          <div className="flex flex-wrap gap-2">
            <Link to="/bitmap/$block" params={{ block: String(found.height) }} className="rounded-md bg-primary px-3 py-2 font-mono text-xs text-primary-foreground">OWNER & MARKET</Link>
            <Link to="/slab" className="rounded-md border border-border px-3 py-2 font-mono text-xs">3D SLAB</Link>
            <Link to="/oasis" className="rounded-md border border-border px-3 py-2 font-mono text-xs">OASIS</Link>
            <a href={`https://mempool.space/block/${found.hash}`} target="_blank" rel="noreferrer" className="rounded-md border border-border px-3 py-2 font-mono text-xs">MEMPOOL ↗</a>
          </div>
        </section>
      )}
    </main>
  );
}

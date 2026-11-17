import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BOUNTY_CONTRACT, BOUNTY_DEPLOY_TX, EXPLORER_TX, STX_FAUCET } from "@/lib/stacks-pilot";
import type { Bounty } from "@/lib/bounty-client";

export const Route = createFileRoute("/bounties")({
  component: BountiesPage,
  head: () => ({
    meta: [
      { title: "Builder Bounties (testnet) · Escrowed Land Forge commissions · BitmapWIN" },
      { name: "description", content: "Post a build request for a BITMAP with tokens locked in an open Clarity escrow. Builders submit an inscription; only the poster can release payment, and expired bounties refund. Stacks testnet only." },
      { property: "og:title", content: "Builder Bounties · BitmapWIN" },
      { property: "og:description", content: "Escrowed build commissions for BITMAP land. The contract holds the funds, not BitmapWIN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const STX_KEY = "bitmap.stake-pilot.stx";
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const fmt = (n: number) => n.toLocaleString("en-US");
const client = () => import("@/lib/bounty-client");

function BountiesPage() {
  const [stx, setStx] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [txs, setTxs] = useState<{ label: string; txid: string }[]>([]);
  useEffect(() => { setStx(localStorage.getItem(STX_KEY) ?? ""); }, []);

  const q = useQuery({ queryKey: ["bounties"], queryFn: async () => (await client()).readBounties(), refetchInterval: 30_000 });
  const bal = useQuery({ queryKey: ["bounty-bal", stx], enabled: !!stx, queryFn: async () => (await client()).testTokenBalance(stx) });

  const run = async (label: string, fn: () => Promise<string>) => {
    setBusy(label); setMsg(null);
    try { const txid = await fn(); setTxs((t) => [{ label, txid }, ...t]); setMsg(`${label} sent. It shows here after the next testnet block.`); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };
  const connect = async () => {
    try { const { connectStacksTestnet } = await import("@/lib/stacks-pilot-client"); const a = await connectStacksTestnet(); setStx(a); localStorage.setItem(STX_KEY, a); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pt-10 pb-32">
      <header className="space-y-2">
        <p className="font-mono text-xs tracking-widest text-signal">BUILDER BOUNTIES · STACKS TESTNET</p>
        <h1 className="font-display text-3xl">Commission a build. The contract holds the money.</h1>
        <p className="text-muted-foreground">Post a request for a BITMAP and lock the reward in an open escrow contract. Builders answer with an inscription. You choose one and the contract pays them in full. If nobody is chosen by the deadline, you take it back.</p>
      </header>

      <div className="rounded-lg border border-bitcoin/60 bg-card/60 p-4 font-mono text-xs leading-relaxed">
        <p className="text-bitcoin">TEST ONLY · NO REAL VALUE</p>
        <p className="mt-1 text-muted-foreground">Rewards are BitmapWin Test sBTC on Stacks testnet. The contract has no admin, no fee and no pause: BitmapWIN cannot move escrowed tokens. It does not check who owns the BITMAP or judge the work; the poster decides, and can let a bounty expire instead of paying.</p>
        <p className="mt-2 break-all text-muted-foreground">Contract: <a className="text-signal hover:underline" href={EXPLORER_TX(BOUNTY_DEPLOY_TX)} target="_blank" rel="noreferrer">{BOUNTY_CONTRACT}</a></p>
      </div>

      <section className="rounded-lg border border-border bg-card/60 p-4 space-y-3">
        <p className="font-mono text-xs tracking-widest text-signal">1 · STACKS TESTNET WALLET</p>
        {stx ? (
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
            <span>{short(stx)}</span>
            <span className="text-muted-foreground">{bal.data != null ? `${fmt(bal.data)} test sats` : "…"}</span>
            <button className="rounded border border-signal/50 px-2 py-1 text-signal hover:border-signal disabled:opacity-50" disabled={!!busy} onClick={() => run("Mint 100,000 test sats", async () => (await client()).mintTestTokens(stx))}>Get 100,000 test sats</button>
            <a className="text-muted-foreground hover:text-foreground" href={STX_FAUCET} target="_blank" rel="noreferrer">Need STX for fees?</a>
          </div>
        ) : (
          <button className="rounded bg-bitcoin px-3 py-2 font-mono text-xs text-primary-foreground" onClick={connect}>Connect Leather or Xverse (testnet)</button>
        )}
      </section>

      {stx && <PostForm busy={!!busy} onPost={(h, amt, t, b) => run(`Post bounty for ${h}.bitmap`, async () => (await client()).createBounty(h, amt, t, b))} />}

      {msg && <p className="font-mono text-xs text-signal">{msg}</p>}
      {txs.length > 0 && (
        <ul className="space-y-1 font-mono text-xs">
          {txs.map((t) => <li key={t.txid}><a className="text-signal hover:underline" href={EXPLORER_TX(t.txid)} target="_blank" rel="noreferrer">{t.label} · {short(t.txid)}</a></li>)}
        </ul>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs tracking-widest text-signal">LIVE FROM THE CONTRACT</p>
          <button className="font-mono text-xs text-muted-foreground hover:text-foreground" onClick={() => q.refetch()}>{q.isFetching ? "Reading…" : "Refresh"}</button>
        </div>
        {q.isError && <p className="font-mono text-xs text-destructive">Could not read the testnet contract. <button className="underline" onClick={() => q.refetch()}>Try again</button></p>}
        {q.data && q.data.bounties.length === 0 && <p className="text-sm text-muted-foreground">No bounties posted yet.</p>}
        {q.data?.bounties.map((b) => (
          <BountyCard key={b.id} b={b} tip={q.data.burnHeight} me={stx} busy={!!busy}
            onSubmit={(ref) => run(`Submit to bounty #${b.id}`, async () => (await client()).submitWork(b.id, ref))}
            onAccept={(who) => run(`Pay ${short(who)} for bounty #${b.id}`, async () => (await client()).acceptAndPay(b.id, who))}
            onRefund={() => run(`Refund bounty #${b.id}`, async () => (await client()).cancelAndRefund(b.id))} />
        ))}
      </section>
    </div>
  );
}

function PostForm({ busy, onPost }: { busy: boolean; onPost: (h: number, amt: number, title: string, blocks: number) => void }) {
  const [height, setHeight] = useState("");
  const [amount, setAmount] = useState("25000");
  const [title, setTitle] = useState("");
  const [days, setDays] = useState("7");
  const h = Number(height), amt = Number(amount), blocks = Math.round(Number(days) * 144);
  const valid = Number.isInteger(h) && h >= 0 && height !== "" && Number.isInteger(amt) && amt >= 1000 && title.trim().length > 0 && title.length <= 120 && blocks >= 6 && blocks <= 4320;
  return (
    <section className="rounded-lg border border-border bg-card/60 p-4 space-y-3">
      <p className="font-mono text-xs tracking-widest text-signal">2 · POST A BOUNTY</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span className="font-mono text-xs text-muted-foreground">BITMAP number</span>
          <input className="w-full rounded border border-border bg-background px-2 py-1.5 font-mono" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value.replace(/\D/g, ""))} placeholder="521066" /></label>
        <label className="space-y-1 text-sm"><span className="font-mono text-xs text-muted-foreground">Reward (test sats, min 1,000)</span>
          <input className="w-full rounded border border-border bg-background px-2 py-1.5 font-mono" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} /></label>
        <label className="space-y-1 text-sm sm:col-span-2"><span className="font-mono text-xs text-muted-foreground">What should be built? (max 120 characters)</span>
          <input className="w-full rounded border border-border bg-background px-2 py-1.5" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Observation tower with a rooftop garden" /></label>
        <label className="space-y-1 text-sm"><span className="font-mono text-xs text-muted-foreground">Open for (days, max 30)</span>
          <input className="w-full rounded border border-border bg-background px-2 py-1.5 font-mono" inputMode="decimal" value={days} onChange={(e) => setDays(e.target.value)} /></label>
      </div>
      <p className="font-mono text-xs text-muted-foreground">About {fmt(blocks)} Bitcoin blocks. Your wallet sends the reward into the contract; you pay only the Stacks network fee.</p>
      <button className="rounded bg-bitcoin px-3 py-2 font-mono text-xs text-primary-foreground disabled:opacity-50" disabled={!valid || busy} onClick={() => onPost(h, amt, title.trim(), blocks)}>Lock reward and post</button>
    </section>
  );
}

function BountyCard({ b, tip, me, busy, onSubmit, onAccept, onRefund }: {
  b: Bounty; tip: number; me: string; busy: boolean; onSubmit: (ref: string) => void; onAccept: (who: string) => void; onRefund: () => void;
}) {
  const [ref, setRef] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [okRef, setOkRef] = useState(false);
  useEffect(() => { client().then((c) => setOkRef(c.isInscriptionRef(ref))); }, [ref]);
  const mine = me === b.poster;
  const expired = tip > b.deadline;
  const left = b.deadline - tip;
  const state = b.status === "paid" ? "PAID" : b.status === "refunded" ? "REFUNDED" : expired ? "EXPIRED" : `OPEN · ~${fmt(Math.max(left, 0))} blocks left`;
  return (
    <article className="rounded-lg border border-border bg-card/60 p-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-muted-foreground">#{b.id} · <Link to="/bitmap/$block" params={{ block: String(b.height) }} className="text-bitcoin hover:underline">{b.height}.bitmap</Link> · by {short(b.poster)}{mine ? " (you)" : ""}</p>
          <h2 className="font-display text-lg">{b.title}</h2>
        </div>
        <div className="text-right font-mono text-xs">
          <p className="text-bitcoin text-sm">{fmt(b.amount)} test sats</p>
          <p className={b.status === "open" && !expired ? "text-signal" : "text-muted-foreground"}>{state}</p>
        </div>
      </div>

      {b.submissions.length > 0 && (
        <ul className="space-y-2">
          {b.submissions.map((s) => (
            <li key={s.builder} className="rounded border border-border/70 p-2 font-mono text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span>{short(s.builder)}{b.winner === s.builder ? " · PAID" : ""}</span>
                <span className="break-all text-muted-foreground">{s.ref}</span>
                <button className="text-signal hover:underline" onClick={() => setPreview(preview === s.ref ? null : s.ref)}>{preview === s.ref ? "Hide" : "Inspect"}</button>
                {mine && b.status === "open" && (
                  <button className="rounded border border-bitcoin/60 px-2 py-0.5 text-bitcoin hover:border-bitcoin disabled:opacity-50" disabled={busy} onClick={() => onAccept(s.builder)}>Accept & pay</button>
                )}
              </div>
              {preview === s.ref && (
                <iframe title={`Inscription ${s.ref}`} src={`https://ordinals.com/preview/${s.ref}`} sandbox="allow-scripts" className="mt-2 aspect-square w-full rounded border border-border bg-background" loading="lazy" />
              )}
            </li>
          ))}
        </ul>
      )}

      {me && !mine && b.status === "open" && !expired && (
        <div className="flex flex-wrap gap-2">
          <input className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1.5 font-mono text-xs" placeholder="Inscription id of your build (…i0)" value={ref} onChange={(e) => setRef(e.target.value)} />
          <button className="rounded border border-signal/60 px-3 py-1.5 font-mono text-xs text-signal disabled:opacity-50" disabled={!okRef || busy} onClick={() => onSubmit(ref)}>Submit build</button>
          <Link to="/forge" className="self-center font-mono text-xs text-muted-foreground hover:text-foreground">Build it in Land Forge</Link>
        </div>
      )}
      {mine && b.status === "open" && expired && (
        <button className="rounded border border-border px-3 py-1.5 font-mono text-xs hover:border-foreground disabled:opacity-50" disabled={busy} onClick={onRefund}>Take back {fmt(b.amount)} test sats</button>
      )}
    </article>
  );
}

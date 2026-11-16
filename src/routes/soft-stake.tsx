import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { WalletConnect } from "@/components/WalletConnect";
import { saveWalletSession, useWalletSession } from "@/lib/wallet-session";
import { signMessageWithWallet } from "@/lib/browser-wallet";
import { bindingMessage, validateBinding } from "@/lib/stacks-softstake";
import { pilotAttestFn, type PilotAttestResult } from "@/lib/stacks-pilot.functions";
import { EXPLORER_TX, PILOT_STAKE, STX_FAUCET } from "@/lib/stacks-pilot";
import { useQuery } from "@tanstack/react-query";
import { watchdogStatusFn } from "@/lib/stake-watchdog.functions";

export const Route = createFileRoute("/soft-stake")({
  component: SoftStakePage,
  head: () => ({
    meta: [
      { title: "Soft-stake pilot (testnet) · Earn test sBTC with your BITMAP · BitmapWIN" },
      { name: "description", content: "Testnet pilot: keep your BITMAP in your wallet, prove you hold it, and earn worthless test sBTC on Stacks testnet. Mainnet rewards are off." },
      { property: "og:title", content: "BITMAP soft-stake pilot · Stacks testnet" },
      { property: "og:description", content: "Your BITMAP never moves. Prove ownership with a signature and claim test tokens on Stacks testnet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Live = Awaited<ReturnType<typeof import("@/lib/stacks-pilot-client").readPilot>>;
type Tx = { label: string; txid: string; status: string };
const STX_KEY = "bitmap.stake-pilot.stx";
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function SoftStakePage() {
  const wallet = useWalletSession();
  const attest = useServerFn(pilotAttestFn);
  const [stx, setStx] = useState("");
  const [height, setHeight] = useState("");
  const [att, setAtt] = useState<Extract<PilotAttestResult, { ok: true }> | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { setStx(localStorage.getItem(STX_KEY) ?? ""); }, []);
  const h = Number(height);
  const validHeight = height !== "" && Number.isInteger(h) && h >= 0;

  const latest = useRef(0);
  const refresh = async () => {
    if (!stx || !validHeight) return;
    const ticket = ++latest.current; // only the newest lookup may write
    try {
      const { readPilot } = await import("@/lib/stacks-pilot-client");
      const r = await readPilot(h, stx);
      if (ticket === latest.current) setLive(r);
    } catch { if (ticket === latest.current) setMsg("Could not read the testnet contract. Try again."); }
  };
  useEffect(() => {
    setLive(null); setAtt(null);
    if (!stx || !validHeight) { latest.current++; return; }
    const t = setTimeout(() => void refresh(), 400);
    return () => clearTimeout(t);
  }, [stx, height]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll pending transactions until they settle, then re-read the contract.
  useEffect(() => {
    if (!txs.some((t) => t.status === "pending")) return;
    const id = setInterval(async () => {
      const { txStatus } = await import("@/lib/stacks-pilot-client");
      const next = await Promise.all(txs.map(async (t) => (t.status === "pending" ? { ...t, status: await txStatus(t.txid) } : t)));
      if (next.some((t, i) => t.status !== txs[i]!.status)) { setTxs(next); void refresh(); }
    }, 15000);
    return () => clearInterval(id);
  }, [txs]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setMsg(null);
    try { await fn(); } catch (e) { setMsg(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(null); }
  };
  const send = (label: string, which: "stake" | "token", name: string, args: () => Promise<unknown[]>) => run(label, async () => {
    const { callPilot } = await import("@/lib/stacks-pilot-client");
    const txid = await callPilot(which, name, await args());
    setTxs((t) => [{ label, txid, status: "pending" }, ...t]);
  });

  const connectStx = () => run("stx", async () => {
    const { connectStacksTestnet } = await import("@/lib/stacks-pilot-client");
    const a = await connectStacksTestnet(); localStorage.setItem(STX_KEY, a); setStx(a);
  });

  const verify = () => run("verify", async () => {
    if (!wallet) throw new Error("Connect your Bitcoin wallet first");
    const b = { height: h, btcAddress: wallet.ordinalsAddress, stxAddress: stx, issuedAt: Math.floor(Date.now() / 1000), network: "testnet" as const };
    const bad = validateBinding(b); if (bad) throw new Error(bad);
    const signature = await signMessageWithWallet(wallet.provider, wallet.ordinalsAddress, bindingMessage(b));
    const r = await attest({ data: { ...b, signature } });
    if (!r.ok) throw new Error(r.status === "unavailable" ? `${r.reason}. Nothing was signed; try again.` : r.reason);
    setAtt(r);
  });

  const submitStake = () => att && send("Stake", "stake", "attest", async () => {
    const { Cl } = await import("@stacks/transactions");
    return [Cl.uint(att.epoch), Cl.uint(att.height), Cl.uint(att.weight), Cl.uint(att.issued), Cl.bufferFromHex(att.signature)];
  });

  const stakeMine = live?.stake && live.stake.owner === stx;
  const expired = live?.stake ? live.burnHeight > live.stake.expires : false;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pt-10 pb-32">
      <header className="space-y-2">
        <p className="font-mono text-xs tracking-widest text-signal">SOFT-STAKE PILOT · STACKS TESTNET</p>
        <h1 className="font-display text-3xl">Keep your BITMAP. Earn test sBTC.</h1>
        <p className="text-muted-foreground">Your BITMAP never leaves your wallet. You sign once to prove you hold it, and a test contract pays you test tokens while you keep holding.</p>
      </header>

      <div className="rounded-lg border border-bitcoin/60 bg-card/60 p-4 font-mono text-xs leading-relaxed">
        <p className="text-bitcoin">TEST ONLY · NO REAL VALUE</p>
        <p className="mt-1 text-muted-foreground">Rewards are BitmapWin Test sBTC on Stacks testnet. Mainnet rewards are switched off. Ownership is checked on real Bitcoin; BitmapWin signs that check, so this pilot trusts BitmapWin, not only the chain.</p>
      </div>

      <WatchdogPanel />

      <section className="space-y-3 rounded-lg border border-border bg-card/60 p-4">
        <p className="font-mono text-xs tracking-widest text-muted-foreground">1 · YOUR WALLETS</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="font-mono text-[11px] text-muted-foreground">BITCOIN (holds the BITMAP)</p>
            {wallet ? <p className="font-mono text-sm">{short(wallet.ordinalsAddress)}</p> : <WalletConnect onConnect={(w) => saveWalletSession(w)} />}
          </div>
          <div className="space-y-2">
            <p className="font-mono text-[11px] text-muted-foreground">STACKS TESTNET (receives test tokens)</p>
            {stx ? <p className="font-mono text-sm">{short(stx)} <button onClick={connectStx} className="ml-2 text-xs underline">change</button></p>
              : <button onClick={connectStx} disabled={busy === "stx"} className="rounded-md border border-border px-3 py-2 font-mono text-xs hover:border-primary disabled:opacity-50">{busy === "stx" ? "OPENING WALLET…" : "CONNECT LEATHER / XVERSE"}</button>}
            <p className="text-[11px] text-muted-foreground">Set the wallet to Testnet. Fees use free <a href={STX_FAUCET} target="_blank" rel="noreferrer" className="underline">test STX</a>.</p>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-card/60 p-4">
        <p className="font-mono text-xs tracking-widest text-muted-foreground">2 · PROVE YOU HOLD IT</p>
        <div className="flex flex-wrap items-center gap-2">
          <input value={height} onChange={(e) => setHeight(e.target.value.replace(/\D/g, ""))} placeholder="BITMAP number, e.g. 552718"
            inputMode="numeric" aria-label="BITMAP number" className="min-w-[200px] flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm" />
          <button onClick={verify} disabled={!wallet || !stx || !validHeight || !!busy} className="rounded-md bg-primary px-4 py-2 font-mono text-sm text-primary-foreground disabled:opacity-50">
            {busy === "verify" ? "CHECKING THE CHAIN…" : "SIGN & VERIFY"}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">Signing is free and moves nothing. We check that this address holds {validHeight ? `${h}.bitmap` : "the BITMAP"} right now.</p>
        {att && (
          <div className="space-y-2 rounded border border-signal/60 p-3 font-mono text-xs">
            <p className="text-signal">VERIFIED · WEIGHT {att.weight.toLocaleString("en-US")}</p>
            <p className="text-muted-foreground">{att.clock === "chain" ? `Held ${att.daysHeld.toLocaleString("en-US")} days since its last on-chain move.` : "Holding time could not be read, so it counts as 0 days."} Slab grade is not counted in the pilot yet.</p>
            <p className="text-muted-foreground">Submit within about 20 minutes, or sign again.</p>
            <button onClick={submitStake} disabled={!!busy} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{busy === "Stake" ? "OPENING WALLET…" : "STAKE ON TESTNET"}</button>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-card/60 p-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs tracking-widest text-muted-foreground">3 · YOUR STAKE</p>
          <button onClick={() => void refresh()} disabled={!stx || !validHeight} className="font-mono text-xs underline disabled:opacity-50">refresh</button>
        </div>
        {!live ? <p className="text-sm text-muted-foreground">Connect both wallets and enter a BITMAP number.</p> : (
          <div className="space-y-3 font-mono text-xs">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="STATUS" value={!live.stake ? "NOT STAKED" : !stakeMine ? "OTHER OWNER" : expired ? "EXPIRED" : "ACTIVE"} />
              <Stat label="WEIGHT" value={live.stake ? live.stake.weight.toLocaleString("en-US") : "—"} />
              <Stat label="CLAIMABLE" value={`${live.pending.toLocaleString("en-US")} t-sats`} />
              <Stat label="YOUR TEST sBTC" value={`${live.balance.toLocaleString("en-US")} t-sats`} />
            </div>
            {live.stake && stakeMine && <p className="text-muted-foreground">{expired ? "Expired: sign and stake again to keep earning." : `Re-confirm before testnet block ${live.stake.expires.toLocaleString("en-US")} (now ${live.burnHeight.toLocaleString("en-US")}).`}</p>}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => send("Claim", "stake", "claim", async () => { const { Cl } = await import("@stacks/transactions"); return [Cl.uint(h)]; })}
                disabled={!stakeMine || expired || live.pending <= 0 || !!busy} className="rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">CLAIM TEST sBTC</button>
              <button onClick={() => send("Mint test tokens", "token", "mint", async () => { const { Cl } = await import("@stacks/transactions"); return [Cl.uint(100000), Cl.principal(stx)]; })}
                disabled={!stx || !!busy} className="rounded-md border border-border px-3 py-2 hover:border-primary disabled:opacity-50">MINT 100,000 TEST t-sats</button>
              <button onClick={() => send("Fund pool", "stake", "fund", async () => { const { Cl } = await import("@stacks/transactions"); return [Cl.uint(50000)]; })}
                disabled={!stx || live.balance < 50000 || !!busy} className="rounded-md border border-border px-3 py-2 hover:border-primary disabled:opacity-50">FUND POOL 50,000</button>
            </div>
            <p className="text-muted-foreground">The pool pays only what someone deposits. Funding splits it across everyone staked at that moment, by weight.</p>
          </div>
        )}
      </section>

      {txs.length > 0 && (
        <section className="space-y-2 rounded-lg border border-border bg-card/60 p-4 font-mono text-xs">
          <p className="tracking-widest text-muted-foreground">TESTNET TRANSACTIONS</p>
          {txs.map((t) => (
            <p key={t.txid}><span className={t.status === "success" ? "text-signal" : t.status === "failed" ? "text-destructive" : "text-muted-foreground"}>{t.status.toUpperCase()}</span> · {t.label} · <a href={EXPLORER_TX(t.txid)} target="_blank" rel="noreferrer" className="underline">{short(t.txid)}</a></p>
          ))}
        </section>
      )}

      {msg && <p className="text-sm text-destructive">{msg}</p>}
      <p className="font-mono text-[11px] text-muted-foreground">Contract: <a href={`https://explorer.hiro.so/txid/${PILOT_STAKE}?chain=testnet`} target="_blank" rel="noreferrer" className="underline">{PILOT_STAKE}</a></p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-border p-2"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 text-sm">{value}</p></div>;
}

function WatchdogPanel() {
  const getStatus = useServerFn(watchdogStatusFn);
  const q = useQuery({ queryKey: ["stake-watchdog"], queryFn: () => getStatus(), refetchInterval: 60_000, staleTime: 30_000 });
  const d = q.data;
  const state = !d ? "CHECKING…" : !d.ok ? "NO DATA" : d.paused ? "PILOT PAUSED" : d.error ? "CHECK INCOMPLETE" : d.suspicious > 0 ? "SUSPICIOUS · PAUSING" : "ALL STAKES MATCH";
  const tone = d?.ok && !d.paused && !d.error && d.suspicious === 0 ? "text-signal" : "text-bitcoin";
  return (
    <section className="space-y-2 rounded-lg border border-border bg-card/60 p-4 font-mono text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="tracking-widest text-muted-foreground">WATCHDOG · TESTNET</p>
        <p className={tone}>{state}</p>
      </div>
      <p className="text-muted-foreground">Every few minutes it compares each stake on the contract with the list of approvals BitmapWin actually signed. A stake nobody signed, or an unexpected admin action, pauses the whole pilot: staking, funding and claims stop, and the test tokens stay in the contract.</p>
      {d && !d.ok && <p className="text-muted-foreground">{d.reason}.</p>}
      {d?.ok && (
        <>
          <p className="text-muted-foreground">Last check {new Date(d.ranAt).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC · testnet block {d.burnHeight.toLocaleString("en-US")} · {d.checked.toLocaleString("en-US")} contract calls compared.</p>
          {d.error && <p className="text-bitcoin">{d.error}. It will try again on the next run.</p>}
          {d.pauseTxid && <p>Pause sent: <a href={EXPLORER_TX(d.pauseTxid)} target="_blank" rel="noreferrer" className="underline">{short(d.pauseTxid)}</a></p>}
          {d.findings.length > 0 && (
            <ul className="space-y-1">
              {d.findings.map((f, i) => (
                <li key={i} className={f.suspicious ? "text-bitcoin" : "text-muted-foreground"}>
                  {f.suspicious ? "SUSPICIOUS" : "INFO"}{f.height != null ? ` · ${f.height}.bitmap` : ""} · {f.detail}{f.txid && <> · <a href={EXPLORER_TX(f.txid)} target="_blank" rel="noreferrer" className="underline">{short(f.txid)}</a></>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

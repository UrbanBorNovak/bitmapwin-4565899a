import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { WalletConnect } from "@/components/WalletConnect";
import { saveWalletSession, useWalletSession } from "@/lib/wallet-session";
import { signMessageWithWallet } from "@/lib/browser-wallet";
import { bindingMessage, rewardPerWeight, stakeShareBps, validateBinding, MAINNET_REWARDS_ENABLED } from "@/lib/stacks-softstake";
import { pilotAttestFn, type PilotAttestResult } from "@/lib/stacks-pilot.functions";
import { EXPLORER_TX, PILOT_STAKE, STX_FAUCET } from "@/lib/stacks-pilot";

/** Pause-only key drill on Stacks testnet, 2026-11-16: pause succeeded, unpause returned err u401. */
const PAUSER_PROOF = {
  pause: "85c33f7d4b32a92e699fd4da877fbb1830bb45b6d550a7876772b7d8bce4099c",
  unpause: "8338a4e034af182100c81af6c02dff6576863f4f838becfbca0cb57b1c4ae068",
  v2Unpause: "0c1d9b7525040834b497caccac2bc91be716ddbdca9a5b2aabc7580f5e301429",
};
import { useQuery } from "@tanstack/react-query";
import { FEE_RECYCLING_ACTIVE, RECYCLE_SPLIT, RECYCLE_STREAMS, splitFee } from "@/lib/fee-recycling";
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
const sats = (n: string) => { try { return BigInt(n).toLocaleString("en-US"); } catch { return n; } };
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
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const net = useQuery({ enabled: ready, queryKey: ["stake-network"], queryFn: async () => (await import("@/lib/stacks-pilot-network")).readNetwork(), refetchInterval: 60_000, staleTime: 30_000 }).data;

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

      <NetworkPanel />

      <FeeRecyclingPanel />

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
            {live.stake && stakeMine && !expired && net && (() => {
              const w = live.stake.weight, bps = stakeShareBps(w, net.activeWeight), per = rewardPerWeight(live.pending, w);
              return (
                <div className="space-y-2 rounded border border-signal/60 p-3">
                  <p className="text-signal">YOUR SHARE · {(bps / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% OF ACTIVE WEIGHT</p>
                  <p className="text-muted-foreground">Your weight {w.toLocaleString("en-US")} ÷ active weight {net.activeWeight.toLocaleString("en-US")} ({net.active.toLocaleString("en-US")} active BITMAP{net.active === 1 ? "" : "s"}).</p>
                  <p className="text-muted-foreground">HOW CLAIMABLE IS WORKED OUT</p>
                  <p>Each treasury top-up adds (top-up ÷ total staked weight at that moment) to a running reward per weight. You are owed your weight × how much that grew since you staked, rounded down.</p>
                  <p>Since you staked: {per.toLocaleString("en-US")} t-sats per weight × weight {w.toLocaleString("en-US")} = <span className="text-signal">{live.pending.toLocaleString("en-US")} t-sats</span> claimable.</p>
                  <p className="text-muted-foreground">So the next top-up pays you about {(bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}% of it, if weights stay the same. Tokens that arrived while nobody was staked are shared out with the next top-up. Test tokens only{MAINNET_REWARDS_ENABLED ? "" : " · mainnet rewards are off"}.</p>
                </div>
              );
            })()}
            {live.stake && stakeMine && <p className="text-muted-foreground">{expired ? "Expired: sign and stake again to keep earning." : `Re-confirm before testnet block ${live.stake.expires.toLocaleString("en-US")} (now ${live.burnHeight.toLocaleString("en-US")}).`}</p>}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => send("Claim", "stake", "claim", async () => { const { Cl } = await import("@stacks/transactions"); return [Cl.uint(h)]; })}
                disabled={!stakeMine || expired || live.pending <= 0 || !!busy} className="rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">CLAIM TEST sBTC</button>
              <button onClick={() => send("Mint test tokens", "token", "mint", async () => { const { Cl } = await import("@stacks/transactions"); return [Cl.uint(100000), Cl.principal(stx)]; })}
                disabled={!stx || !!busy} className="rounded-md border border-border px-3 py-2 hover:border-primary disabled:opacity-50">MINT 100,000 TEST t-sats</button>
            </div>
            <p className="text-muted-foreground">Only the pilot treasury (a 2-of-3 test multisig) can fund the pool, within fixed limits per top-up, per reward period and on the pool balance. Each top-up is split across everyone staked at that moment, by weight. Tokens sent to the pool any other way are never paid out.</p>
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

function NetworkPanel() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const q = useQuery({ enabled: ready, queryKey: ["stake-network"], queryFn: async () => (await import("@/lib/stacks-pilot-network")).readNetwork(), refetchInterval: 60_000, staleTime: 30_000 });
  const d = q.data; const t = (n: number) => `${n.toLocaleString("en-US")} t-sats`;
  const days = d ? d.periodLen / 144 : 1;
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card/60 p-4 font-mono text-xs">
      <p className="tracking-widest text-muted-foreground">PILOT NETWORK · LIVE FROM STACKS TESTNET</p>
      {!d ? <p className="text-muted-foreground">{q.isError ? "Could not read the testnet contract." : "Reading the contract…"}</p> : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="BITMAPS STAKED" value={`${d.staked.toLocaleString("en-US")} (${d.active.toLocaleString("en-US")} active)`} />
            <Stat label="ACTIVE WEIGHT" value={d.activeWeight.toLocaleString("en-US")} />
            <Stat label="REWARDS FUNDED" value={t(d.fundedTotal)} />
            <Stat label="PAID OUT (CLAIMED)" value={t(d.paidOut)} />
            <Stat label="WAITING TO BE CLAIMED" value={t(d.poolHeld)} />
            <Stat label="FUNDED THIS PERIOD" value={t(d.fundedThisPeriod)} />
            <Stat label={`MAX PER ${days === 1 ? "DAY" : `${days} DAYS`}`} value={t(d.perPeriod)} />
            <Stat label="MAX PER WEIGHT / PERIOD" value={d.totalWeight > 0 ? t(Math.floor(d.perPeriod / d.totalWeight)) : "—"} />
          </div>
          <p className="text-muted-foreground">Rewards are only what the treasury actually funds, split by weight among BITMAPs staked at that moment. There is no fixed yield. Test tokens only.</p>
        </>
      )}
    </section>
  );
}

function WatchdogPanel() {
  const getStatus = useServerFn(watchdogStatusFn);
  const q = useQuery({ queryKey: ["stake-watchdog"], queryFn: () => getStatus(), refetchInterval: 60_000, staleTime: 30_000 });
  const d = q.data;
  const state = !d ? "CHECKING…" : !d.ok ? "NO DATA" : d.paused ? "PILOT PAUSED" : d.error ? "CHECK INCOMPLETE" : d.suspicious > 0 ? "SUSPICIOUS · PAUSING" : "STAKES AND POOL MATCH";
  const tone = d?.ok && !d.paused && !d.error && d.suspicious === 0 ? "text-signal" : "text-bitcoin";
  return (
    <section className="space-y-2 rounded-lg border border-border bg-card/60 p-4 font-mono text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="tracking-widest text-muted-foreground">WATCHDOG · TESTNET</p>
        <p className={tone}>{state}</p>
      </div>
      <p className="text-muted-foreground">Every few minutes it compares each stake on the contract with the list of approvals BitmapWin actually signed. It also rebuilds the reward pool balance from every funding and payout and checks it against what the pool really holds. A stake nobody signed, an unexpected admin action, or pool tokens that cannot be explained pause the whole pilot: staking, funding and claims stop, and the test tokens stay in the contract.</p>
      {d && !d.ok && <p className="text-muted-foreground">{d.reason}.</p>}
      {d?.ok && (
        <>
          <p className="text-muted-foreground">Last check {new Date(d.ranAt).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC · testnet block {d.burnHeight.toLocaleString("en-US")} · {d.checked.toLocaleString("en-US")} contract calls compared.</p>
          {d.error && <p className="text-bitcoin">{d.error}. It will try again on the next run.</p>}
          {d.pool ? (
            <div className="space-y-1">
              <p className={d.pool.matches ? "text-signal" : "text-bitcoin"}>REWARD POOL · {d.pool.matches ? "BALANCE EXPLAINED" : "BALANCE DOES NOT MATCH"}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <Stat label="FUNDED" value={sats(d.pool.funded)} />
                <Stat label="SENT DIRECTLY" value={sats(d.pool.direct)} />
                <Stat label="PAID OUT" value={sats(d.pool.paidOut)} />
                <Stat label="EXPECTED" value={sats(d.pool.expected)} />
                <Stat label="IN POOL NOW" value={sats(d.pool.actual)} />
              </div>
              <p className="text-[11px] text-muted-foreground">Test sats, read from Stacks testnet. Expected = funded + sent directly − paid out.</p>
            </div>
          ) : !d.error && <p className="text-muted-foreground">Reward pool not reconciled on this run.</p>}
          {d.pool?.funding && (
            <div className="space-y-1">
              <p className="text-muted-foreground">FUNDING LIMITS · ENFORCED BY THE CONTRACT</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <Stat label="PER TOP-UP" value={sats(d.pool.funding.perCall)} />
                <Stat label="REWARD PERIOD" value={`${d.pool.funding.periodLen.toLocaleString("en-US")} blocks`} />
                <Stat label="THIS PERIOD" value={`${sats(d.pool.funding.fundedThisPeriod)} / ${sats(d.pool.funding.perPeriod)}`} />
                <Stat label="FUNDED REWARDS" value={`${sats(d.pool.funding.poolHeld)} / ${sats(d.pool.funding.poolMax)}`} />
                <Stat label="TREASURY" value={short(d.pool.funding.funder)} />
              </div>
              <p className="text-[11px] text-muted-foreground">Funded rewards = funded − paid out. Tokens sent directly are not counted toward any limit.</p>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">The watchdog holds a pause-only key. On testnet it paused the pilot (<a href={EXPLORER_TX(PAUSER_PROOF.pause)} target="_blank" rel="noreferrer" className="underline">{short(PAUSER_PROOF.pause)}</a>), and its attempts to unpause (<a href={EXPLORER_TX(PAUSER_PROOF.unpause)} target="_blank" rel="noreferrer" className="underline">{short(PAUSER_PROOF.unpause)}</a>) or change admin, pausers, rate cap or oracle keys were all refused by the contract. The current contract refused it too (<a href={EXPLORER_TX(PAUSER_PROOF.v2Unpause)} target="_blank" rel="noreferrer" className="underline">{short(PAUSER_PROOF.v2Unpause)}</a>).</p>
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

function FeeRecyclingPanel() {
  const ex = splitFee(2100);
  const bar = [["TO STAKERS NOW", RECYCLE_SPLIT.pool, "bg-bitcoin"], ["PoX RESERVE", RECYCLE_SPLIT.reserve, "bg-signal"], ["RUNWAY", RECYCLE_SPLIT.runway, "bg-muted-foreground"]] as const;
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card/60 p-4 font-mono text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="tracking-widest text-muted-foreground">FEE RECYCLING · HOW SITE FEES FEED THE POOL</p>
        <span className={FEE_RECYCLING_ACTIVE ? "text-signal" : "text-bitcoin"}>{FEE_RECYCLING_ACTIVE ? "ACTIVE" : "NOT ACTIVE YET · MAINNET OFF"}</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded border border-border">
        {bar.map(([l, pct, c]) => <div key={l} className={c} style={{ width: `${pct}%` }} />)}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {bar.map(([l, pct]) => <Stat key={l} label={l} value={`${pct}%`} />)}
      </div>
      <p className="text-muted-foreground">Fees from {RECYCLE_STREAMS.join(", ")}: {RECYCLE_SPLIT.pool}% is paid into the staking pool for the current period, {RECYCLE_SPLIT.reserve}% builds a stacked STX reserve whose PoX Bitcoin yield funds later periods, {RECYCLE_SPLIT.runway}% covers running the site.</p>
      <p className="text-muted-foreground">Example: a 2,100 sat skin → {ex.pool.toLocaleString("en-US")} to stakers · {ex.reserve.toLocaleString("en-US")} to reserve · {ex.runway.toLocaleString("en-US")} runway.</p>
      <p className="text-[11px] text-muted-foreground">Recycled so far: 0 sats. This pilot is funded only by the test treasury shown above; no real fees are recycled until mainnet rewards are switched on. Every future top-up will link its Bitcoin and Stacks transactions here.</p>
    </section>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useWalletSession } from "@/lib/wallet-session";
import { signPsbtBase64, xOnlyPubKeyHex } from "@/lib/browser-wallet";
import { FINAL_CONFIRMATIONS, blindSeal, mintSealed, noteKey, verifySealed, mempoolChain, type SealState } from "@/lib/shadow-seal";
import {
  BroadcastUnknown, runLockedTransfer, intentStore, clearInterrupted, pendingStore, resolvePending, type Resolution, assertPlainCoin, broadcastTx, txSeenOnChain, decodeConsignment, listCoins, parseSealReceive, pickPlainCoin, prepareTransfer, sealFee,
  sealKey, sealReceiveCode, sealStore, type Coin, type HeldSealed,
} from "@/lib/shadow-seal-wallet";

const short = (s: string) => `${s.slice(0, 8)}…${s.slice(-4)}`;
const salt = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");

const BADGE: Record<SealState["state"], string> = {
  SEALED: "text-signal", PENDING: "text-primary", CONFLICT: "text-destructive", LOST: "text-destructive",
  MOVED: "text-muted-foreground", INVALID: "text-destructive", NOT_YOURS: "text-destructive", UNAVAILABLE: "text-muted-foreground",
};
function label(s: SealState | undefined) {
  if (!s) return "CHECKING…";
  switch (s.state) {
    case "SEALED": return `✓ SEALED · ${s.confirmations} CONFIRMATIONS`;
    case "PENDING": return `◷ PENDING · ${s.reason}`;
    case "CONFLICT": return `✗ CONFLICT · ${s.reason} · ${short(s.spentBy)}`;
    case "LOST": return `✗ LOST · ${s.reason}`;
    case "MOVED": return "MOVED ON";
    case "INVALID": return `✗ INVALID · ${s.reason}`;
    case "NOT_YOURS": return "✗ NOT SEALED TO YOU";
    case "UNAVAILABLE": return "UNAVAILABLE · RETRY";
  }
}

/** Bitcoin-sealed notes (beta). The wallet signs; the holder broadcasts. */
export function SealedVault() {
  const wallet = useWalletSession();
  const [held, setHeld] = useState<HeldSealed[]>([]);
  const [status, setStatus] = useState<Record<string, SealState>>({});
  const [coins, setCoins] = useState<Coin[] | null>(null);
  const [coinPick, setCoinPick] = useState("");
  const [labelIn, setLabelIn] = useState("");
  const [recvCode, setRecvCode] = useState("");
  const [paste, setPaste] = useState("");
  const [give, setGive] = useState<Record<string, string>>({});
  const [feeRate, setFeeRate] = useState(3);
  const [review, setReview] = useState<string | null>(null);
  const [signed, setSigned] = useState<{ txid: string; rawHex: string; sent: { label: string; code: string }[] } | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"send" | "receive">("send");
  const [frozen, setFrozen] = useState(false);
  const [backedUp, setBackedUp] = useState(false);
  const address = wallet?.ordinalsAddress ?? "";

  const store = (v: HeldSealed[]) => { sealStore.setHeld(v); setHeld(v); };
  const check = useCallback(async (list: HeldSealed[]) => {
    const chain = mempoolChain();
    const out: Record<string, SealState> = {};
    for (const h of list) out[noteKey(h.c.note.genesis)] = await verifySealed(h.c, chain, h.mine);
    setStatus(out);
  }, []);
  useEffect(() => { const l = sealStore.held(); setHeld(l); void check(l); }, [check]);
  useEffect(() => { if (address) listCoins(address).then(setCoins).catch(() => setCoins([])); }, [address]);

  const groups = useMemo(() => {
    const g: Record<string, HeldSealed[]> = {};
    for (const h of held) (g[sealKey(h.mine)] ??= []).push(h);
    return g;
  }, [held]);
  const coinOf = (k: string) => coins?.find((c) => sealKey(c) === k);

  async function pickCoin(): Promise<Coin> {
    const chosen = coins?.find((x) => sealKey(x) === coinPick);
    if (chosen) { await assertPlainCoin(chosen); return chosen; }
    const c = await pickPlainCoin(coins ?? [], feeRate, assertPlainCoin, new Set(Object.keys(groups)));
    setCoinPick(sealKey(c));
    return c;
  }
  useEffect(() => {
    fetch("https://mempool.space/api/v1/fees/recommended").then((r) => r.json()).then((f: { halfHourFee?: number }) => { if (f.halfHourFee) setFeeRate(Math.max(1, Math.ceil(f.halfHourFee))); }).catch(() => {});
  }, []);
  const [quickTo, setQuickTo] = useState("");
  const [quickPick, setQuickPick] = useState<Record<string, boolean>>({});
  const [sentTx, setSentTx] = useState<string | null>(null);
  const quickCoin = useMemo(() => {
    const keys = new Set(held.filter((h) => quickPick[noteKey(h.c.note.genesis)]).map((h) => sealKey(h.mine)));
    return keys.size === 1 ? [...keys][0]! : keys.size > 1 ? "MANY" : null;
  }, [held, quickPick]);
  const quickSend = () => run(async () => {
    if (!parseSealReceive(quickTo)) throw new Error("PASTE THE RECIPIENT'S SEAL-RECV CODE");
    if (!quickCoin) throw new Error("TICK AT LEAST ONE NOTE");
    if (quickCoin === "MANY") throw new Error("PICK NOTES FROM ONE SEAL COIN AT A TIME");
    const g: Record<string, string> = {};
    for (const h of groups[quickCoin]!) { const n = noteKey(h.c.note.genesis); if (quickPick[n]) g[n] = quickTo.trim(); }
    setGive(g); setReview(quickCoin);
  });
  const [unknown, setUnknown] = useState(false);
  const addrRef = useRef<string | null>(null);
  useEffect(() => { addrRef.current = address || null; }, [address]);
  const [interrupted, setInterrupted] = useState<{ txid: string; vout: number }[]>([]);
  useEffect(() => { setInterrupted(address ? intentStore.forWallet(address).map((i) => i.anchor) : []); }, [address, held]);
  const checkInterrupted = (a: { txid: string; vout: number }) => run(async () => {
    const r = await clearInterrupted(a, (o) => mempoolChain().outspend(o));
    if (r === "BUSY") throw new Error("ANOTHER TAB IS STILL SIGNING FOR THIS COIN");
    if (r === "UNRESOLVED") throw new Error("COULDN'T CHECK BITCOIN — STILL BLOCKED, TRY AGAIN");
    if (r === "SPENT") throw new Error("THIS COIN WAS SPENT WHILE THE PAGE WAS CLOSED — STILL BLOCKED, YOUR NOTES ARE KEPT FOR REVIEW");
    setInterrupted(intentStore.forWallet(address).map((i) => i.anchor)); setMsg("✓ INTERRUPTED SIGNING CLEARED — THE COIN IS UNSPENT, YOUR NOTES ARE SAFE");
  });
  // Restore any signed-but-unresolved transfer after a reload or wallet reconnect.
  useEffect(() => {
    const p = address ? pendingStore.forWallet(address).at(-1) : undefined;
    if (!p) { setSigned(null); setUnknown(false); setSentTx(null); return; }
    { setSigned({ txid: p.txid, rawHex: p.rawHex, sent: p.sent }); setUnknown(!!p.unknown); }
  }, [address]);
  const broadcast = () => run(async () => {
    if (!signed) return;
    if (unknown) {
      // A previous attempt had no reply: check the exact txid AND the anchor coin before ever re-sending.
      const r = await resolve(signed.txid);
      if (r === "SENT") { settleSent(signed.txid); setMsg("✓ IT DID REACH BITCOIN — NOW GIVE EACH RECIPIENT THEIR CODE"); return; }
      if (r === "CONFLICT") throw new Error("THE ANCHOR COIN WAS SPENT BY A DIFFERENT TRANSACTION — NOT RESENT, NOTES KEPT FOR REVIEW");
      if (r === "UNRESOLVED") throw new Error("STILL UNRESOLVED — NOT RESENT, NOTES KEPT AS THEY ARE");
    }
    if (!window.confirm("Send this signed transaction to Bitcoin now? This can't be undone.")) return;
    try {
      const t = await broadcastTx(signed.rawHex, signed.txid);
      settleSent(t); setMsg("✓ SENT TO BITCOIN — NOW GIVE EACH RECIPIENT THEIR CODE"); void check(held);
    } catch (e) {
      if (e instanceof BroadcastUnknown) {
        setUnknown(true);
        const p = pendingStore.all().find((x) => x.txid === signed.txid);
        if (p) pendingStore.put({ ...p, unknown: true });
      }
      throw e;
    }
  });
  async function run(f: () => Promise<void>) { setBusy(true); setMsg(""); try { await f(); } catch (e) { setMsg(`✗ ${(e as Error).message}`); } finally { setBusy(false); } }

  const mint = () => run(async () => {
    if (!labelIn.trim()) throw new Error("NAME THE NOTE");
    const c = await pickCoin();
    const existing = groups[sealKey(c)];
    const mine = existing?.[0]?.mine ?? { txid: c.txid, vout: c.vout, salt: salt() };
    const next = [...held, { c: { note: mintSealed(labelIn.trim().slice(0, 60), "memo", mine), steps: [], reveals: [] }, mine }];
    store(next); setLabelIn(""); setMsg("SEALED NOTE CREATED ON THAT COIN"); void check(next);
  });
  const makeRecv = () => run(async () => {
    const c = await pickCoin();
    const r = { txid: c.txid, vout: c.vout, salt: salt() };
    sealStore.setRecv({ ...sealStore.recv(), [blindSeal(r)]: r });
    setRecvCode(sealReceiveCode(r));
  });
  const accept = () => run(async () => {
    const c = decodeConsignment(paste);
    if (!c) throw new Error("NOT A SEALED NOTE CODE");
    const last = c.steps.at(-1)?.assignments.find((a) => a.note === noteKey(c.note.genesis));
    const mine = last?.to.kind === "blind" ? sealStore.recv()[last.to.hash] : undefined;
    if (!mine) throw new Error("THIS NOTE WAS NOT SENT TO ONE OF YOUR RECEIVE CODES");
    const s = await verifySealed(c, mempoolChain(), mine);
    if (s.state !== "SEALED" && s.state !== "PENDING") throw new Error(label(s));
    const next = [...held.filter((h) => noteKey(h.c.note.genesis) !== noteKey(c.note.genesis)), { c, mine }];
    store(next); setPaste(""); setStatus((p) => ({ ...p, [noteKey(c.note.genesis)]: s }));
    setMsg(s.state === "SEALED" ? `✓ RECEIVED "${c.note.label}" · SEALED` : `RECEIVED "${c.note.label}" · PENDING UNTIL ${FINAL_CONFIRMATIONS} CONFIRMATIONS`);
  });

  const prepare = (k: string) => run(async () => {
    if (!wallet) throw new Error("CONNECT YOUR WALLET FIRST");
    if (pendingStore.forWallet(address).length) throw new Error("RESOLVE YOUR UNFINISHED TRANSFER FIRST — PRESS CHECK ON BITCOIN");
    const bundle = groups[k]!;
    const coin = coinOf(k);
    if (!coin) throw new Error("THIS SEAL COIN IS NOT IN YOUR WALLET ANY MORE");
    await assertPlainCoin(coin);
    const pick = Object.fromEntries(bundle.map((h) => noteKey(h.c.note.genesis)).filter((n) => give[n]?.trim()).map((n) => [n, give[n]!.trim()]));
    const r = await runLockedTransfer({
      bundle, give: pick, coin, address, tapInternalKeyHex: xOnlyPubKeyHex(wallet.publicKey), feeRate,
      sign: (p) => signPsbtBase64(wallet.provider, p),
      currentWallet: () => addrRef.current,
    });
    const next = sealStore.held();
    if (r.walletChanged) { setHeld(next); setReview(null); setGive({}); setMsg("SIGNED — BUT YOU SWITCHED WALLET OR NETWORK. IT'S SAVED UNDER THE WALLET THAT STARTED IT; SWITCH BACK TO FINISH."); return; }
    const { kept: _k, sent, ...out } = r;
    setHeld(next); setReview(null); setGive({}); setSentTx(null); setUnknown(false); setSigned({ txid: out.txid, rawHex: out.rawHex, sent }); void check(next);
  });
  const resolve = (txid: string) => {
    const p = pendingStore.forWallet(address).find((x) => x.txid === txid);
    if (!p) return Promise.resolve<Resolution>("UNRESOLVED");
    return resolvePending(p, { txSeen: (t) => txSeenOnChain(t), outspend: (o) => mempoolChain().outspend(o) });
  };
  const settleSent = (txid: string) => { pendingStore.drop(txid); setSentTx(txid); setUnknown(false); };
  const cancel = (txid: string) => run(async () => {
    const before = sealStore.undo()[txid];
    if (!before) return;
    const r = await resolve(txid);
    if (r === "SENT") { settleSent(txid); throw new Error("ALREADY ON BITCOIN — IT CAN'T BE CANCELLED"); }
    if (r === "CONFLICT") throw new Error("THE ANCHOR COIN WAS SPENT BY A DIFFERENT TRANSACTION — NOT CANCELLED, NOTES KEPT FOR REVIEW");
    if (r === "UNRESOLVED") throw new Error("COULDN'T CONFIRM IT'S SAFE — NOT CANCELLED, TRY AGAIN SHORTLY");
    const next = [...held.filter((h) => h.mine.txid !== txid), ...before];
    pendingStore.drop(txid); setUnknown(false);
    store(next); setSigned(null); setMsg("PREPARED SPEND CANCELLED — NOTES ARE BACK ON THEIR COIN"); void check(next);
  });

  const backup = () => {
    const blob = new Blob([JSON.stringify({ held: sealStore.held(), recv: sealStore.recv(), sent: sealStore.sent() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `sealed-notes-backup-${Date.now()}.json`; a.click();
    setBackedUp(true);
  };
  const anyPending = Object.values(status).some((s) => s.state === "PENDING");
  const anySealed = Object.values(status).some((s) => s.state === "SEALED");
  const steps = mode === "send" ? [
    { t: "Connect your Bitcoin wallet", done: !!wallet },
    { t: "Pick a plain coin (no inscriptions or runes) — 5,000+ sats is plenty", done: !!coinPick || held.length > 0 },
    { t: "Name a note and press SEAL ON COIN (free — no transaction)", done: held.length > 0 },
    { t: "Ask the recipient for their SEAL-RECV code, then press GIVE FROM THIS COIN and paste it", done: !!review || !!signed },
    { t: "Tick the safety checks, sign in your wallet, then broadcast it yourself (the only transaction)", done: !!signed },
    { t: `Send each recipient their code and wait for ${FINAL_CONFIRMATIONS} confirmations`, done: anySealed && !anyPending },
  ] : [
    { t: "Connect your Bitcoin wallet", done: !!wallet },
    { t: "Pick one of your plain coins to receive on", done: !!coinPick },
    { t: "Press MAKE A RECEIVE CODE and send that code to the sender", done: !!recvCode },
    { t: "Paste the SEAL-NOTE code they give you and press CHECK ON BITCOIN & ACCEPT (no transaction for you)", done: held.length > 0 },
    { t: `Wait for ${FINAL_CONFIRMATIONS} confirmations — then it shows SEALED`, done: anySealed && !anyPending },
  ];
  const nextIdx = steps.findIndex((s) => !s.done);

  return (
    <section className="mt-10 rounded border border-primary/40 bg-card/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[11px] tracking-widest text-primary">BITCOIN-SEALED NOTES · BETA</div>
        <div className="flex gap-3 text-[11px]">
          <button onClick={backup} className="text-signal">[ DOWNLOAD BACKUP ]</button>
          <button onClick={() => void check(held)} className="text-signal">[ RECHECK ON BITCOIN ]</button>
        </div>
      </div>
      <p className="mt-2 font-sans text-[12px] text-muted-foreground">A sealed note lives on one of your Bitcoin coins. Moving it means spending that coin, which Bitcoin allows only once. Your wallet signs; you send the transaction yourself. A note counts as sealed after {FINAL_CONFIRMATIONS} confirmations. Don't spend a seal coin anywhere else — every note on it would be lost.</p>
      <p className="mt-1 font-sans text-[12px] text-muted-foreground">Still in testing: the double-give warning above applies until this has been proven end to end.</p>

      <div className="mt-4 rounded border border-signal/40 bg-background/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] tracking-widest text-signal">EASY GUIDE · STEP BY STEP</div>
          <div className="flex gap-1 text-[11px]">
            {(["send", "receive"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`rounded border px-2 py-0.5 ${mode === m ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{m === "send" ? "I'M SENDING" : "I'M RECEIVING"}</button>
            ))}
          </div>
        </div>
        <ol className="mt-2 space-y-1 font-sans text-[12px]">
          {steps.map((s, i) => (
            <li key={i} className={s.done ? "text-muted-foreground line-through" : i === nextIdx ? "text-foreground" : "text-muted-foreground"}>
              <span className={`mr-2 font-mono ${s.done ? "text-signal" : i === nextIdx ? "text-primary" : ""}`}>{s.done ? "✓" : i === nextIdx ? "▶" : `${i + 1}.`}</span>{s.t}
            </li>
          ))}
        </ol>
        <p className="mt-2 font-sans text-[11px] text-muted-foreground">{mode === "send" ? "Total: one Bitcoin transaction, however many notes you give or keep." : "You never make a transaction to receive."} Tip: in your wallet, freeze the seal coin so it's never spent by accident, and download a backup after every change.</p>
      </div>

      {!wallet ? (
        <p className="mt-4 text-[12px]">&gt; <Link to="/wallet" className="text-primary">CONNECT A WALLET</Link> TO SEAL NOTES_</p>
      ) : (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-[11px] text-muted-foreground">YOUR COINS · {address.slice(0, 10)}…</div>
              <select value={coinPick} onChange={(e) => setCoinPick(e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-[12px]" aria-label="Seal coin">
                <option value="">{coins === null ? "READING COINS…" : coins.length ? "PICK A PLAIN COIN" : "NO COINS FOUND"}</option>
                {coins?.map((c) => <option key={sealKey(c)} value={sealKey(c)}>{c.value.toLocaleString()} sats · {short(c.txid)}:{c.vout}{c.confirmed ? "" : " · unconfirmed"}{groups[sealKey(c)] ? ` · holds ${groups[sealKey(c)]!.length}` : ""}</option>)}
              </select>
              <div className="mt-2 flex gap-2">
                <input value={labelIn} onChange={(e) => setLabelIn(e.target.value)} placeholder="Name of new sealed note" className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-[12px]" />
                <button disabled={busy} onClick={mint} className="rounded border border-primary px-3 py-1 text-[11px] text-primary">[ SEAL ON COIN ]</button>
              </div>
              <button disabled={busy} onClick={makeRecv} className="mt-2 text-[11px] text-signal">[ MAKE A RECEIVE CODE ON THIS COIN ]</button>
              {recvCode ? <div className="mt-1 break-all text-[11px] text-foreground" data-no-translate>{recvCode}</div> : null}
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">RECEIVE A SEALED NOTE</div>
              <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={2} placeholder="SEAL-NOTE-v1.…" className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-[11px]" />
              <button disabled={busy} onClick={accept} className="mt-1 rounded border border-primary px-3 py-1 text-[11px] text-primary">[ CHECK ON BITCOIN & ACCEPT ]</button>
            </div>
          </div>
        </>
      )}

      {wallet && held.length ? (
        <div className="mt-4 rounded border border-primary/60 bg-background/60 p-3">
          <div className="text-[11px] tracking-widest text-primary">1-CLICK TRANSFER</div>
          <p className="mt-1 font-sans text-[11px] text-muted-foreground">Tick notes, paste the recipient's code. Fee is set from live Bitcoin rates ({feeRate} sat/vB). You'll see the full review, then your wallet asks you to sign.</p>
          <div className="mt-2 space-y-1 text-[12px]">
            {held.map((h) => { const n = noteKey(h.c.note.genesis); return (
              <label key={n} className="flex items-center gap-2"><input type="checkbox" checked={!!quickPick[n]} onChange={(e) => { setQuickPick({ ...quickPick, [n]: e.target.checked }); setPaste((p) => p); }} />{h.c.note.label}<span className="text-[10px] text-muted-foreground">· coin {short(h.mine.txid)}</span></label>
            ); })}
          </div>
          <input value={quickTo} onChange={(e) => setQuickTo(e.target.value)} placeholder="Recipient's SEAL-RECV code" className="mt-2 w-full rounded border border-border bg-background px-2 py-1 text-[11px]" data-no-translate />
          {quickCoin === "MANY" ? <p className="mt-1 text-[11px] text-destructive">Pick notes from one seal coin at a time.</p> : null}
          <button disabled={busy} onClick={quickSend} className="mt-2 rounded border border-primary bg-primary/15 px-3 py-1.5 text-[11px] text-primary">[ PREPARE TRANSFER ]</button>
        </div>
      ) : null}

      {interrupted.map((a) => (
        <div key={sealKey(a)} className="mt-3 rounded border border-primary/60 p-2 text-[11px]">
          <span className="text-primary">SIGNING WAS INTERRUPTED</span> on coin {short(a.txid)}:{a.vout} (page closed or reloaded while your wallet was open). New transfers from it are blocked until checked.
          <button disabled={busy} onClick={() => checkInterrupted(a)} className="ml-2 text-signal">[ CHECK ON BITCOIN ]</button>
        </div>
      ))}
      {msg ? <p className="mt-3 text-[12px] text-signal">{msg}</p> : null}
      {signed ? (
        <div className="mt-3 rounded border border-primary/60 p-3 text-[11px]">
          <div className="text-primary">SIGNED BY YOUR WALLET · NOT SENT. Send it yourself, then give each recipient their code.</div>
          <div className="mt-1">TRANSACTION {short(signed.txid)} · <a className="text-signal underline" href="https://mempool.space/tx/push" target="_blank" rel="noreferrer">BROADCAST AT MEMPOOL.SPACE</a></div>
          {sentTx ? <div className="mt-1 text-signal">✓ SENT · <a className="underline" href={`https://mempool.space/tx/${sentTx}`} target="_blank" rel="noreferrer">VIEW ON MEMPOOL</a></div>
            : <button disabled={busy} onClick={broadcast} className="mt-2 rounded border border-primary bg-primary/15 px-3 py-1 text-primary">{unknown ? "[ CHECK ON BITCOIN FIRST ]" : "[ SEND TO BITCOIN NOW ]"}</button>}
          <textarea readOnly rows={2} value={signed.rawHex} onFocus={(e) => e.target.select()} className="mt-1 w-full rounded border border-border bg-background px-2 py-1" data-no-translate />
          {signed.sent.map((s) => (
            <div key={s.code} className="mt-2"><div>CODE FOR THE RECIPIENT OF "{s.label}"</div>
              <textarea readOnly rows={2} value={s.code} onFocus={(e) => e.target.select()} className="w-full rounded border border-border bg-background px-2 py-1" data-no-translate /></div>
          ))}
          {unknown ? <div className="mt-2 text-primary">OUTCOME UNKNOWN — every note stays as prepared. Press CHECK ON BITCOIN FIRST before cancelling or retrying.</div> : null}
          {!sentTx ? <button disabled={busy} onClick={() => cancel(signed.txid)} className="mt-2 text-muted-foreground hover:text-foreground">[ I DIDN'T SEND IT — CANCEL ]</button> : null}
        </div>
      ) : null}

      {Object.entries(groups).map(([k, bundle]) => (
        <div key={k} className="mt-4 rounded border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="text-muted-foreground">SEAL COIN {short(k.split(":")[0]!)}:{k.split(":")[1]} · {bundle.length} NOTE{bundle.length > 1 ? "S" : ""}{coinOf(k) ? ` · ${coinOf(k)!.value.toLocaleString()} sats` : ""}</span>
            {wallet ? <button onClick={() => setReview(review === k ? null : k)} className="text-primary">[ GIVE FROM THIS COIN ]</button> : null}
          </div>
          {bundle.map((h) => {
            const n = noteKey(h.c.note.genesis), s = status[n];
            return (
              <div key={n} className="mt-2 text-[12px]">
                <div className="flex flex-wrap justify-between gap-2"><span className="text-foreground">{h.c.note.label}</span><span className={`text-[11px] ${s ? BADGE[s.state] : "text-muted-foreground"}`}>{label(s)}</span></div>
                {review === k ? <input value={give[n] ?? ""} onChange={(e) => setGive({ ...give, [n]: e.target.value })} placeholder="Recipient's SEAL-RECV code — leave empty to keep" className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-[11px]" /> : null}
              </div>
            );
          })}
          {review === k ? (
            <div className="mt-3 rounded border border-border bg-background/60 p-2 text-[11px]">
              <div className="text-signal">REVIEW · EVERY NOTE ON THIS COIN</div>
              {bundle.map((h) => { const n = noteKey(h.c.note.genesis); const to = give[n]?.trim(); return (
                <div key={n} className="mt-1">{to ? "→ GIVE" : "● KEEP"} · {h.c.note.label} · {to ? `to ${short(to.split(".")[1] ?? to)}` : "stays with you on the new coin (output 0)"}</div>
              ); })}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span>FEE RATE</span><input type="number" min={1} value={feeRate} onChange={(e) => setFeeRate(Number(e.target.value))} className="w-16 rounded border border-border bg-background px-1" aria-label="Fee rate" /><span>sat/vB · fee {sealFee(feeRate).toLocaleString()} sats</span>
              </div>
              <label className="mt-2 flex items-center gap-2 font-sans"><input type="checkbox" checked={frozen} onChange={(e) => setFrozen(e.target.checked)} />I understand this coin must never be spent anywhere else (freeze it in my wallet).</label>
              <label className="mt-1 flex items-center gap-2 font-sans"><input type="checkbox" checked={backedUp} onChange={(e) => setBackedUp(e.target.checked)} />I downloaded a backup of my notes.</label>
              <button disabled={busy || !frozen || !backedUp} onClick={() => prepare(k)} className="mt-2 rounded border border-primary bg-primary/15 px-3 py-1.5 text-primary disabled:opacity-40">{busy ? "WORKING…" : "[ PREPARE & SIGN IN WALLET ]"}</button>
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useWalletSession } from "@/lib/wallet-session";
import { signPsbtBase64, xOnlyPubKeyHex } from "@/lib/browser-wallet";
import { FINAL_CONFIRMATIONS, blindSeal, mintSealed, noteKey, verifySealed, mempoolChain, type SealState } from "@/lib/shadow-seal";
import {
  applySpend, assertPlainCoin, buildSealSpendPsbt, decodeConsignment, finishSigned, listCoins, planBundle, sealFee,
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
    const c = coins?.find((x) => sealKey(x) === coinPick);
    if (!c) throw new Error("PICK ONE OF YOUR COINS FIRST");
    await assertPlainCoin(c);
    return c;
  }
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
    const bundle = groups[k]!;
    const coin = coinOf(k);
    if (!coin) throw new Error("THIS SEAL COIN IS NOT IN YOUR WALLET ANY MORE");
    await assertPlainCoin(coin);
    const pick = Object.fromEntries(bundle.map((h) => noteKey(h.c.note.genesis)).filter((n) => give[n]?.trim()).map((n) => [n, give[n]!.trim()]));
    if (!Object.keys(pick).length) throw new Error("CHOOSE AT LEAST ONE NOTE TO GIVE");
    const { assignments, commitment } = planBundle(bundle, pick);
    const { psbt } = buildSealSpendPsbt({ coin, address, tapInternalKeyHex: xOnlyPubKeyHex(wallet.publicKey), commitment, feeRate });
    const out = finishSigned(await signPsbtBase64(wallet.provider, psbt), commitment);
    const { kept, sent } = applySpend(bundle, assignments, out.txid);
    sealStore.setUndo({ ...sealStore.undo(), [out.txid]: bundle });
    sealStore.setSent([...sealStore.sent(), ...sent.map((s) => ({ ...s, at: new Date().toISOString() }))]);
    const next = [...held.filter((h) => sealKey(h.mine) !== k), ...kept];
    store(next); setReview(null); setGive({}); setSigned({ ...out, sent }); void check(next);
  });
  const cancel = (txid: string) => run(async () => {
    const before = sealStore.undo()[txid];
    if (!before) return;
    const os = await mempoolChain().outspend(before[0]!.mine);
    if (os.spent) throw new Error("ALREADY ON BITCOIN — IT CAN'T BE CANCELLED HERE");
    const next = [...held.filter((h) => h.mine.txid !== txid), ...before];
    store(next); setSigned(null); setMsg("PREPARED SPEND CANCELLED — NOTES ARE BACK ON THEIR COIN"); void check(next);
  });

  return (
    <section className="mt-10 rounded border border-primary/40 bg-card/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[11px] tracking-widest text-primary">BITCOIN-SEALED NOTES · BETA</div>
        <button onClick={() => void check(held)} className="text-[11px] text-signal">[ RECHECK ON BITCOIN ]</button>
      </div>
      <p className="mt-2 font-sans text-[12px] text-muted-foreground">A sealed note lives on one of your Bitcoin coins. Moving it means spending that coin, which Bitcoin allows only once. Your wallet signs; you send the transaction yourself. A note counts as sealed after {FINAL_CONFIRMATIONS} confirmations. Don't spend a seal coin anywhere else — every note on it would be lost.</p>
      <p className="mt-1 font-sans text-[12px] text-muted-foreground">Still in testing: the double-give warning above applies until this has been proven end to end.</p>

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

      {msg ? <p className="mt-3 text-[12px] text-signal">{msg}</p> : null}
      {signed ? (
        <div className="mt-3 rounded border border-primary/60 p-3 text-[11px]">
          <div className="text-primary">SIGNED BY YOUR WALLET · NOT SENT. Send it yourself, then give each recipient their code.</div>
          <div className="mt-1">TRANSACTION {short(signed.txid)} · <a className="text-signal underline" href="https://mempool.space/tx/push" target="_blank" rel="noreferrer">BROADCAST AT MEMPOOL.SPACE</a></div>
          <textarea readOnly rows={2} value={signed.rawHex} onFocus={(e) => e.target.select()} className="mt-1 w-full rounded border border-border bg-background px-2 py-1" data-no-translate />
          {signed.sent.map((s) => (
            <div key={s.code} className="mt-2"><div>CODE FOR THE RECIPIENT OF "{s.label}"</div>
              <textarea readOnly rows={2} value={s.code} onFocus={(e) => e.target.select()} className="w-full rounded border border-border bg-background px-2 py-1" data-no-translate /></div>
          ))}
          <button onClick={() => cancel(signed.txid)} className="mt-2 text-muted-foreground hover:text-foreground">[ I DIDN'T SEND IT — CANCEL ]</button>
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
              <button disabled={busy} onClick={() => prepare(k)} className="mt-2 rounded border border-primary bg-primary/15 px-3 py-1.5 text-primary">{busy ? "WORKING…" : "[ PREPARE & SIGN IN WALLET ]"}</button>
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ConnectedWallet, WalletProviderId } from "@/lib/browser-wallet";
import { signParentInputsPsbt } from "@/lib/browser-wallet";
import { buildBarterSwapFn, reviewBarterSwapFn, broadcastBarterSwapFn } from "@/lib/barter.functions";
import { fetchSwapProposals, signSwapEvent, swapProposalTags, nostrPubkeyOf, type FeedTicket, type SwapProposal } from "@/lib/barter-feed";
import { deviceNostrKey, publishEvent } from "@/lib/nostr-listing";
import { prepareMakerInput } from "@/lib/psbt-buyer";
import { addressToScriptPubKey } from "@/lib/psbt-builder";
import { makerSigningKeys, type MakerKeys } from "@/lib/psbt-scripts";

/** Which key details the connected wallet can supply for the maker's item; refused paths explain why. */
function makerKeysFor(wallet: ConnectedWallet): MakerKeys {
  if (wallet.provider !== "unisat" && wallet.provider !== "xverse") return { ok: false, reason: "Swaps can be signed only with UniSat or Xverse for now." };
  let script: number[];
  try { script = addressToScriptPubKey(wallet.ordinalsAddress); } catch { return { ok: false, reason: "Your ordinals address can't be read." }; }
  return makerSigningKeys(script, [wallet.publicKey, wallet.paymentPublicKey]);
}
import type { BarterTicket } from "@/lib/barter-protocol";

const ticketOf = (t: BarterTicket) => ({
  makerAddress: t.makerAddress, offeringOutpoint: t.offeringOutpoint, offeringInscription: t.offeringInscription,
  offeringValue: t.offeringValue, sweetenerSats: t.sweetenerSats, sweetenerDir: t.sweetenerDir, criteria: t.criteria as Record<string, unknown>,
});
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Phase = "idle" | "building" | "review" | "signing" | "done" | "error";

/** Taker side: build the swap from live chain facts, sign own inputs, send it to the maker. */
export function ProposeSwap({ ticket, asset, wallet }: {
  ticket: FeedTicket; asset: { inscriptionId: string; outpoint: string; label: string }; wallet: ConnectedWallet;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");
  const [agree, setAgree] = useState(false);
  const [built, setBuilt] = useState<{ psbtBase64: string; feeSats: number; feeRate: number; changeSats: number; takerAssetIndex: number; fundingIndices: number[] } | null>(null);
  const [relays, setRelays] = useState<string[]>([]);

  const build = async () => {
    setPhase("building"); setMsg("Reading both items and your fee sats from Bitcoin…");
    const r = await buildBarterSwapFn({ data: {
      ticket: ticketOf(ticket), takerInscription: asset.inscriptionId, takerOutpoint: asset.outpoint,
      takerOrdinalsAddress: wallet.ordinalsAddress, takerPaymentAddress: wallet.paymentAddress,
      ...(wallet.publicKey ? { takerPublicKey: wallet.publicKey } : {}),
      ...(wallet.paymentPublicKey ? { takerPaymentPublicKey: wallet.paymentPublicKey } : {}),
    } }).catch((e) => ({ ok: false as const, reason: errText(e) }));
    if (!r.ok) { setPhase("error"); setMsg(r.reason); return; }
    setBuilt(r); setPhase("review"); setMsg("");
  };

  const signAndSend = async () => {
    if (!built) return;
    setPhase("signing");
    try {
      setMsg("Sign your item in the wallet…");
      let psbt = await signParentInputsPsbt(wallet.provider as WalletProviderId, built.psbtBase64, wallet.ordinalsAddress, [built.takerAssetIndex]);
      if (wallet.paymentAddress === wallet.ordinalsAddress) {
        psbt = await signParentInputsPsbt(wallet.provider as WalletProviderId, psbt, wallet.paymentAddress, built.fundingIndices);
      } else {
        setMsg("Sign the fee payment in the wallet…");
        psbt = await signParentInputsPsbt(wallet.provider as WalletProviderId, psbt, wallet.paymentAddress, built.fundingIndices);
      }
      setMsg("Checking your signed swap…");
      const check = await reviewBarterSwapFn({ data: { ticket: ticketOf(ticket), psbtBase64: psbt } });
      if (!check.ok) throw new Error(check.reason);
      if (!check.takerSigned) throw new Error("Your wallet did not sign every one of your inputs");
      setMsg("Sending to the maker over Nostr…");
      const ev = signSwapEvent(swapProposalTags({ offerEventId: ticket.eventId, makerPubkey: ticket.pubkey, offeringOutpoint: ticket.offeringOutpoint, takerOutpoint: asset.outpoint }), psbt, deviceNostrKey());
      const ok = await publishEvent(ev);
      if (ok.length === 0) throw new Error("No relay accepted the proposal. Nothing was sent.");
      setRelays(ok); setPhase("done");
      setMsg("Sent. Nothing moves until the maker signs too. Moving or spending your item cancels it.");
    } catch (e) {
      setPhase("error"); setMsg(errText(e));
    }
  };

  const sweet = ticket.sweetenerDir === "demand" ? ticket.sweetenerSats : 0;
  return (
    <div className="mt-2 space-y-2 border-t border-border pt-2">
      {phase === "idle" && <button className="w-full border border-primary px-2 py-1 text-primary" onClick={build}>PROPOSE SWAP WITH {asset.label}</button>}
      {phase === "review" && built && (
        <div className="space-y-1">
          <p>You give <span className="text-foreground">{asset.label}</span> and get the offered item.</p>
          {sweet > 0 && <p>You also pay the maker <span className="text-foreground">{sweet.toLocaleString()} sats</span>.</p>}
          <p>Miner fee: <span className="text-foreground">{built.feeSats.toLocaleString()} sats</span> (~{built.feeRate} sat/vB), paid by you.</p>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>I understand this signature lets the maker complete the swap exactly as shown, at any time until my item or fee sats move.</span>
          </label>
          <button disabled={!agree} className="w-full border border-primary px-2 py-1 text-primary disabled:opacity-40" onClick={signAndSend}>SIGN & SEND TO MAKER</button>
        </div>
      )}
      {msg && <p className={phase === "error" ? "text-destructive" : phase === "done" ? "text-accent" : "text-muted-foreground"}>{msg}</p>}
      {relays.length > 0 && <ul className="text-muted-foreground">{relays.map((r) => <li key={r}>✓ {r}</li>)}</ul>}
      {phase === "error" && <button className="border border-border px-2 py-1" onClick={() => { setPhase("idle"); setMsg(""); }}>TRY AGAIN</button>}
    </div>
  );
}

/** Maker side: proposals addressed to this device's messenger key, for offers made by the connected wallet. */
export function SwapInbox({ wallet, tickets }: { wallet: ConnectedWallet; tickets: FeedTicket[] }) {
  const inbox = useQuery({
    queryKey: ["barter-swaps", wallet.ordinalsAddress],
    queryFn: () => fetchSwapProposals(nostrPubkeyOf(deviceNostrKey())),
    staleTime: 60_000,
  });
  const mineTickets = tickets.filter((t) => t.makerAddress === wallet.ordinalsAddress);
  const rows = (inbox.data ?? []).flatMap((p) => {
    const t = mineTickets.find((x) => x.eventId === p.offerEventId || x.offeringOutpoint === p.offeringOutpoint);
    return t ? [{ p, t }] : [];
  });
  return (
    <section className="mb-4 border border-border bg-card/60 p-4 text-xs">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm text-primary">SWAP PROPOSALS FOR YOUR OFFERS</h2>
        <button className="border border-border px-2 py-1" onClick={() => inbox.refetch()}>REFRESH</button>
      </div>
      <p className="mt-1 text-muted-foreground">Only offers posted from this browser receive proposals here.</p>
      {inbox.isLoading && <p className="mt-2 text-muted-foreground">Reading proposals from Nostr relays…</p>}
      {inbox.data && rows.length === 0 && <p className="mt-2 text-muted-foreground">No proposals yet.</p>}
      <ul className="mt-2 space-y-2">{rows.map(({ p, t }) => <ProposalRow key={p.eventId} p={p} t={t} wallet={wallet} />)}</ul>
    </section>
  );
}

function ProposalRow({ p, t, wallet }: { p: SwapProposal; t: FeedTicket; wallet: ConnectedWallet }) {
  const review = useQuery({
    queryKey: ["barter-swap-review", p.eventId],
    queryFn: () => reviewBarterSwapFn({ data: { ticket: ticketOf(t), psbtBase64: p.psbtBase64 } }),
    staleTime: 60_000, retry: 1,
  });
  const [agree, setAgree] = useState(false);
  const [state, setState] = useState<{ phase: Phase; msg: string; txid?: string }>({ phase: "idle", msg: "" });
  const r = review.data;
  const keys = makerKeysFor(wallet);

  const accept = async () => {
    setState({ phase: "signing", msg: "Sign your offered item in the wallet…" });
    try {
      if (!keys.ok) throw new Error(keys.reason);
      const prepared = prepareMakerInput(p.psbtBase64, keys.tapKeyHex, keys.publicKeys);
      const signed = await signParentInputsPsbt(wallet.provider as WalletProviderId, prepared, wallet.ordinalsAddress, [0]);
      setState({ phase: "signing", msg: "Re-checking and broadcasting…" });
      const b = await broadcastBarterSwapFn({ data: { ticket: ticketOf(t), psbtBase64: signed } });
      if (!b.ok) throw new Error(b.reason);
      setState({ phase: "done", msg: "Broadcast. The swap settles when the transaction confirms.", txid: b.txid });
    } catch (e) {
      setState({ phase: "error", msg: errText(e) });
    }
  };

  return (
    <li className="border border-border p-2">
      <p>For your offer <span className="text-foreground">{t.offeringInscription.slice(0, 12)}…</span></p>
      {review.isLoading && <p className="text-muted-foreground">Checking the proposal against Bitcoin…</p>}
      {review.isError && <p className="text-destructive">Proposal could not be checked.</p>}
      {r && !r.ok && <p className="text-destructive">Refused: {r.reason}</p>}
      {r && r.ok && (
        <div className="mt-1 space-y-1">
          <p className="text-accent">✓ You would receive {r.takerAsset.height !== null ? `${r.takerAsset.height}.bitmap` : `${r.takerAsset.id.slice(0, 12)}…`} ({r.takerAsset.value.toLocaleString()} sats postage)</p>
          {t.sweetenerDir === "demand" && t.sweetenerSats > 0 && <p className="text-accent">✓ Plus {t.sweetenerSats.toLocaleString()} sats</p>}
          <p className="text-muted-foreground">Miner fee {r.feeSats.toLocaleString()} sats, paid by the taker.</p>
          {!r.takerSigned && <p className="text-destructive">The taker has not signed every input.</p>}
          {r.takerSigned && !keys.ok && <p className="text-destructive">Signing unavailable: {keys.reason}</p>}
          {r.takerSigned && keys.ok && state.phase !== "done" && (
            <>
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>I want to give my offered item for this one. Broadcasting cannot be undone.</span>
              </label>
              <button disabled={!agree || state.phase === "signing"} className="w-full border border-primary px-2 py-1 text-primary disabled:opacity-40" onClick={accept}>
                {state.phase === "signing" ? "WORKING…" : "SIGN & BROADCAST SWAP"}
              </button>
            </>
          )}
        </div>
      )}
      {state.msg && <p className={state.phase === "error" ? "text-destructive" : state.phase === "done" ? "text-accent" : "text-muted-foreground"}>{state.msg}</p>}
      {state.txid && <a className="text-primary underline" href={`https://mempool.space/tx/${state.txid}`} target="_blank" rel="noreferrer">{state.txid.slice(0, 16)}…</a>}
    </li>
  );
}

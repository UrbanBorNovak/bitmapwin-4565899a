import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ConnectedWallet, WalletProviderId } from "@/lib/browser-wallet";
import { signParentInputsPsbt } from "@/lib/browser-wallet";
import { buildBarterSwapFn, reviewBarterSwapFn, broadcastBarterSwapFn } from "@/lib/barter.functions";
import { fetchSwapProposals, signSwapEvent, swapProposalTags, nostrPubkeyOf, type FeedTicket, type SwapProposal } from "@/lib/barter-feed";
import { deviceNostrKey, publishEvent } from "@/lib/nostr-listing";
import { makerKeysFor, signMakerSwap } from "@/lib/barter-maker-sign";
import type { BarterTicket } from "@/lib/barter-protocol";

const ticketOf = (t: BarterTicket) => ({
  makerAddress: t.makerAddress, offeringOutpoint: t.offeringOutpoint, offeringInscription: t.offeringInscription,
  offeringValue: t.offeringValue, sweetenerSats: t.sweetenerSats, sweetenerDir: t.sweetenerDir, criteria: t.criteria as Record<string, unknown>,
});
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Line = { what: string; sats: number; to: string };
const short = (s: string) => (s.length > 22 ? `${s.slice(0, 10)}…${s.slice(-8)}` : s);

/** Pre-signing summary: every item and sat amount, with the address it ends up at. */
function SwapSummary({ send, receive, fee }: { send: Line[]; receive: Line[]; fee: { sats: number; rate?: number; payer: string; change?: Line } }) {
  const rows = (title: string, ls: Line[]) => (
    <div>
      <p className="font-mono text-[10px] tracking-widest text-muted-foreground">{title}</p>
      {ls.length === 0 ? <p className="text-muted-foreground">Nothing</p> : ls.map((l, i) => (
        <div key={i} className="flex flex-wrap justify-between gap-x-2 border-b border-border/50 py-0.5">
          <span className="text-foreground" title={l.what}>{short(l.what)}</span>
          <span className="font-mono">{l.sats.toLocaleString()} sats → <span className="text-accent" title={l.to}>{short(l.to)}</span></span>
        </div>
      ))}
    </div>
  );
  return (
    <div className="space-y-2 border border-border bg-background/40 p-2" data-no-translate-numbers>
      {rows("YOU SEND", send)}
      {rows("YOU RECEIVE", receive)}
      <div>
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground">MINER FEE</p>
        <p><span className="font-mono">{fee.sats.toLocaleString()} sats</span>{fee.rate ? ` (~${fee.rate} sat/vB)` : ""}, paid by {fee.payer}.</p>
        {fee.change && fee.change.sats > 0 && <p>Change <span className="font-mono">{fee.change.sats.toLocaleString()} sats</span> → <span className="text-accent" title={fee.change.to}>{short(fee.change.to)}</span></p>}
      </div>
    </div>
  );
}

type Phase = "idle" | "building" | "review" | "signing" | "done" | "error";

/** Taker side: build the swap from live chain facts, sign own inputs, send it to the maker. */
export function ProposeSwap({ ticket, assets, wallet }: {
  ticket: FeedTicket; assets: { inscriptionId: string; outpoint: string; label: string }[]; wallet: ConnectedWallet;
}) {
  const asset = assets[0]!;
  const label = assets.map((a) => a.label).join(" + ");
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");
  const [agree, setAgree] = useState(false);
  const [built, setBuilt] = useState<{ psbtBase64: string; feeSats: number; feeRate: number; changeSats: number; takerAssetIndex: number; takerAssetIndices: number[]; fundingIndices: number[] } | null>(null);
  const [relays, setRelays] = useState<string[]>([]);

  const build = async () => {
    setPhase("building"); setMsg("Reading both items and your fee sats from Bitcoin…");
    const r = await buildBarterSwapFn({ data: {
      ticket: ticketOf(ticket), takerInscription: asset.inscriptionId, takerOutpoint: asset.outpoint,
      ...(assets.length > 1 ? { moreItems: assets.slice(1).map((a) => ({ inscription: a.inscriptionId, outpoint: a.outpoint })) } : {}),
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
      setMsg(assets.length > 1 ? `Sign your ${assets.length} items in the wallet…` : "Sign your item in the wallet…");
      let psbt = await signParentInputsPsbt(wallet.provider as WalletProviderId, built.psbtBase64, wallet.ordinalsAddress, built.takerAssetIndices);
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
      {phase === "idle" && <button className="w-full border border-primary px-2 py-1 text-primary" onClick={build}>PROPOSE SWAP WITH {label}</button>}
      {phase === "review" && built && (
        <div className="space-y-1">
          <SwapSummary
            send={[
              ...assets.map((a, i) => ({ what: a.label || a.inscriptionId, sats: built.items?.[i]?.value ?? 0, to: ticket.makerAddress })),
              ...(sweet > 0 ? [{ what: "Extra sats", sats: sweet, to: ticket.makerAddress }] : []),
            ]}
            receive={[{ what: ticket.offeringInscription, sats: ticket.offeringValue, to: wallet.ordinalsAddress }]}
            fee={{ sats: built.feeSats, rate: built.feeRate, payer: "you", change: { what: "change", sats: built.changeSats, to: wallet.paymentAddress } }}
          />
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>I checked every item, amount and address above. This signature lets the maker complete the swap exactly as shown, at any time until my item or fee sats move.</span>
          </label>
          <button disabled={!agree} className="w-full border border-primary px-2 py-1 text-primary disabled:opacity-40" onClick={signAndSend}>CONFIRM · OPEN WALLET TO SIGN</button>
          <button className="w-full border border-border px-2 py-1" onClick={() => { setBuilt(null); setAgree(false); setPhase("idle"); }}>CANCEL · NOTHING SIGNED</button>
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
      const signed = await signMakerSwap(wallet, p.psbtBase64);
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
          {(() => {
            const items = r.takerAssets ?? [r.takerAsset];
            const out = r.outputs ?? [];
            return (
              <SwapSummary
                send={[{ what: t.offeringInscription, sats: t.offeringValue, to: out[0]?.address ?? "taker" }]}
                receive={[
                  ...items.map((x, i) => ({ what: x.height !== null ? `${x.height}.bitmap` : x.id, sats: out[i + 1]?.value ?? x.value, to: out[i + 1]?.address ?? t.makerAddress })),
                  ...(t.sweetenerDir === "demand" && t.sweetenerSats > 0 ? [{ what: "Extra sats", sats: t.sweetenerSats, to: t.makerAddress }] : []),
                ]}
                fee={{ sats: r.feeSats, payer: "the taker (you pay 0)" }}
              />
            );
          })()}
          {!r.takerSigned && <p className="text-destructive">The taker has not signed every input.</p>}
          {r.takerSigned && !keys.ok && <p className="text-destructive">Signing unavailable: {keys.reason}</p>}
          {r.takerSigned && keys.ok && state.phase !== "done" && (
            <>
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>I checked every item, amount and address above. Broadcasting cannot be undone.</span>
              </label>
              <button disabled={!agree || state.phase === "signing"} className="w-full border border-primary px-2 py-1 text-primary disabled:opacity-40" onClick={accept}>
                {state.phase === "signing" ? "WORKING…" : "CONFIRM · OPEN WALLET TO SIGN"}
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

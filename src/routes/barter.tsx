import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo, useState } from "react";
import { useWalletSession } from "@/lib/wallet-session";
const BarterScene3D = lazy(() => import("@/components/barter/BarterScene3D"));
import { ProposeSwap, SwapInbox } from "@/components/barter/SwapPanels";
import type { ConnectedWallet } from "@/lib/browser-wallet";
import { getWalletFn } from "@/lib/wallet.functions";
import type { WalletSnapshot } from "@/lib/wallet";
function Thumb({ id, size = "size-10" }: { id: string; size?: string }) {
  return (
    <span className={`relative inline-block shrink-0 overflow-hidden border border-border bg-background ${size}`}>
      <iframe src={`https://ordinals.com/preview/${id}`} title={`Inscription ${id.slice(0, 8)}`} loading="lazy" sandbox="allow-scripts" scrolling="no" className="pointer-events-none absolute left-0 top-0 h-[400%] w-[400%] origin-top-left scale-25 border-0" />
    </span>
  );
}
import { inscriptionSatpointsFn, verifyBarterOffersFn, type OfferVerdict } from "@/lib/barter.functions";
import { signMessageWithWallet, type WalletProviderId } from "@/lib/browser-wallet";
import { deviceNostrKey, publishEvent } from "@/lib/nostr-listing";
import { signBarterEvent, nostrPubkeyOf } from "@/lib/barter-feed";
import { fetchBarterTickets, describeCriteria, type FeedTicket } from "@/lib/barter-feed";
import {
  matchesCriteria, ticketProblem, ticketTags, satpointProblem, offerProofMessage, DUST_SATS,
  type AssetFacts, type BarterCriteria, type BarterTicket,
  BARTER_MAX_BUNDLE,
} from "@/lib/barter-protocol";

export const Route = createFileRoute("/barter")({
  head: () => ({
    meta: [
      { title: "Barter Board — swap Ordinals for BITMAPs wallet to wallet" },
      { name: "description", content: "Open barter offers for BITMAPs and Ordinals under the BW-BARTER-1 rules. Find offers your wallet can fill." },
      { property: "og:title", content: "BITMAP Barter Board" },
      { property: "og:description", content: "Wallet-to-wallet barter offers for BITMAPs and Ordinals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BarterPage,
});

/** Chain-read wallet items as protocol facts. Tx counts are not in the scan, so tx rules never match here. */
/** Matches the server's per-request cap in inscriptionSatpointsFn. */
const SATPOINT_PAGE = 60;

type Raw = AssetFacts & { inUtxo: number };
/** An asset after its chain satpoint check; `block` is the reason it may not trade, or null. */
type Checked = Raw & { satpoint?: string | null; block: string | null };

function walletAssets(w: WalletSnapshot | undefined): Raw[] {
  const out: Raw[] = [];
  for (const u of w?.utxos ?? []) {
    for (const i of u.inscriptions) {
      const a: Raw = {
        inUtxo: u.inscriptions.length,
        inscriptionId: i.id, outpoint: u.outpoint, value: u.valueSats,
        offset: -1, // not resolved by the wallet scan
        type: i.bitmapHeight !== null ? "bitmap" : "ordinal", spent: false,
      };
      if (i.bitmapHeight !== null) a.height = i.bitmapHeight;
      out.push(a);
    }
  }
  return out;
}

const assetLabel = (a: AssetFacts) => (a.height !== undefined ? `${a.height}.bitmap` : `${a.inscriptionId.slice(0, 10)}…`);

function Unavailable({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-destructive/60 p-3 text-xs text-destructive">
      <strong>NOT AVAILABLE YET · </strong>{children}
    </div>
  );
}

function BarterPage() {
  const wallet = useWalletSession();
  const feed = useQuery({ queryKey: ["barter-feed"], queryFn: () => fetchBarterTickets(), staleTime: 60_000 });
  const holdings = useQuery({
    queryKey: ["barter-wallet", wallet?.ordinalsAddress],
    queryFn: () => getWalletFn({ data: { address: wallet!.ordinalsAddress } }),
    enabled: !!wallet?.ordinalsAddress,
    staleTime: 60_000,
  });
  const raw = useMemo(() => walletAssets(holdings.data), [holdings.data]);
  // Every inscription is checked, in pages of SATPOINT_PAGE; each page is its own request.
  const pages = useMemo(() => {
    const ids = [...new Set(raw.map((a) => a.inscriptionId))];
    const out: string[][] = [];
    for (let i = 0; i < ids.length; i += SATPOINT_PAGE) out.push(ids.slice(i, i + SATPOINT_PAGE));
    return out;
  }, [raw]);
  const satQs = useQueries({
    queries: pages.map((ids) => ({
      queryKey: ["barter-satpoints", ids.join(",")],
      queryFn: () => inscriptionSatpointsFn({ data: { ids } }),
      staleTime: 60_000,
      retry: 1,
    })),
  });
  const pageOf = useMemo(() => {
    const m = new Map<string, number>();
    pages.forEach((ids, p) => ids.forEach((id) => m.set(id, p)));
    return m;
  }, [pages]);
  const checkedPages = satQs.filter((q) => q.data).length;
  const mine = useMemo<Checked[]>(() => raw.map((a) => {
    const q = satQs[pageOf.get(a.inscriptionId) ?? -1];
    if (!q?.data) return { ...a, block: q?.isError ? "position could not be read from chain" : "checking position…" };
    const sp = q.data[a.inscriptionId] ?? null;
    const block = satpointProblem({ outpoint: a.outpoint, value: a.value, satpoint: sp, inscriptionsInUtxo: a.inUtxo });
    return { ...a, offset: block ? a.offset : 0, satpoint: sp, block };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [raw, pageOf, satQs.map((q) => q.dataUpdatedAt + ":" + q.errorUpdatedAt).join(",")]);

  const [filter, setFilter] = useState<{ type: string; maxHeight: string; fillable: boolean }>({ type: "", maxHeight: "", fillable: false });
  const [drawer, setDrawer] = useState<FeedTicket | null>(null);
  const [wizard, setWizard] = useState(false);

  // Wallet proofs on feed offers are checked by the server (signature + live chain position).
  const proofs = useQuery({
    queryKey: ["barter-proofs", (feed.data ?? []).map((t) => t.eventId).join(",")],
    enabled: !!feed.data?.length,
    staleTime: 120_000,
    queryFn: async () => {
      const withProof = (feed.data ?? []).filter((t) => t.proofSig && t.proofIssued !== undefined);
      const out: Record<string, OfferVerdict> = {};
      for (let i = 0; i < withProof.length; i += 30) {
        const offers = withProof.slice(i, i + 30).map((t) => ({
          key: t.eventId, makerAddress: t.makerAddress, offeringOutpoint: t.offeringOutpoint,
          offeringInscription: t.offeringInscription, offeringValue: t.offeringValue,
          sweetenerSats: t.sweetenerSats, sweetenerDir: t.sweetenerDir, criteria: t.criteria,
          nostrPubkey: t.pubkey, issuedAt: t.proofIssued!, signature: t.proofSig!,
        }));
        Object.assign(out, await verifyBarterOffersFn({ data: { offers, fresh: false } }));
      }
      return out;
    },
  });
  const proofLabel = (t: FeedTicket): { ok: boolean; text: string } => {
    if (!t.proofSig) return { ok: false, text: "No wallet proof" };
    const v = proofs.data?.[t.eventId];
    if (!v) return { ok: false, text: proofs.isError ? "Proof could not be checked" : "Checking wallet proof…" };
    return v.ok ? { ok: true, text: "✓ Wallet proof verified · item still in place" } : { ok: false, text: `Proof failed: ${v.reason}` };
  };

  const tickets = (feed.data ?? []).filter((t) => {
    if (filter.type && t.criteria.assetType !== filter.type) return false;
    const mh = Number(filter.maxHeight);
    if (filter.maxHeight && (t.criteria.maxHeight === undefined || t.criteria.maxHeight > mh)) return false;
    if (filter.fillable && !mine.some((a) => matchesCriteria(t.criteria, a))) return false;
    return true;
  });

  return (
    <div className="relative isolate min-h-screen">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-background">
        <div className="sticky top-0 h-[62dvh] w-full"><ClientOnly fallback={null}><Suspense fallback={null}><BarterScene3D /></Suspense></ClientOnly></div>
      </div>
    
    <main className="mx-auto max-w-5xl px-4 py-10 font-mono">
      <header className="mb-6 border border-border bg-card/60 p-5">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">BW-BARTER-1 · draft</p>
        <h1 className="mt-1 font-display text-3xl text-primary">BARTER BOARD</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Offers to swap one inscription for another that meets set rules. Items are matched only using facts read from Bitcoin. Missing facts never count as a match.
        </p>
        <div className="mt-3">
          <p className="border border-dashed border-primary/60 p-3 text-xs text-muted-foreground">
            <strong className="text-primary">ATOMIC SWAPS · </strong>A taker signs a swap that moves both items in one Bitcoin transaction; the maker reviews it and signs to broadcast. Either item moving before then cancels it. Proposals travel over public Nostr relays.
          </p>
        </div>
      </header>

      <section className="mb-4 flex flex-wrap items-end gap-3 border border-border p-3 text-xs">
        <label className="flex flex-col gap-1">WANTS TYPE
          <select className="border border-border bg-background px-2 py-1" value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })}>
            <option value="">any</option><option value="bitmap">BITMAP</option><option value="guardian">Guardian</option>
            <option value="voxel">Voxel build</option><option value="ordinal">Ordinal</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">WANTS MAX BLOCK ≤
          <input className="w-28 border border-border bg-background px-2 py-1" inputMode="numeric" value={filter.maxHeight} onChange={(e) => setFilter({ ...filter, maxHeight: e.target.value.replace(/\D/g, "") })} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filter.fillable} disabled={!wallet} onChange={(e) => setFilter({ ...filter, fillable: e.target.checked })} />
          ONLY OFFERS MY WALLET CAN FILL
        </label>
        <button className="ml-auto border border-primary px-3 py-1.5 text-primary hover:bg-primary/10" onClick={() => setWizard(true)}>+ POST OFFER</button>
      </section>

      {!wallet && <p className="mb-3 text-xs text-muted-foreground">Connect a wallet on the <Link to="/wallet" className="underline">wallet page</Link> to see which offers you can fill.</p>}
      {holdings.isLoading && <p className="mb-3 text-xs text-accent">Scanning your wallet on-chain…</p>}
      {pages.length > 0 && (
        <p className="mb-3 text-xs text-muted-foreground">
          Positions checked: {checkedPages}/{pages.length} batches · {mine.filter((a) => !a.block).length} of {mine.length} items usable
        </p>
      )}

      {feed.isLoading && <p className="text-sm text-muted-foreground">Reading offers from Nostr relays…</p>}
      {feed.error && <p className="text-sm text-destructive">Could not reach the relays.</p>}
      {feed.data && tickets.length === 0 && (
        <p className="border border-border p-4 text-sm text-muted-foreground">
          {feed.data.length === 0 ? "No barter offers on the relays yet." : "No offers match these filters."}
        </p>
      )}

      {wallet && <SwapInbox wallet={wallet} tickets={feed.data ?? []} />}

      <ul className="grid gap-3 sm:grid-cols-2">
        {tickets.map((t) => {
          const n = mine.filter((a) => matchesCriteria(t.criteria, a)).length;
          return (
            <li key={t.eventId} className="border border-border bg-card/60 p-4 text-xs">
              <p className="text-muted-foreground">OFFERING</p>
              <div className="flex items-center gap-2"><Thumb id={t.offeringInscription} size="size-12" /><a href={`https://ordinals.com/inscription/${t.offeringInscription}`} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                {t.offeringInscription.slice(0, 12)}…
              </a></div>
              <p className="mt-2 text-muted-foreground">WANTS</p>
              <p className="text-sm text-foreground">{describeCriteria(t.criteria)}</p>
              {t.sweetenerSats > 0 && <p className="mt-1">{t.sweetenerDir === "demand" ? "+ asks" : "+ adds"} {t.sweetenerSats.toLocaleString("en-US")} sats</p>}
              {(() => { const p = proofLabel(t); return <p className={`mt-2 ${p.ok ? "text-accent" : "text-destructive"}`}>{p.text}</p>; })()}
              {t.note && <p className="mt-2 italic text-muted-foreground">“{t.note}”</p>}
              <div className="mt-3 flex items-center justify-between">
                <span className={n > 0 ? "text-accent" : "text-muted-foreground"}>{wallet ? `${n} match${n === 1 ? "" : "es"} in your wallet` : ""}</span>
                <button className="border border-border px-2 py-1 hover:border-primary" onClick={() => setDrawer(t)}>VIEW MATCHES</button>
              </div>
            </li>
          );
        })}
      </ul>

      {drawer && <MatchDrawer ticket={drawer} mine={mine} wallet={wallet ?? null} verdict={proofs.data?.[drawer.eventId]} onClose={() => setDrawer(null)} />}
      {wizard && <PostWizard mine={mine} makerAddress={wallet?.ordinalsAddress ?? ""} provider={wallet?.provider as WalletProviderId | undefined} onClose={() => setWizard(false)} onPosted={() => feed.refetch()} />}
    </main>
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/70 backdrop-blur-sm" onClick={onClose}>
      <aside className="h-full w-full max-w-md overflow-auto border-l border-border bg-card p-5 font-mono text-xs" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg text-primary">{title}</h2>
          <button aria-label="Close" className="border border-border px-2 py-1" onClick={onClose}>✕</button>
        </div>
        {children}
      </aside>
    </div>
  );
}

function MatchDrawer({ ticket, mine, wallet, verdict, onClose }: { ticket: FeedTicket; mine: Checked[]; wallet: ConnectedWallet | null; verdict: OfferVerdict | undefined; onClose: () => void }) {
  const hasWallet = !!wallet;
  const unsupported = ticket.sweetenerDir === "give" && ticket.sweetenerSats > 0;
  const ok = mine.filter((a) => matchesCriteria(ticket.criteria, a));
  const usesTx = ticket.criteria.minTxCount !== undefined || ticket.criteria.maxTxCount !== undefined;
  const [sel, setSel] = useState<string[]>([]);
  const canSwap = !!wallet && !!verdict?.ok && !unsupported;
  const chosen = ok.filter((a) => !a.block && sel.includes(a.inscriptionId));
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= BARTER_MAX_BUNDLE ? s : [...s, id]));
  return (
    <Sheet title="MATCHING ASSETS" onClose={onClose}>
      <p className="text-muted-foreground">Wants: <span className="text-foreground">{describeCriteria(ticket.criteria)}</span></p>
      {!ticket.proofSig && <p className="mt-2 text-destructive">This offer has no wallet proof; treat its maker as unverified.</p>}
      {usesTx && <p className="mt-2 text-muted-foreground">This offer has a transaction-count rule. The wallet scan doesn't read tx counts, so nothing can match it here yet.</p>}
      {!hasWallet && <p className="mt-3">Connect a wallet to check your items.</p>}
      {hasWallet && ok.length === 0 && <p className="mt-3">None of your items meet these rules.</p>}
      <ul className="mt-3 space-y-2">
        {ok.map((a) => (
          <li key={a.inscriptionId} className={`border p-2 ${a.block ? "border-destructive/50" : "border-border"}`}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Thumb id={a.inscriptionId} /><span className={a.block ? "text-muted-foreground line-through" : "text-accent"}>{assetLabel(a)}</span></span>
              <span className="text-muted-foreground">{a.value.toLocaleString("en-US")} sats postage</span>
            </div>
            <p className={`mt-1 ${a.block ? "text-destructive" : "text-accent"}`}>{a.block ? `Blocked: ${a.block}` : "✓ Position checked: first sat of its own output"}</p>
            {!a.block && canSwap && (
              <label className="mt-2 flex items-center gap-2">
                <input type="checkbox" checked={sel.includes(a.inscriptionId)} disabled={!sel.includes(a.inscriptionId) && sel.length >= BARTER_MAX_BUNDLE} onChange={() => toggle(a.inscriptionId)} />
                <span>Include in my proposal</span>
              </label>
            )}
          </li>
        ))}
      </ul>
      {ok.length > 0 && <p className="mt-2 text-muted-foreground">{ok.filter((a) => !a.block).length} of {ok.length} matching items can be used.</p>}
      {canSwap && ok.some((a) => !a.block) && <p className="mt-2 text-muted-foreground">Tick up to {BARTER_MAX_BUNDLE} items to offer together for this one item. Each must meet the rules above.</p>}
      {canSwap && wallet && chosen.length > 0 && (
        <ProposeSwap key={chosen.map((a) => a.inscriptionId).join(",")} ticket={ticket} wallet={wallet} assets={chosen.map((a) => ({ inscriptionId: a.inscriptionId, outpoint: a.outpoint, label: assetLabel(a) }))} />
      )}
      <div className="mt-4 space-y-2">
        {!verdict?.ok && <p className="text-destructive">Swaps open only on offers whose wallet proof is verified.</p>}
        {unsupported && <Unavailable>Offers where the maker adds sats can't be swapped yet.</Unavailable>}
      </div>
    </Sheet>
  );
}

type PostState = { phase: "idle" | "working" | "done" | "error"; msg: string; relays?: string[] };

function PostWizard({ mine, makerAddress, provider, onClose, onPosted }: {
  mine: Checked[]; makerAddress: string; provider: WalletProviderId | undefined; onClose: () => void; onPosted: () => void;
}) {
  const [step, setStep] = useState(1);
  const [post, setPost] = useState<PostState>({ phase: "idle", msg: "" });
  const [pickId, setPickId] = useState<string | null>(null);
  // Re-read the live check every render so a position change also blocks later steps.
  const pick = mine.find((a) => a.inscriptionId === pickId) ?? null;
  const [c, setC] = useState({ assetType: "bitmap", exactHeight: "", minHeight: "", maxHeight: "", maxTx: "", patoshi: false, sweet: "", note: "" });
  const n = (s: string) => (s === "" ? undefined : Number(s));

  const criteria: BarterCriteria = {};
  if (c.assetType) criteria.assetType = c.assetType as NonNullable<BarterCriteria["assetType"]>;
  for (const [k, v] of [["exactHeight", c.exactHeight], ["minHeight", c.minHeight], ["maxHeight", c.maxHeight], ["maxTxCount", c.maxTx]] as const) {
    const x = n(v); if (x !== undefined) criteria[k] = x;
  }
  if (c.patoshi) criteria.patoshiOnly = true;
  const ticket: BarterTicket | null = pick ? {
    makerAddress, offeringOutpoint: pick.outpoint, offeringInscription: pick.inscriptionId, offeringValue: pick.value,
    sweetenerSats: n(c.sweet) ?? 0, sweetenerDir: "demand", criteria,
  } : null;
  const problem = !pick ? "pick an item first" : pick.block ? `item position: ${pick.block}` : ticketProblem(ticket!);
  const field = (label: string, key: "exactHeight" | "minHeight" | "maxHeight" | "maxTx" | "sweet") => (
    <label className="flex flex-col gap-1">{label}
      <input className="border border-border bg-background px-2 py-1" inputMode="numeric" value={c[key]} onChange={(e) => setC({ ...c, [key]: e.target.value.replace(/\D/g, "") })} />
    </label>
  );

  return (
    <Sheet title={`POST OFFER · STEP ${step}/3`} onClose={onClose}>
      {step === 1 && (
        <>
          <p className="mb-2 text-muted-foreground">What are you offering? Items come from your wallet, read live from Bitcoin.</p>
          {!makerAddress && <p>Connect a wallet first.</p>}
          {makerAddress && mine.length === 0 && <p>No inscriptions found in this wallet.</p>}
          <ul className="max-h-96 space-y-1 overflow-auto">
            {mine.map((a) => (
              <li key={a.inscriptionId}>
                <button
                  disabled={!!a.block}
                  className={`w-full border p-2 text-left disabled:cursor-not-allowed disabled:opacity-60 ${pickId === a.inscriptionId ? "border-primary text-primary" : "border-border"}`}
                  onClick={() => setPickId(a.inscriptionId)}
                >
                  <span className="flex items-center gap-2"><Thumb id={a.inscriptionId} size="size-8" /><span>{assetLabel(a)} <span className="text-muted-foreground">· {a.value.toLocaleString("en-US")} sats</span></span></span>
                  <span className={`block text-[11px] ${a.block ? "text-destructive" : "text-accent"}`}>{a.block ? `Blocked: ${a.block}` : "✓ first sat of its own output"}</span>
                </button>
              </li>
            ))}
          </ul>
          <button disabled={!pick || !!pick.block} className="mt-4 w-full border border-primary px-3 py-2 text-primary disabled:opacity-40" onClick={() => setStep(2)}>NEXT: WHAT YOU WANT</button>
        </>
      )}
      {step === 2 && (
        <div className="grid gap-3">
          <label className="flex flex-col gap-1">TYPE
            <select className="border border-border bg-background px-2 py-1" value={c.assetType} onChange={(e) => setC({ ...c, assetType: e.target.value })}>
              <option value="">any</option><option value="bitmap">BITMAP</option><option value="guardian">Guardian</option>
              <option value="voxel">Voxel build</option><option value="ordinal">Ordinal</option>
            </select>
          </label>
          {field("EXACT BLOCK", "exactHeight")}
          <div className="grid grid-cols-2 gap-2">{field("MIN BLOCK", "minHeight")}{field("MAX BLOCK", "maxHeight")}</div>
          {field("MAX TX COUNT", "maxTx")}
          <label className="flex items-center gap-2"><input type="checkbox" checked={c.patoshi} onChange={(e) => setC({ ...c, patoshi: e.target.checked })} /> PATOSHI BLOCK ONLY</label>
          {field(`EXTRA SATS YOU ASK FOR (0 or ≥ ${DUST_SATS})`, "sweet")}
          <label className="flex flex-col gap-1">NOTE
            <input className="border border-border bg-background px-2 py-1" maxLength={280} value={c.note} onChange={(e) => setC({ ...c, note: e.target.value })} />
          </label>
          <div className="flex gap-2">
            <button className="flex-1 border border-border px-3 py-2" onClick={() => setStep(1)}>BACK</button>
            <button disabled={!pick || !!pick.block} className="flex-1 border border-primary px-3 py-2 text-primary disabled:opacity-40" onClick={() => setStep(3)}>NEXT: REVIEW</button>
          </div>
        </div>
      )}
      {step === 3 && ticket && (
        <div className="grid gap-3">
          <p>Offering <span className="text-primary">{pick ? assetLabel(pick) : ""}</span></p>
          <p>Wants <span className="text-accent">{describeCriteria(criteria)}</span></p>
          {problem ? <p className="text-destructive">Can't post: {problem}.</p> : <p className="text-accent">✓ Offer passes the protocol checks.</p>}
          <details>
            <summary className="cursor-pointer text-muted-foreground">Offer data that would be posted</summary>
            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all border border-border p-2 text-[10px]">{JSON.stringify(ticketTags(ticket), null, 1)}</pre>
          </details>
          <p className="text-muted-foreground">Posting re-reads the item's position from Bitcoin, asks your wallet to sign a message proving you hold it (no transaction, no fee), and sends the offer to public Nostr relays. Anyone can see it.</p>
          <button
            disabled={!!problem || !provider || post.phase === "working" || post.phase === "done"}
            className="w-full border border-primary px-3 py-2 text-primary disabled:cursor-not-allowed disabled:opacity-40"
            onClick={async () => {
              if (!ticket || !provider) return;
              try {
                setPost({ phase: "working", msg: "Re-checking the item's position on Bitcoin…" });
                const sp = await inscriptionSatpointsFn({ data: { ids: [ticket.offeringInscription] } });
                const bad = satpointProblem({ outpoint: ticket.offeringOutpoint, value: ticket.offeringValue, satpoint: sp[ticket.offeringInscription] ?? null, inscriptionsInUtxo: pick?.inUtxo ?? 0 });
                if (bad) throw new Error(`Item can't be offered: ${bad}`);
                const sk = deviceNostrKey();
                const pubkey = nostrPubkeyOf(sk);
                const issuedAt = Math.floor(Date.now() / 1000);
                setPost({ phase: "working", msg: "Waiting for your wallet to sign the ownership proof…" });
                const signature = await signMessageWithWallet(provider, makerAddress, offerProofMessage(ticket, pubkey, issuedAt));
                setPost({ phase: "working", msg: "Checking the proof against Bitcoin…" });
                const v = (await verifyBarterOffersFn({ data: { fresh: true, offers: [{ key: "x", ...ticket, nostrPubkey: pubkey, issuedAt, signature }] } }))["x"];
                if (!v?.ok) throw new Error(`Proof refused: ${v && !v.ok ? v.reason : "no answer"}`);
                setPost({ phase: "working", msg: "Sending to Nostr relays…" });
                const ev = signBarterEvent([...ticketTags(ticket), ["proof_sig", signature], ["proof_issued", String(issuedAt)]], c.note.slice(0, 280), sk);
                const relays = await publishEvent(ev);
                if (relays.length === 0) throw new Error("No relay accepted the offer. Nothing was posted.");
                setPost({ phase: "done", msg: `Posted. ${relays.length} relay${relays.length === 1 ? "" : "s"} confirmed receipt.`, relays });
                onPosted();
              } catch (e) {
                setPost({ phase: "error", msg: e instanceof Error ? e.message : String(e) });
              }
            }}
          >{post.phase === "working" ? "WORKING…" : post.phase === "done" ? "POSTED" : "SIGN PROOF & POST OFFER"}</button>
          {!provider && <p className="text-destructive">Connect a wallet to sign.</p>}
          {post.msg && <p className={post.phase === "error" ? "text-destructive" : post.phase === "done" ? "text-accent" : "text-muted-foreground"}>{post.msg}</p>}
          {post.relays && <ul className="text-muted-foreground">{post.relays.map((r) => <li key={r}>✓ {r}</li>)}</ul>}
          <p className="text-muted-foreground">Takers' signed swaps arrive in "Swap proposals" on this page, in this browser. You review and sign each one; nothing moves without you.</p>
          <button className="border border-border px-3 py-2" onClick={() => setStep(2)}>BACK</button>
        </div>
      )}
    </Sheet>
  );
}

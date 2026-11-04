import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useWalletSession } from "@/lib/wallet-session";
import { getWalletFn } from "@/lib/wallet.functions";
import type { WalletSnapshot } from "@/lib/wallet";
import { inscriptionSatpointsFn } from "@/lib/barter.functions";
import { fetchBarterTickets, describeCriteria, type FeedTicket } from "@/lib/barter-feed";
import {
  matchesCriteria, ticketProblem, ticketTags, satpointProblem, DUST_SATS,
  type AssetFacts, type BarterCriteria, type BarterTicket,
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
  const sats = useQuery({
    queryKey: ["barter-satpoints", raw.map((a) => a.inscriptionId).join(",")],
    queryFn: () => inscriptionSatpointsFn({ data: { ids: raw.slice(0, 60).map((a) => a.inscriptionId) } }),
    enabled: raw.length > 0,
    staleTime: 60_000,
  });
  const mine = useMemo<Checked[]>(() => raw.map((a, i) => {
    if (i >= 60) return { ...a, block: "too many items to check at once" };
    if (!sats.data) return { ...a, block: sats.isError ? "position could not be read from chain" : "checking position…" };
    const sp = sats.data[a.inscriptionId] ?? null;
    const block = satpointProblem({ outpoint: a.outpoint, value: a.value, satpoint: sp, inscriptionsInUtxo: a.inUtxo });
    return { ...a, offset: block ? a.offset : 0, satpoint: sp, block };
  }), [raw, sats.data, sats.isError]);

  const [filter, setFilter] = useState<{ type: string; maxHeight: string; fillable: boolean }>({ type: "", maxHeight: "", fillable: false });
  const [drawer, setDrawer] = useState<FeedTicket | null>(null);
  const [wizard, setWizard] = useState(false);

  const tickets = (feed.data ?? []).filter((t) => {
    if (filter.type && t.criteria.assetType !== filter.type) return false;
    const mh = Number(filter.maxHeight);
    if (filter.maxHeight && (t.criteria.maxHeight === undefined || t.criteria.maxHeight > mh)) return false;
    if (filter.fillable && !mine.some((a) => matchesCriteria(t.criteria, a))) return false;
    return true;
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 font-mono">
      <header className="mb-6 border border-border bg-card/60 p-5">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">BW-BARTER-1 · draft</p>
        <h1 className="mt-1 font-display text-3xl text-primary">BARTER BOARD</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Offers to swap one inscription for another that meets set rules. Items are matched only using facts read from Bitcoin. Missing facts never count as a match.
        </p>
        <div className="mt-3">
          <Unavailable>Wallet signing and settlement are not built yet. You can browse, filter, draft and check matches, but nothing can be signed, posted or traded.</Unavailable>
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

      {feed.isLoading && <p className="text-sm text-muted-foreground">Reading offers from Nostr relays…</p>}
      {feed.error && <p className="text-sm text-destructive">Could not reach the relays.</p>}
      {feed.data && tickets.length === 0 && (
        <p className="border border-border p-4 text-sm text-muted-foreground">
          {feed.data.length === 0 ? "No barter offers on the relays yet." : "No offers match these filters."}
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {tickets.map((t) => {
          const n = mine.filter((a) => matchesCriteria(t.criteria, a)).length;
          return (
            <li key={t.eventId} className="border border-border bg-card/60 p-4 text-xs">
              <p className="text-muted-foreground">OFFERING</p>
              <a href={`https://ordinals.com/inscription/${t.offeringInscription}`} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                {t.offeringInscription.slice(0, 12)}…
              </a>
              <p className="mt-2 text-muted-foreground">WANTS</p>
              <p className="text-sm text-foreground">{describeCriteria(t.criteria)}</p>
              {t.sweetenerSats > 0 && <p className="mt-1">{t.sweetenerDir === "demand" ? "+ asks" : "+ adds"} {t.sweetenerSats.toLocaleString()} sats</p>}
              {t.note && <p className="mt-2 italic text-muted-foreground">“{t.note}”</p>}
              <div className="mt-3 flex items-center justify-between">
                <span className={n > 0 ? "text-accent" : "text-muted-foreground"}>{wallet ? `${n} match${n === 1 ? "" : "es"} in your wallet` : ""}</span>
                <button className="border border-border px-2 py-1 hover:border-primary" onClick={() => setDrawer(t)}>VIEW MATCHES</button>
              </div>
            </li>
          );
        })}
      </ul>

      {drawer && <MatchDrawer ticket={drawer} mine={mine} hasWallet={!!wallet} onClose={() => setDrawer(null)} />}
      {wizard && <PostWizard mine={mine} makerAddress={wallet?.ordinalsAddress ?? ""} onClose={() => setWizard(false)} />}
    </main>
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

function MatchDrawer({ ticket, mine, hasWallet, onClose }: { ticket: FeedTicket; mine: Checked[]; hasWallet: boolean; onClose: () => void }) {
  const ok = mine.filter((a) => matchesCriteria(ticket.criteria, a));
  const usesTx = ticket.criteria.minTxCount !== undefined || ticket.criteria.maxTxCount !== undefined;
  return (
    <Sheet title="MATCHING ASSETS" onClose={onClose}>
      <p className="text-muted-foreground">Wants: <span className="text-foreground">{describeCriteria(ticket.criteria)}</span></p>
      {usesTx && <p className="mt-2 text-muted-foreground">This offer has a transaction-count rule. The wallet scan doesn't read tx counts, so nothing can match it here yet.</p>}
      {!hasWallet && <p className="mt-3">Connect a wallet to check your items.</p>}
      {hasWallet && ok.length === 0 && <p className="mt-3">None of your items meet these rules.</p>}
      <ul className="mt-3 space-y-2">
        {ok.map((a) => (
          <li key={a.inscriptionId} className={`border p-2 ${a.block ? "border-destructive/50" : "border-border"}`}>
            <div className="flex items-center justify-between">
              <span className={a.block ? "text-muted-foreground line-through" : "text-accent"}>{assetLabel(a)}</span>
              <span className="text-muted-foreground">{a.value.toLocaleString()} sats postage</span>
            </div>
            <p className={`mt-1 ${a.block ? "text-destructive" : "text-accent"}`}>{a.block ? `Blocked: ${a.block}` : "✓ Position checked: first sat of its own output"}</p>
          </li>
        ))}
      </ul>
      {ok.length > 0 && <p className="mt-2 text-muted-foreground">{ok.filter((a) => !a.block).length} of {ok.length} matching items can be used.</p>}
      <div className="mt-4 space-y-2">
        <button disabled className="w-full cursor-not-allowed border border-border px-3 py-2 opacity-50">PROPOSE SWAP & SIGN</button>
        <Unavailable>Building, signing and sending the swap is not implemented.</Unavailable>
      </div>
    </Sheet>
  );
}

function PostWizard({ mine, makerAddress, onClose }: { mine: AssetFacts[]; makerAddress: string; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [pick, setPick] = useState<AssetFacts | null>(null);
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
  const problem = ticket ? ticketProblem(ticket) : "pick an item first";
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
                <button className={`w-full border p-2 text-left ${pick?.inscriptionId === a.inscriptionId ? "border-primary text-primary" : "border-border"}`} onClick={() => setPick(a)}>
                  {assetLabel(a)} <span className="text-muted-foreground">· {a.value.toLocaleString()} sats</span>
                </button>
              </li>
            ))}
          </ul>
          <button disabled={!pick} className="mt-4 w-full border border-primary px-3 py-2 text-primary disabled:opacity-40" onClick={() => setStep(2)}>NEXT: WHAT YOU WANT</button>
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
            <button className="flex-1 border border-primary px-3 py-2 text-primary" onClick={() => setStep(3)}>NEXT: REVIEW</button>
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
          <button disabled className="w-full cursor-not-allowed border border-border px-3 py-2 opacity-50">SIGN & POST OFFER</button>
          <Unavailable>Signing and posting offers is not implemented, so this draft is not saved or shared anywhere.</Unavailable>
          <button className="border border-border px-3 py-2" onClick={() => setStep(2)}>BACK</button>
        </div>
      )}
    </Sheet>
  );
}

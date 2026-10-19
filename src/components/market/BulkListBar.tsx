import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { openOffersQuery, unlistMessage, type Offer } from "@/lib/offers";
import { submitOfferFn, cancelOfferFn } from "@/lib/offers.functions";
import { buildListingPsbt } from "@/lib/psbt-builder";
import { signListingPsbt, signMessageWithWallet, xOnlyPubKeyHex } from "@/lib/browser-wallet";
import { useWalletSession } from "@/lib/wallet-session";
import { formatSats } from "@/lib/trades";
import type { BitmonCheck } from "@/lib/bitmon-verify";
import { DUST_SATS, isFarBelowFloor, ladderPrice, listingGuards, matchPrice, suggestFloor } from "@/lib/holder-bulk";
import { computeEv } from "@/lib/listing-ev";
import { supabase } from "@/integrations/supabase/client";

export type BulkItem = { outpoint: string; valueSats: number; bitmapHeight: number };
type Status = "pending" | "signing" | "done" | "skipped" | "failed" | "cancelled";

/**
 * Docked bulk action bar for the seller console. Every BITMAP is its own UTXO,
 * so each listing is its own wallet-signed PSBT, signed one after another.
 * A rejected signature only fails that item; the queue keeps going.
 */
export function BulkListBar({
  items,
  openByOutpoint,
  checks,
  onClear,
}: {
  items: BulkItem[];
  openByOutpoint: Map<string, Offer>;
  checks: Map<number, BitmonCheck>;
  onClear: () => void;
}) {
  const wallet = useWalletSession();
  const qc = useQueryClient();
  const asks = useQuery(openOffersQuery());
  const [mode, setMode] = useState<"ev" | "evlow" | "evhigh" | "uniform" | "floor" | "under1">("ev");
  const [ladder, setLadder] = useState(0);
  const [uniform, setUniform] = useState("");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [running, setRunning] = useState(false);
  const [confirmRisk, setConfirmRisk] = useState(false);
  const stop = useRef(false);
  const skip = useRef(false);
  const sales = useQuery({
    queryKey: ["ev-sales"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("bitmap_height, price_sats, block_time")
        .gt("price_sats", 0)
        .order("block_height", { ascending: false, nullsFirst: false })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const plan = useMemo(() => {
    let rung = 0;
    return items.map((b) => {
      const floor = suggestFloor(b.bitmapHeight, asks.data ?? [], wallet?.ordinalsAddress ?? "");
      const ev = sales.data ? computeEv(b.bitmapHeight, sales.data) : null;
      const ov = overrides[b.outpoint];
      let price: number | null = null;
      let manual = false;
      if (ov && Number(ov) > 0) { price = Math.round(Number(ov)); manual = true; }
      else if (mode === "uniform") price = Number(uniform) > 0 ? Math.round(Number(uniform)) : null;
      else if (mode === "ev" || mode === "evlow" || mode === "evhigh") price = ev && !ev.fallback ? (mode === "ev" ? ev.mid : mode === "evlow" ? ev.low : ev.high) : null;
      else if (floor) price = matchPrice(floor.floorSats, mode);
      if (price !== null && !manual && ladder > 0) price = ladderPrice(price, rung++, ladder);
      if (price !== null && price < DUST_SATS) price = null;
      const c = checks.get(b.bitmapHeight);
      const guards = listingGuards(b.bitmapHeight, !!c && c.status !== "unverified");
      const lowball = price !== null && (isFarBelowFloor(price, ev?.mid ?? null) || isFarBelowFloor(price, floor?.floorSats ?? null));
      const needsChoice = !manual && (mode === "ev" || mode === "evlow" || mode === "evhigh") && (!ev || ev.fallback);
      return { b, floor, ev, price, guards, lowball, needsChoice, offer: openByOutpoint.get(b.outpoint) ?? null };
    });
  }, [items, asks.data, sales.data, wallet?.ordinalsAddress, overrides, mode, uniform, ladder, checks, openByOutpoint]);

  const listable = plan.filter((p) => p.price !== null);
  const risky = listable.filter((p) => p.guards.length > 0 || p.lowball);
  const total = listable.reduce((s, p) => s + p.price!, 0);
  const unlistable = plan.filter((p) => p.offer);

  function invalidate() {
    for (const key of ["offers", "wallet-offers", "registry", "activity", "trades"]) void qc.invalidateQueries({ queryKey: [key] });
  }

  async function runList() {
    if (!wallet) return;
    if (risky.length > 0 && !confirmRisk) {
      toast("CONFIRM FLAGGED BITMAPS FIRST", { description: "TICK THE CONFIRMATION BELOW THE LIST" });
      return;
    }
    setRunning(true);
    stop.current = false;
    const tapInternalKeyHex = xOnlyPubKeyHex(wallet.publicKey);
    for (const p of listable) {
      if (stop.current) { setStatus((s) => ({ ...s, [p.b.outpoint]: "cancelled" })); continue; }
      if (p.offer && p.offer.priceSats === p.price) { setStatus((s) => ({ ...s, [p.b.outpoint]: "skipped" })); continue; }
      skip.current = false;
      setStatus((s) => ({ ...s, [p.b.outpoint]: "signing" }));
      try {
        const [txid, voutRaw] = p.b.outpoint.split(":");
        const psbt = buildListingPsbt({
          txid: txid!, vout: Number(voutRaw), utxoValueSats: p.b.valueSats,
          sellerAddress: wallet.ordinalsAddress, priceSats: p.price!,
          ...(tapInternalKeyHex ? { tapInternalKeyHex } : {}),
          ...(wallet.publicKey ? { publicKeyHex: wallet.publicKey } : {}),
        });
        const signed = await signListingPsbt(wallet.provider, psbt, wallet.ordinalsAddress);
        if (skip.current) { setStatus((s) => ({ ...s, [p.b.outpoint]: "skipped" })); continue; }
        const stored = await submitOfferFn({ data: { psbt: signed } });
        if (p.offer && p.offer.id !== stored.id) {
          try {
            const sig = await signMessageWithWallet(wallet.provider, wallet.ordinalsAddress, unlistMessage(p.offer.id));
            await cancelOfferFn({ data: { offerId: p.offer.id, signature: sig } });
          } catch { toast(`OLD ASK ON ${p.b.bitmapHeight}.BITMAP STILL OPEN`); }
        }
        setStatus((s) => ({ ...s, [p.b.outpoint]: "done" }));
      } catch {
        setStatus((s) => ({ ...s, [p.b.outpoint]: "failed" }));
      }
    }
    setRunning(false);
    invalidate();
  }

  async function runUnlist() {
    if (!wallet) return;
    setRunning(true);
    stop.current = false;
    for (const p of unlistable) {
      if (stop.current) break;
      setStatus((s) => ({ ...s, [p.b.outpoint]: "signing" }));
      try {
        const sig = await signMessageWithWallet(wallet.provider, wallet.ordinalsAddress, unlistMessage(p.offer!.id));
        await cancelOfferFn({ data: { offerId: p.offer!.id, signature: sig } });
        setStatus((s) => ({ ...s, [p.b.outpoint]: "done" }));
      } catch {
        setStatus((s) => ({ ...s, [p.b.outpoint]: "failed" }));
      }
    }
    setRunning(false);
    invalidate();
  }

  const doneN = Object.values(status).filter((s) => s === "done").length;

  return (
    <div className="sticky bottom-0 z-20 border-t border-primary/60 bg-background/95 p-4 backdrop-blur" data-testid="bulk-bar">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] font-bold text-primary">{items.length} SELECTED</span>
        <span className="label">PRICE:</span>
        {([["ev", "FAIR EV"], ["evlow", "EV−"], ["evhigh", "EV+"], ["floor", "MATCH FLOOR"], ["under1", "FLOOR −1%"], ["uniform", "SAME PRICE"]] as const).map(([m, l]) => (
          <button key={m} disabled={running} className={mode === m ? "btn-term !px-2 !py-1" : "btn-term-ghost !px-2 !py-1"} onClick={() => setMode(m)}>{l}</button>
        ))}
        {mode === "uniform" && (
          <input value={uniform} onChange={(e) => setUniform(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="SATS EACH" aria-label="Same price in sats"
            className="w-32 border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground focus:border-foreground focus:outline-none" />
        )}
        <label className="label flex items-center gap-1">LADDER
          <select value={ladder} disabled={running} onChange={(e) => setLadder(Number(e.target.value))} aria-label="Ladder step"
            className="border border-border bg-background px-1 py-1 font-mono text-[11px] text-foreground">
            {[0, 1, 2, 5, 10].map((v) => <option key={v} value={v}>{v === 0 ? "OFF" : `+${v}% EACH`}</option>)}
          </select>
        </label>
        <span className="label ml-auto">{listable.length} PRICED · TOTAL {formatSats(total)}{plan.some((p) => p.needsChoice) ? ` · ${plan.filter((p) => p.needsChoice).length} NEED YOUR PRICE (NOT SIGNED)` : ""}</span>
      </div>

      <ul className="mt-3 max-h-56 divide-y divide-border overflow-auto border border-border">
        {plan.map((p) => {
          const st = status[p.b.outpoint];
          return (
            <li key={p.b.outpoint} className="flex flex-wrap items-center gap-2 px-3 py-2 font-mono text-[10px]">
              <span className="w-28 font-bold text-foreground">{p.b.bitmapHeight}.BITMAP</span>
              <span className="text-muted-foreground">
                {p.ev && !p.ev.fallback ? `EV ${p.ev.mid.toLocaleString("en-US")} · ${p.ev.sampleSize} ${p.ev.scope} · ` : sales.isLoading ? "READING SALES… · " : ""}{p.floor ? `${p.floor.scope.toUpperCase()} FLOOR ${p.floor.floorSats.toLocaleString("en-US")} SATS` : asks.isLoading ? "READING FLOORS…" : "NO COMPARABLE ASKS"}
              </span>
              {p.guards.map((g) => <span key={g.id} className="border border-primary/60 px-1 text-primary">⚠ {g.label}</span>)}
              {p.lowball && <span className="border border-destructive px-1 text-destructive">⚠ UNDER HALF OF EV/FLOOR</span>}
              {p.needsChoice && !sales.isLoading && (
                <span className="flex w-full flex-wrap items-center gap-2 border border-bitcoin/60 px-2 py-1 text-bitcoin" data-testid="ev-fallback">
                  ⚠ {p.ev ? `${p.ev.peerCount} COMPARABLE ${p.ev.tierLabel ?? ""} SALE${p.ev.peerCount === 1 ? "" : "S"} (NEED 3)` : "0 COMPARABLE SALES (NEED 3)"}{p.ev ? ` · ALL-BITMAP EV ${p.ev.mid.toLocaleString("en-US")} (${p.ev.sampleSize} SALES) NOT USED` : ""} · CONFIRM A PRICE TO LIST
                  {p.floor && (
                    <button type="button" disabled={running} className="btn-term-ghost !px-2 !py-0.5"
                      onClick={() => setOverrides((o) => ({ ...o, [p.b.outpoint]: String(p.floor!.floorSats) }))}>
                      [ USE {p.floor.scope.toUpperCase()} FLOOR {p.floor.floorSats.toLocaleString("en-US")} ]
                    </button>
                  )}
                </span>
              )}
              <input value={overrides[p.b.outpoint] ?? ""} disabled={running}
                onChange={(e) => setOverrides((o) => ({ ...o, [p.b.outpoint]: e.target.value.replace(/[^0-9]/g, "") }))}
                placeholder={p.price ? p.price.toLocaleString("en-US") : p.needsChoice ? "YOUR PRICE" : "SATS"} aria-label={`Price for ${p.b.bitmapHeight}.bitmap`}
                className="ml-auto w-28 border border-border bg-background px-2 py-0.5 text-right text-foreground focus:border-foreground focus:outline-none" />
              <span className={`w-16 text-right ${st === "done" ? "text-accent" : st === "failed" ? "text-destructive" : "text-muted-foreground"}`}>
                {st === "signing" ? "SIGNING…" : st ? st.toUpperCase() : p.offer ? "LISTED" : ""}
              </span>
            </li>
          );
        })}
      </ul>

      {risky.length > 0 && (
        <label className="mt-2 flex items-center gap-2 font-mono text-[10px] text-primary">
          <input type="checkbox" checked={confirmRisk} onChange={(e) => setConfirmRisk(e.target.checked)} />
          I CHECKED THE {risky.length} FLAGGED BITMAP{risky.length > 1 ? "S" : ""} AND WANT TO LIST AT THESE PRICES
        </label>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {running ? (
          <>
            <span className="label">SIGNED {doneN} · APPROVE EACH IN YOUR WALLET</span>
            <button className="btn-term-ghost !px-3 !py-1" onClick={() => { skip.current = true; }}>[ SKIP CURRENT ]</button>
            <button className="btn-term-ghost !px-3 !py-1" onClick={() => { stop.current = true; }}>[ CANCEL REMAINING ]</button>
          </>
        ) : (
          <>
            <button className="btn-term" disabled={!wallet || listable.length === 0} onClick={() => void runList()}>[ LIST SELECTED ({listable.length}) ]</button>
            <button className="btn-term-ghost" disabled={!wallet || unlistable.length === 0} onClick={() => void runUnlist()}>[ UNLIST SELECTED ({unlistable.length}) ]</button>
            <button className="btn-term-ghost ml-auto" onClick={() => { setStatus({}); onClear(); }}>[ CLEAR ]</button>
          </>
        )}
      </div>
      <p className="mt-2 font-mono text-[9px] text-muted-foreground">
        &gt; EACH BITMAP IS SIGNED SEPARATELY BY YOUR WALLET · UNLISTING MOVES NO FUNDS · FLOORS EXCLUDE YOUR OWN ASKS · EV FROM CONFIRMED SALES · BUYER PAYS THE FEE, YOU GET YOUR FULL ASK
      </p>
    </div>
  );
}

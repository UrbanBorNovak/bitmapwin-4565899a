import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { offersQuery, type Offer } from "@/lib/offers";
import { openBidsQuery, type Bid } from "@/lib/bids";
import { formatSats } from "@/lib/trades";
import { btcPriceQuery, usdFromSats } from "@/lib/btc-price";
import { shortenAddress } from "@/lib/registry";
import { walletQuery } from "@/lib/wallet";
import { useWalletSession } from "@/lib/wallet-session";
import { buildListingPsbt } from "@/lib/psbt-builder";
import {
  keyCandidates,
  signListingPsbt,
  signPurchasePsbt,
  xOnlyPubKeyHex,
  WALLET_LABEL,
} from "@/lib/browser-wallet";
import { submitOfferFn } from "@/lib/offers.functions";
import { buildPurchaseFn, submitPurchaseFn } from "@/lib/purchase.functions";
import { resolveWallet } from "@/components/BuyButton";
import { MARKETPLACE_FEE_PERCENT } from "@/lib/marketplace-fee";

/**
 * Exchange-style order book for bitmaps: real open sale PSBTs on the ask side,
 * real signed bid intents on the bid side. Asks can be swept in one pass and
 * owned bitmaps can be listed in bulk.
 */
export function BitmapOrderBook({ height }: { height?: number }) {
  const { data: offers = [], isPending: offersPending } = useQuery(offersQuery(height));
  const { data: bids = [], isPending: bidsPending } = useQuery(openBidsQuery(500));
  // Hold the loading state until after hydration: when the query cache is
  // prefetched, the first client render already has data while the server
  // rendered Loading — without this gate the tree hydration-mismatches.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const { data: price } = useQuery(btcPriceQuery());
  const usdPerBtc = price?.usd;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showList, setShowList] = useState(false);

  const asks = useMemo(
    () =>
      offers
        .filter(
          (o) =>
            o.status === "open" &&
            o.priceSats > 0 &&
            o.bitmapHeight !== null &&
            (height === undefined || o.bitmapHeight === height),
        )
        .sort((a, b) => a.priceSats - b.priceSats),
    [offers],
  );
  const liveBids = useMemo(
    () =>
      bids
        .filter((b) => (height === undefined ? true : b.bitmapHeight === height))
        .sort((a, b) => b.priceSats - a.priceSats),
    [bids, height],
  );

  const maxSide = Math.max(
    1,
    ...asks.map((a) => a.priceSats),
    ...liveBids.map((b) => b.priceSats),
  );

  const bestAsk = asks[0]?.priceSats ?? null;
  const bestBid = liveBids[0]?.priceSats ?? null;
  const spread = bestAsk !== null && bestBid !== null ? bestAsk - bestBid : null;

  const sweepList = asks.filter((a) => selected.has(a.id));
  const sweepTotal = sweepList.reduce((sum, a) => sum + a.priceSats, 0);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const queryClient = useQueryClient();

  const sweep = useMutation({
    mutationFn: async () => {
      if (sweepList.length === 0) throw new Error("SELECT AT LEAST ONE ASK");
      const wallet = await resolveWallet();
      const tapKey = xOnlyPubKeyHex(wallet.publicKey);
      const done: string[] = [];
      const failed: string[] = [];
      for (const ask of sweepList) {
        const label = ask.bitmapHeight === null ? ask.outpoint.slice(0, 8) : String(ask.bitmapHeight);
        try {
          const quote = await buildPurchaseFn({
            data: {
              offerId: ask.id,
              buyerPaymentAddress: wallet.paymentAddress,
              buyerOrdinalsAddress: wallet.ordinalsAddress,
              expectedPriceSats: ask.priceSats,
              ...(tapKey ? { tapInternalKeyHex: tapKey } : {}),
              ...(keyCandidates(wallet).length > 0
              ? { paymentPublicKeyHex: keyCandidates(wallet) }
              : {}),
            },
          });
          toast(`SIGN ${label}.BITMAP IN ${WALLET_LABEL[wallet.provider]}`, {
            description: `${formatSats(quote.priceSats)} + ${quote.marketFeeSats} SATS MARKET FEE (${MARKETPLACE_FEE_PERCENT}%)`,
          });
          const signed = await signPurchasePsbt(
            wallet.provider,
            quote.psbtBase64,
            wallet.paymentAddress,
            quote.signIndices,
          );
          await submitPurchaseFn({
            data: { offerId: ask.id, psbt: signed, buyerAddress: wallet.ordinalsAddress },
          });
          done.push(label);
        } catch (error) {
          failed.push(`${label}: ${(error as Error).message}`);
        }
      }
      return { done, failed };
    },
    onSuccess: ({ done, failed }) => {
      void queryClient.invalidateQueries({ queryKey: ["offers"] });
      void queryClient.invalidateQueries({ queryKey: ["registry"] });
      setSelected(new Set());
      toast(`SWEPT ${done.length} BITMAP(S)`, {
        description: failed.length
          ? `FAILED ${failed.length}: ${failed.join(" · ")}`.toUpperCase()
          : done.map((d) => `${d}.BITMAP`).join(" · "),
      });
    },
    onError: (e) => toast("SWEEP FAILED", { description: (e as Error).message.toUpperCase() }),
  });

  return (
    <section className="border border-border bg-card">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="font-mono text-sm font-bold uppercase text-foreground">BITMAP ORDER BOOK</h2>
          <p className="label mt-2">
            {height === undefined ? "BITMAP BIDS & ASKS ONLY" : `${height}.BITMAP DEPTH`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 font-mono text-[10px]">
          <span className="text-muted-foreground">
            BEST BID <span className="text-foreground">{bestBid ? formatSats(bestBid) : "—"}</span>
          </span>
          <span className="text-muted-foreground">
            BEST ASK <span className="text-primary">{bestAsk ? formatSats(bestAsk) : "—"}</span>
          </span>
          <span className="text-muted-foreground">
            SPREAD <span className="text-foreground">{spread !== null ? formatSats(spread) : "—"}</span>
          </span>
          <button className="btn-term-ghost !px-2 !py-1" onClick={() => setShowList((v) => !v)}>
            {showList ? "[ HIDE BULK LIST ]" : "[ LIST MANY ]"}
          </button>
        </div>
      </header>

      {showList && (
        <div className="border-b border-border p-5">
          <BulkListPanel {...(height === undefined ? {} : { height })} />
        </div>
      )}

      <div className="grid gap-0 md:grid-cols-2 md:divide-x md:divide-border">
        <div>
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="label text-foreground">BIDS — {liveBids.length}</span>
            <span className="label">SIGNED INTENTS</span>
          </div>
          {!hydrated || bidsPending ? (
            <Loading />
          ) : liveBids.length === 0 ? (
            <Empty text="NO LIVE BIDS" />
          ) : (
            <ul>
              {liveBids.slice(0, 12).map((bid) => (
                <BidRow key={bid.id} bid={bid} max={maxSide} usdPerBtc={usdPerBtc} />
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="label text-primary">ASKS — {asks.length}</span>
            <span className="label">SIGNED SALE PSBTS</span>
          </div>
          {!hydrated || offersPending ? (
            <Loading />
          ) : asks.length === 0 ? (
            <Empty text="NO OPEN ASKS" />
          ) : (
            <ul>
              {asks.slice(0, 12).map((ask) => (
                <AskRow
                  key={ask.id}
                  ask={ask}
                  max={maxSide}
                  usdPerBtc={usdPerBtc}
                  checked={selected.has(ask.id)}
                  onToggle={() => toggle(ask.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
        <div className="font-mono text-[11px] text-muted-foreground">
          &gt; SWEEP {sweepList.length} ASK(S) ·{" "}
          <span className="text-foreground">{sweepTotal ? formatSats(sweepTotal) : "—"}</span>
          {usdFromSats(sweepTotal, usdPerBtc) ? ` · ${usdFromSats(sweepTotal, usdPerBtc)}` : ""}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-term-ghost !px-3 !py-1.5"
            disabled={asks.length === 0}
            onClick={() => setSelected(new Set(asks.slice(0, 10).map((a) => a.id)))}
          >
            [ SELECT 10 CHEAPEST ]
          </button>
          <button
            className="btn-term-ghost !px-3 !py-1.5"
            disabled={selected.size === 0}
            onClick={() => setSelected(new Set())}
          >
            [ CLEAR ]
          </button>
          <button
            className="btn-term"
            disabled={sweep.isPending || sweepList.length === 0}
            onClick={() => sweep.mutate()}
          >
            {sweep.isPending ? "[ SWEEPING… ]" : `[ SWEEP ${sweepList.length || ""} ]`}
          </button>
        </div>
      </footer>
    </section>
  );
}

function DepthBar({ ratio, side }: { ratio: number; side: "bid" | "ask" }) {
  return (
    <div
      aria-hidden
      className={`absolute inset-y-0 ${side === "ask" ? "right-0 bg-primary/15" : "left-0 bg-foreground/10"}`}
      style={{ width: `${Math.max(4, Math.min(100, ratio * 100))}%` }}
    />
  );
}

function BidRow({ bid, max, usdPerBtc }: { bid: Bid; max: number; usdPerBtc?: number | undefined }) {
  const usd = usdFromSats(bid.priceSats, usdPerBtc);
  return (
    <li className="relative border-b border-border/60">
      <DepthBar ratio={bid.priceSats / max} side="bid" />
      <div className="relative flex items-center justify-between gap-3 px-4 py-2 font-mono text-[11px]">
        <Link
          to="/bitmap/$block"
          params={{ block: String(bid.bitmapHeight) }}
          className="hover:text-primary"
        >
          {bid.bitmapHeight}.BITMAP
        </Link>
        <span className="hidden text-muted-foreground sm:block">
          {shortenAddress(bid.bidderAddress)}
        </span>
        <span className="text-right">
          <span className="text-foreground">{formatSats(bid.priceSats)}</span>
          {usd && <span className="ml-2 text-muted-foreground">{usd}</span>}
        </span>
      </div>
    </li>
  );
}

function AskRow({
  ask,
  max,
  usdPerBtc,
  checked,
  onToggle,
}: {
  ask: Offer;
  max: number;
  usdPerBtc?: number | undefined;
  checked: boolean;
  onToggle: () => void;
}) {
  const usd = usdFromSats(ask.priceSats, usdPerBtc);
  return (
    <li className="relative border-b border-border/60">
      <DepthBar ratio={ask.priceSats / max} side="ask" />
      <div className="relative flex items-center justify-between gap-3 px-4 py-2 font-mono text-[11px]">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            className="size-3 accent-primary"
            aria-label={`Select ${ask.bitmapHeight ?? ask.outpoint} for sweep`}
          />
          {ask.bitmapHeight === null ? (
            <span className="text-muted-foreground">{ask.outpoint.slice(0, 10)}…</span>
          ) : (
            <Link
              to="/bitmap/$block"
              params={{ block: String(ask.bitmapHeight) }}
              className="hover:text-primary"
            >
              {ask.bitmapHeight}.BITMAP
            </Link>
          )}
        </label>
        <span className="text-right">
          <span className="text-primary">{formatSats(ask.priceSats)}</span>
          {usd && <span className="ml-2 text-muted-foreground">{usd}</span>}
        </span>
      </div>
    </li>
  );
}

/** Sign and submit a sale PSBT for several owned bitmaps in one pass. */
function BulkListPanel({ height }: { height?: number }) {
  const wallet = useWalletSession();
  const queryClient = useQueryClient();
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState<"btc" | "sats">("btc");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const ordinals = wallet?.ordinalsAddress ?? "";
  const snapshot = useQuery({ ...walletQuery(ordinals), enabled: ordinals !== "" });

  const priceSats = useMemo(() => {
    const n = Number(price);
    if (!price.trim() || !Number.isFinite(n) || n <= 0) return null;
    const sats = unit === "btc" ? Math.round(n * 100_000_000) : Math.round(n);
    return sats >= 546 ? sats : null;
  }, [price, unit]);

  const owned = useMemo(() => {
    const utxos = snapshot.data?.utxos ?? [];
    const all = utxos.flatMap((u) =>
      u.inscriptions
        .filter((i) => i.bitmapHeight !== null)
        .map((i) => ({
          outpoint: u.outpoint,
          valueSats: u.valueSats,
          bitmapHeight: i.bitmapHeight as number,
        })),
    );
    return height === undefined ? all : all.filter((p) => p.bitmapHeight === height);
  }, [snapshot.data, height]);

  const list = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error("CONNECT A WALLET FIRST");
      if (priceSats === null) throw new Error("ASK AT LEAST 546 SATS");
      const targets = owned.filter((p) => picked.has(p.outpoint));
      if (targets.length === 0) throw new Error("SELECT AT LEAST ONE BITMAP");
      const tapInternalKeyHex = xOnlyPubKeyHex(wallet.publicKey);
      const done: number[] = [];
      const failed: string[] = [];
      for (const target of targets) {
        try {
          const [txid, voutRaw] = target.outpoint.split(":");
          const vout = Number(voutRaw);
          if (!txid || !Number.isInteger(vout)) throw new Error("BAD OUTPOINT");
          const psbt = buildListingPsbt({
            txid,
            vout,
            utxoValueSats: target.valueSats,
            sellerAddress: wallet.ordinalsAddress,
            priceSats,
            ...(tapInternalKeyHex ? { tapInternalKeyHex } : {}),
            ...(wallet.publicKey ? { publicKeyHex: wallet.publicKey } : {}),
          });
          const signed = await signListingPsbt(wallet.provider, psbt, wallet.ordinalsAddress);
          await submitOfferFn({ data: { psbt: signed } });
          done.push(target.bitmapHeight);
        } catch (error) {
          failed.push(`${target.bitmapHeight}: ${(error as Error).message}`);
        }
      }
      return { done, failed };
    },
    onSuccess: ({ done, failed }) => {
      void queryClient.invalidateQueries({ queryKey: ["offers"] });
      void queryClient.invalidateQueries({ queryKey: ["registry"] });
      setPicked(new Set());
      toast(`LISTED ${done.length} BITMAP(S)`, {
        description: failed.length
          ? `FAILED ${failed.length}: ${failed.join(" · ")}`.toUpperCase()
          : done.map((d) => `${d}.BITMAP`).join(" · "),
      });
    },
    onError: (e) => toast("BULK LIST FAILED", { description: (e as Error).message.toUpperCase() }),
  });

  if (!wallet) {
    return (
      <p className="font-mono text-[11px] text-muted-foreground">
        &gt; CONNECT UNISAT OR XVERSE TO LIST BITMAPS IN BULK<span className="blink">_</span>
      </p>
    );
  }

  return (
    <div>
      <span className="label">BULK LIST — ONE PRICE, MANY BITMAPS</span>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 border border-border focus-within:border-foreground">
          <input
            value={price}
            onChange={(e) =>
              setPrice(e.target.value.replace(unit === "btc" ? /[^0-9.]/g : /[^0-9]/g, ""))
            }
            inputMode="decimal"
            placeholder={unit === "btc" ? "ASK PER BITMAP IN BTC" : "ASK PER BITMAP IN SATS"}
            className="flex-1 bg-background px-3 py-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            className="border-l border-border px-3 font-mono text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => {
              setUnit((u) => (u === "btc" ? "sats" : "btc"));
              setPrice("");
            }}
          >
            {unit === "btc" ? "BTC" : "SATS"}
          </button>
        </div>
        <button
          className="btn-term"
          disabled={list.isPending || priceSats === null || picked.size === 0}
          onClick={() => list.mutate()}
        >
          {list.isPending ? "[ SIGNING… ]" : `[ LIST ${picked.size || ""} ]`}
        </button>
      </div>

      {snapshot.isLoading ? (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          &gt; READING YOUR BITMAPS<span className="blink">_</span>
        </p>
      ) : owned.length === 0 ? (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          &gt; NO BITMAPS FOUND IN {shortenAddress(wallet.ordinalsAddress)}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {owned.map((p) => (
            <button
              key={p.outpoint}
              className={picked.has(p.outpoint) ? "btn-term !px-2 !py-1" : "btn-term-ghost !px-2 !py-1"}
              onClick={() =>
                setPicked((prev) => {
                  const next = new Set(prev);
                  if (next.has(p.outpoint)) next.delete(p.outpoint);
                  else next.add(p.outpoint);
                  return next;
                })
              }
            >
              {p.bitmapHeight}
            </button>
          ))}
          <button
            className="btn-term-ghost !px-2 !py-1"
            onClick={() => setPicked(new Set(owned.map((p) => p.outpoint)))}
          >
            [ ALL ]
          </button>
        </div>
      )}
      <p className="mt-2 font-mono text-[10px] text-muted-foreground">
        &gt; EACH BITMAP IS SIGNED SEPARATELY IN YOUR WALLET — BUYERS PAY THE{" "}
        {MARKETPLACE_FEE_PERCENT}% MARKET FEE
      </p>
    </div>
  );
}

function Loading() {
  return (
    <p className="p-5 font-mono text-[11px] text-muted-foreground">
      &gt; LOADING DEPTH<span className="blink">_</span>
    </p>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="p-5 font-mono text-[11px] text-muted-foreground">
      &gt; {text}
      <span className="blink">_</span>
    </p>
  );
}

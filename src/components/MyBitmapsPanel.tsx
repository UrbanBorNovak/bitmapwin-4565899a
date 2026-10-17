import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { walletQuery } from "@/lib/wallet";
import { sellerOffersQuery, type Offer } from "@/lib/offers";
import { submitOfferFn, cancelOfferFn } from "@/lib/offers.functions";
import { buildListingPsbt } from "@/lib/psbt-builder";
import { signListingPsbt, signMessageWithWallet, xOnlyPubKeyHex } from "@/lib/browser-wallet";
import { unlistMessage } from "@/lib/offers";
import { useWalletSession } from "@/lib/wallet-session";
import { formatSats } from "@/lib/trades";
import { shortenAddress } from "@/lib/registry";
import { MARKETPLACE_FEE_PERCENT } from "@/lib/marketplace-fee";
import { resolveWallet } from "@/components/BuyButton";
import { useVerifiedBitmons } from "@/lib/use-verified-bitmons";
import type { BitmonCheck } from "@/lib/bitmon-verify";
import { traitsOf, hasTrait, type TraitId } from "@/lib/traits";
import { BulkListBar } from "@/components/market/BulkListBar";

type HeldBitmap = {
  outpoint: string;
  valueSats: number;
  bitmapHeight: number;
};

/**
 * Seller console: every BITMAP actually sitting in the connected wallet, with
 * list / change price / unlist in one place. Only wallet-held inscriptions
 * appear here, and every action is signed by that wallet — the server revalidates
 * the signature and the live UTXO before an offer is stored.
 */
export function MyBitmapsPanel() {
  const wallet = useWalletSession();
  const ordinals = wallet?.ordinalsAddress ?? "";
  const snapshot = useQuery({ ...walletQuery(ordinals), enabled: ordinals !== "" });
  const offers = useQuery({ ...sellerOffersQuery(ordinals), enabled: ordinals !== "" });

  const held = useMemo<HeldBitmap[]>(() => {
    const utxos = snapshot.data?.utxos ?? [];
    return utxos
      .flatMap((u) =>
        u.inscriptions
          .filter((i) => i.bitmapHeight !== null)
          .map((i) => ({
            outpoint: u.outpoint,
            valueSats: u.valueSats,
            bitmapHeight: i.bitmapHeight as number,
          })),
      )
      .sort((a, b) => a.bitmapHeight - b.bitmapHeight);
  }, [snapshot.data]);

  const openByOutpoint = useMemo(() => {
    const map = new Map<string, Offer>();
    for (const offer of offers.data ?? []) {
      if (offer.status === "open") map.set(offer.outpoint, offer);
    }
    return map;
  }, [offers.data]);

  if (!wallet) {
    return (
      <section id="sell-bitmap" className="border border-border">
        <header className="border-b border-border p-5">
          <h2 className="display text-xl">MY BITMAPS</h2>
          <p className="label mt-2">CONNECT A WALLET TO LIST, REPRICE OR UNLIST YOUR OWN BITMAPS</p>
        </header>
        <p className="p-5 font-mono text-[11px] text-muted-foreground">
          &gt; CONNECT UNISAT OR XVERSE — YOU CAN ONLY LIST BITMAPS HELD BY YOUR OWN WALLET
          <span className="blink">_</span>
        </p>
        <div className="px-5 pb-5">
          <ConnectToSell />
        </div>
      </section>
    );
  }

  return (
    <section id="sell-bitmap" className="border border-border" data-tour="my-bitmaps">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="display text-xl">MY BITMAPS</h2>
          <p className="label mt-2">
            {shortenAddress(wallet.ordinalsAddress)} · {held.length} HELD · BUYER PAYS THE{" "}
            {MARKETPLACE_FEE_PERCENT}% FEE
          </p>
        </div>
        <button
          className="btn-term-ghost !px-3 !py-1.5"
          disabled={snapshot.isFetching || offers.isFetching}
          onClick={() => {
            void snapshot.refetch();
            void offers.refetch();
          }}
        >
          {snapshot.isFetching || offers.isFetching ? "[ READING CHAIN… ]" : "[ REFRESH ]"}
        </button>
      </header>

      {snapshot.isLoading ? (
        <p className="p-5 font-mono text-[11px] text-muted-foreground">
          &gt; READING YOUR WALLET FROM CHAIN<span className="blink">_</span>
        </p>
      ) : held.length === 0 ? (
        <p className="p-5 font-mono text-[11px] text-muted-foreground">
          &gt; NO BITMAP INSCRIPTION FOUND IN {shortenAddress(wallet.ordinalsAddress)}
        </p>
      ) : (
        <HeldList held={held} openByOutpoint={openByOutpoint} />
      )}
    </section>
  );
}

function ConnectToSell() {
  const connect = useMutation({
    mutationFn: () => resolveWallet(),
    onError: (e) => toast("WALLET NOT CONNECTED", { description: (e as Error).message.toUpperCase() }),
  });
  return (
    <button className="btn-term" disabled={connect.isPending} onClick={() => connect.mutate()}>
      {connect.isPending ? "[ CONNECTING… ]" : "[ CONNECT WALLET TO SELL ]"}
    </button>
  );
}

const PAGE = 20;

function HeldList({ held, openByOutpoint }: { held: HeldBitmap[]; openByOutpoint: Map<string, Offer> }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "listed" | "unlisted">("all");
  const [onlyBitmons, setOnlyBitmons] = useState(false);
  const [trait, setTrait] = useState<TraitId | "">("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { checks } = useVerifiedBitmons();
  const bitmonCount = useMemo(() => held.filter((b) => checks.has(b.bitmapHeight)).length, [held, checks]);
  // Only offer traits this wallet actually holds, with counts.
  const traitOptions = useMemo(() => {
    const counts = new Map<TraitId, { label: string; n: number }>();
    for (const b of held) for (const t of traitsOf(b.bitmapHeight)) {
      const c = counts.get(t.id) ?? { label: t.label, n: 0 };
      c.n++;
      counts.set(t.id, c);
    }
    return [...counts.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [held]);
  const rows = useMemo(
    () =>
      held.filter((b) => {
        if (q.trim() && !String(b.bitmapHeight).includes(q.trim())) return false;
        if (onlyBitmons && !checks.has(b.bitmapHeight)) return false;
        if (trait && !hasTrait(b.bitmapHeight, trait)) return false;
        const listed = openByOutpoint.has(b.outpoint);
        return filter === "all" || (filter === "listed" ? listed : !listed);
      }),
    [held, q, filter, openByOutpoint, onlyBitmons, trait, checks],
  );
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const p = Math.min(page, pages - 1);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
          inputMode="numeric"
          placeholder="SEARCH BLOCK #"
          className="w-40 border border-border bg-background px-3 py-1.5 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
        />
        {(["all", "listed", "unlisted"] as const).map((f) => (
          <button
            key={f}
            className={filter === f ? "btn-term !px-3 !py-1" : "btn-term-ghost !px-3 !py-1"}
            onClick={() => { setFilter(f); setPage(0); }}
          >
            {f.toUpperCase()}
          </button>
        ))}
        <button
          className={onlyBitmons ? "btn-term !px-3 !py-1" : "btn-term-ghost !px-3 !py-1"}
          onClick={() => { setOnlyBitmons((v) => !v); setPage(0); }}
        >
          GUARDIANS ({bitmonCount})
        </button>
        <select
          value={trait}
          onChange={(e) => { setTrait(e.target.value as TraitId | ""); setPage(0); }}
          className="border border-border bg-background px-2 py-1.5 font-mono text-[11px] text-foreground focus:border-foreground focus:outline-none"
          aria-label="Filter by trait"
        >
          <option value="">ALL TRAITS</option>
          {traitOptions.map(([id, c]) => (
            <option key={id} value={id}>{c.label.toUpperCase()} ({c.n})</option>
          ))}
        </select>
        {(onlyBitmons || trait) && (
          <button className="btn-term-ghost !px-2 !py-1" onClick={() => { setOnlyBitmons(false); setTrait(""); setPage(0); }}>
            [ CLEAR ]
          </button>
        )}
        <span className="label ml-auto">{rows.length} SHOWN</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <span className="label">SELECT:</span>
        {([
          ["SHOWN", rows],
          ["UNLISTED", rows.filter((b) => !openByOutpoint.has(b.outpoint))],
          ["LISTED", rows.filter((b) => openByOutpoint.has(b.outpoint))],
          ["GUARDIANS", rows.filter((b) => checks.has(b.bitmapHeight))],
        ] as const).map(([l, list]) => (
          <button key={l} className="btn-term-ghost !px-2 !py-0.5" disabled={list.length === 0}
            onClick={() => setSelected(new Set(list.map((b) => b.outpoint)))}>
            {l} ({list.length})
          </button>
        ))}
        {selected.size > 0 && (
          <button className="btn-term-ghost !px-2 !py-0.5" onClick={() => setSelected(new Set())}>[ NONE ]</button>
        )}
      </div>
      {rows.length === 0 && (
        <p className="p-5 font-mono text-[11px] text-muted-foreground">&gt; NONE OF YOUR BITMAPS MATCH THESE FILTERS</p>
      )}
      <ul className="divide-y divide-border">
        {rows.slice(p * PAGE, p * PAGE + PAGE).map((bitmap) => (
          <HeldRow
            key={`${bitmap.outpoint}-${bitmap.bitmapHeight}`}
            selected={selected.has(bitmap.outpoint)}
            onSelect={(on) => setSelected((cur) => { const n = new Set(cur); if (on) n.add(bitmap.outpoint); else n.delete(bitmap.outpoint); return n; })}
            bitmap={bitmap}
            offer={openByOutpoint.get(bitmap.outpoint) ?? null}
            bitmon={checks.get(bitmap.bitmapHeight) ?? null}
          />
        ))}
      </ul>
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-border p-4">
          <button className="btn-term-ghost !px-3 !py-1" disabled={p === 0} onClick={() => setPage(p - 1)}>[ PREV ]</button>
          <span className="label">PAGE {p + 1} / {pages}</span>
          <button className="btn-term-ghost !px-3 !py-1" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>[ NEXT ]</button>
        </div>
      )}
      {selected.size > 0 && (
        <BulkListBar
          items={held.filter((b) => selected.has(b.outpoint))}
          openByOutpoint={openByOutpoint}
          checks={checks}
          onClear={() => setSelected(new Set())}
        />
      )}
    </>
  );
}

function HeldRow({ bitmap, offer, bitmon, selected, onSelect }: { bitmap: HeldBitmap; offer: Offer | null; bitmon: BitmonCheck | null; selected: boolean; onSelect: (on: boolean) => void }) {
  const traits = useMemo(() => traitsOf(bitmap.bitmapHeight), [bitmap.bitmapHeight]);
  const wallet = useWalletSession();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState<"btc" | "sats">("btc");

  const priceSats = useMemo(() => {
    const n = Number(price);
    if (!price.trim() || !Number.isFinite(n) || n <= 0) return null;
    const sats = unit === "btc" ? Math.round(n * 100_000_000) : Math.round(n);
    return sats >= 546 ? sats : null;
  }, [price, unit]);

  function invalidate() {
    for (const key of ["offers", "wallet-offers", "registry", "activity", "trades"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error("CONNECT A WALLET FIRST");
      if (priceSats === null) throw new Error("ASK AT LEAST 546 SATS (0.00000546 BTC)");
      const [txid, voutRaw] = bitmap.outpoint.split(":");
      const vout = Number(voutRaw);
      if (!txid || !Number.isInteger(vout)) throw new Error("BAD BITMAP OUTPOINT");
      const tapInternalKeyHex = xOnlyPubKeyHex(wallet.publicKey);
      const psbt = buildListingPsbt({
        txid,
        vout,
        utxoValueSats: bitmap.valueSats,
        sellerAddress: wallet.ordinalsAddress,
        priceSats,
        ...(tapInternalKeyHex ? { tapInternalKeyHex } : {}),
        ...(wallet.publicKey ? { publicKeyHex: wallet.publicKey } : {}),
      });
      toast("APPROVE THE SIGNATURE IN YOUR WALLET", { description: "SIGNING THE SALE PSBT" });
      const signed = await signListingPsbt(wallet.provider, psbt, wallet.ordinalsAddress);
      const stored = await submitOfferFn({ data: { psbt: signed } });

      // Repricing: the new ask is live, so retire the previous listing. The
      // seller signs the unlist message with the same wallet.
      if (offer && offer.id !== stored.id) {
        try {
          const signature = await signMessageWithWallet(
            wallet.provider,
            wallet.ordinalsAddress,
            unlistMessage(offer.id),
          );
          await cancelOfferFn({ data: { offerId: offer.id, signature } });
        } catch {
          toast("OLD LISTING STILL OPEN", {
            description: "THE NEW ASK IS LIVE — UNLIST THE OLD ONE MANUALLY",
          });
        }
      }
      return stored;
    },
    onSuccess: (stored) => {
      invalidate();
      setEditing(false);
      setPrice("");
      toast(offer ? `REPRICED ${bitmap.bitmapHeight}.BITMAP` : `LISTED ${bitmap.bitmapHeight}.BITMAP`, {
        description: `ASK ${formatSats(stored.priceSats)}`,
      });
    },
    onError: (e) => toast("FAILED", { description: (e as Error).message.toUpperCase() }),
  });

  const unlist = useMutation({
    mutationFn: async () => {
      if (!wallet || !offer) throw new Error("NOTHING TO UNLIST");
      toast("APPROVE THE SIGNATURE IN YOUR WALLET", { description: "THIS MOVES NO FUNDS" });
      const signature = await signMessageWithWallet(
        wallet.provider,
        wallet.ordinalsAddress,
        unlistMessage(offer.id),
      );
      return cancelOfferFn({ data: { offerId: offer.id, signature } });
    },
    onSuccess: () => {
      invalidate();
      toast("UNLISTED", { description: `${bitmap.bitmapHeight}.BITMAP IS OFF THE MARKET` });
    },
    onError: (e) => toast("UNLIST FAILED", { description: (e as Error).message.toUpperCase() }),
  });

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <input type="checkbox" className="mt-1" checked={selected} onChange={(e) => onSelect(e.target.checked)}
            aria-label={`Select ${bitmap.bitmapHeight}.bitmap`} />
        <div>
          <p className="font-mono text-sm font-bold text-foreground">
            {bitmap.bitmapHeight}.BITMAP
          </p>
          <p className="label mt-1">
            {offer
              ? `LISTED · ASK ${formatSats(offer.priceSats)}`
              : "NOT LISTED · YOURS ON CHAIN"}
          </p>
          {(bitmon || traits.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1">
              {bitmon && (
                <span className="border border-primary/60 px-1.5 py-0.5 font-mono text-[9px] text-primary">
                  GUARDIAN
                  {bitmon.status === "unverified"
                    ? bitmon.reason === "reading" ? " · CHECKING…" : " · UNVERIFIED"
                    : ` · ${String(bitmon.species).toUpperCase()} · ${String(bitmon.rarity).toUpperCase()}`}
                </span>
              )}
              {traits.map((t) => (
                <span key={t.id} className="border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                  {t.label.toUpperCase()}
                </span>
              ))}
            </div>
          )}
        </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={editing ? "btn-term !px-3 !py-1.5" : "btn-term-ghost !px-3 !py-1.5"}
            onClick={() => setEditing((o) => !o)}
          >
            {editing ? "[ CANCEL ]" : offer ? "[ CHANGE PRICE ]" : "[ LIST ]"}
          </button>
          {offer && (
            <button
              className="btn-term-ghost !px-3 !py-1.5"
              disabled={unlist.isPending}
              onClick={() => unlist.mutate()}
            >
              {unlist.isPending ? "[ SIGNING… ]" : "[ UNLIST ]"}
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 border border-border focus-within:border-foreground">
              <input
                value={price}
                onChange={(e) =>
                  setPrice(e.target.value.replace(unit === "btc" ? /[^0-9.]/g : /[^0-9]/g, ""))
                }
                inputMode="decimal"
                spellCheck={false}
                aria-label={`Asking price for ${bitmap.bitmapHeight}.bitmap`}
                placeholder={unit === "btc" ? "AMOUNT IN BTC (e.g. 0.0025)" : "AMOUNT IN SATS"}
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
              disabled={save.isPending || priceSats === null}
              onClick={() => save.mutate()}
            >
              {save.isPending
                ? "[ SIGNING… ]"
                : offer
                  ? "[ SIGN NEW ASK ]"
                  : "[ SIGN & LIST ]"}
            </button>
          </div>
          {priceSats !== null && (
            <p className="mt-2 font-mono text-[11px] text-foreground">
              &gt; ASK {formatSats(priceSats)} · {priceSats.toLocaleString("en-US")} SATS
            </p>
          )}
        </div>
      )}
    </li>
  );
}

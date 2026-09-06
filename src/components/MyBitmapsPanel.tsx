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

type HeldBitmap = {
  outpoint: string;
  valueSats: number;
  bitmapHeight: number;
  inscriptionId: string | null;
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
            inscriptionId: i.inscriptionId ?? null,
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
      <section className="border border-border">
        <header className="border-b border-border p-5">
          <h2 className="display text-xl">MY BITMAPS</h2>
          <p className="label mt-2">CONNECT A WALLET TO LIST, REPRICE OR UNLIST YOUR OWN BITMAPS</p>
        </header>
        <p className="p-5 font-mono text-[11px] text-muted-foreground">
          &gt; CONNECT UNISAT OR XVERSE — YOU CAN ONLY LIST BITMAPS HELD BY YOUR OWN WALLET
          <span className="blink">_</span>
        </p>
      </section>
    );
  }

  return (
    <section className="border border-border" data-tour="my-bitmaps">
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
        <ul className="divide-y divide-border">
          {held.map((bitmap) => (
            <HeldRow
              key={`${bitmap.outpoint}-${bitmap.bitmapHeight}`}
              bitmap={bitmap}
              offer={openByOutpoint.get(bitmap.outpoint) ?? null}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function HeldRow({ bitmap, offer }: { bitmap: HeldBitmap; offer: Offer | null }) {
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
        <div>
          <p className="font-mono text-sm font-bold text-foreground">
            {bitmap.bitmapHeight}.BITMAP
          </p>
          <p className="label mt-1">
            {offer
              ? `LISTED · ASK ${formatSats(offer.priceSats)}`
              : "NOT LISTED · YOURS ON CHAIN"}
          </p>
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

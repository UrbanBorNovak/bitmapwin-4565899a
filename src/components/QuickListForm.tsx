import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { walletQuery } from "@/lib/wallet";
import { submitOfferFn } from "@/lib/offers.functions";
import { buildListingPsbt } from "@/lib/psbt-builder";
import { signListingPsbt, xOnlyPubKeyHex } from "@/lib/browser-wallet";
import { useWalletSession } from "@/lib/wallet-session";
import { MARKETPLACE_FEE_PERCENT } from "@/lib/marketplace-fee";
import { formatSats } from "@/lib/trades";
import { shortenAddress } from "@/lib/registry";
import { ListPriceHint } from "@/components/market/ListPriceHint";
import { EvPricePicker } from "@/components/market/EvPricePicker";

/**
 * One-field listing: pick a price, press the button, the wallet signs the sale
 * PSBT and it lands in the offer book. No base64 to copy around.
 */
export function QuickListForm({ height }: { height?: number }) {
  const wallet = useWalletSession();
  const queryClient = useQueryClient();
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState<"btc" | "sats">("btc");
  const [selected, setSelected] = useState<string>("");

  const priceSats = useMemo(() => {
    const n = Number(price);
    if (!price.trim() || !Number.isFinite(n) || n <= 0) return null;
    const sats = unit === "btc" ? Math.round(n * 100_000_000) : Math.round(n);
    return sats >= 546 ? sats : null;
  }, [price, unit]);

  const ordinals = wallet?.ordinalsAddress ?? "";
  const snapshot = useQuery({ ...walletQuery(ordinals), enabled: ordinals !== "" });

  const parcels = useMemo(() => {
    const utxos = snapshot.data?.utxos ?? [];
    const owned = utxos.flatMap((u) =>
      u.inscriptions
        .filter((i) => i.bitmapHeight !== null)
        .map((i) => ({ outpoint: u.outpoint, valueSats: u.valueSats, bitmapHeight: i.bitmapHeight! })),
    );
    return height === undefined ? owned : owned.filter((p) => p.bitmapHeight === height);
  }, [snapshot.data, height]);

  const parcel = parcels.find((p) => p.outpoint === selected) ?? parcels[0] ?? null;

  const list = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error("CONNECT A WALLET FIRST");
      if (!parcel) throw new Error("NO BITMAP FOUND IN THIS WALLET");
      if (priceSats === null) throw new Error("ASK AT LEAST 546 SATS (0.00000546 BTC)");
      const [txid, voutRaw] = parcel.outpoint.split(":");
      const vout = Number(voutRaw);
      if (!txid || !Number.isInteger(vout)) throw new Error("BAD BITMAP OUTPOINT");
      const tapInternalKeyHex = xOnlyPubKeyHex(wallet.publicKey);
      const psbt = buildListingPsbt({
        txid,
        vout,
        utxoValueSats: parcel.valueSats,
        sellerAddress: wallet.ordinalsAddress,
        payoutAddress: wallet.paymentAddress || wallet.ordinalsAddress,
        priceSats,
        ...(tapInternalKeyHex ? { tapInternalKeyHex } : {}),
        ...(wallet.publicKey ? { publicKeyHex: wallet.publicKey } : {}),
      });
      toast("APPROVE THE SIGNATURE IN YOUR WALLET", { description: "OPEN THE WALLET POPUP TO SIGN" });
      const signed = await signListingPsbt(wallet.provider, psbt, wallet.ordinalsAddress);
      return submitOfferFn({ data: { psbt: signed } });
    },
    onSuccess: (offer) => {
      void queryClient.invalidateQueries({ queryKey: ["offers"] });
      void queryClient.invalidateQueries({ queryKey: ["registry"] });
      setPrice("");
      toast(`LISTED ${offer.bitmapHeight ?? "?"}.BITMAP`, {
        description: `ASK ${formatSats(offer.priceSats)} · NOW IN THE OFFER BOOK`,
      });
    },
    onError: (e) => toast("LISTING FAILED", { description: (e as Error).message.toUpperCase() }),
  });

  if (!wallet) {
    return (
      <p className="font-mono text-[11px] text-muted-foreground">
        &gt; CONNECT UNISAT OR XVERSE TO LIST A BITMAP IN ONE CLICK<span className="blink">_</span>
      </p>
    );
  }

  return (
    <div>
      <label className="label" htmlFor="quick-ask">
        SELL {height === undefined ? "A BITMAP" : `${height}.BITMAP`} — TYPE AN AMOUNT, THE PSBT IS
        BUILT FOR YOU
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 border border-border focus-within:border-foreground">
          <input
            id="quick-ask"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(unit === "btc" ? /[^0-9.]/g : /[^0-9]/g, ""))}
            inputMode="decimal"
            spellCheck={false}
            placeholder={unit === "btc" ? "AMOUNT IN BTC (e.g. 0.0025)" : "AMOUNT IN SATS (e.g. 250000)"}
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
          disabled={list.isPending || priceSats === null || parcel === null}
          onClick={() => list.mutate()}
        >
          {list.isPending ? "[ BUILDING & SIGNING… ]" : "[ GENERATE & LIST PSBT ]"}
        </button>
      </div>
      <EvPricePicker
        height={parcel?.bitmapHeight ?? height ?? null}
        priceSats={priceSats}
        onPick={(sats) => {
          setPrice(unit === "btc" ? (sats / 1e8).toFixed(8).replace(/0+$/, "").replace(/\.$/, "") : String(sats));
        }}
      />
      <ListPriceHint priceSats={priceSats} />

      {parcels.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="label">BITMAP</span>
          {parcels.slice(0, 12).map((p) => (
            <button
              key={p.outpoint}
              className={
                parcel?.outpoint === p.outpoint
                  ? "btn-term !px-2 !py-1"
                  : "btn-term-ghost !px-2 !py-1"
              }
              onClick={() => setSelected(p.outpoint)}
            >
              {p.bitmapHeight}
            </button>
          ))}
        </div>
      )}

      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
        {snapshot.isLoading
          ? "> READING YOUR BITMAPS…"
          : parcel
            ? `> SELLING ${parcel.bitmapHeight}.BITMAP FROM ${shortenAddress(wallet.ordinalsAddress)} — YOU RECEIVE THE FULL PRICE, THE BUYER PAYS THE ${MARKETPLACE_FEE_PERCENT}% FEE`
            : `> NO ${height === undefined ? "BITMAP" : `${height}.BITMAP`} FOUND IN ${shortenAddress(wallet.ordinalsAddress)}`}
      </p>
    </div>
  );
}

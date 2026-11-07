import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { walletQuery } from "@/lib/wallet";
import { useWalletSession } from "@/lib/wallet-session";
import { buildListingPsbt } from "@/lib/psbt-builder";
import { signListingPsbt, xOnlyPubKeyHex } from "@/lib/browser-wallet";
import { submitOfferFn } from "@/lib/offers.functions";
import { addToStorefrontFn } from "@/lib/storefront.functions";
import { formatSats } from "@/lib/trades";
import { shortenAddress } from "@/lib/registry";
import { BuyButton } from "@/components/BuyButton";

type Row = {
  offer_id: string;
  offers: {
    inscription_id: string | null;
    seller_address: string | null;
    price_sats: number;
    status: string;
  } | null;
};

export const storefrontQuery = (height: number) => ({
  queryKey: ["storefront", height],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("bitmap_storefront_listings")
      .select("offer_id, offers(inscription_id, seller_address, price_sats, status)")
      .eq("storefront_height", height)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw error;
    return ((data ?? []) as unknown as Row[]).filter((r) => r.offers?.status === "open");
  },
  staleTime: 30_000,
});

/**
 * A BITMAP's own trading post: any ordinal can be sold here with a real
 * SIGHASH_SINGLE|ANYONECANPAY PSBT, and every sale pays the BITMAP holder 1%.
 */
export function BitmapStorefront({ height }: { height: number }) {
  const { data: rows = [], isPending } = useQuery(storefrontQuery(height));
  const wallet = useWalletSession();
  const ordinals = wallet?.ordinalsAddress ?? "";
  const snapshot = useQuery({ ...walletQuery(ordinals), enabled: ordinals !== "" });
  const queryClient = useQueryClient();
  const [pick, setPick] = useState("");
  const [price, setPrice] = useState("");

  const items = (snapshot.data?.utxos ?? []).flatMap((u) =>
    u.inscriptions.map((i) => ({ id: i.id, utxo: u })),
  );

  const list = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error("CONNECT YOUR WALLET");
      const item = items.find((i) => i.id === pick);
      if (!item) throw new Error("PICK AN ORDINAL FROM YOUR WALLET");
      const priceSats = Math.round(Number(price));
      if (!Number.isInteger(priceSats) || priceSats < 546) throw new Error("PRICE MUST BE AT LEAST 546 SATS");
      const [txid, voutRaw] = item.utxo.outpoint.split(":");
      const vout = Number(voutRaw);
      if (!txid || !Number.isInteger(vout)) throw new Error("BAD OUTPOINT");
      const tapInternalKeyHex = xOnlyPubKeyHex(wallet.publicKey);
      const psbt = buildListingPsbt({
        txid,
        vout,
        utxoValueSats: item.utxo.valueSats,
        sellerAddress: wallet.ordinalsAddress,
        payoutAddress: wallet.paymentAddress || wallet.ordinalsAddress,
        priceSats,
        ...(tapInternalKeyHex ? { tapInternalKeyHex } : {}),
        ...(wallet.publicKey ? { publicKeyHex: wallet.publicKey } : {}),
      });
      toast("SIGN THE SALE IN YOUR WALLET", { description: `LISTING FOR ${formatSats(priceSats)}` });
      const signed = await signListingPsbt(wallet.provider, psbt, wallet.ordinalsAddress);
      const offer = await submitOfferFn({ data: { psbt: signed } });
      await addToStorefrontFn({ data: { offerId: offer.id, height } });
      return offer;
    },
    onSuccess: () => {
      setPick("");
      setPrice("");
      void queryClient.invalidateQueries({ queryKey: ["storefront", height] });
      void queryClient.invalidateQueries({ queryKey: ["offers"] });
      toast("LISTED IN THIS BITMAP'S STOREFRONT");
    },
    onError: (e) => toast("LISTING FAILED", { description: (e as Error).message.toUpperCase() }),
  });

  return (
    <section id="storefront" className="mt-8 scroll-mt-20 border border-border p-4" aria-label="BITMAP storefront">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="label text-primary">◆ {height}.BITMAP STOREFRONT</h2>
        <span className="label text-muted-foreground">
          NON-CUSTODIAL PSBT SALES · 1% OF EVERY SALE GOES TO THIS BITMAP'S HOLDER
        </span>
      </div>

      <div className="mt-4 grid gap-2">
        {isPending ? (
          <p className="label text-muted-foreground">LOADING STOREFRONT…</p>
        ) : rows.length === 0 ? (
          <p className="label text-muted-foreground">NOTHING FOR SALE HERE YET — BE THE FIRST MERCHANT.</p>
        ) : (
          rows.map((r) => (
            <div key={r.offer_id} className="flex flex-wrap items-center justify-between gap-3 border border-border/60 p-2">
              <div className="min-w-0">
                <a
                  className="font-mono text-xs text-accent hover:underline"
                  href={`https://ordinals.com/inscription/${r.offers?.inscription_id ?? ""}`}
                  target="_blank"
                  rel="noreferrer"
                  data-no-translate
                >
                  {(r.offers?.inscription_id ?? "").slice(0, 10)}…
                </a>
                <p className="label text-muted-foreground" data-no-translate>
                  SELLER {shortenAddress(r.offers?.seller_address ?? "")}
                </p>
              </div>
              <BuyButton offerId={r.offer_id} priceSats={Number(r.offers?.price_sats ?? 0)} />
            </div>
          ))
        )}
      </div>

      <div className="mt-4 border-t border-border/60 pt-4">
        <p className="label text-muted-foreground">SELL AN ORDINAL HERE</p>
        {!wallet ? (
          <p className="label mt-2 text-muted-foreground">CONNECT YOUR WALLET TO LIST.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            <select
              className="border border-border bg-background px-2 py-1 font-mono text-xs"
              value={pick}
              onChange={(e) => setPick(e.target.value)}
            >
              <option value="">{snapshot.isPending ? "SCANNING WALLET…" : `PICK ONE (${items.length})`}</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.id.slice(0, 12)}…
                </option>
              ))}
            </select>
            <input
              className="w-36 border border-border bg-background px-2 py-1 font-mono text-xs"
              inputMode="numeric"
              placeholder="PRICE IN SATS"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
            />
            <button type="button" className="btn-term" disabled={list.isPending} onClick={() => list.mutate()}>
              {list.isPending ? "[ SIGNING… ]" : "[ LIST IN STOREFRONT ]"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

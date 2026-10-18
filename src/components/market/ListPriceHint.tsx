import { useQuery } from "@tanstack/react-query";
import { btcPriceQuery, usdFromSats } from "@/lib/btc-price";

/** BTC · sats · ≈USD readout for an asking price, plus a plain note on the wallet's ANYONECANPAY warning. */
export function ListPriceHint({ priceSats }: { priceSats: number | null }) {
  const price = useQuery(btcPriceQuery());
  const usd = priceSats !== null ? usdFromSats(priceSats, price.data?.usd) : null;
  return (
    <div className="mt-2 space-y-1">
      {priceSats !== null && (
        <p className="font-mono text-[11px] text-foreground">
          &gt; ASK <span className="text-bitcoin">{(priceSats / 1e8).toFixed(8).replace(/0+$/, "").replace(/\.$/, "")} BTC</span>
          {" "}({priceSats.toLocaleString("en-US")} SATS{usd ? ` ≈ ${usd} USD` : ""})
        </p>
      )}
      <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
        ⓘ YOUR WALLET MAY WARN ABOUT "SIGHASH_SINGLE | ANYONECANPAY". THIS IS THE STANDARD ORDINALS LISTING SIGNATURE: IT LETS ANY BUYER FUND THE PURCHASE, BUT LOCKS YOUR PAYOUT — THE BITMAP CANNOT MOVE UNLESS YOU RECEIVE YOUR FULL ASKING PRICE.
      </p>
    </div>
  );
}

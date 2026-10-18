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
      <details className="font-mono text-[10px] leading-relaxed text-muted-foreground">
        <summary className="cursor-pointer text-signal">ⓘ WHY YOUR WALLET SHOWS "SIGHASH_SINGLE | ANYONECANPAY"</summary>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          <li>YOU SIGN ONLY YOUR BITMAP'S COIN, PAIRED WITH ONE OUTPUT PAYING THIS PRICE TO YOUR OWN ADDRESS. A BUYER ADDS THEIR COINS LATER, SO YOU DON'T NEED TO BE ONLINE.</li>
          <li>PROTECTED: THAT SIGNATURE ONLY WORKS IN A TRANSACTION THAT PAYS YOU AT LEAST THE PRICE ABOVE, TO THAT ADDRESS. CHANGING EITHER BREAKS IT. THE SITE REFUSES ANY OTHER SIGNATURE TYPE.</li>
          <li>RISK: THE SIGNED OFFER STAYS VALID ON BITCOIN UNTIL THE BITMAP MOVES. UNLISTING REMOVES IT FROM THIS SITE, BUT ANYONE HOLDING A COPY COULD STILL BUY AT THE OLD PRICE. TO CANCEL FOR SURE, SEND THE BITMAP TO A NEW ADDRESS.</li>
          <li>RISK: THE BITMAP'S SMALL POSTAGE (USUALLY 330–10,000 SATS) GOES TO THE BUYER WITH IT. IF OTHER INSCRIPTIONS SHARE THAT COIN, THEY GO TOO.</li>
          <li>CHECK THE WALLET POPUP: IT SHOULD LIST ONE INPUT (YOUR BITMAP) AND ONE OUTPUT TO YOUR ADDRESS FOR THIS AMOUNT. IF IT SHOWS "NONE" OR A DIFFERENT AMOUNT, DON'T SIGN.</li>
        </ul>
      </details>
    </div>
  );
}

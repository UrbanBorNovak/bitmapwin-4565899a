import { Link } from "@tanstack/react-router";
import { BuyButton } from "@/components/BuyButton";
import { BlockMosaic } from "@/components/BlockMosaic";
import { formatSats } from "@/lib/trades";
import type { RegistryParcel } from "@/lib/registry";

/** Dense trader card: square block art, height, price, one action. */
export function CompactParcelCard({ parcel }: { parcel: RegistryParcel }) {
  const ask = parcel.listedSats;
  return (
    <article className="group flex flex-col overflow-hidden border border-border bg-card transition-colors hover:border-bitcoin/60">
      <Link to="/bitmap/$block" params={{ block: String(parcel.bitmapHeight) }} className="block aspect-square overflow-hidden bg-background p-2">
        <BlockMosaic height={parcel.bitmapHeight} />
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-2">
        <Link to="/bitmap/$block" params={{ block: String(parcel.bitmapHeight) }} className="truncate font-mono text-[11px] font-bold text-foreground hover:text-bitcoin" data-no-translate>
          {parcel.bitmapHeight.toLocaleString("en-US")}.BITMAP
        </Link>
        <div className="mt-auto flex items-end justify-between gap-1" data-no-translate>
          <div className="min-w-0">
            {ask ? (
              <p className="truncate font-mono text-[12px] font-bold text-bitcoin">₿ {formatSats(ask)}</p>
            ) : parcel.lastSaleSats ? (
              <p className="truncate font-mono text-[11px] text-muted-foreground">LAST {formatSats(parcel.lastSaleSats)}</p>
            ) : (
              <p className="font-mono text-[11px] text-muted-foreground">NOT LISTED</p>
            )}
          </div>
          {parcel.listedOfferId && ask !== null ? (
            <BuyButton
              offerId={parcel.listedOfferId}
              priceSats={ask}
              inscriptionId={parcel.inscriptionId}
              height={parcel.bitmapHeight}
              className="shrink-0 !border-0 !bg-transparent !p-0 font-mono text-[11px] font-bold text-bitcoin hover:underline"
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}

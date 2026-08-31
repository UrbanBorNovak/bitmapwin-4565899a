import { Link } from "@tanstack/react-router";
import { BlockMosaic } from "@/components/BlockMosaic";
import { formatSats } from "@/lib/trades";
import { shortenAddress, type RegistryParcel } from "@/lib/registry";

/** Card for a real, on-chain bitmap claim held in the registry. */
export function ParcelCard({ parcel }: { parcel: RegistryParcel }) {
  return (
    <article className="group border border-border bg-card transition-[border-color,transform] duration-150 hover:border-foreground hover:-translate-y-0.5">
      <Link
        to="/bitmap/$block"
        params={{ block: String(parcel.bitmapHeight) }}
        className="block border-b border-border p-4"
      >
        <BlockMosaic height={parcel.bitmapHeight} />
      </Link>

      <div className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <div className="display text-sm">{parcel.bitmapHeight}.BITMAP</div>
          <span className="label">{PARCEL_STATUS_LABEL[parcel.status]}</span>
        </div>

        <dl className="mt-3 space-y-1 text-[11px]">
          <Row k="OWNER" v={shortenAddress(parcel.ownerAddress)} />
          <Row
            k="ASK"
            v={
              parcel.listedSats
                ? `${formatSats(parcel.listedSats)}${parcel.listedBuyerAddress ? " · RESERVED" : ""}`
                : "NO OPEN OFFER"
            }
          />
          <Row k="TRANSFERS" v={String(parcel.transfers)} />
          <Row
            k="LAST SALE"
            v={parcel.lastSaleSats ? formatSats(parcel.lastSaleSats) : "NO SALE ON CHAIN"}
          />
          <Row
            k="CLAIM"
            v={parcel.inscribedInBlock === null ? "—" : `IN BLOCK ${parcel.inscribedInBlock}`}
          />
        </dl>

        {parcel.supersedes > 0 && (
          <p className="mt-3 font-mono text-[10px] text-muted-foreground">
            &gt; {parcel.supersedes} LATER DUPLICATE CLAIM(S) INVALID
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            to="/bitmap/$block"
            params={{ block: String(parcel.bitmapHeight) }}
            className="btn-term-ghost !px-2 !py-2"
          >
            VIEW
          </Link>
          <a
            className="btn-term !px-2 !py-2"
            href={`https://mempool.space/tx/${parcel.lastSaleTxid ?? parcel.txid}`}
            target="_blank"
            rel="noreferrer"
          >
            {parcel.lastSaleTxid ? "TRADE TX" : "CLAIM TX"}
          </a>
        </div>
      </div>
    </article>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="label">{k}</dt>
      <dd className="truncate font-mono text-foreground">{v}</dd>
    </div>
  );
}

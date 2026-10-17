import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BuyButton } from "@/components/BuyButton";
import { CartToggle } from "@/components/market/TradeSlip";
import { MakeOfferButton } from "@/components/MakeOfferButton";
import { BlockMosaic } from "@/components/BlockMosaic";
import { GuardianMintStatus } from "@/components/bitmon/GuardianMintStatus";

import { SatBadges } from "@/components/SatBadges";
import { TraitBadges } from "@/components/TraitBadges";
import { ClubBadge } from "@/components/ClubBadge";
import { ForgeBadge } from "@/components/ForgeBadge";
import { VerificationChip } from "@/components/ProvenancePanel";
import { formatSats } from "@/lib/trades";
import { openBidsQuery, topBidByHeight } from "@/lib/bids";
import { PARCEL_STATUS_LABEL, shortenAddress, type RegistryParcel } from "@/lib/registry";
import { TraitHolderBadge } from "@/components/TraitHolderBadge";
import type { TraitHolderBadge as TraitHolderProof } from "@/lib/trait-collections";

/** Card for a real, on-chain bitmap claim held in the registry. */
export function ParcelCard({ parcel, traitHolder }: { parcel: RegistryParcel; traitHolder?: TraitHolderProof }) {
  const bids = useQuery(openBidsQuery(500));
  const topBid = topBidByHeight(bids.data ?? []).get(parcel.bitmapHeight) ?? null;

  return (
    <article className="terminal-panel terminal-interactive group overflow-hidden">
      <Link
        to="/bitmap/$block"
        params={{ block: String(parcel.bitmapHeight) }}
        className="block border-b border-border p-4"
      >
        <BlockMosaic height={parcel.bitmapHeight} />
      </Link>

      <div className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <div className="display text-sm">{parcel.bitmapHeight}.BITMAP</div>
            <ClubBadge height={parcel.bitmapHeight} />
            <ForgeBadge height={parcel.bitmapHeight} />
          </div>
          <span className="label">{PARCEL_STATUS_LABEL[parcel.status]}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px]" data-no-translate>
          {parcel.listedSats ? (
            <span className="flex items-center gap-1.5 border border-bitcoin bg-bitcoin/10 px-2 py-1 font-bold text-bitcoin">
              <span className="relative flex size-1.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-bitcoin opacity-70" /><span className="relative inline-flex size-1.5 rounded-full bg-bitcoin" /></span>
              FOR SALE · {formatSats(parcel.listedSats)}
            </span>
          ) : parcel.lastSaleSats ? (
            <span className="border border-border px-2 py-1 text-foreground">LAST {formatSats(parcel.lastSaleSats)}</span>
          ) : null}
          {topBid && <span className="border border-signal/50 bg-signal/10 px-2 py-1 text-signal">BID {formatSats(topBid.priceSats)}</span>}
        </div>

        <div className="mt-2">
          <VerificationChip
            inscriptionId={parcel.inscriptionId}
            duplicateClaims={parcel.supersedes}
          />
        </div>

        <SatBadges height={parcel.bitmapHeight} rarityOnly className="mt-2" />
        <TraitBadges height={parcel.bitmapHeight} max={3} className="mt-2" />
        <GuardianMintStatus height={parcel.bitmapHeight} className="mt-2" />
        {traitHolder && <div className="mt-2"><TraitHolderBadge traits={traitHolder.traitIds} /></div>}

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
          <Row k="TOP BID" v={topBid ? formatSats(topBid.priceSats) : "NO BIDS"} />

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

        {parcel.listedOfferId && parcel.listedSats !== null && (
          <div className="mt-4 flex items-stretch gap-1">
            <CartToggle item={{ offerId: parcel.listedOfferId, height: parcel.bitmapHeight, priceSats: parcel.listedSats, inscriptionId: parcel.inscriptionId }} className="!px-2" />
            <BuyButton
              offerId={parcel.listedOfferId}
              priceSats={parcel.listedSats}
              inscriptionId={parcel.inscriptionId}
              height={parcel.bitmapHeight}
              className="btn-term w-full !px-2 !py-2"
            />
          </div>
        )}

        <div className="mt-2">
          <MakeOfferButton
            height={parcel.bitmapHeight}
            askSats={parcel.listedSats}
            topBidSats={topBid?.priceSats ?? null}
            className="btn-term-ghost w-full !px-2 !py-2"
            label="[ MAKE OFFER ]"
          />
        </div>

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
    <div className="terminal-data-row flex items-baseline justify-between gap-2">
      <dt className="label">{k}</dt>
      <dd className="truncate font-mono text-foreground">{v}</dd>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { inscriptionImageUrl } from "@/lib/profiles";
import { formatSats } from "@/lib/trades";
import { inscriptionOffersQuery } from "@/lib/offers";
import { BuyButton } from "@/components/BuyButton";
import type { ShopConfig, ShopItem } from "@/lib/build-sdk";
import { safeExternalUrl } from "@/lib/safe-url";

/**
 * A holder-run storefront built on top of their bitmap: their own inscriptions,
 * their own prices, their own accent/layout. Sales are settled peer-to-peer
 * through the contact link the seller published — no custody here.
 */
export function ShopBuild({ config, height }: { config: ShopConfig; height: number }) {
  const accent = config.accent;
  const radius = config.frame === "soft" ? "rounded-lg" : "rounded-none";
  const cols =
    config.columns === 2
      ? "sm:grid-cols-2"
      : config.columns === 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "sm:grid-cols-2 lg:grid-cols-3";

  const forSale = config.items.filter((i) => !i.sold);
  const floor = forSale.filter((i) => i.priceSats > 0).map((i) => i.priceSats);

  // Live sale PSBTs the holder published for these inscriptions — one per asset.
  const ids = config.items.filter((i) => !i.sold).map((i) => i.inscriptionId).filter(Boolean);
  const offers = useQuery({ ...inscriptionOffersQuery(ids), enabled: ids.length > 0 });
  const offerFor = (inscriptionId: string) =>
    (offers.data ?? []).find((o) => o.inscriptionId === inscriptionId) ?? null;


  return (
    <div className="space-y-4">
      <header
        className={`border p-4 ${radius}`}
        style={{ borderColor: accent, boxShadow: `inset 0 0 0 1px ${accent}22` }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="display text-lg" style={{ color: accent }}>
            {config.shopName.toUpperCase()}
          </span>
          <span className="label text-muted-foreground">{height}.BITMAP STORE</span>
        </div>
        {config.tagline ? <p className="label mt-2">{config.tagline.toUpperCase()}</p> : null}
        <div className="label mt-3 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          <span>{forSale.length} FOR SALE</span>
          <span>{config.items.length - forSale.length} SOLD</span>
          <span>
            FLOOR {floor.length > 0 ? formatSats(Math.min(...floor)) : "—"}
          </span>
        </div>
        {safeExternalUrl(config.contactUrl) ? (
          <a
            href={safeExternalUrl(config.contactUrl)!}
            target="_blank"
            rel="noreferrer noopener"
            className={`label mt-3 inline-block border px-3 py-1.5 transition-colors hover:bg-primary/10 ${radius}`}
            style={{ borderColor: accent, color: accent }}
          >
            [ {config.contactLabel.toUpperCase()} ]
          </a>
        ) : null}
      </header>

      {config.items.length === 0 ? (
        <div className={`border border-dashed border-border p-6 ${radius}`}>
          <span className="label text-muted-foreground">
            &gt; NO ASSETS LISTED IN THIS SHOP YET_
          </span>
        </div>
      ) : config.layout === "list" ? (
        <div className={`divide-y divide-border border border-border ${radius}`}>
          {config.items.map((item, i) => (
            <div key={`${item.inscriptionId}-${i}`} className="flex items-center gap-3 p-3">
              <img
                src={inscriptionImageUrl(item.inscriptionId)}
                alt={item.name || item.inscriptionId}
                loading="lazy"
                className="h-12 w-12 shrink-0 border border-border object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[11px]">
                  {(item.name || item.inscriptionId).toUpperCase()}
                </div>
                {item.note ? (
                  <div className="label mt-1 text-muted-foreground">{item.note.toUpperCase()}</div>
                ) : null}
              </div>
              <PriceTag item={item} accent={accent} />
              <ShopItemAction
                item={item}
                offer={item.sold ? null : offerFor(item.inscriptionId)}
                contactUrl={config.contactUrl}
                accent={accent}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className={`grid gap-3 ${cols}`}>
          {config.items.map((item, i) => (
            <div
              key={`${item.inscriptionId}-${i}`}
              className={`border border-border bg-card p-3 transition-colors hover:border-primary ${radius}`}
            >
              <img
                src={inscriptionImageUrl(item.inscriptionId)}
                alt={item.name || item.inscriptionId}
                loading="lazy"
                className={`aspect-square w-full border border-border object-cover ${
                  item.sold ? "opacity-40" : ""
                }`}
              />
              <div className="mt-2 font-mono text-[11px]">
                {(item.name || `${item.inscriptionId.slice(0, 10)}…`).toUpperCase()}
              </div>
              {item.note ? (
                <div className="label mt-1 text-muted-foreground">{item.note.toUpperCase()}</div>
              ) : null}
              <div className="mt-2 flex items-center justify-between gap-2">
                <PriceTag item={item} accent={accent} />
                <ShopItemAction
                  item={item}
                  offer={item.sold ? null : offerFor(item.inscriptionId)}
                  contactUrl={config.contactUrl}
                  accent={accent}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="label text-muted-foreground">
        &gt; PRICES SET BY THE HOLDER — LISTED ASSETS BUY ON-CHAIN INSTANTLY AT THE SHOWN PRICE_
      </p>
    </div>
  );
}

/**
 * Buy action for one shop asset: fixed listed price only — a signed PSBT buys
 * instantly on-chain at the ask; no offer flow. Unlisted assets point the
 * buyer at the seller's contact link (or note the sale PSBT is pending).
 */
function ShopItemAction({
  item,
  offer,
  contactUrl,
  accent,
}: {
  item: ShopItem;
  offer: { id: string; priceSats: number } | null;
  contactUrl?: string;
  accent: string;
}) {
  if (item.sold) return null;
  if (offer) return <BuyButton offerId={offer.id} priceSats={offer.priceSats} />;
  return (
    <span className="flex items-center gap-1">
      {item.priceSats > 0 ? (
        <span className="label text-muted-foreground">SALE PSBT PENDING</span>
      ) : null}
      {safeExternalUrl(contactUrl) ? (
        <a
          href={safeExternalUrl(contactUrl)!}
          target="_blank"
          rel="noreferrer noopener"
          className="label border border-border px-2 py-1 hover:border-primary hover:text-primary"
          style={{ color: accent }}
        >
          [ ASK ]
        </a>
      ) : null}
    </span>
  );
}

function PriceTag({
  item,
  accent,
}: {
  item: { priceSats: number; sold: boolean };
  accent: string;
}) {
  if (item.sold) return <span className="label text-muted-foreground">SOLD</span>;
  return (
    <span className="label" style={{ color: accent }}>
      {item.priceSats > 0 ? formatSats(item.priceSats) : "UNPRICED"}
    </span>
  );
}

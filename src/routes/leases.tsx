import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { daysLeft, leaseOffersQuery, leasesQuery, satsToBtc } from "@/lib/leases";
import { LeaseRentButton } from "@/components/leases/LeaseRentButton";
import { ClubBadge } from "@/components/ClubBadge";
import { TraitBadges } from "@/components/TraitBadges";
import { shortenAddress } from "@/lib/registry";

export const Route = createFileRoute("/leases")({
  component: LeaseMarket,
  head: () => ({
    meta: [
      { title: "Lease Bitmaps — Rent Bitcoin Digital Land" },
      {
        name: "description",
        content:
          "Rent Bitcoin bitmaps by the day. Holders earn on-chain rent, renters get build and shop rights for the whole lease term.",
      },
      { property: "og:title", content: "Lease Bitmaps — Rent Bitcoin Digital Land" },
      {
        property: "og:description",
        content:
          "Daily-rate bitmap leases settled with signed Bitcoin transactions. Holders earn rent, renters build.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function LeaseMarket() {
  const offers = useQuery(leaseOffersQuery(200));
  const leases = useQuery(leasesQuery(200));

  const active = (leases.data ?? []).filter((l) => l.status === "active" && daysLeft(l.endsAt) > 0);
  const rentPaid = (leases.data ?? []).reduce((sum, l) => sum + l.totalSats, 0);
  const activeHeights = new Set(active.map((l) => l.bitmapHeight));
  const available = (offers.data ?? []).filter((o) => !activeHeights.has(o.bitmapHeight));

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8">
      <header>
        <h1 className="display text-3xl md:text-4xl">LEASE MARKET</h1>
        <p className="label mt-3">
          RENT A BITMAP BY THE DAY — HOLDERS EARN, RENTERS BUILD AND SELL ON IT
        </p>
      </header>

      <section className="mt-8 grid grid-cols-2 border border-border md:grid-cols-4">
        <Stat k="OPEN OFFERS" v={String(available.length)} />
        <Stat k="ACTIVE LEASES" v={String(active.length)} />
        <Stat k="RENT PAID" v={`${satsToBtc(rentPaid)} BTC`} />
        <Stat
          k="RENT / DAY"
          v={`${active.reduce((sum, l) => sum + l.rateSatsPerDay, 0)} SATS`}
        />
      </section>

      <section className="mt-10 border border-border">
        <header className="border-b border-border p-5">
          <h2 className="display text-xl">AVAILABLE TO LEASE</h2>
          <p className="label mt-2">RENT IS PAID ON-CHAIN TO THE HOLDER THE MOMENT YOU SIGN</p>
        </header>
        {offers.isLoading ? (
          <p className="p-5 font-mono text-[11px] text-muted-foreground">LOADING LEASE OFFERS…</p>
        ) : available.length === 0 ? (
          <p className="p-5 font-mono text-[11px] text-muted-foreground">
            &gt; NO BITMAP IS OFFERED FOR LEASE RIGHT NOW — OFFER YOURS FROM ITS PAGE
            <span className="blink">_</span>
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {available.map((offer) => (
              <li key={offer.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="space-y-2">
                  <Link
                    to="/bitmap/$block"
                    params={{ block: String(offer.bitmapHeight) }}
                    className="display text-lg hover:text-bitcoin"
                  >
                    {offer.bitmapHeight}.BITMAP
                  </Link>
                  <div className="flex flex-wrap items-center gap-2">
                    <ClubBadge height={offer.bitmapHeight} />
                    <TraitBadges height={offer.bitmapHeight} />
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    HOLDER {shortenAddress(offer.ownerAddress)} · {offer.rateSatsPerDay} SATS / DAY
                    {offer.note ? ` · ${offer.note.toUpperCase()}` : ""}
                  </p>
                </div>
                <LeaseRentButton offer={offer} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 border border-border">
        <header className="border-b border-border p-5">
          <h2 className="display text-xl">ACTIVE LEASES</h2>
        </header>
        {active.length === 0 ? (
          <p className="p-5 font-mono text-[11px] text-muted-foreground">
            &gt; NO ACTIVE LEASE YET<span className="blink">_</span>
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {active.map((lease) => (
              <li key={lease.id} className="flex flex-wrap justify-between gap-3 p-5 font-mono text-[11px]">
                <Link
                  to="/bitmap/$block"
                  params={{ block: String(lease.bitmapHeight) }}
                  className="hover:text-bitcoin"
                >
                  {lease.bitmapHeight}.BITMAP
                </Link>
                <span className="text-muted-foreground">
                  {shortenAddress(lease.lesseeAddress)} RENTS FROM{" "}
                  {shortenAddress(lease.ownerAddress)} · {satsToBtc(lease.totalSats)} BTC ·{" "}
                  {daysLeft(lease.endsAt)} DAY(S) LEFT
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-r border-b border-border p-5 last:border-r-0">
      <p className="label">{k}</p>
      <p className="mt-2 font-mono text-sm">{v}</p>
    </div>
  );
}

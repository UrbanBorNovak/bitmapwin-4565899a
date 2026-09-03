import { useMemo } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useWalletSession } from "@/lib/wallet-session";
import { useAuthSession, accountLabel } from "@/lib/auth";
import { myWalletLinksQuery } from "@/lib/wallet-links";
import { ReferralPanel } from "@/components/coins/ReferralPanel";
import { InscriptionAvatar } from "@/components/InscriptionAvatar";
import { profileQuery } from "@/lib/profiles";
import { shortenAddress } from "@/lib/registry";
import { heldHeightsQuery } from "@/lib/held-parcels";
import { buildsQuery } from "@/lib/builds";
import { coinBalanceQuery, coinLedgerQuery, formatBit, reasonLabel } from "@/lib/coins";
import { earningsFor, leasesQuery, daysLeft } from "@/lib/leases";
import { myBidsQuery, openBidsQuery, BID_STATUS_LABEL, isLiveBid } from "@/lib/bids";
import { formatSats } from "@/lib/trades";
import { clubOf } from "@/lib/clubs";
import { followerCountsQuery } from "@/lib/follows";
import { BitmapManager } from "@/components/BitmapManager";
import { ManagerAI } from "@/components/ManagerAI";
import { FloorRanking } from "@/components/FloorRanking";
import { OpportunityFunnel } from "@/components/OpportunityFunnel";
import { registryBaseQuery } from "@/lib/registry";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Your Bitmaps, Builds, Bids & BIT" },
      {
        name: "description",
        content:
          "Personal dashboard for your Bitcoin bitmap land: holdings, builds and visitor counts, incoming and outgoing bids, lease rent and BIT balance in one view.",
      },
      { property: "og:title", content: "Dashboard — Your Bitmaps, Builds, Bids & BIT" },
      {
        property: "og:description",
        content:
          "One view of your bitmap holdings, builds, visitors, bids, leases and BIT earnings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: DashboardError,
  component: DashboardPage,
});

function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-20 md:px-8">
      <p className="label">DASHBOARD</p>
      <h1 className="display mt-4 text-4xl">DASHBOARD UNAVAILABLE</h1>
      <p className="mt-4 font-mono text-xs text-muted-foreground">
        &gt; {error.message.toUpperCase()}
      </p>
      <button
        type="button"
        className="btn-term mt-6"
        onClick={() => {
          void router.invalidate();
          reset();
        }}
      >
        [ RETRY ]
      </button>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border border-border p-4">
      <p className="label">{label}</p>
      <p className="display mt-2 text-2xl">{value}</p>
      {hint ? (
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="label">{title}</h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="font-mono text-[11px] text-muted-foreground">&gt; {text}_</p>;
}

function DashboardPage() {
  const wallet = useWalletSession();
  const { session, user, loading } = useAuthSession();
  const links = useQuery(myWalletLinksQuery(Boolean(session)));
  const address = wallet?.ordinalsAddress ?? links.data?.[0]?.address ?? "";
  const addresses = useMemo(() => (address ? [address] : []), [address]);

  const market = useQuery(registryBaseQuery(300));
  const marketParcels = market.data ?? [];
  const marketListed = useMemo(
    () => marketParcels.filter((p) => p.listedSats !== null),
    [marketParcels],
  );

  const profile = useQuery(profileQuery(address));

  const held = useQuery(heldHeightsQuery(addresses));
  const builds = useQuery(buildsQuery(200));
  const balances = useQuery(coinBalanceQuery(addresses));
  const ledger = useQuery(coinLedgerQuery(addresses, 12));
  const leases = useQuery(leasesQuery(200));
  const outgoing = useQuery(myBidsQuery(addresses));
  const openBids = useQuery(openBidsQuery(500));
  const followers = useQuery(followerCountsQuery(addresses));

  const myBuilds = useMemo(() => {
    const target = address.toLowerCase();
    if (!target) return [];
    return (builds.data ?? []).filter((b) => b.page.ownerAddress.toLowerCase() === target);
  }, [builds.data, address]);

  const heldSet = useMemo(() => new Set(held.data ?? []), [held.data]);
  const incoming = useMemo(
    () => (openBids.data ?? []).filter((b) => isLiveBid(b) && heldSet.has(b.bitmapHeight)),
    [openBids.data, heldSet],
  );

  const earnings = useMemo(
    () => earningsFor(leases.data ?? [], address || null),
    [leases.data, address],
  );
  const rented = useMemo(() => {
    const target = address.toLowerCase();
    return (leases.data ?? []).filter(
      (l) => l.lesseeAddress.toLowerCase() === target && l.status === "active" && daysLeft(l.endsAt) > 0,
    );
  }, [leases.data, address]);

  const balance = (balances.data ?? []).reduce((sum, b) => sum + b.balance, 0);
  const earned = (balances.data ?? []).reduce((sum, b) => sum + b.earnedTotal, 0);
  const totalViews = myBuilds.reduce((sum, b) => sum + b.totalViews, 0);
  const uniqueVisitors = myBuilds.reduce((sum, b) => sum + b.uniqueVisitors, 0);

  const name =
    profile.data?.displayName?.trim() ||
    (address ? shortenAddress(address) : accountLabel(user));

  if (!loading && !session) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-20 md:px-8">
        <p className="label">DASHBOARD</p>
        <h1 className="display mt-4 text-4xl">SIGN IN REQUIRED</h1>
        <Empty text="SIGN IN AND LINK A WALLET TO SEE YOUR PERSONAL DASHBOARD" />
        <Link to="/auth" search={{}} className="btn-term mt-6 inline-flex">[ SIGN IN ]</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <InscriptionAvatar
            inscriptionId={profile.data?.avatarInscriptionId}
            label={name}
            className="size-14 shrink-0 border border-border [image-rendering:pixelated]"
            fallbackClassName="text-sm"
          />
          <div>
            <p className="label">DASHBOARD</p>
            <h1 className="display text-3xl md:text-4xl">{name.toUpperCase()}</h1>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              {address ? address : "NO WALLET LINKED"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/wallet" hash="profile" reloadDocument className="btn-term">
            [ EDIT PROFILE ]
          </Link>
          <Link to="/wallet" className="btn-term">[ WALLET ]</Link>
          {address ? (
            <Link to="/profile/$address" params={{ address }} className="btn-term">
              [ PUBLIC PROFILE ]
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-8">
        <BitmapManager
          name={name}
          addresses={addresses}
          heldHeights={held.data ?? []}
          enabled={Boolean(session)}
        />
      </div>

      <div className="mt-8">
        <ManagerAI
          addresses={addresses}
          heldHeights={held.data ?? []}
          enabled={Boolean(session)}
        />
      </div>


      <div className="mt-8">
        <OpportunityFunnel parcels={marketParcels} />
      </div>

      <div className="mt-8">
        <FloorRanking parcels={marketListed} pending={market.isPending} />
      </div>

      <div className="mt-8">
        <ReferralPanel />
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="BITMAPS HELD"
          value={held.isLoading ? "…" : String((held.data ?? []).length)}
          hint={held.isLoading ? "SCANNING REGISTRY" : "INDEXED + TRADED + BUILT"}
        />
        <Stat
          label="BUILDS"
          value={builds.isLoading ? "…" : String(myBuilds.length)}
          hint={`${totalViews.toLocaleString()} VIEWS · ${uniqueVisitors.toLocaleString()} UNIQUE`}
        />
        <Stat
          label="BIT BALANCE"
          value={balances.isLoading ? "…" : formatBit(balance)}
          hint={`${formatBit(earned)} EARNED ALL TIME`}
        />
        <Stat
          label="FOLLOWERS"
          value={String(followers.data?.get(address) ?? 0)}
          hint="BUILDERS FOLLOWING YOU"
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="INCOMING BIDS"
          value={openBids.isLoading ? "…" : String(incoming.length)}
          hint={
            incoming.length > 0
              ? `TOP ${formatSats(Math.max(...incoming.map((b) => b.priceSats)))}`
              : "NO LIVE BIDS ON YOUR BITMAPS"
          }
        />
        <Stat
          label="MY BIDS"
          value={outgoing.isLoading ? "…" : String((outgoing.data ?? []).length)}
          hint="BIDS YOU PLACED"
        />
        <Stat
          label="RENT EARNED"
          value={formatBit(earnings.totalCoins)}
          hint={`${earnings.activeCount} ACTIVE · ${formatBit(earnings.perDayCoins)}/DAY`}
        />
        <Stat
          label="BITMAPS RENTED"
          value={String(rented.length)}
          hint="LEASES YOU HOLD"
        />
      </div>

      <div className="mt-8 grid gap-3 lg:grid-cols-2">
        <Panel
          title="MY BITMAPS"
          action={<Link to="/marketplace" className="label hover:text-foreground">MARKETPLACE →</Link>}
        >
          {held.isLoading ? (
            <Empty text="SCANNING" />
          ) : (held.data ?? []).length === 0 ? (
            <Empty text="NO BITMAPS FOUND FOR THIS ADDRESS YET" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {[...(held.data ?? [])]
                .sort((a, b) => a - b)
                .slice(0, 40)
                .map((height) => (
                  <Link
                    key={height}
                    to="/bitmap/$block"
                    params={{ block: String(height) }}
                    className="border border-border px-2 py-1 font-mono text-[11px] transition-colors hover:border-primary"
                  >
                    {height}.BITMAP
                    <span className="ml-2 text-muted-foreground">{clubOf(height).label}</span>
                  </Link>
                ))}
            </div>
          )}
        </Panel>

        <Panel
          title="MY BUILDS"
          action={<Link to="/builds" className="label hover:text-foreground">BUILDS FEED →</Link>}
        >
          {builds.isLoading ? (
            <Empty text="LOADING" />
          ) : myBuilds.length === 0 ? (
            <Empty text="NOTHING BUILT YET — OPEN A BITMAP YOU HOLD AND BUILD ON IT" />
          ) : (
            <ul className="divide-y divide-border">
              {myBuilds.slice(0, 8).map((b) => (
                <li key={b.page.bitmapHeight} className="flex items-center justify-between gap-3 py-2">
                  <Link
                    to="/bitmap/$block"
                    params={{ block: String(b.page.bitmapHeight) }}
                    className="min-w-0 font-mono text-xs hover:text-primary"
                  >
                    <span className="block truncate">{b.page.title || `${b.page.bitmapHeight}.BITMAP`}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {b.page.bitmapHeight}.BITMAP · {b.page.buildKind.toUpperCase()}
                    </span>
                  </Link>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {b.totalViews.toLocaleString()} VIEWS
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="INCOMING BIDS"
          action={<Link to="/wallet" className="label hover:text-foreground">ACCEPT IN WALLET →</Link>}
        >
          {incoming.length === 0 ? (
            <Empty text="NO OPEN BIDS ON YOUR BITMAPS" />
          ) : (
            <ul className="divide-y divide-border">
              {incoming.slice(0, 8).map((bid) => (
                <li key={bid.id} className="flex items-center justify-between gap-3 py-2">
                  <Link
                    to="/bitmap/$block"
                    params={{ block: String(bid.bitmapHeight) }}
                    className="font-mono text-xs hover:text-primary"
                  >
                    {bid.bitmapHeight}.BITMAP
                  </Link>
                  <span className="font-mono text-xs text-primary">{formatSats(bid.priceSats)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="MY BIDS"
          action={<Link to="/marketplace" className="label hover:text-foreground">BID MORE →</Link>}
        >
          {(outgoing.data ?? []).length === 0 ? (
            <Empty text="YOU HAVE NOT PLACED ANY BIDS" />
          ) : (
            <ul className="divide-y divide-border">
              {(outgoing.data ?? []).slice(0, 8).map((bid) => (
                <li key={bid.id} className="flex items-center justify-between gap-3 py-2">
                  <Link
                    to="/bitmap/$block"
                    params={{ block: String(bid.bitmapHeight) }}
                    className="font-mono text-xs hover:text-primary"
                  >
                    {bid.bitmapHeight}.BITMAP
                  </Link>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {formatSats(bid.priceSats)} · {BID_STATUS_LABEL[bid.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="LEASES"
          action={<Link to="/leases" className="label hover:text-foreground">LEASE MARKET →</Link>}
        >
          {earnings.leaseCount === 0 && rented.length === 0 ? (
            <Empty text="NO LEASES GRANTED OR RENTED YET" />
          ) : (
            <div className="space-y-2 font-mono text-xs">
              <p>
                GRANTED: {earnings.leaseCount} · ACTIVE {earnings.activeCount} · EARNED{" "}
                <span className="text-primary">{formatBit(earnings.totalCoins)}</span>
              </p>
              <p>
                RENTED: {rented.length}
                {rented.length > 0
                  ? ` · ${rented.map((l) => `${l.bitmapHeight}.BITMAP (${daysLeft(l.endsAt)}D LEFT)`).join(", ")}`
                  : ""}
              </p>
              {earnings.nextExpiry ? (
                <p className="text-muted-foreground">
                  NEXT EXPIRY {new Date(earnings.nextExpiry).toLocaleDateString()}
                </p>
              ) : null}
            </div>
          )}
        </Panel>

        <Panel
          title="BIT ACTIVITY"
          action={<Link to="/coins" className="label hover:text-foreground">BIT ECONOMY →</Link>}
        >
          {(ledger.data ?? []).length === 0 ? (
            <Empty text="NO BIT MOVEMENTS YET — VISITS, BUILDS AND TRADES EARN BIT" />
          ) : (
            <ul className="divide-y divide-border">
              {(ledger.data ?? []).map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-2 font-mono text-xs">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {reasonLabel(entry.reason)}
                  </span>
                  <span className={entry.delta >= 0 ? "text-primary" : "text-muted-foreground"}>
                    {entry.delta >= 0 ? "+" : ""}
                    {formatBit(entry.delta)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

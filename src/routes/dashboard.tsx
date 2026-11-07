import { useMemo, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useWalletSession } from "@/lib/wallet-session";
import { useAuthSession, accountLabel } from "@/lib/auth";
import { myWalletLinksQuery, verifiedWalletAddress } from "@/lib/wallet-links";
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
import { getPublicPassportFn } from "@/lib/passport.functions";
import { PassportSummary } from "@/components/PassportSummary";

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

function DashboardError({ error, reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-20 md:px-8">
      <p className="label">DASHBOARD</p>
      <h1 className="display mt-4 text-4xl">DASHBOARD UNAVAILABLE</h1>
      <p className="mt-4 font-mono text-xs text-muted-foreground">
        &gt; {(error as Error).message.toUpperCase()}
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

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="terminal-panel terminal-interactive p-4">
      <p className="label">{label}</p>
      <p className={`display mt-2 text-2xl ${accent ? "text-primary" : ""}`}>{value}</p>
      {hint ? <p className="mt-1 font-mono text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`terminal-panel flex flex-col overflow-hidden ${className ?? ""}`}>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3">
        <h2 className="label truncate">{title}</h2>
        {action}
      </header>
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="font-mono text-[11px] text-muted-foreground">&gt; {text}_</p>;
}

const TABS = [
  { id: "overview", label: "OVERVIEW" },
  { id: "portfolio", label: "PORTFOLIO" },
  { id: "trading", label: "TRADING" },
  { id: "earnings", label: "EARNINGS" },
  { id: "market", label: "MARKET" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function DashboardPage() {
  const wallet = useWalletSession();
  const { session, user, loading } = useAuthSession();
  const [tab, setTab] = useState<TabId>("overview");
  const links = useQuery(myWalletLinksQuery(Boolean(session)));
  const address = verifiedWalletAddress(links.data, wallet?.ordinalsAddress);
  const addresses = useMemo(() => (address ? [address] : []), [address]);

  const market = useQuery(registryBaseQuery(300));
  const marketParcels = market.data ?? [];
  const marketListed = useMemo(
    () => marketParcels.filter((p) => p.listedSats !== null),
    [marketParcels],
  );

  const profile = useQuery(profileQuery(address));

  const held = useQuery(heldHeightsQuery(addresses));
  const builds = useQuery(buildsQuery());
  const balances = useQuery(coinBalanceQuery(addresses));
  const ledger = useQuery(coinLedgerQuery(addresses, 12));
  const leases = useQuery(leasesQuery(200));
  const outgoing = useQuery(myBidsQuery(addresses));
  const openBids = useQuery(openBidsQuery(500));
  const followers = useQuery(followerCountsQuery(addresses));
  const passport = useQuery({ queryKey: ["dashboard-passport", address], queryFn: () => getPublicPassportFn({ data: { wallet: address } }), enabled: Boolean(address), staleTime: 30_000 });

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
  const followerCount = address ? (followers.data?.get(address) ?? 0) : 0;

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

  const heldPanel = (
    <Panel
      title="MY BITMAPS"
      action={<Link to="/marketplace" className="label shrink-0 hover:text-foreground">MARKETPLACE →</Link>}
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
  );

  const buildsPanel = (
    <Panel
      title="MY BUILDS"
      action={<Link to="/builds" className="label shrink-0 hover:text-foreground">BUILDS FEED →</Link>}
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
                {b.totalViews.toLocaleString("en-US")} VIEWS
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );

  const incomingPanel = (
    <Panel
      title="INCOMING BIDS"
      action={<Link to="/wallet" className="label shrink-0 hover:text-foreground">ACCEPT IN WALLET →</Link>}
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
  );

  const myBidsPanel = (
    <Panel
      title="MY BIDS"
      action={<Link to="/marketplace" className="label shrink-0 hover:text-foreground">BID MORE →</Link>}
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
  );

  const leasesPanel = (
    <Panel
      title="LEASES"
      action={<Link to="/leases" className="label shrink-0 hover:text-foreground">LEASE MARKET →</Link>}
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
  );

  const bitPanel = (
    <Panel
      title="BIT ACTIVITY"
      action={<Link to="/coins" className="label shrink-0 hover:text-foreground">BIT ECONOMY →</Link>}
    >
      {(ledger.data ?? []).length === 0 ? (
        <Empty text="NO BIT MOVEMENTS YET — VISITS, BUILDS AND TRADES EARN BIT" />
      ) : (
        <ul className="divide-y divide-border">
          {(ledger.data ?? []).map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 py-2 font-mono text-xs">
              <span className="min-w-0 truncate text-muted-foreground">{reasonLabel(entry.reason)}</span>
              <span className={entry.delta >= 0 ? "text-primary" : "text-muted-foreground"}>
                {entry.delta >= 0 ? "+" : ""}
                {formatBit(entry.delta)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );

  return (
    <div className="page-shell">
      {/* IDENTITY */}
      <header className="profile-home">
        <div className="grid items-center gap-7 p-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:p-8">
          <div className="relative mx-auto md:mx-0">
            <div className="profile-portrait size-28 overflow-hidden p-1.5 md:size-32">
              <InscriptionAvatar
                inscriptionId={profile.data?.avatarInscriptionId}
                label={name}
                className="size-full rounded-full [image-rendering:pixelated]"
                fallbackClassName="text-2xl text-profile-warm"
              />
            </div>
            <span className="absolute bottom-1 right-1 size-5 rounded-full border-4 border-profile-surface bg-profile-warm shadow-[0_0_12px_color-mix(in_oklab,var(--color-profile-warm)_55%,transparent)]" aria-label="Signed in" />
          </div>
          <div className="min-w-0 text-center md:text-left">
            <div className="flex items-center justify-center gap-3 md:justify-start">
              <p className="label text-profile-warm-muted">
                {links.isLoading ? "CHECKING VERIFICATION" : address ? "WALLET VERIFIED" : "WALLET NOT VERIFIED"}
              </p>
              <span className="h-px w-10 bg-profile-warm/20" />
            </div>
            <h1 className="display mt-3 truncate text-3xl text-profile-warm md:text-4xl">{name}</h1>
            <p className="mt-3 break-all font-mono text-[10px] text-muted-foreground">{address || "NO WALLET LINKED"}</p>
            <p className="mx-auto mt-4 max-w-[60ch] whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground md:mx-0">
              {profile.data?.bio || "THIS IS YOUR PLACE IN THE OASIS. ADD A STORY AND AN ON-CHAIN PORTRAIT TO MAKE IT FEEL LIKE HOME."}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-1">
            <div className="profile-readout min-w-24 p-3 text-center"><p className="label">BUILDS</p><p className="mt-1 font-mono font-bold text-profile-warm">{myBuilds.length}</p></div>
            <div className="profile-readout min-w-24 p-3 text-center"><p className="label">VISITORS</p><p className="mt-1 font-mono font-bold text-profile-warm">{uniqueVisitors.toLocaleString("en-US")}</p></div>
            <div className="profile-readout min-w-24 p-3 text-center"><p className="label">FOLLOWERS</p><p className="mt-1 font-mono font-bold text-profile-warm">{followerCount.toLocaleString("en-US")}</p></div>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-profile-warm/20 bg-background/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <p className="font-mono text-[10px] text-profile-warm-muted"><span className="mr-2 animate-pulse">●</span>WELCOME BACK TO YOUR OASIS</p>
          <div className="flex flex-wrap gap-2">
            <Link to="/wallet" hash="profile" reloadDocument className="btn-term">[ EDIT PROFILE ]</Link>
            <Link to="/wallet" className="btn-term-ghost">[ WALLET ]</Link>
            {address ? <Link to="/profile/$address" params={{ address }} className="btn-term-ghost">[ PUBLIC PROFILE ]</Link> : null}
          </div>
        </div>
      </header>

      {/* KPI STRIP — always visible */}
      {passport.data ? <div className="mt-3"><PassportSummary passport={passport.data} /></div> : null}
      <div className="mt-3 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat
          label="BITMAPS HELD"
          value={held.isLoading ? "…" : String((held.data ?? []).length)}
          hint={held.isLoading ? "SCANNING REGISTRY" : "INDEXED + TRADED + BUILT"}
        />
        <Stat
          label="INCOMING BIDS"
          value={openBids.isLoading ? "…" : String(incoming.length)}
          accent={incoming.length > 0}
          hint={
            incoming.length > 0
              ? `TOP ${formatSats(Math.max(...incoming.map((b) => b.priceSats)))}`
              : "NO LIVE BIDS ON YOUR BITMAPS"
          }
        />
        <Stat
          label="BIT BALANCE"
          value={balances.isLoading ? "…" : formatBit(balance)}
          hint={`${formatBit(earned)} EARNED ALL TIME`}
        />
        <Stat
          label="RENT EARNED"
          value={formatBit(earnings.totalCoins)}
          hint={`${earnings.activeCount} ACTIVE · ${formatBit(earnings.perDayCoins)}/DAY`}
        />
      </div>

      {/* MODULE NAV */}
      <nav className="mt-6 flex flex-wrap gap-2 border-b border-border pb-3" aria-label="Dashboard sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`terminal-interactive border px-3 py-1.5 font-mono text-[11px] tracking-wider ${
              tab === t.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="mt-6 space-y-3">
        {tab === "overview" ? (
          <>
            <BitmapManager
              name={name}
              addresses={addresses}
              heldHeights={held.data ?? []}
              enabled={Boolean(session)}
            />
            <ManagerAI
              addresses={addresses}
              heldHeights={held.data ?? []}
              enabled={Boolean(session)}
            />
            <div className="grid gap-3 lg:grid-cols-2">
              {incomingPanel}
              {heldPanel}
            </div>
          </>
        ) : null}

        {tab === "portfolio" ? (
          <>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <Stat
                label="BUILDS"
                value={builds.isLoading ? "…" : String(myBuilds.length)}
                hint={`${totalViews.toLocaleString("en-US")} VIEWS · ${uniqueVisitors.toLocaleString("en-US")} UNIQUE`}
              />
              <Stat label="TOTAL VIEWS" value={totalViews.toLocaleString("en-US")} hint="ACROSS ALL BUILDS" />
              <Stat
                label="FOLLOWERS"
                value={String(followers.data?.get(address) ?? 0)}
                hint="BUILDERS FOLLOWING YOU"
              />
              <Stat label="BITMAPS RENTED" value={String(rented.length)} hint="LEASES YOU HOLD" />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {heldPanel}
              {buildsPanel}
            </div>
          </>
        ) : null}

        {tab === "trading" ? (
          <>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <Stat label="INCOMING BIDS" value={String(incoming.length)} accent={incoming.length > 0} hint="ON YOUR BITMAPS" />
              <Stat label="MY BIDS" value={String((outgoing.data ?? []).length)} hint="BIDS YOU PLACED" />
              <Stat label="LISTED IN MARKET" value={String(marketListed.length)} hint="LIVE ASKS TRACKED" />
              <Stat label="REGISTRY SCANNED" value={String(marketParcels.length)} hint="BITMAPS IN VIEW" />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {incomingPanel}
              {myBidsPanel}
            </div>
          </>
        ) : null}

        {tab === "earnings" ? (
          <>
            <div className="grid gap-3 lg:grid-cols-2">
              {leasesPanel}
              {bitPanel}
            </div>
            <ReferralPanel />
          </>
        ) : null}

        {tab === "market" ? (
          <>
            <OpportunityFunnel parcels={marketParcels} />
            <FloorRanking parcels={marketListed} pending={market.isPending} />
          </>
        ) : null}
      </div>
    </div>
  );
}

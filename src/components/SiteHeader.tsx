import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, HelpCircle, Search, X } from "lucide-react";
import { useState } from "react";
import { BidInboxBell } from "@/components/BidInboxBell";
import { HeaderIdentity } from "@/components/HeaderIdentity";
import { BtcTicker } from "@/components/BtcTicker";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { startGuidedTour } from "@/components/GuidedTour";

type NavItem = { to: string; label: string; note?: string };
type NavGroup = { id: string; label: string; note: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    id: "play",
    label: "PLAY",
    note: "Everything you use inside the 3D Oasis",
    items: [
      { to: "/map", label: "ENTER THE OASIS", note: "Walk, drive, build and explore" },
      { to: "/stream", label: "WORLD STREAM", note: "See verified history as it happens" },
      { to: "/play-guide", label: "PLAYER GUIDE", note: "Controls, devices and what to do" },
      { to: "/cities", label: "VISIT CITIES", note: "Districts inside the world" },
      { to: "/trading-post", label: "IN-WORLD TRADING POST", note: "Trade your Oasis items" },
      { to: "/inventory", label: "MY INVENTORY", note: "Gear, rations and collectibles" },
    ],
  },
  {
    id: "trade",
    label: "TRADE",
    note: "Bitcoin land, rentals and confirmed sales",
    items: [
      { to: "/marketplace", label: "BITMAP MARKET", note: "Buy and sell BITMAPs" },
      { to: "/leases", label: "LEASES", note: "Rent BITMAPs by the day" },
      { to: "/history", label: "SALES HISTORY", note: "Confirmed on-chain sales" },
      { to: "/donate", label: "DONATE AN INSCRIPTION", note: "Retire unwanted ordinals for BIT" },
    ],
  },
  {
    id: "create",
    label: "CREATE",
    note: "Build and publish experiences on your BITMAPs",
    items: [
      { to: "/my-world", label: "MY WORLD", note: "Manage your BITMAPs and deployments" },
      { to: "/builds", label: "3D BUILDS", note: "On-chain model registry" },
      { to: "/extend", label: "DEPLOY", note: "Put an experience on your land" },
      { to: "/studio", label: "STUDIO", note: "Build an Extender" },
      { to: "/extenders", label: "EXTENDERS", note: "Reusable world packages" },
    ],
  },
  {
    id: "discover",
    label: "DISCOVER",
    note: "See what is active across the network",
    items: [
      { to: "/explore", label: "EXPLORE", note: "Trending BITMAPs and activity" },
      { to: "/ranks", label: "RANKS", note: "Hall of fame, PvP and clans" },
      { to: "/experiences", label: "EXPERIENCES", note: "Live deployed worlds" },
      { to: "/builders", label: "BUILDERS", note: "People building on bedrock" },
      { to: "/world-stats", label: "WORLD STATS", note: "BIT supply, prices and mining" },
    ],
  },
  {
    id: "account",
    label: "ACCOUNT",
    note: "Your holdings, proof and developer resources",
    items: [
      { to: "/my-land", label: "MY BITMAPS", note: "BITMAPs held by your wallet" },
      { to: "/passport", label: "MY PASSPORT", note: "Stamps, proof and build unlocks" },
      { to: "/ownership", label: "OWNERSHIP", note: "Verify on-chain ownership" },
      { to: "/sdk", label: "SDK", note: "Build for Bitcoin land" },
      { to: "/docs", label: "DOCS", note: "Guides and references" },
      { to: "/api", label: "API", note: "Public HTTP endpoints" },
      { to: "/dev-tools", label: "DEVELOPER TOOLS", note: "Playground, MCP, AI" },
    ],
  },
];

export function SiteHeader() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const navigate = useNavigate();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = term.trim();
    if (!q) return;
    if (/^\d{3,7}$/.test(q)) {
      navigate({ to: "/bitmap/$block", params: { block: q } });
    } else {
      navigate({ to: "/marketplace" });
    }
    setSearchOpen(false);
    setTerm("");
  }

  return (
    <header className="site-header sticky top-0 z-50 border-b border-border">
      <div className="mx-auto grid max-w-[1600px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 md:flex md:justify-between md:gap-3 md:px-5">
        <Link to="/" className="site-brand min-w-0 leading-none">
          <div className="display flex items-end gap-1 text-sm sm:text-base">
            <span className="text-bitcoin">BITMAP</span>
            <span className="relative hidden sm:inline">
              <span className="label absolute bottom-full left-0 mb-0.5 hidden text-[0.4rem] leading-none text-bitcoin md:block">
                ALPHA
              </span>
              UNHINGED
            </span>
          </div>
          <div className="label mt-1 hidden text-[0.5rem] sm:block">BITCOIN-NATIVE WORLDS</div>
        </Link>

        <nav className="hidden items-center divide-x divide-border border-x border-border lg:flex" aria-label="Main navigation">
          {NAV_GROUPS.map((group) => (
            <div
              key={group.id}
              className="relative"
              onMouseEnter={() => setOpenGroup(group.id)}
              onMouseLeave={() => setOpenGroup((v) => (v === group.id ? null : v))}
            >
              <button
                type="button"
                aria-expanded={openGroup === group.id}
                onClick={() => setOpenGroup((v) => (v === group.id ? null : group.id))}
              className={`nav-trigger label flex h-9 items-center gap-1 px-3 py-2 ${
                  openGroup === group.id ? "is-active border border-border text-foreground" : ""
                }`}
              >
                {group.label}
                <ChevronDown className="size-3" />
              </button>
              {openGroup === group.id && (
                <div className="nav-menu absolute left-0 top-full min-w-64 border border-border bg-background">
                  <div className="border-b border-border bg-surface px-4 py-2">
                    <div className="label text-bitcoin">{group.label}</div>
                    <div className="mt-1 font-mono text-[10px] leading-snug text-muted-foreground">
                      {group.note}
                    </div>
                  </div>
                  {group.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpenGroup(null)}
                      className="nav-menu-item block border-b border-border px-4 py-3 last:border-b-0"
                      activeProps={{ className: "text-bitcoin" }}
                    >
                      <div className="label text-foreground">{item.label}</div>
                      {item.note && <div className="label mt-1 text-[0.55rem]">{item.note}</div>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Link to="/oasis" className="label ml-2 flex h-9 items-center gap-1 border border-bitcoin bg-bitcoin px-3 py-2 text-primary-foreground hover:border-foreground hover:bg-foreground">
            ENTER OASIS <span aria-hidden="true">→</span>
          </Link>
        </nav>



        <div className="flex shrink-0 items-center gap-1">
          <BtcTicker className="hidden sm:flex" />
          <LanguageSwitcher />
          <button
            type="button"
            aria-label="Show me around this page"
            title="Show me around this page"
            onClick={() => startGuidedTour()}
            className="icon-control hidden size-10 shrink-0 place-items-center border border-border text-muted-foreground sm:grid md:size-9"
          >
            <HelpCircle className="size-4" />
          </button>
          <button
            aria-label="Search bitmaps"
            onClick={() => setSearchOpen((v) => !v)}
            className="icon-control grid size-10 shrink-0 place-items-center border border-border text-muted-foreground md:size-9"
          >
            {searchOpen ? <X className="size-4" /> : <Search className="size-4" />}
          </button>
          <BidInboxBell />
          <HeaderIdentity />
        </div>
      </div>

      {searchOpen && (
        <form onSubmit={submit} className="border-t border-border px-3 py-2 md:px-5">
          <input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search a block number, e.g. 840000"
            className="w-full bg-background font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </form>
      )}

      <nav className="flex items-center divide-x divide-border overflow-visible border-t border-border px-3 py-1 lg:hidden" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className="relative min-w-0 flex-1">
            <button
              type="button"
              aria-expanded={openGroup === group.id}
              onClick={() => setOpenGroup((v) => (v === group.id ? null : group.id))}
              className={`nav-trigger label flex w-full items-center justify-center gap-1 px-1 py-2 sm:px-3 ${
                openGroup === group.id ? "is-active border border-border text-foreground" : ""
              }`}
            >
              {group.label}
              <ChevronDown className="hidden size-3 sm:block" />
            </button>
            {openGroup === group.id && (
              <div className={`nav-menu fixed left-3 right-3 top-[5.55rem] z-50 border border-border bg-background sm:absolute sm:left-0 sm:right-auto sm:top-full sm:mt-1 sm:min-w-72 ${group.id === "account" ? "sm:left-auto sm:right-0" : ""}`}>
                <div className="border-b border-border bg-surface px-4 py-2">
                  <div className="label text-bitcoin">{group.label}</div>
                  <div className="mt-1 font-mono text-[10px] leading-snug text-muted-foreground">{group.note}</div>
                </div>
                {group.items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpenGroup(null)}
                    className="nav-menu-item block border-b border-border px-4 py-3 last:border-b-0"
                    activeProps={{ className: "text-bitcoin" }}
                  >
                    <div className="label text-foreground">{item.label}</div>
                    {item.note && <div className="label mt-1 text-[0.55rem]">{item.note}</div>}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </header>
  );
}

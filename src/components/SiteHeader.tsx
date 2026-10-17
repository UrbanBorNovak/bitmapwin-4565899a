import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ChevronDown, HelpCircle, Search, X, Gamepad2, Store, Hammer, Compass, User,
  Layers, Sparkles, Globe, Swords, Radio, BookOpen, Building2, ArrowLeftRight, Backpack,
  Map as MapIcon, CalendarClock, History, Gift, Home, Users, Rocket, PenTool, Shield, Package,
  TrendingUp, Library, Trophy, Boxes, HardHat, BarChart3, Pickaxe, IdCard, BadgeCheck, Code2,
  FileText, Terminal, Wrench, ArrowRight, type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { BidInboxBell } from "@/components/BidInboxBell";
import { HeaderIdentity } from "@/components/HeaderIdentity";
import { BtcTicker } from "@/components/BtcTicker";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { startGuidedTour } from "@/components/GuidedTour";

type NavItem = { to: string; label: string; note?: string };
type NavGroup = { id: string; label: string; note: string; items: NavItem[] };

const GROUP_ICONS: Record<string, LucideIcon> = {
  play: Gamepad2, trade: Store, create: Hammer, discover: Compass, account: User,
};
const ITEM_ICONS: Record<string, LucideIcon> = {
  "/play": Layers, "/play/extenders": Sparkles, "/oasis": Globe, "/command": Swords, "/stream": Radio,
  "/play-guide": BookOpen, "/cities": Building2, "/trading-post": ArrowLeftRight, "/inventory": Backpack,
  "/marketplace": MapIcon, "/leases": CalendarClock, "/history": History, "/donate": Gift,
  "/my-world": Home, "/builds": Users, "/extend": Rocket, "/studio": PenTool, "/mint": Shield, "/extenders": Package,
  "/explore": TrendingUp, "/codex": Library, "/ranks": Trophy, "/experiences": Boxes, "/builders": HardHat,
  "/world-stats": BarChart3, "/archaeology": Pickaxe, "/my-land": MapIcon, "/passport": IdCard,
  "/ownership": BadgeCheck, "/sdk": Code2, "/docs": FileText, "/api": Terminal, "/dev-tools": Wrench,
  "/forge": Hammer, "/create": Sparkles, "/parcel": MapIcon,
};
function ItemIcon({ to, active }: { to: string; active: boolean }) {
  const I = ITEM_ICONS[to] ?? ArrowRight;
  return (
    <span className={`grid size-8 shrink-0 place-items-center border ${active ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground group-hover:border-signal group-hover:text-signal"}`}>
      <I className="size-4" strokeWidth={1.75} />
    </span>
  );
}
function GroupIcon({ id }: { id: string }) {
  const I = GROUP_ICONS[id] ?? Compass;
  return <I className="size-3.5" strokeWidth={1.75} aria-hidden="true" />;
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "play",
    label: "PLAY",
    note: "Everything you use inside the 3D Oasis",
    items: [
      { to: "/play", label: "PLAY // LIVING CARDS", note: "The card game where the world is the deck" },
      { to: "/play/extenders", label: "PFP EXTENDERS", note: "Optional Ordinals HTML card art" },
      { to: "/oasis", label: "ENTER THE OASIS", note: "Walk, drive, build and explore" },
      { to: "/command", label: "GUARDIAN COMMAND CENTRE", note: "Send Guardians on patrols, marches and raids" },
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
      { to: "/donate", label: "SHARE & FUEL", note: "Share BTC, collect BIT to use in the Oasis" },
    ],
  },
  {
    id: "create",
    label: "CREATE",
    note: "Build and publish experiences on your BITMAPs",
    items: [
      { to: "/forge", label: "LAND FORGE", note: "Build voxels on your BITMAP and inscribe them" },
      { to: "/parcel", label: "PARCEL STUDIO", note: "Map and inscribe the real parcels of a BITMAP" },
      { to: "/clips", label: "BITMAP CLIPS", note: "Turn a BITMAP into a 3D video (by @bitlodo)" },
      { to: "/breed", label: "BREEDING LAB", note: "Pair two Guardians and inscribe their pet" },
      { to: "/kennels", label: "PARCEL FOUNDRY", note: "One Land Forge Outpost per transaction parcel" },
      { to: "/create", label: "CREATE HUB", note: "Pick how you want to build" },
      { to: "/my-world", label: "MY WORLD", note: "Manage your BITMAPs and deployments" },
      { to: "/builds", label: "COMMUNITY BUILDS", note: "Preview and enter public BITMAP worlds" },
      { to: "/extend", label: "DEPLOY", note: "Put an experience on your land" },
      { to: "/studio", label: "STUDIO", note: "Build an Extender" },
      { to: "/mint", label: "MINT GUARDIAN", note: "Shielded Block-DNA ordinals" },
      { to: "/extenders", label: "EXTENDERS", note: "Reusable world packages" },
    ],
  },
  {
    id: "discover",
    label: "DISCOVER",
    note: "See what is active across the network",
    items: [
      { to: "/explore", label: "EXPLORE", note: "Trending BITMAPs and activity" },
      { to: "/codex", label: "CODEX", note: "Field guide: creatures, cards, land" },
      { to: "/ranks", label: "RANKS", note: "Hall of fame, PvP and clans" },
      { to: "/experiences", label: "EXPERIENCES", note: "Live deployed worlds" },
      { to: "/builds", label: "COMMUNITY BUILDS", note: "Browse every public BITMAP build" },
      { to: "/builders", label: "BUILDERS", note: "People building on bedrock" },
      { to: "/world-stats", label: "WORLD STATS", note: "BIT supply, prices and mining" },
      { to: "/archaeology", label: "ARCHAEOLOGY FACTS", note: "Trait definitions and block history" },
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
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const itemIsActive = (to: string) => pathname === to || (to !== "/play" && pathname.startsWith(`${to}/`));

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
                BETA
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
                <GroupIcon id={group.id} />
                {group.label}
                <ChevronDown className="size-3" />
              </button>
              {openGroup === group.id && (
                <div className={`nav-menu absolute left-0 top-full border border-border bg-background ${group.id === "play" ? "w-80" : "min-w-64"}`}>
                  <div className="border-b border-border bg-surface px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="label text-bitcoin">{group.label}</div>
                      {group.id === "play" ? <span className="label text-[0.5rem]">OASIS ONLINE</span> : null}
                    </div>
                    <div className="mt-1 font-mono text-[10px] leading-snug text-muted-foreground">{group.note}</div>
                  </div>
                  <div className={group.id === "play" ? "space-y-1 p-2" : ""}>
                    {group.items.map((item, index) => {
                      const active = itemIsActive(item.to);
                      const divider = group.id === "play" && (index === 2 || index === 5);
                      return (
                        <div key={item.to} className={divider ? "border-t border-border pt-1" : undefined}>
                          <Link
                            to={item.to}
                            activeOptions={{ exact: true }}
                            onClick={() => setOpenGroup(null)}
                            aria-current={active ? "page" : undefined}
                            className={`nav-menu-item group block border-border px-3 py-2.5 ${group.id === "play" ? "border border-transparent" : "border-b last:border-b-0"} ${active ? "border-border bg-surface" : "hover:border-border hover:bg-surface"}`}
                          >
                            <div className="flex items-center gap-3">
                              <ItemIcon to={item.to} active={active} />
                              <div className="min-w-0">
                                <div className={`label transition-transform group-hover:translate-x-0.5 ${active ? "text-bitcoin" : "text-foreground"}`}>{item.label}</div>
                                {item.note && <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{item.note}</div>}
                              </div>
                            </div>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                  {group.id === "play" ? (
                    <div className="flex items-center justify-between border-t border-border bg-card px-4 py-3">
                      <span className="label">9 COMMANDS</span>
                      <span className="label text-bitcoin">READY</span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
          <Link to="/oasis" className="label ml-2 flex h-9 items-center gap-1 border border-bitcoin bg-bitcoin px-3 py-2 text-primary-foreground hover:border-foreground hover:bg-foreground">
            <Globe className="size-3.5" strokeWidth={1.75} /> ENTER OASIS
          </Link>
        </nav>



        <div className="flex shrink-0 items-center gap-1">
          <BtcTicker className="hidden sm:flex" />
          <LanguageSwitcher />
          <ThemeToggle />
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
              <GroupIcon id={group.id} />
              <span className="hidden min-[400px]:inline">{group.label}</span>
              <ChevronDown className="hidden size-3 sm:block" />
            </button>
            {openGroup === group.id && (
              <div className={`nav-menu fixed left-3 right-3 top-[5.55rem] z-50 max-h-[calc(100dvh-6.5rem)] overflow-y-auto border border-border bg-background sm:absolute sm:left-0 sm:right-auto sm:top-full sm:mt-1 sm:w-80 ${group.id === "account" ? "sm:left-auto sm:right-0" : ""}`}>
                <div className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="label text-bitcoin">{group.label}</div>
                    {group.id === "play" ? <span className="label text-[0.5rem]">OASIS ONLINE</span> : null}
                  </div>
                  <div className="mt-1 font-mono text-[10px] leading-snug text-muted-foreground">{group.note}</div>
                </div>
                <div className={group.id === "play" ? "space-y-1 p-2" : ""}>
                  {group.items.map((item, index) => {
                    const active = itemIsActive(item.to);
                    const divider = group.id === "play" && (index === 2 || index === 5);
                    return (
                      <div key={item.to} className={divider ? "border-t border-border pt-1" : undefined}>
                        <Link
                          to={item.to}
                          activeOptions={{ exact: true }}
                          onClick={() => setOpenGroup(null)}
                          aria-current={active ? "page" : undefined}
                          className={`nav-menu-item group block border-border px-3 py-2.5 ${group.id === "play" ? "border border-transparent" : "border-b last:border-b-0"} ${active ? "border-border bg-surface" : "hover:border-border hover:bg-surface"}`}
                        >
                            <div className="flex items-center gap-3">
                              <ItemIcon to={item.to} active={active} />
                              <div className="min-w-0">
                                <div className={`label transition-transform group-hover:translate-x-0.5 ${active ? "text-bitcoin" : "text-foreground"}`}>{item.label}</div>
                                {item.note && <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{item.note}</div>}
                              </div>
                            </div>
                        </Link>
                      </div>
                    );
                  })}
                </div>
                {group.id === "play" ? (
                  <div className="flex items-center justify-between border-t border-border bg-card px-4 py-3">
                    <span className="label">9 COMMANDS</span>
                    <span className="label text-bitcoin">READY</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </nav>
    </header>
  );
}

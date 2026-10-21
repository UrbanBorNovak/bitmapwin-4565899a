import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ChevronDown, HelpCircle, Search, X, Hammer, Compass, User,
  Layers, Sparkles, Globe, Swords, Radio, BookOpen, Building2, ArrowLeftRight, Backpack,
  Map as MapIcon, CalendarClock, History, Gift, Home, Users, Rocket, PenTool, Shield, Package,
  TrendingUp, Library, Trophy, Boxes, HardHat, BarChart3, Pickaxe, IdCard, BadgeCheck, Code2,
  FileText, Terminal, Wrench, ArrowRight, Clapperboard, Menu as MenuIcon, type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { BidInboxBell } from "@/components/BidInboxBell";
import { HeaderIdentity } from "@/components/HeaderIdentity";
import { BtcTicker } from "@/components/BtcTicker";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { startGuidedTour } from "@/components/GuidedTour";

type NavItem = { to: string; label: string; note?: string };
type NavGroup = { id: string; label: string; note: string; items: NavItem[] };

const GROUP_ICONS: Record<string, LucideIcon> = {
  play: Globe, trade: MapIcon, guardians: Shield, create: Hammer, discover: Compass, account: User,
};
const ITEM_ICONS: Record<string, LucideIcon> = {
  "/play": Layers, "/play/extenders": Sparkles, "/oasis": Globe, "/command": Swords, "/stream": Radio,
  "/play-guide": BookOpen, "/cities": Building2, "/trading-post": ArrowLeftRight, "/inventory": Backpack,
  "/marketplace": MapIcon, "/leases": CalendarClock, "/history": History, "/donate": Gift,
  "/my-world": Home, "/builds": Users, "/extend": Rocket, "/studio": PenTool, "/mint": Shield, "/extenders": Package,
  "/explore": TrendingUp, "/codex": Library, "/ranks": Trophy, "/experiences": Boxes, "/builders": HardHat,
  "/world-stats": BarChart3, "/archaeology": Pickaxe, "/my-land": MapIcon, "/passport": IdCard,
  "/ownership": BadgeCheck, "/sdk": Code2, "/docs": FileText, "/api": Terminal, "/dev-tools": Wrench,
  "/forge": Hammer, "/watch": Clapperboard, "/create": Sparkles, "/parcel": MapIcon, "/tools": Wrench,
  "/colony": Users, "/registry": Package, "/traits": BadgeCheck, "/biternam": BookOpen, "/breed": Sparkles,
  "/kennels": Building2, "/toon": Clapperboard, "/clips": Clapperboard,
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

// Organised by the five pillars, then developers. Each page appears once,
// in the order a visitor would naturally use it.
const NAV_GROUPS: NavGroup[] = [
  {
    id: "play",
    label: "WORLD",
    note: "Enter the Oasis and everything you do inside it",
    items: [
      { to: "/oasis", label: "ENTER THE OASIS", note: "Walk, drive, build and explore" },
      { to: "/play-guide", label: "PLAYER GUIDE", note: "Controls, devices and what to do" },
      { to: "/cities", label: "VISIT CITIES", note: "Districts inside the world" },
      { to: "/biternam", label: "BITERNAM QUESTS", note: "Story chapters and quests in the Oasis" },
      { to: "/play", label: "LIVING CARDS", note: "The card game where the world is the deck" },
      { to: "/play/extenders", label: "PFP EXTENDERS", note: "Optional Ordinals HTML card art" },
      { to: "/inventory", label: "MY INVENTORY", note: "Gear, rations and collectibles" },
      { to: "/trading-post", label: "IN-WORLD TRADING POST", note: "Trade your Oasis items" },
    ],
  },
  {
    id: "trade",
    label: "LAND",
    note: "BITMAPs: buy, rent, verify and research",
    items: [
      { to: "/marketplace", label: "BITMAP MARKET", note: "Buy and sell BITMAPs" },
      { to: "/leases", label: "LEASES", note: "Rent BITMAPs by the day" },
      { to: "/history", label: "SALES HISTORY", note: "Confirmed on-chain sales" },
      { to: "/ownership", label: "VERIFY OWNERSHIP", note: "Check who holds a BITMAP on-chain" },
      { to: "/traits", label: "TRAITS", note: "Official BITMAP trait collections" },
      { to: "/archaeology", label: "ARCHAEOLOGY", note: "Block history and records" },
      { to: "/world-stats", label: "WORLD STATS", note: "BIT supply, prices and mining" },
    ],
  },
  {
    id: "guardians",
    label: "GUARDIANS",
    note: "Mint, command and grow your Guardians",
    items: [
      { to: "/mint", label: "MINT GUARDIAN", note: "Shielded Block-DNA ordinals" },
      { to: "/colony", label: "GUARDIAN AGENTS", note: "Your Guardians as helper agents" },
      { to: "/command", label: "COMMAND CENTRE", note: "Patrols, marches and raids" },
      { to: "/breed", label: "BREEDING LAB", note: "Pair two Guardians and inscribe their pet" },
      { to: "/codex", label: "CODEX", note: "Field guide: creatures, cards, land" },
    ],
  },
  {
    id: "create",
    label: "CREATE",
    note: "Build on your BITMAP, make media, deploy experiences",
    items: [
      { to: "/studio", label: "BITMAPWIN STUDIO", note: "Creator home: build, script, publish, sell" },
      { to: "/create", label: "CREATE HUB", note: "Pick how you want to build" },
      { to: "/forge", label: "LAND FORGE", note: "Build voxels on your BITMAP and inscribe them" },
      { to: "/parcel", label: "PARCEL STUDIO", note: "Map and inscribe the real parcels of a BITMAP" },
      { to: "/kennels", label: "PARCEL FOUNDRY", note: "One Outpost per transaction parcel" },
      { to: "/registry", label: "MODEL REGISTRY", note: "On-chain 3D models you can place" },
      { to: "/toon", label: "TOON STUDIO", note: "Script cartoon episodes" },
      { to: "/clips", label: "BITMAP CLIPS", note: "Turn a BITMAP into a 3D video (by @bitlodo)" },
      { to: "/extend", label: "DEPLOY", note: "Put an experience on your land" },
      { to: "/tools", label: "ALL TOOLS", note: "Every free and on-chain tool in one place" },
    ],
  },
  {
    id: "discover",
    label: "DISCOVER",
    note: "What people are building and watching",
    items: [
      { to: "/explore", label: "EXPLORE", note: "Trending BITMAPs and activity" },
      { to: "/stream", label: "WORLD STREAM", note: "Verified history as it happens" },
      { to: "/experiences", label: "EXPERIENCES", note: "Live deployed worlds" },
      { to: "/extenders", label: "EXTENDERS", note: "Reusable world packages" },
      { to: "/builds", label: "COMMUNITY BUILDS", note: "Every public BITMAP build" },
      { to: "/builders", label: "BUILDERS", note: "People building on bedrock" },
      { to: "/watch", label: "TOON CINEMA", note: "Watch episodes and trailers" },
      { to: "/ranks", label: "RANKS", note: "Hall of fame, PvP and clans" },
    ],
  },
  {
    id: "account",
    label: "ME",
    note: "Your holdings, identity and developer resources",
    items: [
      { to: "/my-land", label: "MY BITMAPS", note: "BITMAPs held by your wallet" },
      { to: "/my-world", label: "MY WORLD", note: "Manage your BITMAPs and deployments" },
      { to: "/passport", label: "MY PASSPORT", note: "Stamps, proof and build unlocks" },
      { to: "/donate", label: "SHARE & FUEL", note: "Share BTC, collect BIT to use in the Oasis" },
      { to: "/docs", label: "DOCS", note: "Guides and references" },
      { to: "/sdk", label: "SDK", note: "Build for Bitcoin land" },
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const currentGroup = NAV_GROUPS.find((g) => g.items.some((i) => itemIsActive(i.to)));
  const currentItem = currentGroup?.items.find((i) => itemIsActive(i.to));
  useEffect(() => setMobileOpen(false), [pathname]);

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

      <nav className="relative border-t border-border lg:hidden" aria-label="Main navigation">
        <button
          type="button"
          aria-expanded={mobileOpen}
          onClick={() => {
            setMobileOpen((v) => !v);
            setMobileSection(currentGroup?.id ?? null);
          }}
          className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2"
        >
          <span className="flex min-w-0 items-center gap-2">
            {mobileOpen ? <X className="size-4 text-bitcoin" /> : <MenuIcon className="size-4" />}
            <span className="label">{mobileOpen ? "CLOSE MENU" : "MENU"}</span>
          </span>
          {currentItem && (
            <span className="label truncate text-bitcoin">
              {currentGroup?.label} · {currentItem.label}
            </span>
          )}
        </button>
        {mobileOpen && (
          <div className="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-8rem)] overflow-y-auto pb-24 shadow-lg border-t border-border bg-background">
            {NAV_GROUPS.map((group) => {
              const expanded = mobileSection === group.id;
              const hasCurrent = group.items.some((i) => itemIsActive(i.to));
              return (
                <section key={group.id} className="border-b border-border">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setMobileSection((v) => (v === group.id ? null : group.id))}
                    className={`flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left ${expanded ? "bg-surface" : ""}`}
                  >
                    <span className={hasCurrent ? "text-bitcoin" : "text-muted-foreground"}><GroupIcon id={group.id} /></span>
                    <span className="min-w-0 flex-1">
                      <span className={`label block ${hasCurrent ? "text-bitcoin" : "text-foreground"}`}>{group.label}</span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">{group.note}</span>
                    </span>
                    <span className="label text-[0.55rem] text-muted-foreground">{group.items.length}</span>
                    <ChevronDown className={`size-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </button>
                  {expanded && (
                    <ul className="pb-2">
                      {group.items.map((item) => {
                        const active = itemIsActive(item.to);
                        return (
                          <li key={item.to}>
                            <Link
                              to={item.to}
                              activeOptions={{ exact: true }}
                              onClick={() => setMobileOpen(false)}
                              aria-current={active ? "page" : undefined}
                              className={`group flex min-h-11 items-center gap-3 border-l-2 py-2 pl-5 pr-4 ${active ? "border-bitcoin bg-surface" : "border-transparent hover:bg-surface"}`}
                            >
                              <ItemIcon to={item.to} active={active} />
                              <span className="min-w-0 flex-1">
                                <span className={`label block ${active ? "text-bitcoin" : "text-foreground"}`}>{item.label}</span>
                                {item.note && <span className="block truncate text-[11px] text-muted-foreground">{item.note}</span>}
                              </span>
                              {active && <span className="label text-[0.5rem] text-bitcoin">YOU ARE HERE</span>}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </nav>
    </header>
  );
}

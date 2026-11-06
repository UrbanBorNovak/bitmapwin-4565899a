import { MonolithCell } from "@/components/brand/BrandMarks";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ChevronDown, HelpCircle, Search, X, Hammer, Compass, User,
  Layers, Sparkles, Globe, Swords, Radio, BookOpen, Building2, ArrowLeftRight, Backpack,
  Map as MapIcon, CalendarClock, History, Gift, Home, Users, Rocket, PenTool, Shield, Package,
  TrendingUp, Library, Trophy, Boxes, HardHat, BarChart3, Pickaxe, IdCard, BadgeCheck, Code2,
  FileText, Terminal, Wrench, ArrowRight, Clapperboard, Menu as MenuIcon, type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BidInboxBell } from "@/components/BidInboxBell";
import { HeaderIdentity } from "@/components/HeaderIdentity";
import { BtcTicker } from "@/components/BtcTicker";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { startGuidedTour } from "@/components/GuidedTour";

type NavItem = { to: string; label: string; note?: string; match?: string[] };
type NavSection = { title: string; items: NavItem[] };
type NavGroup = { id: string; label: string; note: string; sections: NavSection[] };

const GROUP_ICONS: Record<string, LucideIcon> = {
  world: Globe, land: MapIcon, creation: Hammer, identity: User, guides: BookOpen,
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
  "/kennels": Building2, "/toon": Clapperboard, "/clips": Clapperboard, "/build": Hammer,
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

// Five menus mirroring the homepage pillars and footer. Every page appears exactly once.
const NAV_GROUPS: NavGroup[] = [
  {
    id: "world",
    label: "WORLD",
    note: "Walk the Oasis, play, and see what the community is doing",
    sections: [
      {
        title: "PLAY",
        items: [
          { to: "/oasis", label: "ENTER THE OASIS", note: "Walk, drive, build and explore" },
          { to: "/biternam", label: "BITERNAM QUESTS", note: "Story chapters and quests" },
          { to: "/play", label: "LIVING CARDS", note: "The card game where the world is the deck" },
          { to: "/cities", label: "VISIT CITIES", note: "Districts inside the world", match: ["/map"] },
          { to: "/trading-post", label: "IN-WORLD TRADING POST", note: "Trade your Oasis items" },
        ],
      },
      {
        title: "COMMUNITY",
        items: [
          { to: "/explore", label: "TRENDING", note: "Trending BITMAPs and activity" },
          { to: "/stream", label: "WORLD STREAM", note: "Verified history as it happens" },
          { to: "/experiences", label: "EXPERIENCES", note: "Live deployed worlds" },
          { to: "/watch", label: "TOON CINEMA", note: "Episodes and trailers" },
          { to: "/ranks", label: "RANKS", note: "Hall of fame, PvP and clans" },
        ],
      },
    ],
  },
  {
    id: "land",
    label: "LAND",
    note: "Own, inspect and trade BITMAPs",
    sections: [
      {
        title: "MARKET",
        items: [
          { to: "/marketplace", label: "BITMAP MARKET", note: "Buy and sell BITMAPs" },
          { to: "/leases", label: "LEASES", note: "Rent BITMAPs by the day" },
          { to: "/history", label: "SALES HISTORY", note: "Confirmed on-chain sales" },
        ],
      },
      {
        title: "RECORDS",
        items: [
          { to: "/registry", label: "REGISTRY", note: "Look up any BITMAP's record" },
          { to: "/collections", label: "LAND CLUBS", note: "BITMAPs grouped by block range" },
          { to: "/ownership", label: "VERIFY OWNERSHIP", note: "Who holds a BITMAP on-chain" },
          { to: "/traits", label: "TRAITS", note: "Official BITMAP trait collections" },
          { to: "/archaeology", label: "ARCHAEOLOGY", note: "Block history and records" },
          { to: "/world-stats", label: "WORLD STATS", note: "BIT supply, prices and mining" },
        ],
      },
    ],
  },
  {
    id: "creation",
    label: "CREATION",
    note: "Build on your BITMAP, make media, deploy experiences",
    sections: [
      {
        title: "BUILD",
        items: [
          { to: "/studio", label: "BITMAPWIN STUDIO", note: "Creator home: build, script, publish, sell" },
          { to: "/build", label: "START BUILDING", note: "Solo, with crew, lightweight or Outpost" },
          { to: "/create", label: "CREATE WITH AI", note: "Describe it, get a working experience" },
          { to: "/tools", label: "ALL TOOLS", note: "Every free and on-chain tool" },
        ],
      },
      {
        title: "SHARE",
        items: [
          { to: "/builds", label: "COMMUNITY BUILDS", note: "Every public BITMAP build" },
          { to: "/builders", label: "BUILDERS", note: "People building on bedrock" },
          { to: "/extenders", label: "EXTENDERS", note: "Reusable world packages" },
          { to: "/play/extenders", label: "PFP EXTENDERS", note: "Optional Ordinals HTML card art" },
        ],
      },
    ],
  },
  {
    id: "identity",
    label: "IDENTITY",
    note: "Your holdings, Passport and Guardians",
    sections: [
      {
        title: "MINE",
        items: [
          { to: "/my-land", label: "MY BITMAPS", note: "BITMAPs held by your wallet" },
          { to: "/passport", label: "MY PASSPORT", note: "Stamps, proof and unlocks" },
          { to: "/inventory", label: "MY INVENTORY", note: "Gear, rations and collectibles" },
          { to: "/donate", label: "SHARE & FUEL", note: "Share BTC, collect BIT" },
        ],
      },
      {
        title: "GUARDIANS",
        items: [
          { to: "/mint", label: "MINT GUARDIAN", note: "Shielded Block-DNA ordinals" },
          { to: "/colony", label: "GUARDIAN AGENTS", note: "Your Guardians as helpers" },
          { to: "/command", label: "COMMAND CENTRE", note: "Patrols, marches and raids" },
          { to: "/breed", label: "BREEDING LAB", note: "Pair two Guardians, inscribe their pet" },
          { to: "/codex", label: "CODEX", note: "Field guide: creatures, cards, land" },
        ],
      },
    ],
  },
  {
    id: "guides",
    label: "GUIDES & CODE",
    note: "Learn the world, then build on it",
    sections: [
      {
        title: "GUIDES",
        items: [
          { to: "/land-101", label: "LAND 101", note: "What a BITMAP is and why it matters" },
          { to: "/guardians-guide", label: "GUARDIANS GUIDE", note: "How block data becomes a Guardian" },
          { to: "/play-guide", label: "PLAYER GUIDE", note: "Controls, devices and what to do" },
        ],
      },
      {
        title: "DEVELOPERS",
        items: [
          { to: "/docs", label: "DOCS & SDK", note: "Guides, SDK and API references" },
          { to: "/dev-tools", label: "DEVELOPER TOOLS", note: "Playground, MCP, AI" },
        ],
      },
    ],
  },
];
const groupItems = (g: NavGroup) => g.sections.flatMap((s) => s.items);

// Pages that live outside the menu but belong to one of its entries — the Atlas
// district and place chapters belong to VISIT CITIES. Keyed by the menu entry path.
const EXTRA_MATCH = new Map<string, string[]>();
for (const g of NAV_GROUPS) for (const s of g.sections) for (const i of s.items) if (i.match) EXTRA_MATCH.set(i.to, i.match);

export function SiteHeader() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desktopNavRef = useRef<HTMLElement | null>(null);

  // Hover-away closes, but only after a grace period so a pointer that briefly
  // leaves the trigger (mid-click, zoom rounding) never slams the menu shut.
  const cancelScheduledClose = () => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelScheduledClose();
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setOpenGroup(null);
    }, 220);
  };

  // Close on Escape and on clicks outside the desktop nav (a pinned menu still closes there).
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (desktopNavRef.current && !desktopNavRef.current.contains(e.target as Node)) setOpenGroup(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenGroup(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    };
  }, []);

  const [term, setTerm] = useState("");
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const itemIsActive = (to: string) =>
    [...(EXTRA_MATCH.get(to) ?? []), to].some(
      (p) => pathname === p || (p !== "/play" && pathname.startsWith(`${p}/`)),
    );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const currentGroup = NAV_GROUPS.find((g) => groupItems(g).some((i) => itemIsActive(i.to)));
  const currentItem = (currentGroup ? groupItems(currentGroup) : []).find((i) => itemIsActive(i.to));
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
        <Link to="/" aria-label="BITMAP UNHINGED home" className="site-brand max-md:@container flex min-w-0 items-center gap-2 leading-none">
          <MonolithCell className="size-7 shrink-0" />
          <div className="hidden min-w-0 @[6.5rem]:block md:block">
          <div className="display flex items-end gap-1 text-sm sm:text-base">
            <span className="text-bitcoin">BITMAP</span>
            <span className="relative hidden sm:inline">
              <span className="label absolute bottom-full left-0 mb-0.5 hidden text-[0.4rem] leading-none text-bitcoin md:block">
                BETA
              </span>
              UNHINGED
            </span>
          </div>
          <div className="label mt-1 hidden whitespace-nowrap text-[0.5rem] sm:block lg:hidden 2xl:block">BITCOIN-NATIVE WORLDS</div>
          </div>
        </Link>

        <nav ref={desktopNavRef} className="relative hidden" aria-label="Main navigation">
          {NAV_GROUPS.map((group) => {
            const here = groupItems(group).some((i) => itemIsActive(i.to));
            return (
            <div
              key={group.id}
              onMouseEnter={() => {
                cancelScheduledClose();
                setOpenGroup(group.id);
              }}
              onMouseLeave={scheduleClose}
            >
              <button
                type="button"
                aria-expanded={openGroup === group.id}
                // Hover already opens the menu; clicking the label must pin it open, never toggle it closed.
                onClick={() => {
                  cancelScheduledClose();
                  setOpenGroup(group.id);
                }}
              className={`nav-trigger label flex h-9 items-center gap-1 whitespace-nowrap px-2 py-2 xl:px-3 ${
                  openGroup === group.id ? "is-active border border-border text-foreground" : ""
                } ${here && openGroup !== group.id ? "is-here" : ""}`}
              >
                <span className="hidden 2xl:inline"><GroupIcon id={group.id} /></span>
                {group.label}
                <ChevronDown className="size-3" />
              </button>
              {openGroup === group.id && (
                <div className={`nav-menu absolute top-full border border-border bg-background left-0 w-[40rem]`}>
                  <div className="border-b border-border bg-surface px-4 py-3">
                    <div className="label text-bitcoin">{group.label}</div>
                    <div className="mt-1 font-mono text-[10px] leading-snug text-muted-foreground">{group.note}</div>
                  </div>
                  <div className={"grid grid-cols-2 divide-x divide-border"}>
                    {group.sections.map((section) => {
                      const compact = false;
                      const sectionHere = section.items.some((i) => itemIsActive(i.to));
                      return (
                        <div key={section.title} className="p-2">
                          <div className={`label flex items-center gap-1.5 px-2 pb-1 pt-1 text-[0.55rem] ${sectionHere ? "text-bitcoin" : "text-signal"}`}>
                            {sectionHere && <span className="size-1 shrink-0 rounded-full bg-bitcoin" aria-hidden="true" />}
                            {section.title}
                          </div>
                          {section.items.map((item) => {
                            const active = itemIsActive(item.to);
                            return (
                              <Link
                                key={item.to}
                                to={item.to}
                                activeOptions={{ exact: true }}
                                onClick={() => setOpenGroup(null)}
                                aria-current={active ? "page" : undefined}
                                title={item.note}
                                className={`nav-menu-item group block border px-2 ${compact ? "py-1.5" : "py-2"} ${active ? "border-bitcoin bg-surface" : "border-transparent hover:border-border hover:bg-surface"}`}
                              >
                                <div className="flex items-center gap-2">
                                  {compact ? null : <ItemIcon to={item.to} active={active} />}
                                  <div className="min-w-0">
                                    <div className={`label transition-transform group-hover:translate-x-0.5 ${active ? "text-bitcoin" : "text-foreground"}`}>{item.label}</div>
                                    {item.note && !compact && <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{item.note}</div>}
                                    {active && <div className="label mt-1 text-[0.5rem] text-bitcoin">YOU ARE HERE</div>}
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            );
          })}
          <Link to="/oasis" className="label ml-2 flex h-9 items-center gap-1 whitespace-nowrap border border-bitcoin bg-bitcoin px-3 py-2 text-primary-foreground hover:border-foreground hover:bg-foreground">
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
              const hasCurrent = groupItems(group).some((i) => itemIsActive(i.to));
              return (
                <section key={group.id} className="border-b border-border">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setMobileSection((v) => (v === group.id ? null : group.id))}
                    className={`flex min-h-12 w-full items-center gap-3 border-l-2 px-4 py-3 text-left ${hasCurrent ? "border-bitcoin" : "border-transparent"} ${expanded ? "bg-surface" : ""}`}
                  >
                    <span className={hasCurrent ? "text-bitcoin" : "text-muted-foreground"}><GroupIcon id={group.id} /></span>
                    <span className="min-w-0 flex-1">
                      <span className={`label block ${hasCurrent ? "text-bitcoin" : "text-foreground"}`}>{group.label}</span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">{group.note}</span>
                    </span>
                    {hasCurrent && <span className="label text-[0.5rem] text-bitcoin">HERE</span>}
                    <span className="label text-[0.55rem] text-muted-foreground">{groupItems(group).length}</span>
                    <ChevronDown className={`size-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </button>
                  {expanded && (
                    <div className="pb-2">
                      {group.sections.map((section) => {
                        const here = section.items.some((i) => itemIsActive(i.to));
                        return (
                        <div key={section.title}>
                          <div className={`label sticky top-0 z-10 flex items-center justify-between gap-2 border-y border-border bg-surface px-4 py-1.5 text-[0.55rem] ${here ? "text-bitcoin" : "text-signal"}`}>
                            <span className="flex items-center gap-1.5">
                              {here && <span className="size-1 shrink-0 rounded-full bg-bitcoin" aria-hidden="true" />}
                              {section.title}
                            </span>
                            <span className="font-mono text-[0.5rem] text-muted-foreground">{here ? "YOU ARE HERE" : section.items.length}</span>
                          </div>
                          <ul>
                            {section.items.map((item) => {
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
                        </div>
                        );
                      })}
                    </div>
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

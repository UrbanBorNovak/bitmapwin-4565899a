import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Search, X } from "lucide-react";
import { useState } from "react";
import { BidInboxBell } from "@/components/BidInboxBell";
import { HeaderIdentity } from "@/components/HeaderIdentity";
import { BtcTicker } from "@/components/BtcTicker";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type NavItem = { to: string; label: string; note?: string };
type NavGroup = { id: string; label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    id: "world",
    label: "WORLD",
    items: [
      { to: "/map", label: "MAP", note: "1,000 × 1,000 live world" },
      { to: "/cities", label: "CITIES", note: "Districts and city hubs" },
      { to: "/explore", label: "EXPLORE", note: "Trending land and activity" },
    ],
  },
  {
    id: "build",
    label: "BUILD",
    items: [
      { to: "/my-world", label: "MY WORLD", note: "Your land and deployments" },
      { to: "/builds", label: "BUILDS", note: "On-chain 3D model registry" },
      { to: "/extend", label: "EXTEND", note: "Deploy software on land" },
      { to: "/studio", label: "STUDIO", note: "Extender code workbench" },
    ],
  },
  {
    id: "market",
    label: "MARKET",
    items: [
      { to: "/marketplace", label: "MARKETPLACE", note: "Buy and sell BITMAPs" },
      { to: "/extenders", label: "EXTENDERS", note: "Packages that run on land" },
      { to: "/experiences", label: "EXPERIENCES", note: "Live deployed worlds" },
      { to: "/builders", label: "BUILDERS", note: "Who ships on bedrock" },
    ],
  },
  {
    id: "land",
    label: "LAND",
    items: [
      { to: "/my-land", label: "MY LAND", note: "BITMAPs your wallet holds" },
      { to: "/leases", label: "LEASES", note: "Rent land by the day" },
      { to: "/ownership", label: "OWNERSHIP", note: "First-is-first, on chain" },
      { to: "/history", label: "HISTORY", note: "Confirmed chain sales" },
    ],
  },
  {
    id: "develop",
    label: "DEVELOP",
    items: [
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
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto grid max-w-[1600px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-2.5 md:flex md:justify-between md:gap-4 md:px-8 md:py-3">
        <Link to="/" className="min-w-0 leading-none">
          <div className="display flex items-end gap-1 text-sm sm:text-base md:text-lg">
            <span>BITMAP</span>
            <span className="relative">
              <span className="label absolute bottom-full left-0 mb-0.5 text-[0.4rem] leading-none text-bitcoin">
                ALPHA
              </span>
              UNHINGED
            </span>
          </div>
          <div className="label mt-1 hidden sm:block">BITCOIN LAND BEDROCK</div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
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
                className={`label flex items-center gap-1 px-3 py-2 transition-colors hover:text-foreground ${
                  openGroup === group.id ? "border border-border text-foreground" : ""
                }`}
              >
                {group.label}
                <ChevronDown className="size-3" />
              </button>
              {openGroup === group.id && (
                <div className="absolute left-0 top-full min-w-64 border border-border bg-background shadow-[4px_4px_0_0_hsl(var(--border))]">
                  {group.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpenGroup(null)}
                      className="block border-b border-border px-4 py-3 last:border-b-0 hover:bg-secondary"
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

        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          <BtcTicker className="hidden sm:flex" />
          <ThemeToggle />
          <LanguageSwitcher />
          <button
            aria-label="Search bitmaps"
            onClick={() => setSearchOpen((v) => !v)}
            className="grid size-11 shrink-0 place-items-center border border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground md:size-9"
          >
            {searchOpen ? <X className="size-4" /> : <Search className="size-4" />}
          </button>
          <BidInboxBell />
          <HeaderIdentity />
        </div>
      </div>

      {searchOpen && (
        <form onSubmit={submit} className="border-t border-border px-4 py-3 md:px-8">
          <input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search a block number, e.g. 840000"
            className="w-full bg-background font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </form>
      )}

      <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-2 lg:hidden">
        {NAV_GROUPS.flatMap((g) => g.items).map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="label shrink-0 px-2 py-2"
            activeProps={{ className: "text-foreground" }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

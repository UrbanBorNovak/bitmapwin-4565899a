import { Link, useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useState } from "react";
import { BidInboxBell } from "@/components/BidInboxBell";
import { HeaderIdentity } from "@/components/HeaderIdentity";
import { BtcTicker } from "@/components/BtcTicker";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV = [
  { to: "/marketplace", label: "MARKETPLACE" },
  { to: "/builds", label: "BUILDS" },
  { to: "/leases", label: "LEASES" },
  { to: "/land-101", label: "LAND 101" },
] as const;


export function SiteHeader() {
  const [searchOpen, setSearchOpen] = useState(false);
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
          <div className="label mt-1 hidden sm:block">BITCOIN DIGITAL LAND</div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="label px-3 py-2 transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground border border-border" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          <BtcTicker className="hidden sm:flex" />
          <ThemeToggle />
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
        {NAV.map((item) => (
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

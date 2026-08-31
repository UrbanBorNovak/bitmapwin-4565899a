import { Link, useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useState } from "react";
import { BidInboxBell } from "@/components/BidInboxBell";
import { HeaderIdentity } from "@/components/HeaderIdentity";

const NAV = [
  { to: "/explore", label: "EXPLORE" },
  { to: "/marketplace", label: "MARKETPLACE" },
  { to: "/collections", label: "COLLECTIONS" },
  { to: "/builds", label: "BUILDS" },

  { to: "/map", label: "MAP" },
  { to: "/activity", label: "ACTIVITY" },
  { to: "/extractor", label: "EXTRACTOR" },
  { to: "/bitmaps", label: "REGISTRY" },
  { to: "/wallet", label: "WALLET" },
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
      navigate({ to: "/explore", search: { q } });
    }
    setSearchOpen(false);
    setTerm("");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Link to="/" className="shrink-0 leading-none">
          <div className="display text-base md:text-lg">BITMAP MARKETPLACE</div>
          <div className="label mt-1">BITCOIN DIGITAL LAND</div>
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

        <div className="flex items-center gap-2">
          <button
            aria-label="Search bitmaps"
            onClick={() => setSearchOpen((v) => !v)}
            className="border border-border p-2 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
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
            placeholder="Search block number, inscription or owner..."
            className="w-full bg-background font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </form>
      )}

      <nav className="flex items-center justify-between gap-1 border-t border-border px-4 py-2 lg:hidden">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="label px-2 py-1"
            activeProps={{ className: "text-foreground" }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

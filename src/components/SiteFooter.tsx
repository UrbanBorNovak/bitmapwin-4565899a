import { Link } from "@tanstack/react-router";

const GROUPS: { label: string; items: { to: string; label: string }[] }[] = [
  {
    label: "PLAY",
    items: [
      { to: "/oasis", label: "ENTER THE OASIS" },
      { to: "/play", label: "LIVING CARDS" },
      { to: "/play-guide", label: "PLAYER GUIDE" },
      { to: "/cities", label: "VISIT CITIES" },
      { to: "/trading-post", label: "IN-WORLD TRADING POST" },
      { to: "/inventory", label: "MY INVENTORY" },
    ],
  },
  {
    label: "TRADE",
    items: [
      { to: "/marketplace", label: "BITMAP MARKET" },
      { to: "/leases", label: "LEASES" },
      { to: "/history", label: "SALES HISTORY" },
    ],
  },
  {
    label: "CREATE",
    items: [
      { to: "/my-world", label: "MY WORLD" },
      { to: "/builds", label: "3D BUILDS" },
      { to: "/extend", label: "DEPLOY" },
      { to: "/studio", label: "STUDIO" },
      { to: "/mint", label: "MINT GUARDIAN" },
      { to: "/forge", label: "LAND FORGE" },
      { to: "/breed", label: "BREED PETS" },
      { to: "/extenders", label: "EXTENDERS" },
      { to: "/store-kit", label: "TINY STORE KIT" },
      { to: "/tiny-studio", label: "TINY STUDIO" },
    ],
  },
  {
    label: "DISCOVER",
    items: [
      { to: "/explore", label: "EXPLORE" },
      { to: "/experiences", label: "EXPERIENCES" },
      { to: "/builders", label: "BUILDERS" },
      { to: "/world-stats", label: "WORLD STATS" },
    ],
  },
  {
    label: "ACCOUNT",
    items: [
      { to: "/my-land", label: "MY BITMAPS" },
      { to: "/ownership", label: "OWNERSHIP" },
      { to: "/sdk", label: "SDK" },
      { to: "/docs", label: "DOCS" },
      { to: "/api", label: "API" },
      { to: "/dev-tools", label: "DEVELOPER TOOLS" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="site-footer border-t border-border px-4 pt-6 pb-24 md:px-5">
      <div className="mx-auto max-w-[1600px]">
        <nav className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
          {GROUPS.map((g) => (
            <div key={g.label} className="bg-background p-4">
              <div className="label text-foreground">{g.label}</div>
              <ul className="mt-3 space-y-1.5">
                {g.items.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className="footer-link label text-[0.6rem]">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 md:flex-row md:items-center md:justify-between">
          <div className="display text-xs"><Link to="/collections" className="text-primary hover:text-foreground">THE OTHERTHINGS</Link> · BITMAPWIN · THE INTERNET, BUT WITH LAND · <Link to="/novelty" className="text-signal hover:text-foreground">NOVELTY ON BITCOIN</Link> · <Link to="/beta" className="text-bitcoin hover:text-foreground">BETA 0.9</Link></div>
          <div className="label">
            REAL BLOCKS · LIVE ORDINALS · ON-CHAIN OWNERSHIP
            <span className="blink ml-2 text-foreground">_</span>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 label text-[0.6rem]">
          <span>LIVEOCI INDEXING &amp; ON-CHAIN BITMON BY{" "}
            <a href="https://x.com/boppleton" target="_blank" rel="noreferrer" className="text-primary hover:text-foreground">@BOPPLETON</a></span>
          <span aria-hidden>·</span>
          <span>BOT STARTER KIT ON{" "}
            <a href="https://github.com/UrbanBorNovak/bitmapwin-bot-starter" target="_blank" rel="noreferrer" className="text-signal hover:text-foreground">GITHUB</a></span>
          <span aria-hidden>·</span>
          <Link to="/store-kit" className="text-signal hover:text-foreground">STORE KIT</Link>
          <span aria-hidden>·</span>
          <Link to="/tiny-studio" className="text-signal hover:text-foreground">TINY STUDIO</Link>
          <span aria-hidden>·</span>
          <Link to="/docs" hash="tiny-tools" className="text-signal hover:text-foreground">TOOL DOCS</Link>
        </div>
      </div>
    </footer>
  );
}

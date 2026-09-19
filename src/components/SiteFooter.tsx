import { Link } from "@tanstack/react-router";
import { SPRITES, SpriteCritter } from "@/components/SpriteCritter";

const GROUPS: { label: string; items: { to: string; label: string }[] }[] = [
  {
    label: "PLAY",
    items: [
      { to: "/map", label: "ENTER THE OASIS" },
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
      { to: "/extenders", label: "EXTENDERS" },
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
    <footer className="site-footer border-t border-border px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1600px]">
        <nav className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <div className="label text-bitcoin">{g.label}</div>
              <ul className="mt-3 space-y-2">
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
        <div className="mt-8 flex flex-col gap-2 border-t border-border pt-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <SpriteCritter sheet={SPRITES[2]!} height={44} className="animate-sprite-bob shrink-0" />
            <div className="display text-sm">THE BEDROCK FOR AI-BUILT WORLDS</div>
          </div>
          <div className="label">
            REAL BLOCKS · LIVE ORDINALS · ON-CHAIN OWNERSHIP
            <span className="blink ml-2 text-foreground">_</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

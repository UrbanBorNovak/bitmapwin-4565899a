import { Link } from "@tanstack/react-router";

const GROUPS: { label: string; items: { to: string; label: string }[] }[] = [
  {
    label: "WORLD",
    items: [
      { to: "/map", label: "MAP" },
      { to: "/cities", label: "CITIES" },
      { to: "/explore", label: "EXPLORE" },
    ],
  },
  {
    label: "BUILD",
    items: [
      { to: "/my-world", label: "MY WORLD" },
      { to: "/builds", label: "BUILDS" },
      { to: "/extend", label: "EXTEND" },
      { to: "/studio", label: "STUDIO" },
    ],
  },
  {
    label: "MARKET",
    items: [
      { to: "/marketplace", label: "MARKETPLACE" },
      { to: "/extenders", label: "EXTENDERS" },
      { to: "/experiences", label: "EXPERIENCES" },
      { to: "/builders", label: "BUILDERS" },
    ],
  },
  {
    label: "LAND",
    items: [
      { to: "/my-land", label: "MY LAND" },
      { to: "/leases", label: "LEASES" },
      { to: "/ownership", label: "OWNERSHIP" },
      { to: "/history", label: "HISTORY" },
    ],
  },
  {
    label: "DEVELOP",
    items: [
      { to: "/sdk", label: "SDK" },
      { to: "/docs", label: "DOCS" },
      { to: "/api", label: "API" },
      { to: "/dev-tools", label: "DEVELOPER TOOLS" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1600px]">
        <nav className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <div className="label text-bitcoin">{g.label}</div>
              <ul className="mt-3 space-y-2">
                {g.items.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className="label text-[0.6rem] hover:text-foreground">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mt-8 flex flex-col gap-2 border-t border-border pt-6 md:flex-row md:items-center md:justify-between">
          <div className="display text-sm">THE BEDROCK FOR AI-BUILT WORLDS</div>
          <div className="label">
            REAL BLOCKS · LIVE ORDINALS · ON-CHAIN OWNERSHIP
            <span className="blink ml-2 text-foreground">_</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

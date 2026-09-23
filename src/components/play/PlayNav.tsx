import { Link } from "@tanstack/react-router";

const LINKS = [
  { to: "/play", label: "LOBBY" },
  { to: "/play/cards", label: "MY CARDS" },
  { to: "/play/atlas", label: "CARD ATLAS" },
  { to: "/play/extenders", label: "PFP EXTENDERS" },
] as const;

export function PlayNav() {
  return (
    <nav className="flex gap-px overflow-x-auto border border-border bg-border" aria-label="Play">
      {LINKS.map((l) => (
        <Link key={l.to} to={l.to} activeOptions={{ exact: true }} activeProps={{ "aria-current": "page", className: "text-bitcoin" }} className="label shrink-0 bg-card px-4 py-2.5 hover:text-bitcoin">
          {l.label}
        </Link>
      ))}
      <Link to="/oasis" className="label ml-auto shrink-0 bg-card px-4 py-2.5 hover:text-bitcoin">THE OASIS ↗</Link>
    </nav>
  );
}

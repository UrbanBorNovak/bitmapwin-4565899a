import { Link } from "@tanstack/react-router";
import { clubOf } from "@/lib/clubs";

/** Collection ("club") chip for a bitmap, derived from its block height. */
export function ClubBadge({
  height,
  className = "",
  asLink = true,
}: {
  height: number;
  className?: string;
  /** Set false when the badge sits inside another link — links cannot nest. */
  asLink?: boolean;
}) {
  const club = clubOf(height);
  const chip = `inline-block border border-primary px-1.5 py-0.5 font-mono text-[9px] uppercase text-primary transition-colors ${className}`;

  if (!asLink) {
    return (
      <span className={chip} title={`${club.label} — ${club.blurb}`}>
        {club.short}
      </span>
    );
  }

  return (
    <Link
      to="/collections/$club"
      params={{ club: club.id }}
      className={`${chip} hover:bg-primary hover:text-primary-foreground`}
      title={`${club.label} — ${club.blurb}`}
    >
      {club.short}
    </Link>
  );
}

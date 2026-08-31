import { Link } from "@tanstack/react-router";
import { clubOf } from "@/lib/clubs";

/** Collection ("club") chip for a bitmap, derived from its block height. */
export function ClubBadge({ height, className = "" }: { height: number; className?: string }) {
  const club = clubOf(height);
  return (
    <Link
      to="/collections/$club"
      params={{ club: club.id }}
      className={`inline-block border border-primary px-1.5 py-0.5 font-mono text-[9px] uppercase text-primary transition-colors hover:bg-primary hover:text-primary-foreground ${className}`}
      title={`${club.label} — ${club.blurb}`}
    >
      {club.short}
    </Link>
  );
}

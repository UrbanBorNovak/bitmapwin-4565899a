import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { parcelClubBadgesQuery, parcelClubById } from "@/lib/parcel-clubs";

/**
 * Parcel club badges earned by an address: one chip per club whose parent
 * BITMAP holds a valid parcel in this wallet, with the parcel names that prove
 * it. Nothing is shown until real parcel ownership is read from chain.
 */
export function ParcelClubBadges({
  address,
  className = "",
}: {
  address: string | null;
  className?: string;
}) {
  const badges = useQuery(parcelClubBadgesQuery(address));
  const earned = badges.data ?? [];
  if (!address || earned.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {earned.map((membership) => {
        const club = parcelClubById(membership.clubId);
        if (!club) return null;
        const names = membership.parcels
          .slice(0, 6)
          .map((parcel) => `${parcel.index}.${membership.height}.bitmap`)
          .join(", ");
        return (
          <Link
            key={membership.clubId}
            to="/bitmap/$block"
            params={{ block: String(membership.height) }}
            title={`${club.label} — ${club.blurb} Parcels held: ${names}`}
            className="inline-flex items-center gap-1.5 border border-bitcoin px-2 py-1 font-mono text-[9px] uppercase text-bitcoin transition-colors hover:bg-bitcoin hover:text-background"
          >
            <span data-no-translate>{club.label}</span>
            <span className="tabular-nums opacity-70" data-no-translate>
              ×{membership.parcels.length}
            </span>
            <span aria-hidden>✓</span>
          </Link>
        );
      })}
    </div>
  );
}

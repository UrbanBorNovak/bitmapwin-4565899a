import { useQueries } from "@tanstack/react-query";
import { GALLERY_COLLECTIONS, galleriesFor, type GalleryCollection } from "@/lib/bitmap-collections";
import { galleryMembersQuery } from "@/lib/gallery";
import { ordContentUrl } from "@/lib/oci";

/**
 * Chips for the inscribed gallery collections a bitmap belongs to, each with
 * its real on-chain cover art.
 *
 * Membership is verified against the inscribed galleries themselves: each
 * gallery's reveal transaction lists its members, so a chip marked with a tick
 * is confirmed on chain. While a gallery is still loading (or if the index is
 * busy) the fixed pattern rules — block number, transaction count, render
 * shape — decide the chips instead.
 */
export function GalleryBadges({
  height,
  txCount,
  sides = null,
  className = "",
}: {
  height: number;
  txCount: number | null;
  /** per-transaction renderer square sides, for the shape-based punk rules */
  sides?: number[] | null;
  className?: string;
}) {
  const heuristic = galleriesFor(height, txCount, sides);
  const results = useQueries({
    queries: GALLERY_COLLECTIONS.map((collection) => galleryMembersQuery(collection.coverInscription)),
  });

  const chips: { collection: GalleryCollection; verified: boolean }[] = [];
  GALLERY_COLLECTIONS.forEach((collection, index) => {
    const members = results[index]?.data;
    if (members && members.heights.length > 0) {
      if (members.heights.includes(height)) chips.push({ collection, verified: true });
      return;
    }
    if (heuristic.some((entry) => entry.id === collection.id)) {
      chips.push({ collection, verified: false });
    }
  });

  if (chips.length === 0) return null;
  return (
    <>
      {chips.map(({ collection, verified }) => (
        <a
          key={collection.id}
          href={`https://ordinals.com/inscription/${collection.coverInscription}`}
          target="_blank"
          rel="noreferrer"
          title={`${collection.label} — ${collection.blurb}${verified ? " (confirmed on chain)" : ""}`}
          className={`inline-flex items-center gap-1.5 border border-bitcoin px-1.5 py-0.5 font-mono text-[9px] uppercase text-bitcoin transition-colors hover:bg-bitcoin hover:text-background ${className}`}
        >
          <img
            src={ordContentUrl(collection.coverInscription)}
            alt=""
            aria-hidden
            loading="lazy"
            className="h-3 w-3 [image-rendering:pixelated]"
          />
          <span data-no-translate>{collection.short}</span>
          {verified ? <span aria-hidden>✓</span> : null}
        </a>
      ))}
    </>
  );
}

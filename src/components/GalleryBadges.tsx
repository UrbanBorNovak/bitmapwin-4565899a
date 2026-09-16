import { galleriesFor } from "@/lib/bitmap-collections";
import { ordContentUrl } from "@/lib/oci";

/**
 * Chips for the inscribed gallery collections a bitmap belongs to, each with
 * its real on-chain cover art. Patterns are fixed on chain, so these never
 * change once a block exists.
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
  const galleries = galleriesFor(height, txCount, sides);
  if (galleries.length === 0) return null;
  return (
    <>
      {galleries.map((gallery) => (
        <a
          key={gallery.id}
          href={`https://ordinals.com/inscription/${gallery.coverInscription}`}
          target="_blank"
          rel="noreferrer"
          title={`${gallery.label} — ${gallery.blurb}`}
          className={`inline-flex items-center gap-1.5 border border-bitcoin px-1.5 py-0.5 font-mono text-[9px] uppercase text-bitcoin transition-colors hover:bg-bitcoin hover:text-background ${className}`}
        >
          <img
            src={ordContentUrl(gallery.coverInscription)}
            alt=""
            aria-hidden
            loading="lazy"
            className="h-3 w-3 [image-rendering:pixelated]"
          />
          <span data-no-translate>{gallery.short}</span>
        </a>
      ))}
    </>
  );
}

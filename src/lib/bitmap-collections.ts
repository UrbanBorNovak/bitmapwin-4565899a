/**
 * Inscribed gallery collections — pattern collections whose membership can
 * never change, because they are decided by facts already fixed on chain: the
 * block number, or the block's render shape.
 *
 * Each entry points at the real inscribed gallery cover, all six of them
 * children of
 * 609b51c4512411e2726637f404a3a8ebc309dc29600a30ba3edcf61d4312d407i0.
 *
 * The punk rules use the canonical bitmap renderer scale: every transaction
 * becomes an orange square whose side is `ceil(log10(total_sats)) - 5`
 * (minimum 1), packed Mondrian-style. The three two-transaction punks are
 * distinguished purely by the neck square's side: 2 = pristine, 3 = standard,
 * 4 = wide neck. Verified against reference blocks 78319 (pristine) and
 * 84534 (wide neck). Change a rule in one place here and every badge on the
 * site follows.
 */

export const GALLERY_PARENT_INSCRIPTION =
  "609b51c4512411e2726637f404a3a8ebc309dc29600a30ba3edcf61d4312d407i0";

export type GalleryCollection = {
  id: string;
  label: string;
  short: string;
  /** inscribed cover art of the gallery */
  coverInscription: string;
  blurb: string;
  /** exact transaction count a block must have, when the rule is tx based */
  txCount?: number;
  /**
   * the exact two square sides (sorted) a two-transaction block must render
   * with, on the bitmap renderer scale — the shape the silhouette is cut on
   */
  sidePair?: [number, number];
  /** inclusive block-number range, when the rule is number based */
  maxHeight?: number;
};

/** Bop's inscribed on-chain getGallery(id) reader. */
export const GET_GALLERY_FUNCTION_INSCRIPTION =
  "609ae74a6d2dac910a077220dd5d67e2787b1c922b0ea8d64837610cf296d059i0";

export const GALLERY_COLLECTIONS: GalleryCollection[] = [
  {
    id: "999-club",
    label: "999 CLUB",
    short: "999 CLUB",
    coverInscription: "999bbd123e327789d9b0991a73bb76385b7d9f3d99828576d6b2b0cb8c3cdfdei0",
    blurb: "Every BITMAP from block 0 to block 999.",
    maxHeight: 999,
  },
  {
    id: "pristine-punks",
    label: "PRISTINE PUNKS",
    short: "PRISTINE PUNK",
    coverInscription: "52bb90c60b0c4cb1518dfd797381429e21777cf22001b8916d5d29f2d501747bi0",
    blurb: "Two transactions: a clean head over a narrow neck.",
    txCount: 2,
    sidePair: [2, 5],
  },
  {
    id: "standard-punks",
    label: "STANDARD PUNKS",
    short: "STANDARD PUNK",
    coverInscription: "53bb821884ebf674bbe646173de5a29607932541b73271d0058d362142e551b3i0",
    blurb: "Two transactions: the neck packs at three fifths of the head.",
    txCount: 2,
    sidePair: [3, 5],
  },
  {
    id: "wide-neck-punks",
    label: "WIDE NECK PUNKS",
    short: "WIDE NECK",
    coverInscription: "54bb94b28c03ec91c83366ab5a5b82fd082a930b8382911b4cbe4a648544f40ai0",
    blurb: "Two transactions: the neck comes out four fifths as wide as the head.",
    txCount: 2,
    sidePair: [4, 5],
  },
  {
    id: "5tx-perfect-punks",
    label: "5TX PERFECT PUNKS",
    short: "5TX PUNK",
    coverInscription: "5555ecd52e738e5a32a926a25c83e6fb3c0536a9b5eb8e80c03b18e8ef08d70fi0",
    blurb: "Exactly five transactions — a perfectly packed punk.",
    txCount: 5,
  },
  {
    id: "7tx-perfect-punks",
    label: "7TX PERFECT PUNKS",
    short: "7TX PUNK",
    coverInscription: "77775e67fa7b257e126add77e12fedb48e32f885c9f3e03ab64aea2c5ebf6041i0",
    blurb: "Exactly seven transactions — a perfectly packed punk.",
    txCount: 7,
  },
];

/**
 * Every gallery collection a bitmap belongs to. `txCount` comes from the block
 * itself, so pass null while it is still loading. `sides` are the block's
 * per-transaction renderer square sides (only needed for two-transaction
 * blocks); pass null while unknown — the shape punks stay hidden until the
 * real shape is in hand.
 */
export function galleriesFor(
  height: number,
  txCount: number | null,
  sides?: number[] | null,
): GalleryCollection[] {
  const sorted =
    sides && sides.length ? [...sides].sort((a, b) => a - b) : null;
  return GALLERY_COLLECTIONS.filter((c) => {
    if (c.maxHeight !== undefined) return height <= c.maxHeight;
    if (c.sidePair) {
      return (
        txCount === 2 &&
        !!sorted &&
        sorted.length === 2 &&
        sorted[0] === c.sidePair[0] &&
        sorted[1] === c.sidePair[1]
      );
    }
    if (c.txCount !== undefined) return txCount !== null && txCount === c.txCount;
    return false;
  });
}

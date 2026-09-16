/**
 * Inscribed gallery collections — pattern collections whose membership can
 * never change, because they are decided by facts already fixed on chain: the
 * block number, or the number of transactions in the block (which decides the
 * shape a bitmap renders as).
 *
 * Each entry points at the real inscribed gallery cover, all six of them
 * children of
 * 609b51c4512411e2726637f404a3a8ebc309dc29600a30ba3edcf61d4312d407i0.
 *
 * The transaction counts below are the collection rules; change the number in
 * one place here and every badge on the site follows.
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
  /** inclusive block-number range, when the rule is number based */
  maxHeight?: number;
};

export const GALLERY_COLLECTIONS: GalleryCollection[] = [
  {
    id: "999-club",
    label: "999 CLUB",
    short: "999",
    coverInscription: "999bbd123e327789d9b0991a73bb76385b7d9f3d99828576d6b2b0cb8c3cdfdei0",
    blurb: "The first thousand blocks ever mined — three digits or fewer, forever.",
    maxHeight: 999,
  },
  {
    id: "pristine-punks",
    label: "PRISTINE PUNKS",
    short: "PRISTINE PUNK",
    coverInscription: "52bb90c60b0c4cb1518dfd797381429e21777cf22001b8916d5d29f2d501747bi0",
    blurb: "Two transactions: a clean head over a narrow neck.",
    txCount: 2,
  },
  {
    id: "standard-punks",
    label: "STANDARD PUNKS",
    short: "STANDARD PUNK",
    coverInscription: "53bb821884ebf674bbe646173de5a29607932541b73271d0058d362142e551b3i0",
    blurb: "Three transactions packing into the classic punk silhouette.",
    txCount: 3,
  },
  {
    id: "wide-neck-punks",
    label: "WIDE NECK PUNKS",
    short: "WIDE NECK",
    coverInscription: "54bb94b28c03ec91c83366ab5a5b82fd082a930b8382911b4cbe4a648544f40ai0",
    blurb: "Four transactions: the neck comes out as wide as the jaw.",
    txCount: 4,
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
    coverInscription: "999bbd123e327789d9b0991a73bb76385b7d9f3d99828576d6b2b0cb8c3cdfdei0",
    blurb: "Exactly seven transactions — a perfectly packed punk.",
    txCount: 7,
  },
];

// The 7tx cover is its own inscription; keep it explicit rather than reusing.
GALLERY_COLLECTIONS[5]!.coverInscription =
  "77775e67fa7b257e126add77e12fedb48e32f885c9f3e03ab64aea2c5ebf6041i0";

/**
 * Every gallery collection a bitmap belongs to. `txCount` comes from the block
 * itself, so pass null while it is still loading.
 */
export function galleriesFor(height: number, txCount: number | null): GalleryCollection[] {
  return GALLERY_COLLECTIONS.filter((c) => {
    if (c.maxHeight !== undefined) return height <= c.maxHeight;
    if (c.txCount !== undefined) return txCount !== null && txCount === c.txCount;
    return false;
  });
}

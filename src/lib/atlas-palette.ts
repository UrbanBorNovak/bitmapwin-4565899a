/**
 * ATLAS PALETTE — the painted colours of the illustrated atlas map, shared with
 * the 3D world so THE OASIS reads as the same place as /map.
 *
 * Sampled from the atlas artwork: hazy warm sky, turquoise shallows and deeper
 * teal water, lush layered forest greens, sunlit ochre drylands to the east,
 * pale slate rock and warm chalk peaks.
 */
export const ATLAS = {
  /** Horizon haze and scene background. */
  sky: "#cfe0e6",
  /** Sun-warmed distance wash. */
  haze: "#e6dcc6",
  /** Open dryland floor. */
  sand: "#d8b478",
  /** Beaches where land meets water. */
  beach: "#e7d2a0",
  /** Grass lowlands. */
  grass: "#6f9c50",
  /** Deep forest canopy. */
  forest: "#456f3c",
  /** Sunlit leaf tops. */
  leaf: "#8ab85a",
  /** Exposed rock. */
  rock: "#a9b2b3",
  /** Warm chalk summits. */
  peak: "#e9e6d8",
  /** Shallow turquoise water. */
  shallow: "#63c4cb",
  /** Deeper water. */
  water: "#2f8ea8",
  /** Hairline map linework. */
  grid: "#9aa896",
  /** Painted timber and trunks. */
  timber: "#7c5a3a",
} as const;

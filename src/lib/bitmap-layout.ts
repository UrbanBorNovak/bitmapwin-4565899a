import MondrianLayout, { type Slot } from "@/lib/mondrian";

/** Deterministic 32-bit hash of a number seed. */
function hash32(seed: number): number {
  let h = seed ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic list of parcel sizes for a block, mimicking the vbyte
 * distribution of real Bitcoin transactions (many small, few large).
 * Order is preserved — the Mondrian packing places transactions in block order.
 */
export function blockParcelSizes(blockHeight: number, txCount?: number | null): number[] {
  const h = hash32(blockHeight);
  const rand = mulberry32(h);
  const count = Math.max(40, Math.min(txCount ?? 120 + (h % 240), 600));
  const sizes: number[] = [];

  for (let i = 0; i < count; i++) {
    const r = rand();
    let size = 1;
    if (r > 0.985) size = 5;
    else if (r > 0.95) size = 4;
    else if (r > 0.86) size = 3;
    else if (r > 0.6) size = 2;
    sizes.push(size);
  }

  return sizes;
}

export type BlockLayout = {
  /** side of the packing square */
  width: number;
  /** rows actually used by placed squares */
  height: number;
  parcels: Slot[];
};

/** Mondrian packing of a block's transactions into square parcels. */
export function blockLayout(blockHeight: number, txCount?: number | null): BlockLayout {
  return layoutFromSizeClasses(blockParcelSizes(blockHeight, txCount));
}

/**
 * Real transaction vbytes → square parcel sizes, bitfeed-style: each parcel's
 * side grows with the log of the transaction's vsize. Block order preserved.
 */
export function parcelSizesFromVsizes(vsizes: number[]): number[] {
  return vsizes.map((vsize) => {
    const side = Math.floor(Math.log2(Math.max(1, vsize) / 180)) + 1;
    return Math.max(1, Math.min(8, side));
  });
}

/** Mondrian packing driven by real per-transaction vbytes from the chain. */
export function layoutFromVsizes(vsizes: number[]): BlockLayout {
  return layoutFromSizeClasses(parcelSizesFromVsizes(vsizes));
}

/**
 * Mondrian packing from precomputed size classes — the one-byte-per-transaction
 * payload served by /api/public/blocks/:height. Transactions keep their block
 * order; sorting them would change the canonical layout.
 */
export function layoutFromSizeClasses(classes: number[]): BlockLayout {
  const sizes = classes.map((c) => Math.max(1, Math.min(8, Math.round(c) || 1)));
  if (sizes.length === 0) return { width: 1, height: 1, parcels: [] };
  const layout = new MondrianLayout(sizes);
  return {
    width: Math.max(1, layout.width),
    height: Math.max(1, layout.height),
    parcels: layout.slots,
  };
}

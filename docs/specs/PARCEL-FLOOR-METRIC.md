# Parcel Floor Metric

Status: Stable · Reference: `src/lib/forge-parcels.ts`

A BITMAP is a block, and each of its transactions is a parcel (`<index>.<height>.bitmap`). This metric decides which parcel owns which tile.

- The canvas is a **64×64 cell grid**; the block's Mondrian layout places one rectangle per transaction.
- Each cell has **exactly one owner**: the parcel with the largest true Mondrian coverage of that cell. Ties go to the lower tx index.
- A parcel's footprint is its Mondrian rect, **at least 1×1** (scaled ×span/64 on XL).
- Height is the full canvas ceiling (air rights), whatever the footprint.
- A verified parcel build replaces the district build **only inside its own rect**. It is hard-clipped both when inscribed and when rendered.
- The `bitmapwin-parcel` metadata must equal the rect derived for that index.

Every viewer re-derives the same bounds from block math alone, without trusting any server.

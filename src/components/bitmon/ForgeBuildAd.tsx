import { Link } from "@tanstack/react-router";

/** Promo beside the Guardian awaken flow: inscribe a voxel build onto the same BITMAP. */
export function ForgeBuildAd({ height }: { height?: number }) {
  return (
    <aside aria-label="Inscribe your voxel build" className="panel mt-6 flex flex-wrap items-center justify-between gap-4 rounded-md border border-signal/50 p-4">
      <div className="min-w-0 max-w-2xl">
        <p className="label text-signal">LAND FORGE · NEW IN BETA</p>
        <h2 className="display mt-1 text-xl md:text-2xl">Give your Guardian a home. <span className="text-bitcoin">Inscribe your voxel build.</span></h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Build on {height !== undefined ? `${height}.bitmap` : "your BITMAP"} in Land Forge Studio, then inscribe it onto the BITMAP's own sat. Inscribed builds rise in the Oasis and get a cyan beacon on the map.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to="/forge" className="btn-term">OPEN LAND FORGE →</Link>
        <Link to="/map" className="btn-term-ghost">SEE BUILT BITMAPS</Link>
      </div>
    </aside>
  );
}

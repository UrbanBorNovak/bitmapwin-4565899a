import { Link } from "@tanstack/react-router";
import { Landmark, Users } from "lucide-react";
import { atlasDistricts, districtChapter } from "@/lib/atlas-places";
import { ATLAS_SIDE } from "@/lib/atlas-geometry";

export type AtlasCamera = { zoom: number; x: number; y: number };
export type AtlasDistrictStat = { indexed: number; owners: number };

/**
 * District names rendered OUTSIDE the zoom transform, in screen space,
 * so text is always rasterized crisply at the device pixel ratio.
 * Labels grow with zoom instead of being counter-scaled — deeper zoom
 * means bigger, bolder names, then the district chapter and its real
 * owner analytics once the camera is inside the region.
 */
export function AtlasPlaceLabels({
  camera,
  stats,
}: {
  camera: AtlasCamera;
  stats?: Record<number, AtlasDistrictStat | undefined>;
}) {
  const { zoom, x, y } = camera;
  const step = zoom < 1.7 ? 4 : zoom < 2.8 ? 2 : 1;
  // Screen-space font size: starts at 10px, grows with zoom, capped.
  const nameSize = Math.min(26, 9 + zoom * 1.6);
  const landmarkSize = Math.min(15, 7 + zoom * 0.8);
  const margin = 0.08; // cull labels just outside the viewport

  return (
    <div aria-label="Named atlas districts" className="pointer-events-none absolute inset-0 overflow-hidden">
      {atlasDistricts()
        .filter((district) => district.index % step === 0)
        .map((district) => {
          const sx = (district.x / ATLAS_SIDE) * zoom + x;
          const sy = (district.y / ATLAS_SIDE) * zoom + y;
          if (sx < -margin || sx > 1 + margin || sy < -margin || sy > 1 + margin) return null;
          return (
            <Link
              key={district.index}
              onPointerDown={(event) => event.stopPropagation()}
              to="/map/district/$slug"
              params={{ slug: district.slug }}
              style={{ left: `${sx * 100}%`, top: `${sy * 100}%`, transform: "translate(-50%,-50%)" }}
              className="group pointer-events-auto absolute flex min-w-24 flex-col items-center text-center"
              aria-label={`Read the story of ${district.name}, landmark ${district.landmark}`}
            >
              <span
                style={{ fontSize: `${nameSize}px`, textShadow: "0 1px 2px rgba(0,0,0,.85), 0 0 10px rgba(0,0,0,.55), 0 0 2px rgba(0,0,0,.9)" }}
                className="whitespace-nowrap font-mono font-black uppercase tracking-wide text-background transition-colors group-hover:text-bitcoin"
              >
                {district.name}
              </span>
              {zoom >= 2.2 ? (
                <span
                  style={{ fontSize: `${landmarkSize}px`, textShadow: "0 1px 2px rgba(0,0,0,.8), 0 0 8px rgba(0,0,0,.5)" }}
                  className="mt-0.5 flex items-center gap-1 whitespace-nowrap font-mono font-bold uppercase text-bitcoin"
                >
                  <Landmark style={{ width: landmarkSize, height: landmarkSize }} />
                  {district.landmark}
                </span>
              ) : null}
              {zoom >= 3 ? (
                <span
                  style={{ fontSize: `${Math.min(13, 7 + zoom * 0.6)}px`, textShadow: "0 1px 2px rgba(0,0,0,.85)" }}
                  className="mt-0.5 whitespace-nowrap font-mono font-bold uppercase tracking-[0.2em] text-background/85"
                >
                  {districtChapter(district)}
                </span>
              ) : null}
              {zoom >= 3.6 && stats?.[district.index] ? (
                <span
                  style={{ fontSize: `${Math.min(13, 7 + zoom * 0.5)}px`, textShadow: "0 1px 2px rgba(0,0,0,.85)" }}
                  className="mt-0.5 flex items-center gap-1 whitespace-nowrap font-mono font-bold uppercase text-signal"
                >
                  <Users style={{ width: 11, height: 11 }} />
                  {stats[district.index]!.owners.toLocaleString("en-US")} OWNERS ·{" "}
                  {stats[district.index]!.indexed.toLocaleString("en-US")} BITMAPS
                </span>
              ) : null}

            </Link>
          );
        })}
    </div>
  );
}

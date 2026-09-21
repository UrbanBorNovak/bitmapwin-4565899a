import { Link } from "@tanstack/react-router";
import { Landmark } from "lucide-react";
import { atlasDistricts } from "@/lib/atlas-places";
import { ATLAS_SIDE } from "@/lib/atlas-geometry";

export function AtlasPlaceLabels({ zoom }: { zoom: number }) {
  const step = zoom < 1.7 ? 4 : zoom < 2.8 ? 2 : 1;
  return <div aria-label="Named atlas districts" className="pointer-events-none absolute inset-0">
    {atlasDistricts().filter((district) => district.index % step === 0).map((district) => (
      <Link
        key={district.index}
        onPointerDown={(event) => event.stopPropagation()}
        to="/map/district/$slug"
        params={{ slug: district.slug }}
        style={{ left: `${(district.x / ATLAS_SIDE) * 100}%`, top: `${(district.y / ATLAS_SIDE) * 100}%`, transform: `translate(-50%,-50%) scale(${1 / zoom})` }}
        className="group pointer-events-auto absolute flex min-w-24 flex-col items-center text-center drop-shadow-md"
        aria-label={`Read the story of ${district.name}, landmark ${district.landmark}`}
      >
        <span className="font-mono text-[9px] font-bold uppercase text-foreground/90 transition-colors group-hover:text-bitcoin">{district.name}</span>
        {zoom >= 2.2 ? <span className="mt-0.5 flex items-center gap-1 whitespace-nowrap font-mono text-[7px] uppercase text-bitcoin/85"><Landmark className="size-2.5" />{district.landmark}</span> : null}
      </Link>
    ))}
  </div>;
}

import { Building2, Castle, Landmark, Mountain, Sprout, Trees, Waves, Wind } from "lucide-react";
import atlasImage from "@/assets/oasis-atlas-storybook.jpg";
import type { AtlasPlaceStory } from "@/lib/atlas-places";

const motifIcons = {
  harbor: Waves,
  heights: Mountain,
  quarter: Building2,
  gardens: Sprout,
  reach: Wind,
  ward: Castle,
  commons: Trees,
  frontier: Landmark,
} as const;

/** A spatially faithful illustration: each BITMAP reveals its own cell of the painted atlas. */
export function AtlasPlaceIllustration({ place }: { place: AtlasPlaceStory }) {
  const Motif = motifIcons[place.motif];
  const scale = place.frame.divisions * 100;
  return (
    <figure className="district-illustration relative isolate min-h-[420px] overflow-hidden border-y border-bitcoin/35 sm:min-h-[520px] sm:border">
      <img
        src={atlasImage}
        alt={`Hand-painted view of ${place.localName} in ${place.name}`}
        width={1920}
        height={1200}
        fetchPriority="high"
        draggable={false}
        className="pointer-events-none absolute max-w-none select-none object-cover"
        style={{
          width: `${scale}%`,
          height: `${scale}%`,
          left: `${place.frame.column * -100}%`,
          top: `${place.frame.row * -100}%`,
        }}
      />
      <div className="district-illustration__wash absolute inset-0" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-5 p-5 sm:p-8 md:p-10">
        <figcaption className="min-w-0 max-w-3xl">
          <p className="font-mono text-[10px] uppercase text-signal" data-no-translate>{place.chapter}</p>
          <h1 className="display mt-2 text-4xl text-foreground drop-shadow-lg sm:text-6xl md:text-7xl">{place.localName}</h1>
          <p className="mt-3 font-mono text-[10px] uppercase text-bitcoin sm:text-xs">{place.name} · {place.atmosphere}</p>
        </figcaption>
        <span className="hidden size-20 shrink-0 place-items-center border border-bitcoin/60 bg-background/45 text-bitcoin backdrop-blur-sm sm:grid" aria-hidden="true">
          <Motif className="size-9" strokeWidth={1.25} />
        </span>
      </div>
    </figure>
  );
}

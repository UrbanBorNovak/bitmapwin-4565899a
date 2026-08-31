import type { GalleryConfig } from "@/lib/build-sdk";
import { inscriptionImageUrl } from "@/lib/profiles";

export function GalleryBuild({ config, height }: { config: GalleryConfig; height: number }) {
  if (config.items.length === 0) return null;
  const cols =
    config.columns === 2 ? "sm:grid-cols-2" : config.columns === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3";
  return (
    <div className={`grid grid-cols-2 gap-3 ${cols}`}>
      {config.items.map((item) => (
        <figure key={item.inscriptionId} className="overflow-hidden rounded-md border border-border">
          <a href={`https://ordinals.com/inscription/${item.inscriptionId}`} target="_blank" rel="noreferrer">
            <img
              src={inscriptionImageUrl(item.inscriptionId)}
              alt={item.caption || `On-chain inscription shown on ${height}.bitmap`}
              loading="lazy"
              className="aspect-square w-full bg-background object-contain"
            />
          </a>
          <figcaption className="label border-t border-border px-2 py-1 truncate">
            {item.caption || item.inscriptionId.slice(0, 12)}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

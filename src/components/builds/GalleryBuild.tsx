import { themePanelStyle, themeShellStyle, type GalleryConfig } from "@/lib/build-sdk";
import { inscriptionImageUrl } from "@/lib/profiles";

export function GalleryBuild({ config, height }: { config: GalleryConfig; height: number }) {
  if (config.items.length === 0) return null;
  const theme = config.theme;
  const cols =
    config.columns === 2 ? "sm:grid-cols-2" : config.columns === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3";
  return (
    <div className="border p-4" style={themeShellStyle(theme)}>
      <div className={`grid grid-cols-2 gap-3 ${cols}`}>
        {config.items.map((item) => (
          <figure
            key={item.inscriptionId}
            className="overflow-hidden border"
            style={themePanelStyle(theme)}
          >
            <a
              href={`https://ordinals.com/inscription/${item.inscriptionId}`}
              target="_blank"
              rel="noreferrer"
            >
              <img
                src={inscriptionImageUrl(item.inscriptionId)}
                alt={item.caption || `On-chain inscription shown on ${height}.bitmap`}
                loading="lazy"
                className={`aspect-square w-full transition-all duration-300 ${
                  config.fit === "cover" ? "object-cover" : "object-contain"
                } ${config.monochrome ? "grayscale hover:grayscale-0" : ""}`}
              />
            </a>
            <figcaption
              className="label truncate border-t px-2 py-1"
              style={{ borderColor: `${theme.accent}44`, color: theme.accent }}
            >
              {item.caption || item.inscriptionId.slice(0, 12)}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

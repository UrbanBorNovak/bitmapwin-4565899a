/**
 * THE LAND YOU STAND ON — the landscape under the avatar and the perks it
 * grants. The panel changes the moment you cross into the next BITMAP, and the
 * perks it lists are exactly the modifiers the world is applying right now.
 */

import { atlasPlace } from "@/lib/atlas-places";
import { useStandingLand } from "@/lib/land-biome-live";

export function LandPerksHud() {
  const { height, landscape } = useStandingLand();
  const place = atlasPlace(height);

  return (
    <div
      data-no-translate
      className="hud-panel pointer-events-none absolute left-3 bottom-24 z-30 w-[min(15rem,calc(100%-1.5rem))] space-y-1 px-2.5 py-2 font-mono text-[10px]"
      aria-label="Land and perks"
    >
      <span className="hud-telemetry-title">{landscape.name}</span>
      <p className="text-muted-foreground">
        {place.localName} · {place.name}
      </p>
      <p className="tabular-nums text-bitcoin">{height.toLocaleString("en-US")}.BITMAP</p>
      <ul className="space-y-0.5 pt-1">
        {landscape.perks.map((perk) => (
          <li key={perk.key}>
            <span className="hud-live">{perk.name}</span>
            <span className="block text-muted-foreground">{perk.effect}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

# Landscapes, perks and a denser Oasis

Right now every BITMAP in the Oasis looks and plays the same, while the atlas already
gives each block a district, a landmark and an era. This makes the two agree: the
land you stand on gets a named landscape, a distinct look, its own density of
trees/rock/props, and concrete perks you can feel while playing.

## Landscapes

Each BITMAP resolves to one of eight landscapes, derived only from facts that
already exist on chain: the block's era (height), its district position on the
atlas, and its transaction count from the indexed block stats.

- ANCIENT STONE — genesis and sub-1K blocks: bare rock, ruins, sparse growth
- TEMPERATE ISLES — early blocks: shoreline groves, flowers, warm light
- HIGHLAND FOREST — dense pines, tall relief, deep shade
- SUNLIT ARCHIPELAGO — open water light, scattered palms, bright horizon
- DESERT MESA — sand, dry props, long sightlines, thin vegetation
- SNOWLINE — cold rim light, sparse hardy growth, pale ground
- LIVING FRONTIER — fog and scaffolding near the chain tip
- BEYOND THE FRONTIER — unmined land: empty, quiet, waiting

District motif (harbor, heights, gardens, reach, ward, commons, quarter,
frontier) shifts the same landscape sideways, so two HIGHLAND FOREST blocks in
different districts still read as different places.

## Perks

Every landscape grants two or three perks with real, visible numbers. They are
land-based, not account-based: they apply while you stand on that BITMAP and
disappear when you leave, so they reward exploring rather than grinding.

| Perk | Effect |
| --- | --- |
| SURE FOOTING | faster ground speed on open terrain |
| THIN AIR | higher jump on highland and snowline land |
| DEEP SHADE | quieter presence, slower stamina burn in forest |
| RICH SEAM | higher mining yield on stone and mesa land |
| FERTILE GROUND | faster terraform growth on island and garden land |
| LONG SIGHT | greater view distance and lighter fog on desert and reach land |
| FROST BITE | slower growth, but stronger ore on snowline |
| FRONTIER LUCK | better find rates near the chain tip |

Perks stack with nothing hidden: the HUD lists the ones currently active with
their exact modifier, and the panel names the landscape and district they come
from.

## Density and feel

The same landscape drives how crowded the world looks: tree, flower, mushroom,
rock and prop counts each get their own multiplier, and transaction count nudges
density up on busy blocks. Fog distance, sun warmth, ground tone and ambient
light shift per landscape while staying inside the warm hand-painted look, with
Bitcoin orange kept for ownership and actions and cyan for live signals. Quality
presets still cap the totals, so low-end devices stay smooth.

## Where it shows

- Oasis: a compact LAND panel in the HUD naming the landscape, district and
  active perks, updating as you cross into a new BITMAP
- Atlas: the selected BITMAP inspector and each district story page name the
  landscape and its perks, so the map explains the world before you enter
- Land pages: the territory readout gains its landscape line

## Technical notes

- New `src/lib/land-biome.ts`: pure deterministic resolver from height plus
  atlas district plus block stats to a landscape record with density
  multipliers, tone values and a perk list. No new tables, no writes.
- Density wiring in `PineTrees.tsx`, `LandGrowth.tsx`, `DesertLife.tsx`,
  `DesertProps.tsx`, `MineralNodes.tsx`, `SeaIslands.tsx` reads multipliers
  instead of fixed caps, clamped by the existing quality settings.
- Feel wiring in `WorldWeather.tsx`, `TerrainField.tsx`, `SkyBodies.tsx` and the
  fog in `BitmapWorld3D.tsx`.
- Perk effects apply where the mechanic already lives: `speedScale` in the move
  intent, jump impulse, growth rate in `world-terraform.ts`, yield in
  `bitmap-mining.ts`. No new server functions and no invented on-chain values.
- Atlas and district pages read the same resolver, so map and world can never
  disagree.

## Verification

Walk across a landscape boundary in the Oasis and confirm density, fog and the
HUD perk list all change; check three landscapes on desktop and phone; confirm
no horizontal overflow, clean console, and a clean build.

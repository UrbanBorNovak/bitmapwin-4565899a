# District Story Pages

## Goal
Give each of the 64 named atlas districts a permanent story destination that feels like part of the painted Oasis, not a generic detail page.

## What will be built
- Add a story page at `/map/district/:slug` for every named district.
- Give each district its own illustration by framing and enlarging that district’s exact region of the hand-painted atlas, then layering restrained district-specific atmosphere and landmark treatment without inventing on-chain activity.
- Write a concise, deterministic atlas story for each district using its name, landmark, era, neighboring geography, and anchor BITMAP. Clearly separate world lore from verified Bitcoin facts.
- Show the district landmark, atlas coordinates, anchor BITMAP, era, neighboring districts, and direct actions to open the land, return to the atlas, or drop into the Oasis.
- Make district names on the atlas open their story pages while preserving normal map pan, zoom, and BITMAP pin interactions.
- Add previous/next district navigation and mobile-friendly layouts.

## Visual direction
- Continue the warm hand-painted storybook language already used by the Oasis atlas.
- Let the district illustration dominate the first view; keep terminal labels sparse and secondary.
- Preserve Bitcoin orange for ownership/actions and cyan for live or spatial signals.
- Keep all illustrations readable under controls and ensure each district composition is visibly distinct.

## Technical details
- Extend the atlas place module with stable district slugs, lookup, neighbors, deterministic story metadata, and district-specific art framing.
- Add the new TanStack route with unique title, description, Open Graph metadata, and not-found handling.
- Reuse the existing 1920×1200 painted atlas asset so district artwork remains spatially faithful and does not add 64 heavyweight image files.
- Update atlas labels and selected-district details with story links.
- Add the district route pattern to sitemap generation if the sitemap is statically enumerated.

## Verification
- Confirm all 64 district slugs are unique and resolve.
- Check representative corner, central, and edge districts on desktop and phone.
- Verify illustration framing, navigation, no horizontal overflow, no console errors, and a clean preview build.

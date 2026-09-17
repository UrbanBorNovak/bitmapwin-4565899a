# Build Menu Templates

## Outcome
Players can choose ready-made shrine compounds, wall runs, and gated entrances from the existing in-world BUILD panel and place each complete layout in one action.

## Implementation
- Promote the existing inscribed clay shrine pieces into reusable player-built structure types, keeping their current on-chain models and scale.
- Add three template recipes:
  - Shrine compound: shrine, steps, perimeter walls, entrance, door, pillars, and details.
  - Defensive wall: a straight modular wall run with supporting pillars.
  - Gate and door: an entrance wall, functional visual door, and flanking pillars.
- Add an atomic template placement function that rotates all parts around the player, verifies every footprint is dry and clear, totals the material cost once, then places and publishes all parts together.
- Add Templates and Single Pieces sections to the BUILD panel, showing cost and a one-action BUILD HERE confirmation.
- Render the new structure types through the existing inscribed-model renderer and register their collision footprints so players and vehicles route around walls while entrances remain passable.

## Validation
- Confirm insufficient materials or one blocked/wet part prevents the entire template without spending items.
- Confirm all parts rotate with player facing, persist locally, publish as one batch, and remain visible after moving away and returning.
- Check desktop and mobile BUILD panels, TypeScript, the live map route, and current diagnostics.

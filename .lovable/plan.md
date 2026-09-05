# Unify BitmapWin styles and motion

## Goal
Make the existing site feel like one coherent BitmapWin operating system while preserving its strict monochrome terminal identity, Bitcoin-orange accents, real data, and current features.

## Implementation
- Add shared page-shell, page-intro, section-header, panel, data-row, loading, and reveal patterns based on the selected unified dark direction.
- Standardize button, link, field, focus, disabled, panel-hover, and active states across the site through semantic design tokens and shared utilities.
- Add restrained route and content entrance motion, consistent live-status motion, and reduced-motion fallbacks.
- Align the global header, footer, error pages, dashboard, marketplace, world/build/market/land/developer pages, and common cards with the same spacing and interaction language.
- Preserve the full-bleed 3D world and specialized interactive tools; only their surrounding interface receives the shared treatment.

## Technical details
- Extend `src/styles.css` with semantic timing/easing tokens and reusable Tailwind v4 utilities.
- Add small shared presentation primitives under `src/components/ui/` and adopt them in route-level layouts where they remove duplicated styling.
- Add a keyed route-stage wrapper in the root layout for consistent page entrances without changing navigation behavior.
- Keep square/low-radius surfaces and border-driven hierarchy; do not introduce gradients, glass effects, new colors, mock data, or feature changes.
- Verify key public and signed-out pages at desktop and mobile sizes, confirm reduced-motion behavior, and check the latest build/runtime logs.

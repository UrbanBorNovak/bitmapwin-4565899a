# Restyle BitmapWin around ord.net

## Goal
Make the entire existing product read as one dense, monochrome Bitcoin marketplace interface inspired by ord.net, without changing its data, routes, atlas, Oasis, or five-pillar product structure.

## Implementation
- Replace the current glass/storybook page chrome with the selected near-black ord.net system: `#050505` background, `#111111` surfaces, `#2A2A2A` rules, `#F2F2F2` text, and Bitcoin orange `#F7931A` for ownership and actions.
- Keep Space Grotesk for headings and DM Sans for body copy; tighten labels, controls, rows, spacing, and type hierarchy for exchange-grade density.
- Rebuild the shared header into a compact navigation and utility bar with precise dropdowns, search, live BTC, language, theme, wallet, and account access.
- Restyle shared buttons, fields, menus, panels, cards, tables, status rows, loading states, page intros, route transitions, and footer through global semantic tokens and utilities so every route inherits the same visual language.
- Recompose the home page into a dense market overview rather than a marketing hero, while preserving its real on-chain data and five core product pillars.
- Preserve the painterly atlas and 3D Oasis as primary content; remove decorative page chrome around them and make their controls match the ord.net system.
- Keep layouts usable on phones with compact horizontal navigation, non-overflowing data rows, and appropriately stacked panels.

## Technical details
- Update `src/styles.css` tokens and shared utilities; remove gradients, glass effects, broad shadows, rounded cards, decorative page masks, and soft entrance motion from 2D interface chrome.
- Update shared header, footer, button primitives, root shell, and home page composition; route-specific pages inherit the global system without business-logic changes.
- Retain visual effects inside the actual atlas artwork and WebGL Oasis scene, but make overlays and controls monochrome and square.
- Verify representative home, atlas, marketplace, BITMAP detail, Passport, Studio, and Oasis screens at desktop and mobile sizes, then check build and runtime logs.

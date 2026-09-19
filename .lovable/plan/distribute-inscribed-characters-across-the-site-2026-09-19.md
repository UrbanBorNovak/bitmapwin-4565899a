# Distribute inscribed characters across the site

## Build
- Replace the full homepage parade and footer mascot with one shared ambient character layer.
- Show exactly three animated characters at once on standard two-dimensional pages.
- Choose a stable trio and varied edge-safe positions from the current page address, so navigation changes the scene without flicker.
- Keep characters decorative, click-through, clear of the header and main control areas, and smaller on phones.
- Exclude the Oasis world and other immersive/sensitive screens where overlays could obstruct play or account flows.

## Technical details
- Reuse the existing inscription sprite renderer and reduced-motion behavior.
- Derive selection and placement deterministically from the route path rather than changing randomly during a visit.
- Mount the ambient layer once in the shared page shell and verify desktop and phone layouts.

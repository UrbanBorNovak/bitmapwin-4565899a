# Distribute extender pool art across PLAY cards

## Goal
When a player chooses an extender collection such as ORD TORCHES, every PLAY card receives a deterministic image from that collection instead of every card using the same selected image.

## Changes
- Store the selected collection/pool separately from any individual preview item.
- Make card artwork selection deterministic from the card identity, so the same card keeps the same background across sessions and devices.
- Use the full chosen pool and spread cards across its images; preserve BITMAP-scoped imported collections.
- Change collection selection controls so choosing ORD TORCHES activates the whole collection, while individual tiles remain previews rather than global single-image choices.
- Verify card lists and match cards show varied artwork without changing gameplay data or card stats.

## Technical details
- Extend normalized PLAY visual settings with a selected collection identifier while remaining compatible with existing saved settings.
- Update `activePfpExtenderForCard` to hash the card ID and BITMAP into the active collection's enabled entries.
- Keep the current safe image/HTML rendering paths and cosmetic-only behavior.

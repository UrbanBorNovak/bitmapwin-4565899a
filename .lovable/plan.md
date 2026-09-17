# Plan: Keep water clean

## Goal
Make Oasis water show only the allowed water content: ships, yachts, islands, and the existing goose families.

## Changes
- Stop ground builds and full camps from being placed on water.
- Hide any old or shared player-built structures that are already sitting in water.
- Stop traps from being placed or rendered in water.
- Hide parked ground/air rides if their saved parked position is in water.
- Keep ships/yachts visible on water and islands in seas.

## Technical notes
- Use the existing sea check so behavior matches the water shader and shoreline.
- Do not change the water shader, ships, yachts, islands, or goose-family behavior.
- Keep existing land placement behavior unchanged.

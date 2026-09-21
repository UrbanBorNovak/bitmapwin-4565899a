# BSS (Bitmap Sunset Script) integration

Goal: Bitcoin Bitmap → BSS BMP inscription → decoded scene → rendered inside the existing Oasis. No redesign, no new world format, no hardcoded scene.

## One thing you should know first

There is no public `bss-core` package and no `bssReadBmp()` function. I checked npm, GitHub and the web:

- The npm name `bss-core` exists but is an unrelated, unpublished 2018 package.
- The real project (`BitmapSunset/bitmap_sunset`) publishes only docs — no source. Its engine, compiler and reader are inscribed on Bitcoin itself.
- Their docs top out at `BSS 0 0 14`; there is no published 0.0.16 source anywhere.

What *is* real and verified: I fetched Bitmap 156700's BMP (`676ddb94…c953i0`, 4,614 bytes) and read its header — magic `BS`, version `0 0 14`, declared payload 4,373 bytes inside 4,446 bytes of de-padded pixel data, followed by resource declarations (`ram0`…`ram25`) each binding a 32-byte inscription id. I also unpacked the on-chain BitmapSunset application and can read its reference decoder (bit-level opcode reader, BMP de-padding, fail-closed validation).

So: instead of installing a package that does not exist, the reader is ported into BitmapWin as a small self-contained module, faithful to the on-chain reference and validated against real inscriptions. Version handling covers 0.0.9 through 0.0.16 with the header's version bytes read from the file, not assumed.

## What gets built

**1. BSS reader — `src/lib/bss/`**
- `bmp.ts`: BMP parse, row-padding strip, payload extraction.
- `header.ts`: 9-byte header (magic, version, declared filesize), strict end-of-file validation against BMP padding overflow.
- `stream.ts`: bit-level reader matching the reference encoding.
- `decode.ts`: opcode walk producing a typed `BssScene` — version, resources (named inscription ids), objects (kind, transform, bind, colour, label), diagnostics. Fails closed with a precise reason; never throws into the render tree.
- Pure data only. BSS is never evaluated as JavaScript.

**2. Loader + cache — `src/lib/bss/load.ts`**
- Resolves a Bitmap's BSS child inscription, fetches `/content/<id>`, decodes once, caches the decoded scene in memory plus the browser cache keyed by inscription id. Repeat visits do not refetch.

**3. Converter — `src/lib/bss/to-world.ts`**
- Maps decoded objects onto what BitmapWin already renders: model/quad/billboard/primitive → existing `InscribedParts` model loading and simple meshes, with BSS coordinates (clamped ±10100) scaled into Oasis units.

**4. Rendering**
- A `BssScene` layer inside the existing 3D world, mounted for the selected Bitmap. Unsupported opcodes are skipped and reported, not faked.

**5. Inspector panel on `/bitmap/$block`**
- BSS version, BMP source inscription, object count, resource count, validation status, plus explicit LOADING and CANNOT DECODE states.

## Verification

Bitmap 156700 (`967.bitmap` references it) is the live test: open `/bitmap/156700`, its real BMP is fetched, decoded at the version the file declares, and its objects appear in the world. Decoder round-trip is asserted against the real bytes in a unit test. Typecheck, build, desktop and phone pass.

## Not included

No editor, no compiler, no inscribing, no BSS→text export. Reader and renderer only, modular so any `/bitmap/{number}` works.

# BWVX — Bitcoin Voxel Payload

Status: Stable · Reference: `src/lib/voxel-populate.ts`, `src/lib/bwvx-export.ts`

BWVX is a compression format for blockspace. It is not a voxel rendering engine. Clients expand it into triangles: either instanced boxes in one draw call, or greedy-meshed quads.

## BWVX1 — per block

- Encoding: base64 binary, **4 bytes per block** `[x, y, z, kind]`
- Coordinates `0..63` relative to the build's corner (64³ canvas)
- `kind` indexes the shared block palette (`BWVX_PALETTE`)

## BWVX2 — greedy boxes

- Magic: `"BW2\0"` (4 bytes)
- Then **7 bytes per box** `[x0, y0, z0, x1, y1, z1, kind]`, inclusive bounds
- BWVX1 coordinates are always `< 64`, so a BWVX1 payload can never start with `B` (0x42 = 66). That makes the two formats safe to tell apart.
- Encoders pick the smaller format. XL canvases (128³, `data-span="128"`) always use BWVX2.

## BWVX_ASM — recursive assemblies

An assembly refers to already-inscribed pieces by **inscription id + placement** and fetches them live (`/r/metadata`, falling back to `/content`). It stores only its own blocks, so a reused piece is never paid for twice.

## Rendering contract

- One `InstancedMesh` per payload, so the whole build is one draw call
- Same bytes drive the in-app preview and the on-chain self-rendering HTML
- Parcel builds are hard-clipped to their Parcel Floor Metric rect

## Reference API

```ts
bwvxBoxes(b64): Box[]          // decode either format
exportBwvxBytes(blocks, span)  // encode the smallest valid payload
loadBwvxMesh(THREE, b64)       // one-draw-call mesh
```

Round-trip tests: `src/lib/bwvx-roundtrip.test.ts`, `src/lib/bwvx-export.test.ts`.

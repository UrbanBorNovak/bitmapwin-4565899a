# @bitmap/build-sdk

Zero-dependency, framework-free SDK for building on Bitcoin Bitmap digital land.
A **build** is what a holder puts on top of `<height>.bitmap`: an info page, an
on-chain gallery, a 3D world or a 2D arcade. Everything is `{ kind, config }`.

```bash
bun add @bitmap/build-sdk   # or: npm i @bitmap/build-sdk
```

## Build kinds

| kind | what it is | config |
| --- | --- | --- |
| `info` | personal home page for a block | `headline`, `fields[]`, `links[]` |
| `gallery` | grid of inscriptions you hold | `columns` (2–4), `items[]` |
| `game3d` | deterministic voxel skyline | `worldName`, `towers` (4–64), `spin`, `accent` |
| `game2d` | seeded maze coin run | `title`, `coins` (3–40), `walls` (0–60), `speed` (1–10) |

## Make a build

```ts
import { createBuildPayload } from "@bitmap/build-sdk";

const payload = createBuildPayload({
  height: 840000,
  kind: "gallery",
  owner: "bc1p…",
  title: "HALVING GALLERY",
  config: {
    columns: 3,
    items: [{ inscriptionId: "…i0", caption: "SODA" }],
  },
});
```

`createBuildPayload` sanitises and clamps everything, so loose input can never
produce an invalid build. The result is the exact JSON to inscribe as a child of
`<height>.bitmap`:

```json
{
  "p": "bitmap-build",
  "v": 2,
  "bitmap": "840000.bitmap",
  "kind": "gallery",
  "config": { "columns": 3, "items": [{ "inscriptionId": "…i0", "caption": "SODA" }] }
}
```

## Read a build back

```ts
import { parseBuildPayload, payloadHeight } from "@bitmap/build-sdk";

const build = parseBuildPayload(JSON.parse(text)); // throws on wrong protocol/version
payloadHeight(build); // 840000
```

## Render it yourself

The SDK ships no UI on purpose — configs are plain data, so any renderer works.
Use `buildSeed(height)` + `seededRandom(seed)` for generated visuals so every
visitor sees the identical world:

```ts
import { buildSeed, seededRandom } from "@bitmap/build-sdk";

const rand = seededRandom(buildSeed(840000));
const towerHeight = 1 + rand() * 5;
```

## Also exported

- `BUILD_KINDS`, `BUILD_KIND_LABELS`, `BUILD_KIND_HINTS`
- `DEFAULT_CONFIGS`, `BUILD_LIMITS`
- `isBuildKind`, `parseBuildConfig`
- types: `BuildKind`, `InfoConfig`, `GalleryConfig`, `Game3dConfig`, `Game2dConfig`, `BuildPayload`

## Rules of the protocol

- A valid bitmap is the first inscription claiming `<height>.bitmap`.
- A build belongs to the bitmap holder (or a delegate the holder grants).
- Parcels are child inscriptions named `<index>.<height>.bitmap`, with index up
  to the block's transaction count.

MIT licensed. Protocol `bitmap-build` v2.

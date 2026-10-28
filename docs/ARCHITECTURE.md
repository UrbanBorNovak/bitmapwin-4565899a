# Architecture

## Pillars

| Pillar | Surface | Core modules |
|---|---|---|
| WORLD | `/oasis`, Biternam rooms, `/launch` | `src/components/game`, `src/components/biternam`, `src/components/launch` |
| LAND | `/marketplace`, BITMAP pages | `src/lib/forge-parcels.ts`, `bitmap-oci.server.ts` |
| EXPERIENCES | Extenders, Grandstands | `src/lib/sovereign-stand.ts` |
| IDENTITY | Passport, seats, Guardians | `src/lib/creature-morph.ts`, `onchain-guardian.ts` |
| CREATION | `/forge` Land Forge | `src/lib/voxel-populate.ts`, `bwvx-export.ts`, `forge-assembly.ts` |

## Trust boundaries

```text
Bitcoin L1 (ordinals.com, mempool.space)   <- source of truth
        |
Server functions (edge worker)             <- re-verify every claim: signatures, holdings, payments
        |
Database (row-level security)              <- public world state readable; secrets deny-all
        |
Browser                                    <- renders; its claims never grant rewards or access
```

Rules that hold everywhere:

- **Rewards and access are server-judged.** Seats, lounges, backrooms and BIT payouts are checked again on the server.
- **Ownership is checked live on-chain.** A stored proof records *which* inscription proved it.
- **Shared scenes are deterministic.** Guardian routes, raids, shards and storms come from block data and timestamps, so every client sees the same result without per-frame networking.
- **Every 3D canvas goes through `SafeCanvas`.** This keeps page zoom from blowing up WebGL buffers.

## Rendering

Three.js / React Three Fiber, tuned for a retro look and 60 FPS: pixel ratio 1, no antialiasing or shadows, instanced meshes, and greedy-meshed voxels. Biternam rooms use fixed cameras in 2.5D.

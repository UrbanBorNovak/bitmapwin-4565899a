<div align="center">

# 🟧 BITMAPWIN

### Bitcoin-native worlds, built from real blocks

**Every Bitcoin block is land. Every transaction is a BITMAP parcel. Every build is proven on-chain.**

[![Bitcoin L1](https://img.shields.io/badge/Bitcoin-L1-F7931A?logo=bitcoin&logoColor=white)](https://mempool.space)
[![Ordinals](https://img.shields.io/badge/Ordinals-Inscribed-111111)](https://ordinals.com)
[![TanStack Start](https://img.shields.io/badge/TanStack_Start-v1-00E5FF)](https://tanstack.com/start)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-000000?logo=threedotjs&logoColor=white)](https://threejs.org)

[**Website**](https://bitmapwin.app) · [**Enter the Oasis**](https://bitmapwin.app/oasis) · [**Launch Grandstand**](https://bitmapwin.app/launch) · [**Land Forge**](https://bitmapwin.app/forge) · [**X / Twitter**](https://x.com/bitmapwin)

</div>

---

## 📖 Table of Contents

- [What is BITMAPWIN?](#-what-is-bitmapwin)
- [The Five Pillars](#-the-five-pillars)
- [On-Chain Milestones](#-on-chain-milestones)
- [Launch Grandstand](#-launch-grandstand)
- [Protocols & Standards](#-protocols--standards)
- [Technology Stack](#-technology-stack)
- [Getting Started](#-getting-started)
- [Repository Structure](#-repository-structure)
- [Design Principles](#-design-principles)
- [Security](#-security)

---

## 🌍 What is BITMAPWIN?

BITMAPWIN turns Bitcoin history into a world you can walk through. Every block mined since Genesis becomes a 3D territory. Every transaction inside it becomes a BITMAP parcel with its own footprint and full-height air rights.

Nothing is invented. Terrain, ownership, pedigree and builds are derived from **live Bitcoin facts**, **Ordinals inscriptions** and **wallet signatures**. If it isn't proven on-chain, it doesn't exist in the world.

```text
  Bitcoin block  ──►  BITMAP land  ──►  Oasis world  ──►  Forge builds  ──►  Inscribed on L1
   (height, txs)      (parcels)         (walk & meet)     (voxel BWVX)       (Tag 11 delegate)
```

---

## 🏛️ The Five Pillars

```text
                         ┌──────────────────────┐
                         │      BITMAPWIN       │
                         └──────────┬───────────┘
      ┌──────────────┬──────────────┼──────────────┬──────────────┐
      ▼              ▼              ▼              ▼              ▼
   WORLD           LAND        EXPERIENCES     IDENTITY       CREATION
  The Oasis       BITMAPs       Biternam &     Passport &    Land Forge
                               Grandstands     Guardians      & BWVX
```

| Pillar | Where | What it does |
|---|---|---|
| 🌐 **WORLD** | [`/oasis`](https://bitmapwin.app/oasis) | A shared 3D map of Bitcoin blocks on a Hilbert-curve atlas. One BITMAP is 10 avatar strides across. Biomes and wildlife follow the ground. Retro 60 FPS engine with a 2.5D diorama camera. |
| 🧱 **LAND** | [`/marketplace`](https://bitmapwin.app/marketplace) | 900,000+ indexed BITMAPs. Parcels follow the Mondrian layout of each block. Ownership and holding time come from live satpoint and UTXO data. |
| 🎬 **EXPERIENCES** | [`/biternam`](https://bitmapwin.app/biternam), [`/launch`](https://bitmapwin.app/launch) | Biternam: fixed-camera 2.5D rooms (Bit-Café, Museum, Outpost, Vault, Lair, Batcave, VIP Lounge) with puzzles, cutscenes and inventory. Extenders let holders host live experiences on their land. |
| 🪪 **IDENTITY** | [`/guardians`](https://bitmapwin.app/guardians-guide) | BIP-322 sign-in with no custody. Guardians are voxel creatures generated from block DNA. Pixel avatars are built from inscribed tiles. |
| 🛠️ **CREATION** | [`/forge`](https://bitmapwin.app/forge) | Land Forge voxel studio. Builds are packed as BWVX and inscribed directly onto the BITMAP's own sat. Community modules pay creator royalties in the Bitcoin transaction itself. |

---

## ⛓️ On-Chain Milestones

### Land Forge Master Renderer (Tag 11 Delegate)

The self-rendering voxel viewer is inscribed on Bitcoin. Lean builds point to it and only carry their voxel data.

| Field | Value |
|---|---|
| Inscription | [`ab5a20f7…29b8i0`](https://ordinals.com/inscription/ab5a20f799095d0b700bc8efc2164d7900e2a092a3c537c75ec51e4999f829b8i0) |
| Confirmed | Block **973,155** |
| Formats | **BWVX1** (raw voxels, 4 bytes/block) · **BWVX2** (greedy box compression) |
| Payload | Tag 5 CBOR metadata `{ f, h, d, p }` |
| Runtime | Zero external requests, mouse and touch orbit controls |

Builds made with earlier renderers keep loading and stay recognised.

---

## 🏟️ Launch Grandstand

[`/launch`](https://bitmapwin.app/launch) is a live 3D stadium counting toward launch.

- **480+ Bitmappers seated** — every wallet that used BITMAPWIN holds a permanent seat
- **Founders Row** — seats #1–100
- **Pixel faces** — your own held BITMAP Pixel, or a deterministic one assigned to you
- **BITMAP flags & club hair** — set only from a live wallet scan, never guessed
- **Gold VIP tickets** — an optional seat ticket inscribed on Bitcoin; minters get a gold ring and a spot on the jumbotron ticker
- **Live stage** — a one-sided stage screen, sponsor slots, Lightning tips, popcorn throwing, arena sound
- **Share My Seat** — one tap posts your seat to X

Seat claims are a message signature only: **no transaction, no fee**.

---

## 📜 Protocols & Standards

Full specs live in [`docs/`](./docs/README.md). Read [VISION](./docs/VISION.md) and [CONTRIBUTING](./CONTRIBUTING.md) as well.

| Standard | Purpose |
|---|---|
| **BWVX1 / BWVX2** | Compact voxel encoding for Land Forge builds |
| **BWVX_ASM** | Recursive assemblies that reference inscribed pieces by inscription id |
| **BW-STAND-1** | Sovereign Grandstand: an inscribed JSON config whose inscription id is the stand's identity |
| **Parcel Floor Metric** | One owner per cell from Mondrian coverage; builds clip to their own rect |
| **BIP-322** | Wallet-signed proof for seats, lounges, backrooms and trading API writes |
| **SHORD / Shadow Utility** | Poseidon commitments and one-time nullifiers for private relics and passes |

---

## 🧰 Technology Stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start v1 · React 19 · Vite |
| 3D | Three.js · React Three Fiber · Drei |
| Styling | Tailwind CSS v4 with semantic design tokens |
| Typography | Space Grotesk · DM Sans · Space Mono |
| Bitcoin | `@scure/btc-signer`, `micro-ordinals`, `bip322-js`, `sats-connect` |
| Cryptography | `@noble/*`, `poseidon-lite`, `snarkjs` (Groth16) |
| Data | Ordinals.com, mempool.space, and a hosted Postgres backend with row-level security |
| Runtime | Edge workers (Cloudflare Workers compatible) |

---

## 🚀 Getting Started

**Requirements:** Node.js 20+ or Bun, and a browser with WebGL2.

```bash
# Clone
git clone https://github.com/<your-username>/bitmapwin.git
cd bitmapwin

# Install
bun install        # or: npm install

# Run
bun dev            # or: npm run dev
```

Open **http://localhost:8080**.

> Backend features (seats, BIT, marketplace) need the project's environment variables. Never commit private keys or secrets.

---

## 📁 Repository Structure

```text
src/
├── routes/                  File-based pages
│   ├── index.tsx            Homepage
│   ├── oasis.tsx            Shared 3D world
│   ├── launch.tsx           Launch Grandstand
│   ├── forge.tsx            Land Forge studio
│   ├── marketplace.tsx      BITMAP marketplace
│   ├── biternam_.*.tsx      2.5D Biternam rooms
│   └── api/public/          Public API (trading, agent schema, inscriptions)
├── components/
│   ├── biternam/            Room props, rigs, CRT screens
│   ├── launch/              Grandstand, tickets, wardrobe, sponsors
│   ├── game/                Avatars, recorder, voxel renderers
│   └── ui/                  Glass instrument controls
├── lib/                     Bitcoin, voxel and world logic
│   ├── forge-delegate.ts    Master renderer + CBOR payloads
│   ├── forge-parcels.ts     Parcel Floor Metric
│   ├── creature-morph.ts    Guardian DNA → voxel design
│   ├── sovereign-stand.ts   BW-STAND-1
│   └── shord/               Private notes and proofs
public/                      Static assets and WASM circuits
supabase/migrations/         Database schema
```

---

## 🎨 Design Principles

- **Only real on-chain facts** — no mock data, no browser-held ownership claims
- **Server-judged rewards** — anything worth BIT or access is re-checked on the server
- **Two accents** — Bitcoin orange `#F7931A` for ownership and actions, signal cyan `#00E5FF` for live data
- **Glass instrument panels** — dark terminal UI inspired by ord.net and mempool.space
- **Retro by choice** — 90s-style rendering that holds 60 FPS on phones

---

## 🔐 Security

This repository contains application source only. No wallet keys, seed phrases or passwords are stored here. Circuit files in `public/wasm/` are public proving and verification parameters.

Found a vulnerability? Please contact the team privately via [X](https://x.com/bitmapwin) rather than opening a public issue.

---

<div align="center">

```text
[ BITMAPWIN · BITCOIN-NATIVE WORLDS · 2026 ]
```

**[bitmapwin.app](https://bitmapwin.app)**

</div>

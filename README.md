# BITMAPWIN (bitmapwin.app)

> **Bitcoin-Native Worlds · Infinite 3D Blockchain Expanse · L1 Inscribed Architecture**

[![Bitcoin](https://img.shields.io/badge/Blockchain-Bitcoin%20L1-F7931A?logo=bitcoin&logoColor=white)](https://bitcoin.org)
[![Ordinals](https://img.shields.io/badge/Ordinals-Inscribed%20Worlds-black)](https://ordinals.com)
[![Stack](https://img.shields.io/badge/Stack-TanStack%20Start%20%7C%20React%2019%20%7C%20Three.js-00e5ff)](https://bitmapwin.app)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**BITMAPWIN** is an on-chain world engine and digital land protocol built directly on the Bitcoin blockchain. Every block mined since Genesis is a persistent 3D territory; every transaction is an unforgeable parcel with sovereign air rights.

No centralized servers dictate the terrain—geometry, pedigree, and ownership are deterministically derived from live Bitcoin L1 facts and Inscribed Ordinals standards.

---

## 🏛️ The Five Pillars

BITMAPWIN is structured around five core pillars:


       ┌────────────────────────────────────────────────────────┐
       │                       BITMAPWIN                        │
       └───────────────────────────┬────────────────────────────┘
                                   │
      ┌──────────────┬─────────────┼──────────────┬──────────────┐
      ▼              ▼             ▼              ▼              ▼
  1. WORLD        2. LAND     3. EXPERIENCES  4. IDENTITY    5. CREATION
  (The Oasis)    (Bitmaps)     (Biternam &     (Passport &   (Land Forge
                                Extenders)      Guardians)    & BWVX)


1. WORLD · The Oasis (/oasis)




Infinite Procedural Terrain: An expansive 3D world where one BITMAP spans exactly 10 avatar strides across.


Deterministic Biomes: Ground textures, topography, and wild voxel entities spawn deterministically based on Bitcoin block entropy (wildBiomeAt).


Performance-First Retro Engine: Optimized 60 FPS Three.js rendering pipeline featuring retro aesthetics, 2.5D diorama camera modes, and zero bloat.




2. LAND · On-Chain Bitmaps (/marketplace, /bitmap/$height)




1:1 Block Representation: Over 900,000+ indexed Bitcoin blocks rendered as physical voxel archipelagos.


Parcel Floor Metric: Strictly enforces Mondrian coverage—each transaction within a block defines an exclusive parcel with full ceiling air rights.


Live Provenance: Traced directly via Bitcoin satpoint movements and unspent outputs (UTXO).




3. EXPERIENCES · Extenders & Biternam (/biternam/*, /launch)




Biternam Interiors: Fixed-camera 2.5D cinematic rooms (Bit-Café, Museum, Outpost, Vault, Lair, Batcave) with dynamic cutscene directors and inventory logic.


Launch Grandstand (/launch): A live 3D spectator stadium featuring permanent seats for 480+ Bitmapper wallets, live L1 VIP tickets, and real-time community mechanics.


Sovereign Grandstands (BW-STAND-1): Inscribed JSON configs enabling permissionless, self-hosted stadiums verified via BIP-322 wallet signatures.




4. IDENTITY · Passport & Guardians (/guardians, /passport)




BIP-322 Sovereign Auth: Zero custodial logins. Ownership and seat access are verified strictly via Bitcoin message signatures.


Morph-from-DNA Guardians: Procedural voxel companions generated deterministically from block headers and transaction hashes (morphFromDna).


On-Chain Pixel Avatars: Live-rendered portraits composited directly from inscribed tile layers on ordinals.com.




5. CREATION · Land Forge & BWVX (/forge)




Tag 11 Master Delegate: Self-contained voxel renderers inscribed on Bitcoin (BWVX1 raw / BWVX2 greedy box compression).


Lean Inscriptions: Creators publish rich 3D structures by inscribing only lightweight CBOR metadata (Tag 5) delegating to the on-chain master renderer.


Recursive Assemblies: Multi-piece modular prefabs referencing independent inscription IDs, flattened dynamically into the Oasis.






🛠️ Technology Stack


Layer	Technology
Framework	TanStack Start v1 (Full-stack React 19, SSR/SSG, Vite 7)
3D Rendering	Three.js / React Three Fiber (@react-three/drei)
Styling & Design System	Tailwind CSS v4, Semantic CSS tokens, Glass instrument panels
Typography	Space Grotesk (display), DM Sans (body), Space Mono (data)
Bitcoin Protocols	BIP-322, Ordinals Tag 11 / Tag 5 CBOR, Taproot single-use seals
Confidential Proofs	Client-side Poseidon SNARKs / Groth16 (SHORD engine)




🚀 Getting Started


Prerequisites




Node.js (v20+ recommended) or Bun


Modern browser with WebGL2 support




Installation


# Clone the repository
git clone https://github.com/<your-username>/bitmapwin.git
cd bitmapwin

# Install dependencies
bun install
# or
npm install

# Start the local development server
bun dev
# or
npm run dev




The application will be running at http://localhost:8080.





📁 Repository Structure


├── src/
│   ├── routes/               # TanStack file-based routes
│   │   ├── index.tsx         # Homepage & First 60s interactive hero
│   │   ├── oasis.tsx         # Infinite 3D procedural world
│   │   ├── launch.tsx        # Live 3D Launch Grandstand & spectator arena
│   │   ├── forge.tsx         # Land Forge 3D voxel builder
│   │   ├── biternam/         # 2.5D fixed-camera interior rooms
│   │   └── marketplace.tsx   # Verified Bitcoin digital land registry
│   ├── components/           # UI components, 3D canvases, and HUD overlays
│   │   ├── biternam/         # Stage rigs, room props, and CRT monitors
│   │   ├── game/             # Character controllers and voxel renderers
│   │   └── ui/               # Terminal-style glass instrument controls
│   ├── lib/                  # Bitcoin, cryptographic, and procedural algorithms
│   │   ├── forge-delegate.ts # Master renderer & CBOR payload packers
│   │   ├── creature-morph.ts # Morph-from-DNA Guardian generator
│   │   ├── sovereign-stand.ts# BW-STAND-1 specification & verification
│   │   └── onchain-engine.ts # Deterministic coordinate & block math
└── public/                   # Static assets and WebAssembly circuits





🔐 Design Principles & Conventions




Only Real On-Chain Facts: No synthetic or mock claims. If an asset isn't proven by a Bitcoin transaction, inscription, or BIP-322 signature, it does not exist in the world.


Terminal Cypherpunk Aesthetic: High-contrast dark UI inspired by ord.net and mempool.space. Two primary signals:



Bitcoin Orange (#F7931A): Ownership, verified state, actions.


Signal Cyan (#00E5FF): Live block data, telemetry, active transmitters.






Sovereignty First: All progressive game unlocks, private backroom passes, and notes reside client-side in browser storage or encrypted device vaults.






🌐 Official Links




Website: bitmapwin.app


X / Twitter: @bitmapwin


Explorer & Ordinals: ordinals.com

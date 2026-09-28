# Block-DNA Guardians + Deposit QR Summoning

## What players get
1. On any BITMAP they hold (verified wallet), a **SUMMON GUARDIAN** button on the BITMAP page, in the inventory, and in the Oasis.
2. A summon dialog with a turning 3D preview of the Guardian that block produces: its species, rarity, HP, bite, speed, armour and signature ability. Everything comes from the real block (transaction count, shape group, halving era, fees, block hash). Nothing is random, and nothing is invented.
3. A payment screen with a Bitcoin QR code (BIP-21) plus the exact amount and a breakdown: summon price, protocol share and network fee. It pays the treasury `bc1qqmu6el7rxdc2va4kzqexhll6ulmrdkwmcdqkxd`.
4. The dialog watches the blockchain (mempool.space). Once it sees a payment of the exact amount to the treasury, followed by one confirmation, the Guardian **awakens**: celebration screen, sound, a ticker entry and an event on the Territory Chronicle.
5. In the Oasis, the Guardian patrols its home BITMAP with its own nameplate and level, and roams using the same brain as the settlers and whales. It also appears on the owner's inventory character sheet.

## Honest scope for phase 1
- The payment is a real Bitcoin transaction, checked on-chain. The Guardian itself is a **BITMAPWIN record tied to the block**. It is not an inscription yet. Inscribing on Bitcoin needs a server-held key for the reveal, which makes it custodial, so it becomes phase 2.
- Each block gets at most one Guardian (first paid summon wins). It stays tied to the BITMAP, and whoever currently holds the BITMAP (live ownership check) controls it.
- Price: 10,000 sats per summon, with the network fee paid by the payer. This is a placeholder you can change.

## Technical details
- `src/lib/bitmon.ts`: a pure function that turns block data into Guardian DNA: 8 species from pattern group mod 8, rarity from halving era and trait rarity, and stats from tx count, fee and size. The block hash seeds colours.
- Database migration:
  - `bitmon_guardians` (block_height unique, species, rarity, stats jsonb, dna_hash, summoned_by_address, payment_txid unique, created_at). It gets a public SELECT policy, and writes happen only on the server.
  - `bitmon_summon_orders` (id, block_height, payer_address, amount_sats with a unique per-order sats tail so payments can be matched, status pending/seen/settled/expired, txid, expires_at). The owner reads their own orders, and writes happen only on the server.
- `src/lib/bitmon.functions.ts`:
  - `createSummonOrderFn`: runs behind auth and needs a verified wallet that owns the block.
  - `checkSummonOrderFn`: scans mempool.space for treasury outputs and settles idempotently.
  - `listGuardiansInChunksFn`: serves the Oasis.
- Components: `bitmon/SummonGuardianDialog.tsx` (preview via `CreatureModel3D` with a tinted body per species, QR, poller, celebration), `game/TerritoryGuardians.tsx` (nearby-only rendering with `createFlyBrain`), plus hooks into the BITMAP page, inventory and Oasis HUD.
- Provenance: a `guardian_summoned` event goes to `provenance_events`, so the ticker and Chronicle pick it up.
- Phase 2 (not now): inscribing Guardians on-chain, arena battles, and marketplace trading.

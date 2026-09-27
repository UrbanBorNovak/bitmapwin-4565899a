# Fill the remaining 40 official traits with real block data

## What changes for you
Trait pages that now say "index data required" will start listing real BITMAPs as a background indexer reads Bitcoin block history. Categories fill in gradually (the whole chain takes a while to read politely from public block explorers). Each page shows how far indexing has reached, so nothing is claimed before it is proven.

## What can be proven, and from where
Every block from 0 to the tip gets one extra record: mined time, block hash, size, total output amount, average fee rate, and the miner's coinbase message.

| Traits | Proven from |
|---|---|
| LEAP DAY | mined time is Feb 29 (UTC) |
| 21E8 | block hash contains `21e8` |
| PRE-SEGWIT FULL | size ≥ ~999,000 bytes before block 481,824 |
| 100K / 250K / 500K / 1M / 3M / 5M OUT | total output amount |
| BILLIONAIRE | outputs × fixed $30k ≥ $1B (official rule) |
| MINED BILLIONAIRE | outputs × BTC price on the mined day ≥ $1B (daily price history) |
| 1K–7K FEE RATE | average fee rate |
| MINER MESSAGE | coinbase contains readable text (the message is shown on the page) |
| CHINESE LUCKY NUMBER | height contains "168" (to be confirmed against the official definition) |

## Traits that need an official list, not block data
PATOSHI, MONDRIAN, NOTABLE EVENT, COMMUNITY PUNK, GRID PUNK, XSPECTAR, BITMAP VALLEY, ROSS ULBRICHT, MICROSTRATEGY, DUAL PALINDROME, the 8 PERFECT PUNKS and the 3 neck punks can't be worked out from block fields alone. Plan:
- PATOSHI: import the published Patoshi block list (public research dataset), with a link to the source.
- Neck and perfect punks: reuse the existing Punks & Patterns shape rules on stored block shapes where they match the official definition exactly.
- The rest stay "index data required" until we get the official Bitmap.Community lists. If you can share them or confirm a source, they plug into the same pages.

## Technical details
- New table `block_facts` (height PK, mined_at, hash, size, total_output_sats, avg_fee_rate, coinbase_text, pool). Public read, service-role write, GRANTs + RLS.
- Crawl-state row plus a public cron route `/api/public/crawl-block-facts` (secret-checked), paging mempool.space `/v1/blocks` (15 per call, extras include outputs/fees/coinbase), with the existing mirror fallback in `chain.server.ts`.
- Daily BTC price table filled from mempool historical-price for MINED BILLIONAIRE.
- Extend `official_trait_bitmaps` and `bitmap_has_height_trait` (nomination check) with the new cases. Mark traits supported once their source exists, and show "indexed through block N" on the page.
- `patoshi_blocks` table seeded from the dataset in a migration.
- Record the indexing rule in AGENTS.md.

# Add official Bitmap traits to the marketplace

## Scope
- Replace the current inferred height labels with the matching official Bitmap.Community names and definitions.
- Add official trait filtering directly to the BITMAP marketplace.
- Show official trait badges on each marketplace BITMAP and retain them on BITMAP detail pages.
- Include a compact trait glossary linked to the source documentation so buyers can understand each filter.

## Accuracy
- Compute only traits that can be proven from the BITMAP block height already on-chain: Mythic, Epic, Rare, first transaction, palindrome, pizza transaction/day, Block 9, Block 78, 66 DAO, prime, Fibonacci, same digits, early-block ranges, binary, and powers of ten.
- Do not label Patoshi, billionaire, miner-message, event, or organization-linked traits without the additional verified block data required by their official definitions.
- Preserve existing real listing, ownership, and confirmed-sale logic unchanged.

## Technical details
- Centralize official labels, descriptions, source keys, and matching rules in the shared traits module.
- Extend the marketplace filter state and card badges using the shared trait functions.
- Keep existing visual tokens and terminal styling; no new backend tables or seeded data.
- Verify the marketplace at desktop and mobile widths and check the latest build result.

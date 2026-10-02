# Fix: canonical BITMAP validation + generator HUD overlap

## What is already fixed (server side)
The VERIFY box on the summon page now rejects a Guardian whose parent is a
duplicate `<height>.bitmap` — it must match the first-is-first inscription in
our index. Nothing more to do there.

## What remains: the generator on ordinals.com
The inscribed Master Generator runs client-side inside ordinals.com and can
only read ordinals.com's own recursive endpoints. It cannot call our index,
so on ordinals.com it can never tell an original BITMAP from a duplicate
claim. That limit is permanent — the fix is to make the generator honest
about it, plus repair the visual bug spotted in the walk-through.

## Changes to `src/lib/guardian-delegate.ts` (V6)
1. **Honest parent label** — when the parent parses as `<height>.bitmap`,
   the HUD line reads `PARENT <height>.BITMAP · FIRST-IS-FIRST CHECK IN APP`
   instead of implying full validation; duplicates are flagged only when the
   parent's content is not a bitmap at all (current behaviour, kept).
2. **HUD overlap fix** — move the bottom-right button bar up so it no longer
   covers the ARMOR stat number on small screens.
3. Regenerate the Master Generator HTML and update the `/dev-tools` panel to
   `VERSION V6`.

## What you must do (cannot be done from here)
4. Download the V6 HTML from `/dev-tools` and inscribe it from your wallet as
   `text/html;charset=utf-8`.
5. Send the new inscription to the platform collection address
   `bc1pjpa5…gpnz7l` (inscription transfer, not a BTC payment).
6. Send me the new inscription ID — I will switch the delegate ID and
   collection parent over, keeping V5 and V1 accepted for already-minted
   Guardians.

## Verification
- Typecheck clean.
- Browser run with mocked block data: HUD label text, button bar position,
  stances / X-ray / OBJ / camera mode still work.
- Real summon + ordinals.com check stays with you (needs your wallet).

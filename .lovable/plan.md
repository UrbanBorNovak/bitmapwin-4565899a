# Living card learning and evolution

## What will change
- Give every living card a persistent memory of plays, attacks, victories, defeats, and ability use.
- Let repeated behavior unlock permanent adaptations with small, predictable stat gains.
- Make card states progress through actual experience and activity, while keeping Oasis builds as a meaningful evolution path.
- Show learning progress, unlocked adaptations, and remembered actions on each card’s detail page.
- Surface evolution moments during matches and preserve all learning locally and across signed-in devices.

## Learning rules
- First play wakes a card from DORMANT to ACTIVE.
- Three plays teach a type-specific adaptation.
- Eight recorded actions teach BATTLE-TESTED.
- Three victories teach VETERAN.
- Experience, activity, victories, and real Oasis builds advance cards toward AWAKENED, DEVELOPED, and LEGENDARY.
- Every permanent stat increase is applied once and recorded in card history.

## Technical details
- Extend the existing living-card data with backward-compatible learning memory and adaptations.
- Normalize older saved cards when loading local or cloud profiles.
- Record play, attack, and match-result events through the existing world-event pipeline.
- Keep blockchain facts, derived traits, and learned game state visibly separate.
- Add focused tests for deterministic unlocks and one-time stat changes.

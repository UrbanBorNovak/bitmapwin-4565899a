<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Port only PlayCanvas maths from src/lib/onchain-engine.ts; the world runs on Three.js.
- Use MemberRibbon with verified badges; never trust browser-held ownership claims.
- Count only confirmed BITMAPWIN JIGGLYPUFF sales matching inscription input and exact seller payout.
- Use Bitmap.Community trait definitions, but expose only locally proven on-chain traits.
- Trait badges require a live unspent-BITMAP wallet scan, expire after 30 days, and expose only proof.
- Paginate official traits without full-index counts to protect the 900k+ BITMAP index.
- Archaeology separates chain facts from attributed notes; publish reviewed records and feature at most three per trait.
- Block traits require stored block_facts or the published Patoshi list; missing records never match.
- Run one active Extender viewer with exact code; otherwise show its BITMAP preview/payload.
- BITMAP pages order identity/market, live territory, facts, history, then community.
- Chronicles use persisted public provenance and aggregate visits; never expose identities or invent history.
- Community Builds joins public BITMAPs to active Extenders and mounts one live viewer.
- Return expected Oasis permission denials as recoverable results, never thrown errors.
- Oasis maps share Atlas/Hilbert/fog; block-fee props lock to the prior 10-block median.
- Oasis progress is device-local; BIT pays fixed EXPLORE_MILESTONES once per account ledger ref.
- Guardians are one-per-block after exact payment; procedural species visuals share GuardianBody. Ordinals use public DNA/summon proof and device-local keys without identity.
- Shadow Assets store only device-derived commitment/nullifier hashes; shadow_commitments has no RLS policy and is reached only through security-definer routines.
- SHORD (src/lib/shord/*) is client-only: keys/notes stay in the browser, prover.ts never fakes a proof.
- SHORD own pool: spend.circom (depth-20 Poseidon) → public/wasm/shord; custodial key from SHORD_POOL_SEED in shord-pool.server.ts, which checks every spend (known root, unused nullifier, Groth16). Single-party dev setup; never claim external-pool compatibility. Why: Bitcoin cannot verify Groth16, so the pool key holder is the trust anchor.
- Direct-to-shield mints bind the note to the inscription's one-time commit address plus a device-held claim secret, accepting only a reveal that spends it and pays output 0 to the pool.

- Guardian collection visuals come from morphFromDna (src/lib/creature-morph.ts) via GuardianBody height prop; species only sets ability/lore line. Why: one block-derived design per BITMAP everywhere.
- Marketplace buys take a 90s server-side checkout hold (reserve_offer RPC, service-role only) before building the PSBT; submit requires the live hold. Why: snipe protection without exposing seller PSBTs.
- Guardian master V7 (src/lib/guardian-delegate-v7.ts) is built from the V6 source by checked string swaps plus one V7 block; V6 stays the active master until V7's inscription id is wired. Why: keeps the live V6 bytes untouched.

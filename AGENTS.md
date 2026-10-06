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
- Guardian master V7 (src/lib/guardian-delegate-v7.ts) is built from the V6 source by checked string swaps plus one V7 block; V7 (#127,517,786) is the active Tag 11 delegate; V6 stays the Tag 3 root. Why: keeps the live V6 bytes untouched.
- BITMAPs ≥942,000 resolve via the vendored on-chain LiveOCI block parser (src/lib/vendor/ord-block-parser.js) in resolveBitmapFromChain, then cache in bitmap_index. Why: OCI pages stop at 941,999.
- Holder Epoch land perks (src/lib/holder-epoch.ts landBoost) come only from bitmap_index genesis + latest traced sale; they scale the daily visitor dividend and the Extender maxHeight. Why: holding is rewarded from chain facts, never browser claims.
- Holding time resets on every on-chain move of the inscription (satpoint tx block via bitmap-custody.server.ts), not only traced sales. Why: transfers and swaps outside recorded sales must not overcount custody.
- Guardian command routes (guardian_dispatches) are waypoint lists between server timestamps; every client derives position from positionAt in src/lib/guardian-dispatch.ts. Why: all players see the same Guardian position without per-frame networking; only the summoning account may deploy.
- Guardian raids settle lazily in settleRaids (guardian-walker.server.ts, called from Command Centre and Oasis): each lap of a march (repeat orders loop by clock, no cron) that reaches a guarded BITMAP fights via resolveRaid seeded by dispatch id + lap; spoils go to bitmap_spoils via land_raid_spoils, and recent public outcomes render on the winner's Oasis land. Why: deterministic, replayable, publicly visible outcomes with no polling job.
- Server-managed secret tables use explicit deny-all browser policies plus revoked anon/authenticated grants; only trusted server routines receive table access. Why: player tokens, commitments, wallet proofs, and withdrawal details must never be readable through the Data API.
- Host & Earn deployments are extender_deployments with config.hostAndEarn=true, created via hostExtender (latest published version, live ownership via deployExtender); runDailyRewards splits their visitor BIT by HOST_SPLIT between land holder and extender creator. Why: holders earn from land without coding, transfers, or payment.
- District Fiefdom: runDailyRewards pays FIEF_SPLIT of each visited BITMAP's visitor BIT pro-rata to valid on-chain parcel holders via parcelHoldersFor (src/lib/parcel-fief.server.ts, first claim per tx index, live holder). Why: parcel shares come only from chain scans, never browser claims.

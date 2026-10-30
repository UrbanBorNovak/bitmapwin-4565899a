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
- Guardian collection visuals come from morphFromDna (src/lib/creature-morph.ts) via GuardianBody height prop; species only sets ability/lore line. Why: one block-derived design per BITMAP everywhere.
- Marketplace buys take a 90s server-side checkout hold (reserve_offer RPC, service-role only) before building the PSBT; submit requires the live hold. Why: snipe protection without exposing seller PSBTs.
- BITMAPs ≥942,000 resolve via the vendored on-chain LiveOCI block parser (src/lib/vendor/ord-block-parser.js) in resolveBitmapFromChain, then cache in bitmap_index. Why: OCI pages stop at 941,999.
- Holding time resets on every on-chain move of the inscription (satpoint tx block via bitmap-custody.server.ts), not only traced sales. Why: transfers and swaps outside recorded sales must not overcount custody.
- Guardian command routes (guardian_dispatches) are waypoint lists between server timestamps; every client derives position from positionAt in src/lib/guardian-dispatch.ts. Why: all players see the same Guardian position without per-frame networking; only the summoning account may deploy.
- Guardian raids settle lazily in settleRaids (guardian-walker.server.ts): each march lap reaching a guarded BITMAP fights via resolveRaid seeded by dispatch id + lap; spoils go to bitmap_spoils. Why: deterministic, public outcomes with no cron.
- Server-managed secret tables use explicit deny-all browser policies plus revoked anon/authenticated grants; only trusted server routines receive table access. Why: player tokens, commitments, wallet proofs, and withdrawal details must never be readable through the Data API.
- Host & Earn = extender_deployments with config.hostAndEarn=true via hostExtender (live ownership); runDailyRewards splits visitor BIT by HOST_SPLIT. Why: holders earn without coding.
- Oasis touch input is sampled and damped in the camera frame loop, with immediate movement release; touch pads are world-relative and navigation reserves their space. Why: smooth, frame-rate-independent controls without drifting or overlapping thumbs.
- Public game/chain tables (dispatches, spoils, forge modules/builds, kits, custody, genesis minters, spawn points, oasis voxels, kennels) stay world-readable via RLS but expose only non-account columns through column-level GRANTs; internal user uuids are read only by server code. Why: shared world state is public, account linkage is not.
- Subdirectories have their own AGENTS.md; read it before changing files there.
- Marketplace Bitmon pattern filter (BitmonPatternFilter + block-stats patternHeightsQuery) matches only verified block_stats.pattern records, separate from Guardian species; groups above PATTERN_GROUP_MAX are refused, never truncated. Why: Bitmons are block shapes, not creatures.
- Clips: @bitlodo studio vendored unmodified in public/tools/clips. Why: full fidelity.
- Marketplace ALL-tab filters use fetchRegistryScope (finite candidate sets × height ranges, checked in bitmap_index). Why: exact totals without loading the full index.
- Every R3F canvas goes through SafeCanvas (offsetSize measuring). Why: page-size CSS zoom on <html> makes rect measuring grow canvases until WebGL fails.
- Sovereign Grandstand (BW-STAND-1, src/lib/sovereign-stand.ts): a stand is an inscribed JSON config whose inscription id is its identity; seats in stand_seats keep the BIP-322 signature and are written only by claimStandSeatFn after signature + live BITMAP-in-range checks; Convention Badge tiers count distinct stands. Why: inscription viewers block network access, so the inscription carries identity/rules and any site can re-verify public seat proofs.
- Found puzzle keys persist only as ECDH-sealed backups in src/lib/key-vault.ts (passphrase-wrapped private half, never stored passphrase); backups are deleted only by explicit typed user action, never on sweep. Why: unattended finds must survive crashes without readable keys at rest or on the server.

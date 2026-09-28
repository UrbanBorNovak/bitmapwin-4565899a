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
- On-chain engine references live in src/lib/onchain-engine.ts; PlayCanvas scripts are never loaded — only their maths (noise/shaders) is ported to Three.js, because the world runs on Three.js.
- Use the shared MemberRibbon for active profile and wallet membership markers, backed by the verified membership badge; this keeps holder and donation displays consistent without trusting browser-held ownership claims.
- Count JIGGLYPUFF sales only from confirmed BITMAPWIN purchases with a matching inscription input and exact seller payout; ordinary transfers and change outputs cannot prove a sale price.
- Marketplace traits use Bitmap.Community definitions but expose only locally proven on-chain traits.
- Official trait holder badges require a live verified-wallet scan of unspent BITMAP inscriptions and expire after 30 days; public UI reads only the resulting badge proof.
- Official trait lists detect a next page without full-index counts, keeping the 900k+ BITMAP index responsive.
- BITMAP Archaeology separates chain-verified facts from attributed community field notes; only reviewed records are public and at most three are featured per official trait.
- Block-derived official traits read only from stored block_facts (mempool.space headers/extras) and the published Patoshi list; a block without a record never matches.
- One public viewer runs active Extender code/config as interactive 3D with exact code; otherwise use the BITMAP preview/payload.
- BITMAP pages order identity/market, live territory, facts, history, then community.
- Territory Chronicles derive only from persisted public provenance and aggregate visitor statistics; never expose visitor identities or synthesize missing history.
- Community Builds joins public BITMAP pages with active Extenders and mounts one live viewer for WebGL stability.
- Expected Oasis permission denials return results, not thrown errors, so actions remain recoverable in-world.
- Oasis maps share painted Atlas/Hilbert/fog; block-fee props lock to the prior 10-block median.
- Oasis discovery progress is device-local; BIT pays only on fixed EXPLORE_MILESTONES, once per account via ledger ref, so farming is bounded.
- Block-DNA Guardians are derived purely from public block data (src/lib/bitmon.ts) and created only server-side after an exact-amount treasury payment confirms; one per block, because the chain payment is the only trusted proof.
- Shadow Assets store only pass commitment/nullifier hashes (src/lib/shadow-vault.ts derives them on-device); shadow_commitments has no RLS policy and is reached solely through the security-definer routines, so no wallet or account is ever linked to a pass.

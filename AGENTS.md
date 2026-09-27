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
- Marketplace trait labels and filters use Bitmap.Community definitions, but expose only traits provable from locally verified on-chain fields; this prevents unsupported rarity claims.
- Official trait holder badges require a live verified-wallet scan of unspent BITMAP inscriptions and expire after 30 days; public UI reads only the resulting badge proof.
- Official trait lists detect a next page without full-index counts, keeping the 900k+ BITMAP index responsive.
- BITMAP Archaeology separates chain-verified facts from attributed community field notes; only reviewed records are public and at most three are featured per official trait.

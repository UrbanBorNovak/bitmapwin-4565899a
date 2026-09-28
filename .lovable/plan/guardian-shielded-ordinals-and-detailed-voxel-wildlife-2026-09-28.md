# Guardian Shielded Ordinals and Detailed Voxel Wildlife

## Goal
Make every awakened Block-DNA Guardian eligible for its own rich Ordinals artifact, while upgrading the procedural voxel animals and Guardians across the Oasis and Bestiary.

## Build
- Add a deterministic Guardian artifact generated from the block’s real DNA, species, rarity, stats, ability, and summon transaction.
- Derive a shield commitment from those public Guardian facts without embedding the summoner’s wallet or account in the artifact.
- Show the Ordinals inscriber automatically after a Guardian awakens or when its existing summon is reopened.
- Reuse the existing non-custodial two-step commit/reveal flow, with exact live miner pricing, local recovery data, wallet delivery, and Bitcoin/Ordinals links.
- Clearly distinguish the original 1,000-sat Guardian summon from the additional Bitcoin miner cost required for the rich inscription.
- Rebuild each procedural voxel species with recognizable silhouettes and finer details: eyes, muzzles, ears, tails, feet, horns/tusks, markings, segmented limbs, wings, and species-specific features.
- Increase Block-DNA Guardian detail for golem, wisp, bird, wyrm, and beast bodies while preserving deterministic colors and rarity effects.
- Keep all existing fly-brain movement, combat, spawning, on-chain models, and mobile quality limits unchanged.

## Validation
- Check the Guardian dialog before payment and after an existing awakened Guardian.
- Verify the artifact preview contains no wallet/account identity and produces a valid commit/reveal job.
- Open the Oasis and Bestiary to confirm detailed animals render, remain grounded, animate, and do not blank the scene.
- Check desktop and phone layouts, runtime errors, and the preview build.

## Technical details
- Generalize the current Shadow inscriber so it can accept a deterministic Guardian SVG, custom copy, and a stable 32-byte commitment.
- Keep private reveal keys only in device storage; do not write them to the backend.
- The Ordinal itself is public and transferable. “Shielded” refers to excluding wallet/account identity from its payload, not hiding the inscription or its Bitcoin owner.

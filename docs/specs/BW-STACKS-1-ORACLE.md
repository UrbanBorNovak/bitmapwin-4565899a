# BW-STACKS-1 - ownership-checking key (oracle) design

Status: draft. Contract `contracts/bitmap-sbtc-stake.clar` implements every on-chain rule below and
passes 10 simulator scenarios (`contracts/sim`). Nothing is deployed; no key exists yet.

## 1. Three keys, three powers
| Role | Who holds it | Can | Cannot |
|---|---|---|---|
| **Admin** | 2-of-3 Stacks multisig, hardware wallets, three different people. Never on a server. | schedule / revoke / emergency-replace oracle keys, unpause, set rate cap, add pausers | move anyone's sBTC |
| **Pauser** | watcher bot (server secret) + each admin's phone wallet | `pause` | unpause, touch keys, move funds. Stolen = downtime only |
| **Oracle** | one key per *epoch*, non-exportable | sign custody attestations | move funds, change roles, unpause, sign for another Stacks address, be replayed on another contract or chain |

## 2. Storage
- **Testnet:** key as a Lovable Cloud secret read by exactly one server module (`stacks-oracle.server.ts`). Anyone with project access could sign - acceptable only for test sBTC.
- **Mainnet:** secp256k1 key generated *inside* a cloud KMS (AWS KMS `ECC_SECG_P256K1`), marked non-exportable. The website holds only a credential limited to `kms:Sign` on that one key, also a server secret. The KMS DER signature is converted to 65-byte r||s||v with low-S before submission. Trust left: the KMS provider and whoever can reach that credential.
- The private key is never logged, returned, put in the database, or sent to a browser.

## 3. Restrictions
On-chain (enforced by the contract):
- Signed message = sha256 of the Clarity tuple `{domain "BW-STACKS-1", contract, chain-id, epoch, height, owner, weight, issued}` - no reuse across contracts, networks or key epochs.
- `owner` is the transaction sender: a signature only ever helps the address it names.
- Weight <= 2,922; must be submitted within 6 blocks of `issued`; valid 144 blocks.
- **Rate cap:** new weight per Bitcoin block is limited (default 20,000). Taking over someone else's BITMAP counts in full.
- New stakes start with zero share of past funding, so a stolen key can never reach sBTC already earned.

Off-chain (signer rules):
- Signs only after its own live lookup: BIP-322 binding fresh (10 min), canonical holder from LiveOCI + current satpoint at that address, weight from `stakeWeight()` using server-side holding days and stored slab grade. Nothing but the height and Stacks address come from the browser.
- Per-address and global signing limits.
- Every signature is logged (height, Stacks owner, weight, epoch, issued, time) in a deny-all table. No secrets in it; it exists so the watcher can compare.

## 4. Rotation
- **Scheduled, every 90 days:** admin multisig calls `schedule-key(new)`. New key starts in 144 blocks; old key keeps working 144 more blocks, then retires. Holders re-attest daily anyway, so nobody notices.
- Retired-but-not-revoked keys leave existing stakes fully valid.

## 5. Detection
Watcher job (every few minutes):
1. Reads every `attest` call on the contract from a Stacks API.
2. Any attestation with no matching signer-log row -> **pause immediately** with the pauser key.
3. Also pauses on: rate cap hit, an unexpected admin call, signer-log volume spike.
4. Evicts expired and void stakes each block.

## 6. Compromise runbook
1. **Pause** (watcher or any admin phone, seconds). Attest, fund, claim and evict stop. Funds stay put.
2. **Disable** the website's KMS credential and rotate the server secrets.
3. Admin multisig calls `emergency-key(newKey, compromisedFrom)` - only allowed while paused. It revokes the current epoch from that Bitcoin height and installs the new key at once. Pick `compromisedFrom` conservatively (earliest unmatched attestation, or the key's start).
4. **Unpause.** Stakes signed by the bad key at or after `compromisedFrom` cannot claim; `evict` returns their rewards to the pool for honest stakers. Stakes signed before that height are untouched.
5. Holders whose stake was signed by the revoked key re-attest with one click under the new key.
6. Publish a post-mortem with the on-chain evidence.

**Worst case:** sBTC funded between the start of the compromise and the pause, shared with forged weight up to the rate cap. Recycling on eviction returns forged shares to honest holders. Honest stakes signed during the compromise window also have that window's rewards recycled - the contract cannot tell them apart.

## 7. Known limits
- While paused, honest holders cannot claim.
- The admin multisig can install any key: holders trust those three people. A future version could add a time-lock on non-emergency admin actions.
- Stacks cannot read Ordinals; custody truth is the oracle's word, checked publicly afterwards.

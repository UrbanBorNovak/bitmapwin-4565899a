# Shadow Passes & Private Relics

Status: Beta · Reference: `src/lib/shord/`, `src/lib/biternam-backroom.ts`

## Model

- A pass is a secret kept on the device. The server stores only `commitment = Poseidon(secret, …)` and, once spent, a one-time `nullifier`.
- Commitment tables are deny-all and can be reached only through security-definer routines.
- Handoffs between holders are signed with Schnorr. Recovery uses a backup file kept on the user's own device.

## Backrooms (Vault, Lair)

- A pass is issued only after the earning room is solved on the server; one pass per account.
- The claims table never stores the pass fingerprint, and timestamps are truncated to the day.
- Every protected step (take/use) re-checks the pass on the server. Scenes, look and talk stay public.

## SHORD pool

Groth16 spend circuit (depth-20 Poseidon tree). Bitcoin cannot verify Groth16, so **the pool key holder is the trust anchor**. This is a single-party setup and claims no compatibility with external pools.

## Honest limits

The fingerprint check for backrooms is not zero-knowledge. Privacy holds against the stored and logged data, not against a malicious server.

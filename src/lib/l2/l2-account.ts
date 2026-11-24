import { z } from "zod";

export const accountDraftSchema = z.object({
  login: z.string().regex(/^[a-z0-9]{3,14}$/),
  address: z.string().regex(/^bc1[qp][a-z0-9]{38,60}$/),
  passwordCommitment: z.string().regex(/^[a-f0-9]{64}$/),
});
export const accountProofSchema = accountDraftSchema.extend({
  nonce: z.string().uuid(),
  expiresAt: z.number().int().positive(),
  signature: z.string().min(20).max(2048),
  passwordHash: z.string().regex(/^[A-Za-z0-9+/]{27}=$/),
});
export type AccountDraft = z.infer<typeof accountDraftSchema>;
export type AccountProof = z.infer<typeof accountProofSchema>;

export function accountMessage(d: AccountDraft & { nonce: string; expiresAt: number }) {
  return ["BITMAPWIN L2 ACCOUNT · v1", "Domain: bitmapwin.app", `Login: ${d.login}`, `Bitcoin address: ${d.address}`,
    `Password commitment: ${d.passwordCommitment}`, `Nonce: ${d.nonce}`, `Expires: ${d.expiresAt}`,
    "Create one new L2 account. No transaction, land rights or BIT rewards."].join("\n");
}

/** Legacy L2 verifier, never plaintext. Treat the verifier itself as a secret. */
export async function legacyPasswordHash(password: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password)));
  return btoa(String.fromCharCode(...bytes));
}
export async function passwordCommitment(hash: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(hash)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
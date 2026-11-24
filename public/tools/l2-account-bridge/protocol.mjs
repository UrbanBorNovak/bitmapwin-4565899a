import { createHash, timingSafeEqual } from 'node:crypto';
import { Verifier } from 'bip322-js';

export function accountMessage(d) {
  return ['BITMAPWIN L2 ACCOUNT · v1', 'Domain: bitmapwin.app', `Login: ${d.login}`, `Bitcoin address: ${d.address}`,
    `Password commitment: ${d.passwordCommitment}`, `Nonce: ${d.nonce}`, `Expires: ${d.expiresAt}`,
    'Create one new L2 account. No transaction, land rights or BIT rewards.'].join('\n');
}
export function validDraft(d) {
  return d && /^[a-z0-9]{3,14}$/.test(d.login ?? '') && /^bc1[qp][a-z0-9]{38,60}$/.test(d.address ?? '')
    && /^[a-f0-9]{64}$/.test(d.passwordCommitment ?? '') && /^[a-f0-9-]{36}$/.test(d.userId ?? '');
}
export function verifyProof(d, now = Date.now()) {
  if (!validDraft(d) || !/^[a-f0-9-]{36}$/.test(d.nonce ?? '') || !Number.isSafeInteger(d.expiresAt)
    || d.expiresAt <= now || d.expiresAt > now + 300_000 || !/^[A-Za-z0-9+/]{27}=$/.test(d.passwordHash ?? '')
    || typeof d.signature !== 'string' || d.signature.length > 2048) return false;
  if (createHash('sha256').update(d.passwordHash).digest('hex') !== d.passwordCommitment) return false;
  try { return Verifier.verifySignature(d.address, accountMessage(d), d.signature); } catch { return false; }
}
export function authorized(header, secret) {
  if (!secret || secret.length < 32 || typeof header !== 'string') return false;
  const expected = Buffer.from(`Bearer ${secret}`), actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
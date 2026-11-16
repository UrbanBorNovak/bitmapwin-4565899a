/**
 * BW-STACKS-1 soft-stake helpers (pure, browser-safe).
 * The BITMAP never moves: the holder signs a BIP-322 binding message on L1,
 * a relayer checks live custody, and the Clarity vault only accrues sBTC
 * while an oracle attestation for that custody is unexpired.
 */
export const STAKE_PREFIX = "BITMAPWIN-STAKE-1";
/** Attestations expire after this many Bitcoin blocks (~1 day). */
export const ATTESTATION_TTL = 144;
/** Weight cap on holding days so ancient wallets can't dominate. */
export const MAX_HOLD_DAYS = 1460;

export interface Binding {
  height: number;
  btcAddress: string;
  stxAddress: string;
  issuedAt: number; // unix seconds
}

const STX_RE = /^S[PM][0-9A-HJKMNP-TV-Z]{38,40}$/;
const BTC_RE = /^(bc1p|tb1p|bcrt1p)[02-9ac-hj-np-z]{58}$/;

export function validateBinding(b: Binding): string | null {
  if (!Number.isInteger(b.height) || b.height < 0) return "Invalid BITMAP height";
  if (!BTC_RE.test(b.btcAddress)) return "Bitcoin address must be Taproot (bc1p…)";
  if (!STX_RE.test(b.stxAddress)) return "Invalid Stacks address";
  if (!Number.isInteger(b.issuedAt) || b.issuedAt <= 0) return "Invalid timestamp";
  return null;
}

/** Exact text the holder signs with BIP-322. Order and newlines are fixed. */
export function bindingMessage(b: Binding): string {
  const err = validateBinding(b);
  if (err) throw new Error(err);
  return [
    STAKE_PREFIX,
    `bitmap: ${b.height}.bitmap`,
    `btc: ${b.btcAddress}`,
    `stx: ${b.stxAddress}`,
    `issued: ${b.issuedAt}`,
  ].join("\n");
}

/** Proofs older than 10 minutes or from the future (>2 min skew) are refused. */
export function bindingFresh(issuedAt: number, nowSec: number): boolean {
  return issuedAt <= nowSec + 120 && nowSec - issuedAt <= 600;
}

/**
 * Integer weight: (1 + min(days held, cap)) × grade multiplier (grade 1–10 → 10–100, /10).
 * Ungraded BITMAPs use grade 5 (×1.0 baseline would be 50/10 = 5 → we normalise to 10).
 */
export function stakeWeight(daysHeld: number, grade: number | null): number {
  const d = Math.max(0, Math.min(MAX_HOLD_DAYS, Math.floor(daysHeld)));
  const g = grade == null ? 5 : Math.max(1, Math.min(10, Math.round(grade)));
  // grade 5 → ×1.0, grade 10 → ×2.0, grade 1 → ×0.2
  return Math.floor(((1 + d) * g) / 5);
}

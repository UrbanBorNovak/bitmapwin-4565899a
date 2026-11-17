/**
 * BW-STACKS-1 soft-stake helpers (pure, browser-safe).
 * The BITMAP never moves: the holder signs a BIP-322 binding message on L1,
 * the oracle checks live custody, and the Clarity vault only accrues while an
 * oracle attestation for that custody is unexpired.
 */
export const STAKE_PREFIX = "BITMAPWIN-STAKE-1";
/** Weight cap on holding days so ancient wallets can't dominate. */
export const MAX_HOLD_DAYS = 1460;
/** Mainnet rewards are switched off. Only the testnet pilot exists. */
export const MAINNET_REWARDS_ENABLED = false as const;
export type StakeNetwork = "testnet" | "mainnet";

export interface Binding {
  height: number;
  btcAddress: string;
  stxAddress: string;
  issuedAt: number; // unix seconds
  network: StakeNetwork;
}

const STX_MAINNET = /^S[PM][0-9A-HJKMNP-TV-Z]{38,40}$/;
const STX_TESTNET = /^S[TN][0-9A-HJKMNP-TV-Z]{38,40}$/;
const BTC_RE = /^bc1p[02-9ac-hj-np-z]{58}$/;

export const isTestnetStx = (a: string) => STX_TESTNET.test(a);
export const isMainnetStx = (a: string) => STX_MAINNET.test(a);

export function validateBinding(b: Binding): string | null {
  if (b.network !== "testnet" && !MAINNET_REWARDS_ENABLED) return "Mainnet rewards are disabled";
  if (!Number.isInteger(b.height) || b.height < 0 || b.height > 2_000_000) return "Invalid BITMAP height";
  if (!BTC_RE.test(b.btcAddress)) return "Bitcoin address must be Taproot (bc1p…)";
  if (b.network === "testnet" && !isTestnetStx(b.stxAddress)) {
    return isMainnetStx(b.stxAddress) ? "Switch your Stacks wallet to Testnet" : "Invalid Stacks testnet address";
  }
  if (!Number.isInteger(b.issuedAt) || b.issuedAt <= 0) return "Invalid timestamp";
  return null;
}

/** Exact text the holder signs with BIP-322. Order and newlines are fixed. */
export function bindingMessage(b: Binding): string {
  const err = validateBinding(b);
  if (err) throw new Error(err);
  return [
    STAKE_PREFIX,
    `network: stacks-${b.network}`,
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
 * Integer weight: (1 + min(days held, cap)) × grade / 5.
 * Ungraded = grade 5 (×1.0); grade 10 = ×2.0; grade 1 = ×0.2.
 */
export function stakeWeight(daysHeld: number, grade: number | null): number {
  const d = Math.max(0, Math.min(MAX_HOLD_DAYS, Math.floor(daysHeld)));
  const g = grade == null ? 5 : Math.max(1, Math.min(10, Math.round(grade)));
  return Math.floor(((1 + d) * g) / 5);
}

/** A stake's share of total active weight, in basis points (10,000 = 100%), rounded down. */
export function stakeShareBps(weight: number, activeWeight: number): number {
  if (!(weight > 0) || !(activeWeight > 0) || weight > activeWeight) return 0;
  return Math.floor((weight * 10_000) / activeWeight);
}

/**
 * Claimable rewards follow the contract exactly: every top-up adds amount / total weight
 * to a running "reward per weight"; a stake is owed weight × (growth since it was staked),
 * rounded down. This returns that growth per weight, recovered from the claimable figure.
 */
export function rewardPerWeight(claimable: number, weight: number): number {
  return weight > 0 ? Math.floor(claimable / weight) : 0;
}

/**
 * BW-STACKS-1 testnet watchdog (pure, browser-safe). Compares every `attest`
 * call on the pilot contract with the oracle's own signing log. An attestation
 * the oracle never logged means the oracle key signed something outside the
 * website, so the pilot must pause. Testnet only: mainnet rewards stay off.
 */
export type ContractTx = {
  txid: string;
  status: "success" | "pending" | "failed";
  fn: string;
  sender: string;
  burnHeight: number | null; // null while in the mempool
  args: string[]; // Clarity reprs, e.g. "u1"
};
export type LogRow = { stx_address: string; height: number; weight: number; epoch: number; issued: number };
export type Finding = {
  kind: "unmatched-attest" | "admin-call" | "log-spike" | "rejected-attest" | "pool-mismatch" | "pool-outflow" | "claim-recipient" | "direct-deposit" | "pool-moving" | "fund-sender" | "pool-held-mismatch";
  suspicious: boolean;
  txid?: string;
  sender?: string;
  height?: number | undefined;
  detail: string;
};

/** Burn height the watchdog was switched on. Earlier calls were the pre-watchdog deploy tests. */
export const WATCHDOG_ARMED_FROM = 39282; // bw-stake-pilot-v2 deploy
/** Calls only the admin may make. Any one the team has not acknowledged pauses the pilot. */
export const ADMIN_FUNCTIONS = ["set-admin", "set-pauser", "set-rate-cap", "unpause", "schedule-key", "revoke-epoch", "emergency-key", "set-funding"];
/** Admin txids reviewed by the team (e.g. the unpause after an incident). */
export const ACKNOWLEDGED_ADMIN_TXIDS: string[] = [
  "0x2f4d1d5631f118ab6187fa5ceb302803ac193debae0a7f4dbf75609eb4ed1761", // unpause after the 2026-11-16 pause drill
  "0x6e449a7311d29b7d4358355e0cd8244b78c7da6e7576451cffee9f6a77c847fc", // unpause after the watchdog re-paused on the drill unpause
  "0xf3bc9e39257131ef9695717066d40e2c2fd37a762e65d17efd22680f3bf399cb", // set-pauser: grant the dedicated pause-only key
  "0x7c7581174bad6bf52ebaa6672c8dc63ecf0f22481e1f2df758bd173e47941ee0", // set-pauser: remove the admin from the pauser list
  "0xb0a2845f682d7fff941249b46ad24c61691469a6fd73709c99bb88efca2e3370", // unpause after the pause-only key drill
];
/** More oracle signatures than this in one hour is treated as a signer spike. */
export const MAX_SIGNATURES_PER_HOUR = 60;

const uint = (repr: string | undefined) => {
  const m = /^u(\d+)$/.exec(repr ?? "");
  return m ? Number(m[1]) : NaN;
};
const key = (r: { owner: string; height: number; weight: number; epoch: number; issued: number }) =>
  `${r.owner}|${r.epoch}|${r.height}|${r.weight}|${r.issued}`;

export function assertTestnetContract(contractId: string) {
  if (!/^S[TN][0-9A-Z]+\.[a-z0-9-]+$/i.test(contractId)) throw new Error("Watchdog runs only against a Stacks testnet contract");
}

/** Compare contract calls with the signing log. Each log row can vouch for one attest call only. */
export function compareAttestations(txs: ContractTx[], log: LogRow[], signaturesLastHour: number, armedFrom = WATCHDOG_ARMED_FROM): Finding[] {
  const budget = new Map<string, number>();
  for (const r of log) {
    const k = key({ owner: r.stx_address, height: r.height, weight: r.weight, epoch: r.epoch, issued: r.issued });
    budget.set(k, (budget.get(k) ?? 0) + 1);
  }
  const findings: Finding[] = [];
  const inScope = txs.filter((t) => t.burnHeight == null || t.burnHeight >= armedFrom);
  // Oldest first so the earliest call consumes the log row.
  inScope.sort((a, b) => (a.burnHeight ?? Infinity) - (b.burnHeight ?? Infinity));
  for (const t of inScope) {
    if (t.fn === "attest") {
      const [e, h, w, iss] = t.args.map(uint);
      const height = Number.isFinite(h) ? h : undefined;
      if (t.status === "failed") {
        findings.push({ kind: "rejected-attest", suspicious: false, txid: t.txid, sender: t.sender, height, detail: "The contract refused this attestation, so it changed nothing." });
        continue;
      }
      const k = key({ owner: t.sender, height: h!, weight: w!, epoch: e!, issued: iss! });
      const left = budget.get(k) ?? 0;
      if ([e, h, w, iss].some((n) => !Number.isFinite(n)) || left <= 0) {
        findings.push({ kind: "unmatched-attest", suspicious: true, txid: t.txid, sender: t.sender, height, detail: "Accepted or pending stake with no matching entry in the oracle's signing log." });
      } else budget.set(k, left - 1);
    } else if (ADMIN_FUNCTIONS.includes(t.fn) && t.status !== "failed" && !ACKNOWLEDGED_ADMIN_TXIDS.includes(t.txid)) {
      findings.push({ kind: "admin-call", suspicious: true, txid: t.txid, sender: t.sender, detail: `Unacknowledged admin call: ${t.fn}.` });
    }
  }
  if (signaturesLastHour > MAX_SIGNATURES_PER_HOUR) {
    findings.push({ kind: "log-spike", suspicious: true, detail: `${signaturesLastHour.toLocaleString("en-US")} oracle signatures in the last hour (limit ${MAX_SIGNATURES_PER_HOUR}).` });
  }
  return findings;
}

/** Pause only when something is suspicious, the contract is not paused yet, and no pause is already in flight. */
export function shouldPause(findings: Finding[], contractPaused: boolean | null, pauseInFlight: boolean): boolean {
  return findings.some((f) => f.suspicious) && contractPaused !== true && !pauseInFlight; // unreadable status still pauses
}

// ---------- reward pool reconciliation ----------
/** A confirmed transaction touching the pool, with its token transfers (Hiro transactions_with_transfers). */
export type PoolTx = {
  txid: string;
  status: "success" | "failed";
  fn: string | null; // pilot function name, null when the tx is not a pilot call (e.g. a plain token transfer)
  sender: string;
  transfers: { asset: string; amount: string; sender: string | null; recipient: string | null }[];
};
export type PoolSummary = { funded: string; paidOut: string; direct: string; expected: string; actual: string; matches: boolean; held?: string | null; funding?: FundingConfig | null };
/** The contract's own funding guard, read live from `funding`. Amounts are strings (uint). */
export type FundingConfig = { funder: string; perCall: string; periodLen: number; perPeriod: string; poolMax: string; poolHeld: string; fundedThisPeriod: string; period: number };

/** Pilot calls that may legitimately pay tokens out: claim pays the caller, attest/evict settle a replaced or closed stake. */
export const PAYOUT_FUNCTIONS = ["claim", "attest", "evict"];

/**
 * Rebuild the pool balance from its full confirmed history and compare it with the live balance.
 * Tokens may only enter through `fund` (direct transfers are reported, not suspicious, since anyone can send them)
 * and only leave through claim/attest/evict. Any other outflow, a claim paid to someone other than the caller,
 * or a live balance that differs from the rebuilt one is suspicious. BigInt maths: amounts never lose precision.
 */
export function reconcilePool(txs: PoolTx[], actualBalance: bigint, pool: string, asset: string, opts: { treasury?: string; contractHeld?: bigint | null } = {}): { findings: Finding[]; summary: PoolSummary } {
  let funded = 0n, paid = 0n, direct = 0n;
  const findings: Finding[] = [];
  for (const t of txs) {
    if (t.status !== "success") continue; // failed transactions move nothing
    for (const x of t.transfers) {
      if (x.asset !== asset) continue;
      const amt = BigInt(x.amount);
      if (x.recipient === pool && x.sender !== pool) {
        if (t.fn === "fund") {
          funded += amt;
          if (opts.treasury && t.sender !== opts.treasury) findings.push({ kind: "fund-sender", suspicious: true, txid: t.txid, detail: `${amt.toLocaleString("en-US")} test sats were funded by an address that is not the treasury.` });
        }
        else { direct += amt; findings.push({ kind: "direct-deposit", suspicious: false, txid: t.txid, detail: `${amt.toLocaleString("en-US")} test sats sent straight to the pool, outside fund. Counted, not shared out.` }); }
      } else if (x.sender === pool && x.recipient !== pool) {
        paid += amt;
        if (!t.fn || !PAYOUT_FUNCTIONS.includes(t.fn)) {
          findings.push({ kind: "pool-outflow", suspicious: true, txid: t.txid, detail: `${amt.toLocaleString("en-US")} test sats left the pool through ${t.fn ?? "a non-pilot call"}, which should never pay out.` });
        } else if (t.fn === "claim" && x.recipient !== t.sender) {
          findings.push({ kind: "claim-recipient", suspicious: true, txid: t.txid, detail: `A claim paid ${amt.toLocaleString("en-US")} test sats to an address other than the one claiming.` });
        }
      }
    }
  }
  const expected = funded + direct - paid;
  const matches = expected === actualBalance;
  if (!matches) {
    findings.push({ kind: "pool-mismatch", suspicious: true, detail: `Pool holds ${actualBalance.toLocaleString("en-US")} test sats but funding minus payouts gives ${expected.toLocaleString("en-US")}.` });
  }
  // The contract's pool-held counts funding minus payouts and must ignore unsolicited transfers.
  const heldExpected = funded > paid ? funded - paid : 0n;
  if (opts.contractHeld != null && opts.contractHeld !== heldExpected) {
    findings.push({ kind: "pool-held-mismatch", suspicious: true, detail: `The contract counts ${opts.contractHeld.toLocaleString("en-US")} test sats of funded rewards but funding minus payouts gives ${heldExpected.toLocaleString("en-US")}.` });
  }
  const str = (n: bigint) => n.toString();
  return { findings, summary: { funded: str(funded), paidOut: str(paid), direct: str(direct), expected: str(expected), actual: str(actualBalance), matches: matches && (opts.contractHeld == null || opts.contractHeld === heldExpected), held: opts.contractHeld == null ? null : str(opts.contractHeld) } };
}

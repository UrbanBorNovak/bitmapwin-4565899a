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
  kind: "unmatched-attest" | "admin-call" | "log-spike" | "rejected-attest";
  suspicious: boolean;
  txid?: string;
  sender?: string;
  height?: number | undefined;
  detail: string;
};

/** Burn height the watchdog was switched on. Earlier calls were the pre-watchdog deploy tests. */
export const WATCHDOG_ARMED_FROM = 39264;
/** Calls only the admin may make. Any one the team has not acknowledged pauses the pilot. */
export const ADMIN_FUNCTIONS = ["set-admin", "set-pauser", "set-rate-cap", "unpause", "schedule-key", "revoke-epoch", "emergency-key"];
/** Admin txids reviewed by the team (e.g. the unpause after an incident). */
export const ACKNOWLEDGED_ADMIN_TXIDS: string[] = [
  "0x2f4d1d5631f118ab6187fa5ceb302803ac193debae0a7f4dbf75609eb4ed1761", // unpause after the 2026-11-16 pause drill
  "0x6e449a7311d29b7d4358355e0cd8244b78c7da6e7576451cffee9f6a77c847fc", // unpause after the watchdog re-paused on the drill unpause
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

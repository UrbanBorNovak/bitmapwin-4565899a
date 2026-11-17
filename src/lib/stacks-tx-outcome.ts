// Live outcome of wallet-signed Stacks testnet transactions, with contract
// refusal codes turned into plain sentences. Browser-safe: no @stacks imports.
import { HIRO_TESTNET } from "@/lib/stacks-pilot";

export type ErrorMap = Record<string, string>;
/** ft-transfer? and the test token both refuse with u1. */
const TOKEN_U1 = "Not enough test sats in this wallet. Use the button to get test sats first.";

export const BOUNTY_ERRORS: ErrorMap = {
  u1: TOKEN_U1,
  u100: "The reward must be at least 1,000 test sats.",
  u101: "The bounty must stay open between 6 and 4,320 Bitcoin blocks.",
  u102: "That bounty does not exist.",
  u103: "Only the person who posted this bounty can do that.",
  u104: "This bounty is already paid or refunded.",
  u105: "The deadline has passed, so new builds can no longer be submitted.",
  u106: "The deadline has not passed yet, so the reward cannot be taken back.",
  u107: "That builder has not submitted anything to this bounty.",
  u108: "You cannot answer your own bounty. Use a different Stacks account.",
  u109: "This bounty already has 20 builders.",
};

export const PILOT_ERRORS: ErrorMap = {
  u1: TOKEN_U1,
  u401: "This wallet is not allowed to do that. Only the account that registered the BITMAP can claim.",
  u402: "The custody proof did not match this wallet. Sign the proof again.",
  u403: "The pilot is paused right now.",
  u404: "This BITMAP is not registered.",
  u406: "The proof or registration has expired. Sign the custody proof again.",
  u407: "The proof was signed with a key that is no longer valid. Sign the custody proof again.",
  u408: "The weight in this proof is out of range.",
  u409: "Too many registrations this period. Try again later.",
  u410: "This registration is still active.",
  u411: "This top-up is over the fund's limits.",
};

/** "(err u105)" → sentence; null when the call succeeded. */
export function explainResult(repr: string | null | undefined, status = "abort_by_response", errors: ErrorMap = BOUNTY_ERRORS): string | null {
  const m = /\(err (u\d+)\)/.exec(String(repr ?? ""));
  if (m) return errors[m[1]!] ?? `The contract refused it (${m[1]}).`;
  if (status.startsWith("dropped")) return "The network dropped this transaction. Try again.";
  if (status === "abort_by_post_condition") return "Your wallet's safety check stopped this transaction.";
  return status === "success" ? null : "The transaction failed.";
}

export type TxOutcome = { state: "pending" | "success" | "failed"; reason: string | null };
/** Not-yet-indexed (404) counts as pending, so polling never stops early. */
export async function txOutcome(txid: string, errors: ErrorMap = BOUNTY_ERRORS): Promise<TxOutcome> {
  const r = await fetch(`${HIRO_TESTNET}/extended/v1/tx/${txid.startsWith("0x") ? txid : `0x${txid}`}`);
  if (r.status === 404) return { state: "pending", reason: null };
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  const status = String(j?.tx_status ?? "pending");
  if (status === "pending") return { state: "pending", reason: null };
  if (status === "success") return { state: "success", reason: null };
  return { state: "failed", reason: explainResult(j?.tx_result?.repr, status, errors) };
}

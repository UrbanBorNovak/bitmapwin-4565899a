/**
 * Autonomous Bot Citizens: each bot gets its own Taproot key generated and kept
 * on this device only (never sent to the server). The deposit address is the
 * key's p2tr address; funds stay spendable by whoever holds this device's key.
 */
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { p2tr, NETWORK } from "@scure/btc-signer";

export const MIN_DEPOSIT_SATS = 10_000;
export const PROMPT_MAX = 280;
const KEY = "bitmapwin.botCitizens.v1";

export type BotCitizen = {
  id: string; name: string; height: number; parcelIndex: number | null;
  prompt: string; maxFeeSats: number; secretHex: string; address: string; createdAt: number;
};

export function validateCommission(i: { name: string; height: number; parcelIndex: number | null; prompt: string }): string | null {
  if (!i.name.trim() || i.name.trim().length > 32) return "Name must be 1–32 characters.";
  if (!Number.isInteger(i.height) || i.height < 0 || i.height > 2_000_000) return "Enter a valid BITMAP number.";
  if (i.parcelIndex !== null && (!Number.isInteger(i.parcelIndex) || i.parcelIndex < 0)) return "Parcel index must be 0 or higher.";
  const p = i.prompt.trim();
  if (p.length < 4 || p.length > PROMPT_MAX) return `Prompt must be 4–${PROMPT_MAX} characters.`;
  return null;
}

export function addressFor(secret: Uint8Array): string {
  return p2tr(schnorr.getPublicKey(secret), undefined, NETWORK).address!;
}

export function createBot(i: { name: string; height: number; parcelIndex: number | null; prompt: string; maxFeeSats: number }): BotCitizen {
  const secret = schnorr.utils.randomSecretKey();
  return {
    id: crypto.randomUUID(), name: i.name.trim(), height: i.height, parcelIndex: i.parcelIndex,
    prompt: i.prompt.trim(), maxFeeSats: i.maxFeeSats, secretHex: bytesToHex(secret),
    address: addressFor(secret), createdAt: Date.now(),
  };
}

export function loadBots(): BotCitizen[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as BotCitizen[];
    // Re-derive so a tampered address can never point deposits elsewhere.
    return raw.filter((b) => b.secretHex).map((b) => ({ ...b, address: addressFor(hexToBytes(b.secretHex)) }));
  } catch { return []; }
}
export function saveBots(bots: BotCitizen[]) { localStorage.setItem(KEY, JSON.stringify(bots)); }

export type BotStatus = "AWAITING_FUNDS" | "FUNDS_PENDING" | "FUNDED";
export function statusFor(confirmed: number, pending: number): BotStatus {
  if (confirmed >= MIN_DEPOSIT_SATS) return "FUNDED";
  if (confirmed + pending > 0) return "FUNDS_PENDING";
  return "AWAITING_FUNDS";
}

export async function fetchBalance(address: string): Promise<{ confirmed: number; pending: number }> {
  const r = await fetch(`https://mempool.space/api/address/${address}`);
  if (!r.ok) throw new Error("Balance unavailable");
  const j = await r.json();
  const c = j.chain_stats, m = j.mempool_stats;
  return { confirmed: c.funded_txo_sum - c.spent_txo_sum, pending: m.funded_txo_sum - m.spent_txo_sum };
}

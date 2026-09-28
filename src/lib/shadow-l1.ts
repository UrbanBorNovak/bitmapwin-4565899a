import { sha256 } from "@noble/hashes/sha2.js";
import { MEMBERSHIP_ADDRESS } from "@/lib/membership";

/** Where the territory anchor fee is collected. */
export const SHADOW_L1_TREASURY = MEMBERSHIP_ADDRESS;

/** Anchor fee carried alongside the OP_RETURN note. Miner fee is on top. */
export const SHADOW_GATE_ANCHOR_SATS = 1_000;
export const SHADOW_PASS_ANCHOR_SATS = 1_000;

export type ShadowL1Note = {
  op: "gate" | "pass" | "spend";
  slug: string;
  territoryBlock: number;
  passIndex: number;
  digestHex: string;
  payloadHex: string;
  txid: string;
  status: "broadcast" | "confirmed";
  confirmedHeight: number | null;
  createdAt: string;
};

export function mempoolTxUrl(txid: string): string {
  return `https://mempool.space/tx/${txid}`;
}

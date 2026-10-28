/**
 * Bitcoin Puzzle sweep — everything runs on the device. The found key never
 * leaves the browser; the signed spend pays the solver 90% and the treasury a
 * fixed 10% of the puzzle balance (miner fee comes out of the solver's share).
 */
import * as btc from "@scure/btc-signer";
import { hex } from "@scure/base";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { DONATION_ADDRESS } from "@/lib/donations";

export const MEMPOOL = "https://mempool.space/api";
/** Treasury share of a swept puzzle, in percent. */
export const SWEEP_TREASURY_PERCENT = 10;

export type Puzzle = { n: number; address: string; rewardBtc: number; startHex: string; endHex: string };

/** Active Bitcoin 160 puzzle #71: keys lie in [2^70, 2^71). */
export const PUZZLE_71: Puzzle = {
  n: 71,
  address: "1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU",
  rewardBtc: 7.1,
  startHex: "400000000000000000",
  endHex: "7fffffffffffffffff",
};

/** Hash160 a P2PKH address commits to. */
export function hash160Of(address: string): Uint8Array {
  const out = btc.Address(btc.NETWORK).decode(address);
  if (out.type !== "pkh") throw new Error("Puzzle addresses are legacy P2PKH");
  return out.hash;
}

/** Fixed split: treasury takes 10% of the balance, solver gets the rest minus fee. */
export function sweepSplit(totalSats: bigint, minerFee: bigint) {
  const treasury = (totalSats * BigInt(SWEEP_TREASURY_PERCENT)) / 100n;
  const player = totalSats - treasury - minerFee;
  if (player <= 546n) throw new Error("Balance too small to sweep after fees");
  return { treasury, player };
}

/** 1 P2PKH input (compressed) + 2 outputs. */
export const SWEEP_VBYTES = 226;

export function keyMatches(priv: Uint8Array, target: Uint8Array): boolean {
  const addr = btc.p2pkh(secp256k1.getPublicKey(priv, true));
  const h = hash160Of(addr.address!);
  return h.every((b, i) => b === target[i]);
}

export async function buildSweep(p: { priv: Uint8Array; puzzleAddress: string; payTo: string; feeRate: number }) {
  const utxos: { txid: string; vout: number; value: number }[] = await fetch(`${MEMPOOL}/address/${p.puzzleAddress}/utxo`).then((r) => r.json());
  if (!utxos.length) throw new Error("This puzzle has already been swept");
  const tx = new btc.Transaction({ allowLegacyWitnessUtxo: false });
  let total = 0n;
  for (const u of utxos) {
    const raw = await fetch(`${MEMPOOL}/tx/${u.txid}/hex`).then((r) => r.text());
    tx.addInput({ txid: u.txid, index: u.vout, nonWitnessUtxo: hex.decode(raw), sequence: 0xffffffff });
    total += BigInt(u.value);
  }
  const vbytes = SWEEP_VBYTES + (utxos.length - 1) * 148;
  const fee = BigInt(Math.ceil(vbytes * p.feeRate));
  const { treasury, player } = sweepSplit(total, fee);
  tx.addOutputAddress(p.payTo, player, btc.NETWORK);
  tx.addOutputAddress(DONATION_ADDRESS, treasury, btc.NETWORK);
  tx.sign(p.priv);
  tx.finalize();
  return { hex: tx.hex, total, fee, player, treasury };
}

export async function broadcast(txHex: string): Promise<string> {
  const ends = [`${MEMPOOL}/tx`, "https://blockstream.info/api/tx"];
  const results = await Promise.allSettled(ends.map((u) => fetch(u, { method: "POST", body: txHex }).then(async (r) => { const t = await r.text(); if (!r.ok) throw new Error(t); return t; })));
  const ok = results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<string> | undefined;
  if (!ok) throw new Error((results[0] as PromiseRejectedResult).reason?.message ?? "Broadcast failed");
  return ok.value.trim();
}

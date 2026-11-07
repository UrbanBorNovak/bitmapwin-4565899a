/**
 * BW-LEASE-L1 rent — PREPAID rent released on a block schedule.
 *
 * What Bitcoin Script can and cannot enforce (no covenants: no CTV / CAT / APO):
 *  - It CAN release money that is already locked, on a timetable: the tenant locks
 *    periods × rent + deposit, and pre-signs one transaction per period. Each pays
 *    one period's rent to the landlord and moves the rest back into the same bond.
 *    Every transaction carries nSequence = periodBlocks, so BIP-68 stops period k+1
 *    from confirming until periodBlocks after period k. The rent is guaranteed
 *    because it is already escrowed.
 *  - It CANNOT force a payment from coins that are not locked. "Pay as you go or lose
 *    the deposit" would need the landlord to co-sign each renewal, and Script cannot
 *    tell "tenant did not pay" apart from "landlord refused to sign". Forcing the rent
 *    output without the landlord needs a covenant opcode Bitcoin does not have.
 *  - It CANNOT check that the land was actually usable: building rights are granted
 *    by the app (trust in the app + landlord).
 *
 * Receipts: the confirmed period transaction IS the receipt; anyone can read it on chain.
 *
 * Timing rule: periodBlocks < refundCsv. After each step the landlord may collect the
 * next period from block periodBlocks, and the tenant may refund everything left from
 * block refundCsv, so a landlord who does not collect inside that window loses the
 * rest of the schedule to the tenant.
 */
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import * as bitcoin from "bitcoinjs-lib";
import { leaseAddress, type LeaseNetwork, type LeaseTerms } from "./lease-tapscript";

export type RentPlan = { periods: number; rentSats: number; periodBlocks: number; feeSats: number; landlordScript: string };
export type Outpoint = { txid: string; vout: number; value: number };
export type RentStep = { period: number; txid: string; unsignedHex: string; sighash: string; prev: Outpoint; remaining: number };

export const P2TR_DUST = 330;

/** Sats the tenant locks for the plan: every period's rent and fee, plus the deposit left at the end. */
export const rentFundingValue = (p: RentPlan, depositSats: number) => p.periods * (p.rentSats + p.feeSats) + depositSats;

/** Builds the whole pre-signable chain from the funding outpoint. Pure and deterministic. */
export function rentChain(terms: LeaseTerms, network: LeaseNetwork, funding: Outpoint, plan: RentPlan) {
  if (!Number.isInteger(plan.periods) || plan.periods < 1 || plan.periods > 52) throw new Error("periods must be 1..52");
  if (!Number.isInteger(plan.periodBlocks) || plan.periodBlocks < 1) throw new Error("periodBlocks must be a positive block count");
  if (plan.periodBlocks >= terms.refundCsv) throw new Error("refund lock must be longer than one rent period");
  if (plan.rentSats < 546) throw new Error("rent below dust");
  const lease = leaseAddress(terms, network);
  const spk = hexToBytes(lease.scriptPubKey), leaf = hexToBytes(lease.leafHashes.mutual);
  const steps: RentStep[] = [];
  let prev = funding;
  for (let k = 1; k <= plan.periods; k++) {
    const remaining = prev.value - plan.rentSats - plan.feeSats;
    if (remaining < P2TR_DUST) throw new Error(`bond runs out at period ${k}`);
    const tx = new bitcoin.Transaction();
    tx.version = 2;
    tx.addInput(hexToBytes(prev.txid).reverse(), prev.vout, plan.periodBlocks);
    tx.addOutput(hexToBytes(plan.landlordScript), BigInt(plan.rentSats));
    tx.addOutput(spk, BigInt(remaining));
    const sighash = bytesToHex(tx.hashForWitnessV1(0, [spk], [BigInt(prev.value)], bitcoin.Transaction.SIGHASH_DEFAULT, leaf));
    steps.push({ period: k, txid: tx.getId(), unsignedHex: tx.toHex(), sighash, prev, remaining });
    prev = { txid: tx.getId(), vout: 1, value: remaining };
  }
  return { lease, steps, deposit: prev };
}

/** Tenant signs every period up front (mutual leaf, tenant half only). */
export const tenantPresign = (steps: RentStep[], tenantSecret: string) =>
  steps.map((s) => bytesToHex(schnorr.sign(hexToBytes(s.sighash), hexToBytes(tenantSecret))));

/**
 * Landlord-side check before granting any building rights: rebuilds the chain from
 * the agreed terms and the live funding output, and verifies every tenant signature.
 * Returns problems; empty means the whole schedule is collectable.
 */
export function verifyRentBundle(terms: LeaseTerms, network: LeaseNetwork, funding: Outpoint & { scriptPubKey: string }, plan: RentPlan, tenantSigs: string[]): string[] {
  const problems: string[] = [];
  let chain: ReturnType<typeof rentChain>;
  try { chain = rentChain(terms, network, funding, plan); } catch (e) { return [(e as Error).message]; }
  if (funding.scriptPubKey !== chain.lease.scriptPubKey) problems.push("funding output is not the lease address");
  if (tenantSigs.length !== chain.steps.length) problems.push(`expected ${chain.steps.length} tenant signatures, got ${tenantSigs.length}`);
  chain.steps.forEach((s, i) => {
    const sig = tenantSigs[i];
    let ok = false;
    try { ok = !!sig && sig.length === 128 && schnorr.verify(hexToBytes(sig), hexToBytes(s.sighash), hexToBytes(terms.tenant)); } catch { ok = false; }
    if (!ok) problems.push(`period ${s.period}: tenant signature invalid`);
  });
  return problems;
}

/** Landlord completes one period: witness = [tenantSig, landlordSig, mutual script, control block]. */
export function completeRentTx(lease: ReturnType<typeof leaseAddress>, step: RentStep, tenantSig: string, landlordSecret: string): string {
  const tx = bitcoin.Transaction.fromHex(step.unsignedHex);
  const landlordSig = bytesToHex(schnorr.sign(hexToBytes(step.sighash), hexToBytes(landlordSecret)));
  tx.setWitness(0, [hexToBytes(tenantSig), hexToBytes(landlordSig), hexToBytes(lease.leaves.mutual), hexToBytes(lease.controlBlocks.mutual)]);
  return tx.toHex();
}

/** Which periods are paid, judged only from confirmations the caller read from the chain. */
export function rentReceipts(steps: RentStep[], confirmedTxids: ReadonlySet<string>) {
  return steps.map((s) => ({ period: s.period, txid: s.txid, paid: confirmedTxids.has(s.txid) }));
}

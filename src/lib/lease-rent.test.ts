import { describe, expect, it } from "vitest";
import * as bitcoin from "bitcoinjs-lib";
import { bytesToHex } from "@noble/hashes/utils.js";
import { newCellKey, xOnly } from "./lease-tapscript";
import { rentChain, rentFundingValue, rentReceipts, tenantPresign, verifyRentBundle, type RentPlan } from "./lease-rent";

const sk = (b: number) => bytesToHex(new Uint8Array(32).fill(b));
const landlordSk = sk(1), tenantSk = sk(3);
const terms = { landlord: xOnly(landlordSk), tenant: xOnly(tenantSk), equivocation: newCellKey(new Uint8Array(32).fill(5), new Uint8Array(32).fill(6)).pub, refundCsv: 288 };
const plan: RentPlan = { periods: 3, rentSats: 20_000, periodBlocks: 144, feeSats: 500, landlordScript: "0014" + "11".repeat(20) };
const DEPOSIT = 40_000;

function setup() {
  const value = rentFundingValue(plan, DEPOSIT);
  const chain = rentChain(terms, "tb", { txid: "aa".repeat(32), vout: 0, value }, plan);
  const funding = { txid: "aa".repeat(32), vout: 0, value, scriptPubKey: chain.lease.scriptPubKey };
  return { chain, funding, sigs: tenantPresign(chain.steps, tenantSk) };
}

describe("prepaid rent schedule", () => {
  it("locks 3 × (20,000 + 500) + 40,000 = 101,500 sats", () => {
    expect(rentFundingValue(plan, DEPOSIT)).toBe(101_500);
  });
  it("each period pays exactly the rent to the landlord and leaves the 40,000 deposit at the end", () => {
    const { chain } = setup();
    for (const s of chain.steps) {
      const tx = bitcoin.Transaction.fromHex(s.unsignedHex);
      expect(tx.ins[0]!.sequence).toBe(144);
      expect(Number(tx.outs[0]!.value)).toBe(20_000);
      expect(bytesToHex(tx.outs[0]!.script)).toBe(plan.landlordScript);
    }
    expect(chain.deposit.value).toBe(40_000);
  });
  it("chains each period onto the previous one", () => {
    const { chain } = setup();
    expect(chain.steps[1]!.prev).toEqual({ txid: chain.steps[0]!.txid, vout: 1, value: chain.steps[0]!.remaining });
  });
  it("refuses a period as long as the refund lock", () => {
    expect(() => rentChain(terms, "tb", { txid: "aa".repeat(32), vout: 0, value: 200_000 }, { ...plan, periodBlocks: 288 })).toThrow();
  });
  it("refuses a schedule the bond cannot cover", () => {
    expect(() => rentChain(terms, "tb", { txid: "aa".repeat(32), vout: 0, value: 50_000 }, plan)).toThrow(/period 3/);
  });
});

describe("landlord bundle check", () => {
  it("accepts a correct bundle", () => {
    const { funding, sigs } = setup();
    expect(verifyRentBundle(terms, "tb", funding, plan, sigs)).toEqual([]);
  });
  it("rejects a missing period signature", () => {
    const { funding, sigs } = setup();
    expect(verifyRentBundle(terms, "tb", funding, plan, sigs.slice(0, 2))).toContain("expected 3 tenant signatures, got 2");
  });
  it("rejects signatures made for a smaller rent", () => {
    const { funding } = setup();
    const cheap = rentChain(terms, "tb", funding, { ...plan, rentSats: 1_000 });
    expect(verifyRentBundle(terms, "tb", funding, plan, tenantPresign(cheap.steps, tenantSk))).toHaveLength(3);
  });
  it("rejects signatures from a key other than the tenant's", () => {
    const { chain, funding } = setup();
    expect(verifyRentBundle(terms, "tb", funding, plan, tenantPresign(chain.steps, sk(9)))).toHaveLength(3);
  });
  it("rejects funding that is not the lease address", () => {
    const { funding, sigs } = setup();
    expect(verifyRentBundle(terms, "tb", { ...funding, scriptPubKey: "5120" + "00".repeat(32) }, plan, sigs)).toContain("funding output is not the lease address");
  });
  it("marks only confirmed periods as paid", () => {
    const { chain } = setup();
    expect(rentReceipts(chain.steps, new Set([chain.steps[0]!.txid])).map((r) => r.paid)).toEqual([true, false, false]);
  });
});

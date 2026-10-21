import { describe, it, expect } from "vitest";
import * as btc from "@scure/btc-signer";
import { planRelicMint, revealPaysPlan, dustLimit } from "./relic-mint-guard";
import { MASTER_PARENT_ID } from "./collection-parent";
import { DONATION_ADDRESS } from "./donations";

const BM = "a".repeat(64) + "i0";
const HOLDER = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
const base = {
  height: 840000, tip: 900000, holderAddress: HOLDER, treasuryAddress: DONATION_ADDRESS,
  parents: [{ inscriptionId: BM, address: HOLDER }, { inscriptionId: MASTER_PARENT_ID }],
  bitmapParentId: BM, masterInscriptionId: MASTER_PARENT_ID,
};

function mockTx(outs: [string, number][]) {
  const tx = new btc.Transaction({ allowUnknownOutputs: true });
  for (const [a, s] of outs) tx.addOutputAddress(a, BigInt(s), btc.NETWORK);
  return tx;
}

describe("relic mint payout guard", () => {
  it("gold tier pays 1050 holder + 1050 treasury", () => {
    const r = planRelicMint(base);
    expect(r.ok && r.payouts.map((p) => p.sats)).toEqual([1050, 1050]);
  });
  it("standard relic pays exactly 546 + 546 = 1092", () => {
    const r = planRelicMint({ ...base, height: 800001 });
    expect(r.ok && r.total).toBe(1092);
  });
  it("blocks when holder unverified", () => {
    const r = planRelicMint({ ...base, holderAddress: null });
    expect(r.ok === false && r.missing).toEqual(["HOLDER"]);
  });
  it("blocks when holder differs from the BITMAP parent's live address", () => {
    const r = planRelicMint({ ...base, holderAddress: DONATION_ADDRESS });
    expect(r.ok === false && r.missing).toEqual(["HOLDER"]);
  });
  it("blocks on bad treasury, missing parents, and beyond tip", () => {
    expect(planRelicMint({ ...base, treasuryAddress: "nope" }).ok).toBe(false);
    const r = planRelicMint({ ...base, parents: [], bitmapParentId: null, masterInscriptionId: null, height: 900001 });
    expect(r.ok === false && r.missing).toEqual(["TIP", "BITMAP", "COLLECTION"]);
  });
  it("mock transaction must pay both recipients in full", () => {
    const r = planRelicMint(base); if (!r.ok) throw new Error();
    expect(revealPaysPlan(mockTx([[HOLDER, 1050], [DONATION_ADDRESS, 1050]]), r.payouts)).toEqual({ ok: true });
    expect(revealPaysPlan(mockTx([[HOLDER, 1050], [DONATION_ADDRESS, 1000]]), r.payouts).ok).toBe(false);
    expect(revealPaysPlan(mockTx([[DONATION_ADDRESS, 2100]]), r.payouts).ok).toBe(false);
  });
});

describe("script-specific dust limits", () => {
  const TR = "bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297";
  const WSH = "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3";
  const PKH = "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2";
  const SH = "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy";
  it("maps each script type to its Bitcoin Core dust limit", () => {
    expect(dustLimit(PKH)).toBe(546); expect(dustLimit(SH)).toBe(540);
    expect(dustLimit(HOLDER)).toBe(294); expect(dustLimit(WSH)).toBe(330); expect(dustLimit(TR)).toBe(330);
    expect(dustLimit("garbage")).toBeNull();
  });
  it("standard 546-sat shares clear dust for every script type", () => {
    for (const a of [PKH, SH, WSH, TR]) {
      const r = planRelicMint({ ...base, height: 800001, holderAddress: a, parents: [{ inscriptionId: BM, address: a }, { inscriptionId: MASTER_PARENT_ID }] });
      expect(r.ok && r.total).toBe(1092);
    }
  });
  it("mock transaction paying both shares passes; underpaying holder fails", () => {
    const r = planRelicMint({ ...base, height: 800001 }); if (!r.ok) throw new Error();
    expect(revealPaysPlan(mockTx([[HOLDER, 546], [DONATION_ADDRESS, 546]]), r.payouts)).toEqual({ ok: true });
    expect(revealPaysPlan(mockTx([[HOLDER, 545], [DONATION_ADDRESS, 546]]), r.payouts).ok).toBe(false);
  });
});

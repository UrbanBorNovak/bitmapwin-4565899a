import { describe, it, expect } from "vitest";
import * as btc from "@scure/btc-signer";
import { hex } from "@scure/base";
import { buildRelicPreview, viewerVerified, RELIC_VIEWER_INSCRIPTION_ID } from "./relic-mint-preview";
import { MASTER_PARENT_ID } from "./collection-parent";
import { DONATION_ADDRESS } from "./donations";

const BM = "a".repeat(64) + "i0";
const HOLDER = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
const COL = "bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297";
const parents = [
  { inscriptionId: BM, signer: "wallet" as const, txid: "1".repeat(64), vout: 0, value: 546, address: HOLDER },
  { inscriptionId: MASTER_PARENT_ID, signer: "platform" as const, txid: "2".repeat(64), vout: 1, value: 330, address: COL },
];
const base = {
  height: 800001, tip: 900000, parents, bitmapParentId: BM, masterInscriptionId: MASTER_PARENT_ID,
  holderAddress: HOLDER, treasuryAddress: DONATION_ADDRESS, minterAddress: COL, feeRate: 5, metadataBytes: 800, viewerOk: false,
};

describe("relic unsigned preview", () => {
  it("lists both parents, five outputs with dust limits, and a miner fee", () => {
    const r = buildRelicPreview(base);
    if (!r.ok) throw new Error(r.message);
    expect(r.parents.map((p) => p.inscriptionId)).toEqual([BM, MASTER_PARENT_ID]);
    expect(r.outputs.map((o) => [o.role, o.sats, o.dust])).toEqual([
      ["BITMAP PARENT", 546, 294], ["COLLECTION PARENT", 330, 330], ["RELIC", 546, 330], ["HOLDER", 546, 294], ["TREASURY", 546, 294],
    ]);
    expect(r.tribute).toBe(1092);
    expect(r.minerFee).toBe(r.vbytes * 5);
  });
  it("the PSBT is unsigned and pays both recipients", () => {
    const r = buildRelicPreview(base); if (!r.ok) throw new Error();
    const tx = btc.Transaction.fromPSBT(hex.decode(r.psbtHex), { allowUnknownOutputs: true, allowUnknownInputs: true });
    expect(tx.isFinal).toBe(false);
    for (let i = 0; i < tx.inputsLength; i++) expect(tx.getInput(i).tapKeySig ?? tx.getInput(i).finalScriptWitness).toBeUndefined();
    expect(tx.outputsLength).toBe(5);
  });
  it("signing stays disabled with or without a verified viewer", () => {
    const a = buildRelicPreview(base), b = buildRelicPreview({ ...base, viewerOk: true });
    expect(a.ok && a.signingEnabled).toBe(false);
    expect(b.ok && b.signingEnabled).toBe(false);
    expect(RELIC_VIEWER_INSCRIPTION_ID).toBeNull();
    expect(viewerVerified(null, "text/html")).toBe(false);
    expect(viewerVerified(BM, "image/png")).toBe(false);
  });
  it("refuses to preview when a parent, holder or parent dust fails", () => {
    expect(buildRelicPreview({ ...base, masterInscriptionId: null }).ok).toBe(false);
    expect(buildRelicPreview({ ...base, holderAddress: null }).ok).toBe(false);
    const low = [{ ...parents[0] }, { ...parents[1], value: 200 }];
    expect(buildRelicPreview({ ...base, parents: low }).ok).toBe(false);
    expect(buildRelicPreview({ ...base, feeRate: 0 }).ok).toBe(false);
  });
});

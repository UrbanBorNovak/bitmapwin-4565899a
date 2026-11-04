import { describe, expect, it } from "vitest";
import { buildSwapPsbt, byteArrayToHex, prepareMakerInput } from "@/lib/psbt-buyer";
import { addressToScriptPubKey } from "@/lib/psbt-builder";
import { decodePsbt } from "@/lib/psbt";
import { verifyLayoutForMaker, type BarterTicket, type SwapLayout } from "@/lib/barter-protocol";

const MAKER = "bc1pmfr3p9j00pfxjh0zmgp99y8zftmd3s5pmedqhyptwy6lm87hf5sspknck9";
const TAKER = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
const spk = (a: string) => byteArrayToHex(addressToScriptPubKey(a));
const T1 = "a".repeat(64), T2 = "b".repeat(64), T3 = "c".repeat(64);

const ticket: BarterTicket = {
  makerAddress: MAKER, offeringOutpoint: `${T1}:0`, offeringInscription: `${T1}i0`, offeringValue: 546,
  sweetenerSats: 10_000, sweetenerDir: "demand", criteria: { assetType: "bitmap" },
};
const build = () => buildSwapPsbt({
  maker: { txid: T1, vout: 0, valueSats: 546, scriptPubKeyHex: spk(MAKER) },
  taker: { txid: T2, vout: 1, valueSats: 600, scriptPubKeyHex: spk(TAKER) },
  makerReceiveScriptHex: spk(MAKER), takerReceiveScriptHex: spk(TAKER), takerChangeScriptHex: spk(TAKER),
  funding: [{ txid: T3, vout: 2, valueSats: 100_000, scriptPubKeyHex: spk(TAKER) }],
  feeRate: 5, sweetenerSats: 10_000,
});
const layoutOf = (b64: string): SwapLayout => {
  const d = decodePsbt(b64);
  return {
    inputs: d.inputs.map((i, n) => ({ outpoint: i.outpoint, value: i.witnessValueSats!, owner: n === 0 ? "maker" : "taker" })),
    outputs: d.outputs.map((o) => ({ address: o.address!, value: o.valueSats })),
    feeSats: d.inputs.reduce((s, i) => s + i.witnessValueSats!, 0) - d.totalOutSats,
  };
};

describe("BW-BARTER-1 swap PSBT", () => {
  it("swaps both items and pays the asked 10,000 sats to the maker", () => {
    const b = build();
    const l = layoutOf(b.psbtBase64);
    expect(l.outputs[0]).toEqual({ address: TAKER, value: 546 });
    expect(l.outputs[1]).toEqual({ address: MAKER, value: 600 });
    expect(l.outputs[2]).toEqual({ address: MAKER, value: 10_000 });
    expect(l.feeSats).toBe(b.feeSats);
    expect(b.fundingIndices).toEqual([2]);
    expect(verifyLayoutForMaker(l, ticket, { inscriptionId: `${T2}i0`, outpoint: `${T2}:1`, value: 600, offset: 0, type: "bitmap", spent: false })).toBeNull();
  });
  it("maker refuses a layout that drops the sweetener", () => {
    const l = layoutOf(build().psbtBase64);
    l.outputs.splice(2, 1);
    expect(verifyLayoutForMaker(l, ticket, { inscriptionId: `${T2}i0`, outpoint: `${T2}:1`, value: 600, offset: 0, type: "bitmap", spent: false })).toBe("sweetener missing");
  });
  it("refuses when funding can't cover fee plus sweetener", () => {
    expect(() => buildSwapPsbt({
      maker: { txid: T1, vout: 0, valueSats: 546, scriptPubKeyHex: spk(MAKER) },
      taker: { txid: T2, vout: 1, valueSats: 600, scriptPubKeyHex: spk(TAKER) },
      makerReceiveScriptHex: spk(MAKER), takerReceiveScriptHex: spk(TAKER), takerChangeScriptHex: spk(TAKER),
      funding: [{ txid: T3, vout: 2, valueSats: 5_000, scriptPubKeyHex: spk(TAKER) }], feeRate: 5, sweetenerSats: 10_000,
    })).toThrow(/Not enough/);
  });
  it("adds the maker's taproot key to input 0 without changing the transaction", () => {
    const b = build();
    const out = prepareMakerInput(b.psbtBase64, "02" + "11".repeat(32));
    expect(layoutOf(out)).toEqual(layoutOf(b.psbtBase64));
    expect(out).not.toBe(b.psbtBase64);
  });
});

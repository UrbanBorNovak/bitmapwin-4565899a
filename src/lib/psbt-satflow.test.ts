import { describe, expect, it } from "vitest";
import { buildListingPsbt, addressToScriptPubKey } from "@/lib/psbt-builder";
import { buildBuyerPsbt, psbtOutputs, satDestination, SELLER_INDEX, byteArrayToHex } from "@/lib/psbt-buyer";

const SELLER = "bc1qgunjcn7a7njky4xzj4ahj79cg6muzj4qg5pfpv";
const BUYER_ORD = "bc1pkmkffmvdcpsnmvj7fus5e3ffxmdt5czms00td52rzrd58whc4aqqdf458w";
const BUYER_PAY = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
const OUTPOINT = "f537200970e9592b572e1ae0fe60d2d326ecffe79b1d5e44b494917c57044a13:0";
const hex = (a: string) => byteArrayToHex(addressToScriptPubKey(a));
const listing = buildListingPsbt({ txid: OUTPOINT.split(":")[0]!, vout: 0, utxoValueSats: 294, sellerAddress: SELLER, priceSats: 10000 });
const coin = (n: number, v: number) => ({ txid: String(n).repeat(64).slice(0, 64), vout: 0, valueSats: v, scriptPubKeyHex: hex(BUYER_PAY) });

function build(funding = [coin(1, 600), coin(2, 700), coin(3, 200_000)], inscriptionValueSats = 294) {
  return buildBuyerPsbt({
    sellerPsbtBase64: listing,
    inscriptionOutpoint: OUTPOINT,
    inscriptionValueSats,
    receiveScriptHex: hex(BUYER_ORD),
    changeScriptHex: hex(BUYER_PAY),
    funding,
    feeRate: 3,
  });
}

describe("purchase sat flow", () => {
  it("old layout (seller input 0 → price output 0) sent the BITMAP to the seller — the confirmed 819245 bug", () => {
    expect(satDestination(listing, 0)).toBe(0);
  });

  it("the BITMAP lands in output 1 at the buyer's ordinals address", () => {
    const r = build();
    expect(satDestination(r.psbtBase64, SELLER_INDEX)).toBe(1);
    expect(psbtOutputs(r.psbtBase64)[1]!.scriptHex).toBe(hex(BUYER_ORD));
  });

  it("the seller is paid the exact price at output 2, matching their signed input index", () => {
    const outs = psbtOutputs(build().psbtBase64);
    expect(outs[2]!.scriptHex).toBe(hex(SELLER));
    expect(outs[2]!.valueSats).toBe(10000);
  });

  it("padding coins come straight back to the buyer in output 0", () => {
    const outs = psbtOutputs(build().psbtBase64);
    expect(outs[0]!.valueSats).toBe(1300);
    expect(outs[0]!.scriptHex).toBe(hex(BUYER_PAY));
  });

  it("sub-dust postage is topped up to 546 and still delivered to the buyer", () => {
    const r = build(undefined, 294);
    expect(psbtOutputs(r.psbtBase64)[1]!.valueSats).toBe(546);
    expect(satDestination(r.psbtBase64, SELLER_INDEX)).toBe(1);
  });

  it("buyer signs every input except the seller's", () => {
    expect(build().signIndices).toEqual([0, 1, 3]);
  });

  it("refuses with fewer than 3 plain coins", () => {
    expect(() => build([coin(1, 600), coin(3, 200_000)])).toThrow(/3 separate plain coins/);
  });
});

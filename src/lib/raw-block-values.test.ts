import { describe, expect, it } from "vitest";
import { txValuesFromRawBlock } from "@/lib/raw-block-values";

// Block 170: the first bitcoin payment (Satoshi -> Hal Finney), real bytes.
const HASH = "00000000d1145790a8694403d4063f323d499e655c83426834d4ce2f8dd4a2ee";
const RAW = Uint8Array.from("0100000055bd840a78798ad0da853f68974f3d183e2bd1db6a842c1feecf222a00000000ff104ccb05421ab93e63f8c3ce5c2c2e9dbb37de2764b3a3175c8166562cac7d51b96a49ffff001d283e9e700201000000010000000000000000000000000000000000000000000000000000000000000000ffffffff0704ffff001d0102ffffffff0100f2052a01000000434104d46c4968bde02899d2aa0963367c7a6ce34eec332b32e42e5f3407e052d64ac625da6f0718e7b302140434bd725706957c092db53805b821a85b23a7ac61725bac000000000100000001c997a5e56e104102fa209c6a852dd90660a20b2d9c352423edce25857fcd3704000000004847304402204e45e16932b8af514961a1d3a1a25fdf3f4f7732e9d624c6c61548ab5fb8cd410220181522ec8eca07de4860a4acdd12909d831cc56cbbac4622082221a8768d1d0901ffffffff0200ca9a3b00000000434104ae1a62fe09c5f51b13905f07f06b99a2f7159b2225f374cd378d71302fa28414e7aab37397f554a7df5f142c21c1b7303b8a0626f1baded5c72a704f7e6cd84cac00286bee0000000043410411db93e1dcdb8a016b49840f8c53bc1eb68a382e97b1482ecad7b148a6909a5cb2e0eaddfb84ccf9744464f82e160bfa9b8b64f9d4c03f999b8643f656b412a3ac00000000".match(/../g)!.map((b) => parseInt(b, 16)));

describe("raw block reader", () => {
  it("reads every transaction's output total from a proven block", () => {
    expect(txValuesFromRawBlock(RAW, HASH, 2)).toEqual([5_000_000_000, 5_000_000_000]);
  });

  it("refuses a block whose transaction count disagrees with its header", () => {
    expect(() => txValuesFromRawBlock(RAW, HASH, 3)).toThrow(/transactions/);
  });

  it("refuses truncated or altered bytes instead of returning part of the block", () => {
    expect(() => txValuesFromRawBlock(RAW.subarray(0, RAW.length - 10), HASH, 2)).toThrow();
    const altered = RAW.slice();
    altered[altered.length - 20] ^= 0xff;
    expect(() => txValuesFromRawBlock(altered, HASH, 2)).toThrow(/merkle/);
  });
});

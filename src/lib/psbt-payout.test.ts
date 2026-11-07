import { describe, expect, it } from "vitest";
import * as bitcoin from "bitcoinjs-lib";
import { buildListingPsbt } from "./psbt-builder";

const holder = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
const payment = "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3";

describe("listing payout address", () => {
  it("pays the price to the separate payment address when given", () => {
    const b64 = buildListingPsbt({ txid: "a".repeat(64), vout: 0, utxoValueSats: 546, sellerAddress: holder, payoutAddress: payment, priceSats: 15000 });
    const psbt = bitcoin.Psbt.fromBase64(b64);
    expect(bitcoin.address.fromOutputScript(psbt.txOutputs[0]!.script)).toBe(payment);
    expect(psbt.txOutputs[0]!.value).toBe(15000n);
  });
  it("defaults the payout to the holder address", () => {
    const psbt = bitcoin.Psbt.fromBase64(buildListingPsbt({ txid: "a".repeat(64), vout: 0, utxoValueSats: 546, sellerAddress: holder, priceSats: 15000 }));
    expect(bitcoin.address.fromOutputScript(psbt.txOutputs[0]!.script)).toBe(holder);
  });
});

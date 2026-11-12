import { describe, expect, it } from "vitest";
import { buildListingPsbt } from "@/lib/psbt-builder";
import { isVerifiedPurchase } from "@/lib/verified-sales.server";

const HOLDER = "bc1pkmkffmvdcpsnmvj7fus5e3ffxmdt5czms00td52rzrd58whc4aqqdf458w";
const PAY = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
const BUYER = "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3";
const IN = "a".repeat(64);
const psbt = buildListingPsbt({ txid: IN, vout: 0, utxoValueSats: 546, sellerAddress: HOLDER, payoutAddress: PAY, priceSats: 15000 });
const offer = { buyer_txid: "t", outpoint: `${IN}:0`, seller_address: HOLDER, buyer_address: BUYER, price_sats: 15000, psbt_base64: psbt };
const tx = (payTo: string, value = 15000, vin = IN) => ({
  txid: "t",
  vin: [{ txid: "p", vout: 0 }, { txid: "p", vout: 1 }, { txid: vin, vout: 0 }],
  vout: [{ value: 600, scriptpubkey_address: BUYER }, { value: 546, scriptpubkey_address: BUYER }, { value, scriptpubkey_address: payTo }],
  status: { confirmed: true, block_height: 900000 },
});

describe("verified sales (Xverse two-address sellers)", () => {
  it("counts a sale paid to the seller's signed payment address at output 2", () => {
    expect(isVerifiedPurchase(tx(PAY), offer)).toBe(true);
  });
  it("rejects a payout to any other address", () => {
    expect(isVerifiedPurchase(tx(BUYER), offer)).toBe(false);
  });
  it("rejects a payout below the price", () => {
    expect(isVerifiedPurchase(tx(PAY, 14999), offer)).toBe(false);
  });
  it("rejects a tx not spending the listed outpoint at input 2", () => {
    expect(isVerifiedPurchase(tx(PAY, 15000, "b".repeat(64)), offer)).toBe(false);
  });
});

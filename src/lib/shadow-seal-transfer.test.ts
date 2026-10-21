/** 1-click transfer with a mock wallet: a real throwaway key signs, nothing touches Bitcoin. */
import { describe, expect, it, vi } from "vitest";
import { Transaction, p2wpkh, utils } from "@scure/btc-signer";
import { base64, hex } from "@scure/base";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { mintSealed, noteKey, readAnchorScript } from "./shadow-seal";
import { broadcastTx, pickPlainCoin, prepareTransfer, sealFee, sealReceiveCode, type Coin, type HeldSealed } from "./shadow-seal-wallet";

const priv = utils.randomPrivateKeyBytes();
const address = p2wpkh(secp256k1.getPublicKey(priv, true)).address!;
const mockWallet = async (psbt: string) => {
  const tx = Transaction.fromPSBT(base64.decode(psbt), { allowUnknownOutputs: true });
  tx.sign(priv);
  return base64.encode(tx.toPSBT());
};
const coin: Coin = { txid: "c".repeat(64), vout: 1, value: 20_000, confirmed: true };
const A = { txid: coin.txid, vout: 1, salt: "s-a" };
const bundle: HeldSealed[] = ["Key", "Pass", "Map"].map((l, i) => ({ c: { note: mintSealed(l, "item", A, `2026-10-21T00:00:0${i}Z`), steps: [], reveals: [] }, mine: A }));
const bob = sealReceiveCode({ txid: "b".repeat(64), vout: 0, salt: "s-b" });
const k = (i: number) => noteKey(bundle[i]!.c.note.genesis);

describe("coin selection", () => {
  const coins: Coin[] = [
    { txid: "1".repeat(64), vout: 0, value: 100_000, confirmed: true },
    { txid: "2".repeat(64), vout: 0, value: 6_000, confirmed: true }, // carries an inscription
    { txid: "3".repeat(64), vout: 0, value: 8_000, confirmed: true },
    { txid: "4".repeat(64), vout: 0, value: 5_000, confirmed: false }, // unconfirmed
    { txid: "5".repeat(64), vout: 0, value: 900, confirmed: true }, // too small
  ];
  const plain = async (c: Coin) => { if (c.txid.startsWith("2")) throw new Error("inscribed"); };

  it("picks the smallest confirmed plain coin that can pay the fee", async () => {
    expect((await pickPlainCoin(coins, 3, plain)).txid).toBe("3".repeat(64));
  });
  it("skips coins whose inscription check cannot be completed", async () => {
    const flaky = async (c: Coin) => { if (!c.txid.startsWith("1")) throw new Error("ordinals.com down"); };
    expect((await pickPlainCoin(coins, 3, flaky)).txid).toBe("1".repeat(64));
  });
  it("fails closed when no coin is plain", async () => {
    await expect(pickPlainCoin(coins, 3, async () => { throw new Error("x"); })).rejects.toThrow(/NO PLAIN COIN/);
  });
});

describe("give-or-keep review + mock wallet signing", () => {
  it("gives the ticked note, keeps the other two on output 0, and the signed tx carries the seal record", async () => {
    const r = await prepareTransfer({ bundle, give: { [k(1)]: bob }, coin, address, feeRate: 4, sign: mockWallet });
    expect(r.sent.map((s) => s.label)).toEqual(["Pass"]);
    expect(r.kept.map((h) => h.c.note.label)).toEqual(["Key", "Map"]);
    expect(r.kept.every((h) => h.mine.txid === r.txid && h.mine.vout === 0)).toBe(true);
    const tx = Transaction.fromRaw(hex.decode(r.rawHex), { allowUnknownOutputs: true });
    expect(tx.inputsLength).toBe(1);
    expect(Number(tx.getOutput(0).amount)).toBe(20_000 - sealFee(4));
    expect(readAnchorScript(hex.encode(tx.getOutput(1).script!))).not.toBeNull();
  });
  it("cancelling in the wallet changes nothing", async () => {
    const before = JSON.stringify(bundle);
    await expect(prepareTransfer({ bundle, give: { [k(0)]: bob }, coin, address, feeRate: 4, sign: async () => { throw new Error("User rejected"); } }))
      .rejects.toThrow(/SIGNING CANCELLED/);
    expect(JSON.stringify(bundle)).toBe(before);
  });
  it("rejects a wallet that strips the seal record", async () => {
    const tamper = async (p: string) => {
      const t = Transaction.fromPSBT(base64.decode(p), { allowUnknownOutputs: true });
      const bad = new Transaction({ allowUnknownOutputs: true });
      bad.addInput(t.getInput(0)); bad.addOutput(t.getOutput(0)); bad.addOutput({ script: hex.decode("6a00"), amount: 0n });
      bad.sign(priv); return base64.encode(bad.toPSBT());
    };
    await expect(prepareTransfer({ bundle, give: { [k(0)]: bob }, coin, address, feeRate: 4, sign: tamper })).rejects.toThrow(/LOST ITS SEAL RECORD/);
  });
  it("refuses when no note is given or a code is bad", async () => {
    await expect(prepareTransfer({ bundle, give: {}, coin, address, feeRate: 4, sign: mockWallet })).rejects.toThrow(/AT LEAST ONE/);
    await expect(prepareTransfer({ bundle, give: { [k(0)]: "SEAL-RECV-v1.zz" }, coin, address, feeRate: 4, sign: mockWallet })).rejects.toThrow();
  });
});

describe("broadcast failures (mocked network, nothing sent)", () => {
  const txid = "d".repeat(64);
  it("returns the txid on success", async () => {
    const f = vi.fn(async () => new Response(txid, { status: 200 }));
    expect(await broadcastTx("00", f as unknown as typeof fetch)).toBe(txid);
  });
  it("surfaces a node rejection", async () => {
    const f = async () => new Response("sendrawtransaction RPC error: bad-txns-inputs-missingorspent", { status: 400 });
    await expect(broadcastTx("00", f as unknown as typeof fetch)).rejects.toThrow(/REJECTED.*missingorspent/);
  });
  it("reports a network outage as not sent", async () => {
    const f = async () => { throw new TypeError("Failed to fetch"); };
    await expect(broadcastTx("00", f as unknown as typeof fetch)).rejects.toThrow(/NOT SENT/);
  });
  it("refuses an unexpected reply", async () => {
    const f = async () => new Response("<html>oops</html>", { status: 200 });
    await expect(broadcastTx("00", f as unknown as typeof fetch)).rejects.toThrow(/UNEXPECTED/);
  });
});

/**
 * Xverse maker signing with a mocked wallet. Signatures are fake bytes: these
 * tests check what the wallet is asked and handed, never real cryptography,
 * and nothing is broadcast (fetch is trapped).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { secp256k1 } from "@noble/curves/secp256k1.js";

const walletCalls: Array<{ psbtBase64: string; inputsToSign: Array<{ address: string; signingIndexes: number[]; sigHash?: number }> }> = [];
let walletMode: "sign" | "cancel" = "sign";

vi.mock("sats-connect", () => ({
  AddressPurpose: { Ordinals: "ordinals", Payment: "payment" },
  BitcoinNetworkType: { Mainnet: "Mainnet" },
  getProviders: () => [{ id: "XverseProviders.BitcoinProvider", name: "Xverse" }],
  request: vi.fn(),
  signTransaction: async (opts: { payload: { psbtBase64: string; inputsToSign: never[] }; onFinish: (r: { psbtBase64: string }) => void; onCancel: () => void }) => {
    walletCalls.push(opts.payload);
    if (walletMode === "cancel") return opts.onCancel();
    opts.onFinish({ psbtBase64: fakeSign(opts.payload.psbtBase64, opts.payload.inputsToSign as never) });
  },
}));

import { buildSwapPsbt, byteArrayToHex, parsePsbt, serializePsbt, finalizeSignedPsbt, isFullySigned, extractRawTxHex } from "@/lib/psbt-buyer";
import { addressToScriptPubKey } from "@/lib/psbt-builder";
import { sha256 } from "@noble/hashes/sha2.js";
import { hash160 } from "@/lib/psbt-scripts";
import { makerKeysFor, signMakerSwap } from "@/lib/barter-maker-sign";
import type { ConnectedWallet } from "@/lib/browser-wallet";

/** Fake wallet: adds a dummy signature on each requested index (tap key sig for P2TR, partial sig otherwise). */
function fakeSign(b64: string, req: Array<{ signingIndexes: number[] }>, pub = FAKE_PUB): string {
  const p = parsePsbt(b64);
  for (const idx of req.flatMap((r) => r.signingIndexes)) {
    const map = p.inputs[idx]!;
    const wu = map.find((kv) => kv.key[0] === 0x01)!.value;
    const taproot = wu[9] === 0x51 && wu[8] === 34;
    map.push(taproot ? { key: [0x13], value: Array(64).fill(7) } : { key: [0x02, ...pub], value: [...Array(71).fill(9), 0x01] });
  }
  return serializePsbt(p);
}
let FAKE_PUB: number[] = [];

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const BIP86_X = "cc8a4bc64d897bddc5fbc2f670f7a8ba0b386779106cf1223c6fc5d7cd6fc115";
const BIP86_ADDR = "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr";
const TAKER = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
const spk = (a: string) => byteArrayToHex(addressToScriptPubKey(a));

// Nested-segwit maker: a fresh key and its own 3… address.
const nestedPub = hex(secp256k1.getPublicKey(secp256k1.utils.randomSecretKey(), true));
const nestedRedeem = [0x00, 0x14, ...hash160([...Buffer.from(nestedPub, "hex")])];
const nestedScript = [0xa9, 0x14, ...hash160(nestedRedeem), 0x87];
const base58check = (payload: number[]) => {
  const full = [...payload, ...sha256(sha256(Uint8Array.from(payload))).slice(0, 4)];
  const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = BigInt("0x" + Buffer.from(full).toString("hex")), out = "";
  while (n > 0n) { out = A[Number(n % 58n)] + out; n /= 58n; }
  for (const b of full) { if (b !== 0) break; out = "1" + out; }
  return out;
};
const NESTED_ADDR = base58check([0x05, ...nestedScript.slice(2, 22)]);

const swapFor = (makerAddr: string) => buildSwapPsbt({
  maker: { txid: "a".repeat(64), vout: 0, valueSats: 546, scriptPubKeyHex: spk(makerAddr) },
  taker: { txid: "b".repeat(64), vout: 1, valueSats: 600, scriptPubKeyHex: spk(TAKER) },
  makerReceiveScriptHex: spk(makerAddr), takerReceiveScriptHex: spk(TAKER), takerChangeScriptHex: spk(TAKER),
  funding: [{ txid: "c".repeat(64), vout: 2, valueSats: 100_000, scriptPubKeyHex: spk(TAKER) }],
  feeRate: 5, sweetenerSats: 0,
});
/** Taker's half, signed by the (fake) taker wallet first, as in the real flow. */
const takerSigned = (makerAddr: string) => {
  const b = swapFor(makerAddr);
  return fakeSign(b.psbtBase64, [{ signingIndexes: [1, ...b.fundingIndices] }], [...Buffer.from("02" + "33".repeat(32), "hex")]);
};
const xverse = (over: Partial<ConnectedWallet>): ConnectedWallet => ({ provider: "xverse", ordinalsAddress: BIP86_ADDR, paymentAddress: TAKER, ...over });
const input0 = (b64: string) => parsePsbt(b64).inputs[0]!;

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  walletCalls.length = 0; walletMode = "sign";
  const provider = { request: vi.fn(async () => ({ result: null })), signTransaction: vi.fn() };
  (globalThis as Record<string, unknown>).window = { XverseProviders: { BitcoinProvider: provider } };
  fetchSpy = vi.fn(() => { throw new Error("network blocked in test: no broadcast allowed"); });
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => { vi.unstubAllGlobals(); delete (globalThis as Record<string, unknown>).window; });

describe("Xverse maker signing · taproot (bc1p…)", () => {
  it("hands Xverse the checked internal key, asks for input 0 only with SIGHASH_ALL, and yields a complete unbroadcast tx", async () => {
    FAKE_PUB = [];
    const signed = await signMakerSwap(xverse({ publicKey: "02" + BIP86_X }), takerSigned(BIP86_ADDR));
    expect(walletCalls).toHaveLength(1);
    const call = walletCalls[0]!;
    expect(call.inputsToSign).toEqual([{ address: BIP86_ADDR, signingIndexes: [0], sigHash: 1 }]);
    expect(byteArrayToHex(input0(call.psbtBase64).find((kv) => kv.key[0] === 0x17)!.value)).toBe(BIP86_X);
    const final = finalizeSignedPsbt(signed);
    expect(isFullySigned(final)).toBe(true);
    expect(extractRawTxHex(final)).toMatch(/^02000000/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("replaces a wrong key hint planted by the taker before Xverse sees it", async () => {
    const p = parsePsbt(takerSigned(BIP86_ADDR));
    p.inputs[0]!.push({ key: [0x17], value: Array(32).fill(0x22) });
    await signMakerSwap(xverse({ publicKey: BIP86_X }), serializePsbt(p));
    const hints = input0(walletCalls[0]!.psbtBase64).filter((kv) => kv.key[0] === 0x17);
    expect(hints.map((kv) => byteArrayToHex(kv.value))).toEqual([BIP86_X]);
  });
});

describe("Xverse maker signing · nested segwit (3…)", () => {
  it("hands Xverse the redeem script for the matching key and yields a complete unbroadcast tx", async () => {
    FAKE_PUB = [...Buffer.from(nestedPub, "hex")];
    const signed = await signMakerSwap(xverse({ ordinalsAddress: NESTED_ADDR, publicKey: "02" + BIP86_X, paymentPublicKey: nestedPub }), takerSigned(NESTED_ADDR));
    const call = walletCalls[0]!;
    expect(call.inputsToSign).toEqual([{ address: NESTED_ADDR, signingIndexes: [0], sigHash: 1 }]);
    expect(input0(call.psbtBase64).find((kv) => kv.key[0] === 0x04)!.value).toEqual(nestedRedeem);
    const final = finalizeSignedPsbt(signed);
    expect(isFullySigned(final)).toBe(true);
    expect(extractRawTxHex(final)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("disabled paths never reach the wallet", () => {
  const cases: Array<[string, Partial<ConnectedWallet>, RegExp]> = [
    ["taproot, no key shared", {}, /didn't share the key/],
    ["taproot, key for another account", { publicKey: "11".repeat(32) }, /doesn't match/],
    ["nested segwit, no matching key", { ordinalsAddress: NESTED_ADDR, publicKey: BIP86_X }, /nested-segwit/],
    ["legacy 1… address", { ordinalsAddress: "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2", publicKey: BIP86_X }, /Legacy/],
    ["unreadable address", { ordinalsAddress: "not-an-address", publicKey: BIP86_X }, /can't be read|can't sign/],
    ["unsupported wallet", { provider: "leather" as never, publicKey: BIP86_X }, /UniSat or Xverse/],
  ];
  for (const [name, over, reason] of cases) {
    it(name, async () => {
      const w = xverse(over);
      const k = makerKeysFor(w);
      expect(k.ok).toBe(false);
      if (!k.ok) expect(k.reason).toMatch(reason);
      await expect(signMakerSwap(w, takerSigned(BIP86_ADDR))).rejects.toThrow(reason);
      expect(walletCalls).toHaveLength(0);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  }
  it("a decline in Xverse is reported and nothing is sent", async () => {
    walletMode = "cancel";
    await expect(signMakerSwap(xverse({ publicKey: BIP86_X }), takerSigned(BIP86_ADDR))).rejects.toThrow(/DECLINED/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

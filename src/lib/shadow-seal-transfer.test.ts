/** 1-click transfer with a mock wallet: a real throwaway key signs, nothing touches Bitcoin. */
import { describe, expect, it, vi } from "vitest";
import { Transaction, p2wpkh, utils } from "@scure/btc-signer";
import { base64, hex } from "@scure/base";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { mintSealed, noteKey, readAnchorScript } from "./shadow-seal";
import { BroadcastUnknown, pendingStore, resolvePending, sealStore, type PendingTransfer, type Resolution, txSeenOnChain, broadcastTx, pickPlainCoin, prepareTransfer, sealFee, sealReceiveCode, type Coin, type HeldSealed } from "./shadow-seal-wallet";

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
    const r = await prepareTransfer({ bundle, give: { [k(1)]: bob }, coin, allHeld: bundle, address, feeRate: 4, sign: mockWallet });
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
    await expect(prepareTransfer({ bundle, give: { [k(0)]: bob }, coin, allHeld: bundle, address, feeRate: 4, sign: async () => { throw new Error("User rejected"); } }))
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
    await expect(prepareTransfer({ bundle, give: { [k(0)]: bob }, coin, allHeld: bundle, address, feeRate: 4, sign: tamper })).rejects.toThrow(/LOST ITS SEAL RECORD/);
  });
  it("refuses when no note is given or a code is bad", async () => {
    await expect(prepareTransfer({ bundle, give: {}, coin, allHeld: bundle, address, feeRate: 4, sign: mockWallet })).rejects.toThrow(/AT LEAST ONE/);
    await expect(prepareTransfer({ bundle, give: { [k(0)]: "SEAL-RECV-v1.zz" }, coin, allHeld: bundle, address, feeRate: 4, sign: mockWallet })).rejects.toThrow();
  });
});

describe("broadcast outcomes (mocked network, nothing sent)", () => {
  const F = (f: (u: string, i?: RequestInit) => Promise<Response>) => f as unknown as typeof fetch;
  const signedTx = () => prepareTransfer({ bundle, allHeld: bundle, give: { [k(1)]: bob }, coin, address, feeRate: 4, sign: mockWallet });

  it("returns the txid when Bitcoin accepts it", async () => {
    const s = await signedTx();
    expect(await broadcastTx(s.rawHex, s.txid, F(async () => new Response(s.txid)))).toBe(s.txid);
  });
  it("a definite node rejection is reported as rejected", async () => {
    const s = await signedTx();
    await expect(broadcastTx(s.rawHex, s.txid, F(async () => new Response("bad-txns-inputs-missingorspent", { status: 400 })))).rejects.toThrow(/REJECTED/);
  });
  it("'already in mempool' counts as sent", async () => {
    const s = await signedTx();
    expect(await broadcastTx(s.rawHex, s.txid, F(async () => new Response("txn-already-in-mempool", { status: 400 })))).toBe(s.txid);
  });
  it("a timeout is UNKNOWN, never 'not sent'", async () => {
    const s = await signedTx();
    const hang = F((_u, i) => new Promise((_, rej) => i?.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")))));
    const e = await broadcastTx(s.rawHex, s.txid, hang, 20).catch((x) => x);
    expect(e).toBeInstanceOf(BroadcastUnknown);
    expect((e as BroadcastUnknown).txid).toBe(s.txid);
  });
  it("a dropped connection, a 5xx, or an odd reply are UNKNOWN", async () => {
    const s = await signedTx();
    await expect(broadcastTx(s.rawHex, s.txid, F(async () => { throw new TypeError("Failed to fetch"); }))).rejects.toBeInstanceOf(BroadcastUnknown);
    await expect(broadcastTx(s.rawHex, s.txid, F(async () => new Response("bad gateway", { status: 502 })))).rejects.toBeInstanceOf(BroadcastUnknown);
    await expect(broadcastTx(s.rawHex, s.txid, F(async () => new Response("<html>")))).rejects.toBeInstanceOf(BroadcastUnknown);
  });
  it("after an unknown outcome, the txid lookup decides: seen / absent / still unknown", async () => {
    const s = await signedTx();
    expect(await txSeenOnChain(s.txid, F(async (u) => { expect(u).toContain(s.txid); return new Response('{"confirmed":false}'); }))).toBe("seen");
    expect(await txSeenOnChain(s.txid, F(async () => new Response("Transaction not found", { status: 404 })))).toBe("absent");
    expect(await txSeenOnChain(s.txid, F(async () => { throw new TypeError("offline"); }))).toBe("unknown");
    expect(await txSeenOnChain(s.txid, F(async () => new Response("", { status: 503 })))).toBe("unknown");
  });
  it("every bundle note is preserved through an unknown outcome: kept + given cover the whole bundle", async () => {
    const before = JSON.stringify(bundle);
    const s = await signedTx();
    await broadcastTx(s.rawHex, s.txid, F(async () => { throw new TypeError("x"); })).catch(() => {});
    expect(JSON.stringify(bundle)).toBe(before);
    expect([...s.kept.map((h) => h.c.note.label), ...s.sent.map((x) => x.label)].sort()).toEqual(["Key", "Map", "Pass"]);
  });
});

describe("only the anchoring coin, with the whole bundle", () => {
  const other: Coin = { txid: "e".repeat(64), vout: 0, value: 50_000, confirmed: true };
  it("auto-pick never chooses a coin that already anchors notes", async () => {
    const seal = new Set([`${other.txid}:0`]);
    const small: Coin = { txid: "f".repeat(64), vout: 0, value: 9_000, confirmed: true };
    expect((await pickPlainCoin([other, small], 3, async () => {}, seal)).txid).toBe(small.txid);
    await expect(pickPlainCoin([other], 3, async () => {}, seal)).rejects.toThrow(/NO PLAIN COIN/);
  });
  it("refuses to spend an unrelated coin for these notes", async () => {
    await expect(prepareTransfer({ bundle, allHeld: bundle, give: { [k(0)]: bob }, coin: other, address, feeRate: 4, sign: mockWallet })).rejects.toThrow(/WRONG COIN/);
  });
  it("refuses a partial bundle that would lose notes on the coin", async () => {
    await expect(prepareTransfer({ bundle: bundle.slice(0, 2), allHeld: bundle, give: { [k(0)]: bob }, coin, address, feeRate: 4, sign: mockWallet })).rejects.toThrow(/WOULD BE LOST/);
  });
  it("refuses giving a note that is not on this coin", async () => {
    await expect(prepareTransfer({ bundle, allHeld: bundle, give: { ["x".repeat(64)]: bob }, coin, address, feeRate: 4, sign: mockWallet })).rejects.toThrow(/NOT ON THIS COIN/);
  });
});

describe("unresolved transfers survive reloads and only resolve on both chain facts", () => {
  const mem = new Map<string, string>();
  globalThis.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) } as unknown as Storage;

  const make = async () => {
    const r = await prepareTransfer({ bundle, allHeld: bundle, give: { [k(1)]: bob }, coin, address, feeRate: 4, sign: mockWallet });
    const p: PendingTransfer = { txid: r.txid, rawHex: r.rawHex, anchor: { txid: coin.txid, vout: coin.vout }, sent: r.sent, at: "t", unknown: true };
    return { r, p };
  };

  it("a pending transfer, with its given and kept notes, is still there after a 'reload'", async () => {
    mem.clear();
    const { r, p } = await make();
    pendingStore.put(p);
    sealStore.setHeld(r.kept); sealStore.setUndo({ [r.txid]: bundle });
    // simulate reload: read everything back from storage only
    const [back] = pendingStore.all();
    expect(back!.txid).toBe(r.txid);
    expect(back!.unknown).toBe(true);
    expect(back!.sent.map((s) => s.label)).toEqual(["Pass"]);
    expect(sealStore.held().map((h) => h.c.note.label)).toEqual(["Key", "Map"]);
    expect(sealStore.undo()[r.txid]!.map((h) => h.c.note.label)).toEqual(["Key", "Pass", "Map"]);
  });

  const cases: [string, Parameters<typeof resolvePending>[1], Resolution][] = [
    ["seen + anchor spent by it → SENT", { txSeen: async () => "seen", outspend: async () => ({ spent: true, txid: "SELF" }) }, "SENT"],
    ["absent + anchor unspent → SAFE_TO_CANCEL", { txSeen: async () => "absent", outspend: async () => ({ spent: false }) }, "SAFE_TO_CANCEL"],
    ["anchor spent by another tx → CONFLICT", { txSeen: async () => "absent", outspend: async () => ({ spent: true, txid: "f".repeat(64) }) }, "CONFLICT"],
    ["txid lookup unavailable → UNRESOLVED", { txSeen: async () => "unknown", outspend: async () => ({ spent: false }) }, "UNRESOLVED"],
    ["anchor lookup fails → UNRESOLVED", { txSeen: async () => "absent", outspend: async () => { throw new Error("down"); } }, "UNRESOLVED"],
    ["seen but anchor unspent (contradiction) → UNRESOLVED", { txSeen: async () => "seen", outspend: async () => ({ spent: false }) }, "UNRESOLVED"],
    ["absent but anchor spent by it (contradiction) → UNRESOLVED", { txSeen: async () => "absent", outspend: async () => ({ spent: true, txid: "SELF" }) }, "UNRESOLVED"],
  ];
  for (const [name, deps, want] of cases) {
    it(name, async () => {
      const { p } = await make();
      const fix = { ...deps, outspend: async (o: { txid: string; vout: number }) => {
        expect(o).toEqual(p.anchor);
        const v = await deps.outspend(o);
        return v.txid === "SELF" ? { ...v, txid: p.txid } : v;
      } };
      expect(await resolvePending(p, fix)).toBe(want);
    });
  }

  it("dropping a resolved transfer removes only that one", async () => {
    mem.clear();
    const { p } = await make();
    pendingStore.put(p); pendingStore.put({ ...p, txid: "9".repeat(64) });
    pendingStore.drop(p.txid);
    expect(pendingStore.all().map((x) => x.txid)).toEqual(["9".repeat(64)]);
  });
});

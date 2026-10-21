/** 1-click transfer with a mock wallet: a real throwaway key signs, nothing touches Bitcoin. */
import { describe, expect, it, vi } from "vitest";
import { Transaction, p2wpkh, utils } from "@scure/btc-signer";
import { base64, hex } from "@scure/base";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { mintSealed, noteKey, readAnchorScript } from "./shadow-seal";
import { BroadcastUnknown, VaultStorageError, loadHeld, restoreBackup, recoverInterruptedRestore, repairedHeld, runLockedTransfer, intentStore, clearInterrupted, networkOf, withAnchorLock, pendingStore, resolvePending, sealStore, type PendingTransfer, type Resolution, txSeenOnChain, broadcastTx, pickPlainCoin, prepareTransfer, sealFee, sealReceiveCode, type Coin, type HeldSealed } from "./shadow-seal-wallet";

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
    const p: PendingTransfer = { txid: r.txid, rawHex: r.rawHex, anchor: { txid: coin.txid, vout: coin.vout }, address, network: "mainnet", sent: r.sent, at: "t", unknown: true };
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

describe("two tabs, one anchor coin", () => {
  // Fake Web Locks shared by two "tabs" (same origin storage + lock manager), like a real browser.
  const held = new Set<string>();
  const locks = { request: async (name: string, _o: unknown, cb: (l: unknown) => Promise<unknown>) => {
    if (held.has(name)) return cb(null);
    held.add(name);
    try { return await cb({ name }); } finally { held.delete(name); }
  } };
  const tab = (signer: (p: string) => Promise<string>) => withAnchorLock(coin, async () => {
    const r = await prepareTransfer({ bundle, allHeld: bundle, give: { [k(1)]: bob }, coin, address, feeRate: 4, sign: signer });
    pendingStore.put({ txid: r.txid, rawHex: r.rawHex, anchor: { txid: coin.txid, vout: coin.vout }, address, network: "mainnet", sent: r.sent, at: "t" });
    return r;
  }, locks);

  it("while tab A's wallet popup is open, tab B is refused", async () => {
    localStorage.removeItem("bitmapwin:sealed-pending");
    let release!: () => void;
    const slow = (p: string) => new Promise<string>((res) => { release = () => res(mockWallet(p)); });
    const a = tab(slow);
    await new Promise((r) => setTimeout(r, 0));
    await expect(tab(mockWallet)).rejects.toThrow(/ANOTHER TAB IS SIGNING/);
    release();
    const ra = await a;
    expect(pendingStore.onAnchor(coin).map((p) => p.txid)).toEqual([ra.txid]);
  });
  it("after tab A finishes, tab B is refused by the stored unfinished transfer", async () => {
    await expect(tab(mockWallet)).rejects.toThrow(/ALREADY HAS AN UNFINISHED TRANSFER/);
    expect(pendingStore.onAnchor(coin)).toHaveLength(1);
  });
  it("a refused tab never reaches the wallet and changes no notes", async () => {
    const before = JSON.stringify(bundle);
    const spy = vi.fn(mockWallet);
    await expect(tab(spy)).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
    expect(JSON.stringify(bundle)).toBe(before);
  });
  it("tab A cancelling in the wallet frees the coin for tab B", async () => {
    localStorage.removeItem("bitmapwin:sealed-pending");
    await expect(tab(async () => { throw new Error("rejected"); })).rejects.toThrow(/SIGNING CANCELLED/);
    expect(pendingStore.onAnchor(coin)).toHaveLength(0);
    await expect(tab(mockWallet)).resolves.toBeTruthy();
  });
  it("without a lock manager it refuses rather than risk a race", async () => {
    await expect(withAnchorLock(coin, async () => 1, undefined)).rejects.toThrow(/CAN'T PREVENT TWO TABS/);
  });
});

describe("recovery is scoped to wallet and network", () => {
  const other = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
  const test = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";
  it("detects the network from the address", () => {
    expect(networkOf(address)).toBe("mainnet");
    expect(networkOf(test)).toBe("testnet");
    expect(networkOf("bcrt1qxyz")).toBe("regtest");
  });
  it("switching wallet hides the other wallet's unfinished transfer but still guards its coin", async () => {
    localStorage.removeItem("bitmapwin:sealed-pending");
    const p: PendingTransfer = { txid: "7".repeat(64), rawHex: "00", anchor: { txid: coin.txid, vout: coin.vout }, address, network: "mainnet", sent: [{ label: "Pass", code: "x" }], at: "t" };
    pendingStore.put(p);
    expect(pendingStore.forWallet(address).map((x) => x.txid)).toEqual([p.txid]);
    expect(pendingStore.forWallet(other)).toHaveLength(0);
    expect(pendingStore.forWallet(test)).toHaveLength(0);
    expect(pendingStore.onAnchor(coin)).toHaveLength(1);
    // switching back restores it with its given note intact
    expect(pendingStore.forWallet(address)[0]!.sent.map((s) => s.label)).toEqual(["Pass"]);
  });
  it("a record signed on another network is never shown to this wallet", () => {
    localStorage.removeItem("bitmapwin:sealed-pending");
    pendingStore.put({ txid: "8".repeat(64), rawHex: "00", anchor: { txid: "1".repeat(64), vout: 0 }, address, network: "testnet", sent: [], at: "t" });
    expect(pendingStore.forWallet(address)).toHaveLength(0);
  });
});

describe("crashes, reloads and late signatures while the wallet window is open", () => {
  // Web Locks are released by the browser when a tab dies; model that with a "crash" that frees the name.
  const held = new Set<string>();
  const locks = { request: async (name: string, _o: unknown, cb: (l: unknown) => Promise<unknown>) => {
    if (held.has(name)) return cb(null);
    held.add(name);
    try { return await cb({ name }); } finally { held.delete(name); }
  } };
  const reset = () => { for (const key of ["bitmapwin:sealed-pending", "bitmapwin:sealed-intent", "bitmapwin:sealed-undo", "bitmapwin:sealed-sent"]) localStorage.removeItem(key); sealStore.setHeld(bundle); held.clear(); };
  const labels = () => sealStore.held().map((h) => h.c.note.label).sort();
  const go = (sign: (p: string) => Promise<string>, currentWallet = () => address as string | null) =>
    runLockedTransfer({ bundle, give: { [k(1)]: bob }, coin, address, feeRate: 4, sign, currentWallet, locks });

  it("reload mid-popup: the intent survives, notes are untouched, and new transfers are blocked", async () => {
    reset();
    void go(() => new Promise<string>(() => {})); // popup never returns — tab is about to die
    await new Promise((r) => setTimeout(r, 0));
    held.clear(); // tab crashed: browser frees its lock
    expect(intentStore.onAnchor(coin)).toHaveLength(1);
    expect(intentStore.forWallet(address)).toHaveLength(1);
    expect(labels()).toEqual(["Key", "Map", "Pass"]);
    const spy = vi.fn(mockWallet);
    await expect(go(spy)).rejects.toThrow(/INTERRUPTED/);
    expect(spy).not.toHaveBeenCalled();
  });
  it("an interrupted signing is cleared only when the anchor is provably unspent", async () => {
    expect(await clearInterrupted(coin, async () => { throw new Error("down"); }, locks)).toBe("UNRESOLVED");
    expect(await clearInterrupted(coin, async () => ({ spent: true, txid: "e".repeat(64) }), locks)).toBe("SPENT");
    expect(intentStore.onAnchor(coin)).toHaveLength(1);
    expect(await clearInterrupted(coin, async () => ({ spent: false }), locks)).toBe("CLEARED");
    expect(intentStore.onAnchor(coin)).toHaveLength(0);
    expect(labels()).toEqual(["Key", "Map", "Pass"]);
    await expect(go(mockWallet)).resolves.toBeTruthy();
  });
  it("can't clear an intent while a live tab is still signing", async () => {
    reset();
    let release!: () => void;
    const p = go((ps) => new Promise((res) => { release = () => res(mockWallet(ps)); }));
    await new Promise((r) => setTimeout(r, 0));
    expect(await clearInterrupted(coin, async () => ({ spent: false }), locks)).toBe("BUSY");
    release(); await p;
  });
  it("crash right after the signature lands: notes, pending and undo are all already saved", async () => {
    reset();
    const r = await go(mockWallet);
    held.clear(); // crash
    expect(intentStore.onAnchor(coin)).toHaveLength(0);
    expect(pendingStore.forWallet(address).map((x) => x.txid)).toEqual([r.txid]);
    expect(sealStore.held().map((h) => h.c.note.label)).toEqual(["Key", "Map"]);
    expect(pendingStore.forWallet(address)[0]!.sent.map((x) => x.label)).toEqual(["Pass"]);
    expect(sealStore.undo()[r.txid]!.map((h) => h.c.note.label).sort()).toEqual(["Key", "Map", "Pass"]);
    await expect(go(mockWallet)).rejects.toThrow(/UNFINISHED TRANSFER/);
  });
  it("signature arriving after a wallet switch is filed under the wallet that started it", async () => {
    reset();
    const r = await go(mockWallet, () => "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq");
    expect(r.walletChanged).toBe(true);
    expect(pendingStore.forWallet(address).map((x) => x.txid)).toEqual([r.txid]);
    expect(pendingStore.forWallet("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq")).toHaveLength(0);
    await expect(go(mockWallet)).rejects.toThrow(/UNFINISHED/);
  });
  it("signature arriving after a network switch (or disconnect) is flagged the same way", async () => {
    reset();
    expect((await go(mockWallet, () => "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx")).walletChanged).toBe(true);
    reset();
    expect((await go(mockWallet, () => null)).walletChanged).toBe(true);
    expect(pendingStore.onAnchor(coin)).toHaveLength(1);
  });
  it("if another tab added a note to the coin while signing, the signature is discarded and nothing is lost", async () => {
    reset();
    let release!: () => void;
    const p = go((ps) => new Promise((res) => { release = () => res(mockWallet(ps)); }));
    await new Promise((r) => setTimeout(r, 0));
    const extra: HeldSealed = { c: { note: mintSealed("Late", "item", A, "2026-10-21T00:00:09Z"), steps: [], reveals: [] }, mine: A };
    sealStore.setHeld([...sealStore.held(), extra]);
    release();
    await expect(p).rejects.toThrow(/CHANGED WHILE SIGNING/);
    expect(labels()).toEqual(["Key", "Late", "Map", "Pass"]);
    expect(pendingStore.onAnchor(coin)).toHaveLength(0);
    expect(intentStore.onAnchor(coin)).toHaveLength(0);
  });
});

describe("stale signatures after an interrupted signing is cleared", () => {
  // A lock that always grants models the worst case: a stale tab whose lock was lost (crash/reload/
  // wallet extension holding the request), so only the attempt check stands between it and the coin.
  const open = { request: async (_n: string, _o: unknown, cb: (l: unknown) => Promise<unknown>) => cb({}) };
  const reset = () => { for (const key of ["bitmapwin:sealed-pending", "bitmapwin:sealed-intent", "bitmapwin:sealed-undo", "bitmapwin:sealed-sent"]) localStorage.removeItem(key); sealStore.setHeld(bundle); };
  const labels = () => sealStore.held().map((h) => h.c.note.label).sort();
  const slow = () => { let release!: () => void; const sign = (ps: string) => new Promise<string>((res) => { release = () => res(mockWallet(ps)); }); return { sign, release: () => release() }; };
  const go = (sign: (p: string) => Promise<string>, give = { [k(1)]: bob }, currentWallet = () => address as string | null) =>
    runLockedTransfer({ bundle, give, coin, address, feeRate: 4, sign, currentWallet, locks: open });
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it("old signature arrives after clear + a new transfer finished → rejected, new transfer intact", async () => {
    reset();
    const old = slow(); const pa = go(old.sign);
    await tick();
    expect(await clearInterrupted(coin, async () => ({ spent: false }), open)).toBe("CLEARED");
    const nb = await go(mockWallet, { [k(0)]: bob }); // new transfer gives "Key"
    old.release();
    await expect(pa).rejects.toThrow(/STALE/);
    expect(pendingStore.onAnchor(coin).map((p) => p.txid)).toEqual([nb.txid]);
    expect(pendingStore.onAnchor(coin)[0]!.sent.map((x) => x.label)).toEqual(["Key"]);
    expect(labels()).toEqual(["Map", "Pass"]);
    expect(sealStore.undo()[nb.txid]!.map((h) => h.c.note.label).sort()).toEqual(["Key", "Map", "Pass"]);
  });
  it("old signature arrives while the new attempt is still in its wallet → rejected, new attempt unaffected", async () => {
    reset();
    const old = slow(); const pa = go(old.sign);
    await tick();
    await clearInterrupted(coin, async () => ({ spent: false }), open);
    const nu = slow(); const pb = go(nu.sign, { [k(2)]: bob });
    await tick();
    old.release();
    await expect(pa).rejects.toThrow(/STALE/);
    expect(intentStore.onAnchor(coin)).toHaveLength(1); // the new attempt's intent was NOT dropped
    expect(labels()).toEqual(["Key", "Map", "Pass"]);
    nu.release();
    const rb = await pb;
    expect(rb.sent.map((x) => x.label)).toEqual(["Map"]);
    expect(labels()).toEqual(["Key", "Pass"]);
    expect(intentStore.onAnchor(coin)).toHaveLength(0);
  });
  it("old attempt rejected by its wallet after being superseded never drops the new intent", async () => {
    reset();
    let reject!: () => void;
    const pa = go(() => new Promise<string>((_, rej) => { reject = () => rej(new Error("user closed")); }));
    await tick();
    await clearInterrupted(coin, async () => ({ spent: false }), open);
    const nu = slow(); const pb = go(nu.sign);
    await tick();
    reject();
    await expect(pa).rejects.toThrow(/SIGNING CANCELLED/);
    expect(intentStore.onAnchor(coin)).toHaveLength(1);
    nu.release(); await pb;
  });
  it("stale signature after a reload + wallet switch is rejected and files nothing for either wallet", async () => {
    reset();
    const old = slow(); const pa = go(old.sign, { [k(1)]: bob }, () => "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq");
    await tick();
    await clearInterrupted(coin, async () => ({ spent: false }), open); // "reload", then cleared
    old.release();
    await expect(pa).rejects.toThrow(/STALE/);
    expect(pendingStore.all()).toHaveLength(0);
    expect(labels()).toEqual(["Key", "Map", "Pass"]);
  });
  it("two attempts racing with no lock: the second is refused before its wallet opens, the first files", async () => {
    reset();
    const a = slow();
    const pa = go(a.sign); await tick();
    const spy = vi.fn(mockWallet);
    await expect(go(spy, { [k(0)]: bob })).rejects.toThrow(/INTERRUPTED/);
    expect(spy).not.toHaveBeenCalled();
    a.release();
    const ra = await pa;
    expect(pendingStore.onAnchor(coin).map((p) => p.txid)).toEqual([ra.txid]);
    expect([...labels(), ...ra.sent.map((x) => x.label)].sort()).toEqual(["Key", "Map", "Pass"]);
  });
});

describe("browser storage failures and damaged recovery records", () => {
  // A storage that can be told to fail setItem for given keys, drop writes silently, or throw on read.
  const mem = new Map<string, string>();
  let failSet = new Set<string>(), dropSet = new Set<string>(), failRead = false;
  const faulty = {
    getItem: (k: string) => { if (failRead) throw new Error("SecurityError"); return mem.get(k) ?? null; },
    setItem: (k: string, v: string) => { if (failSet.has(k)) throw new DOMException("quota", "QuotaExceededError"); if (!dropSet.has(k)) mem.set(k, v); },
    removeItem: (k: string) => void mem.delete(k),
  } as unknown as Storage;
  const real = globalThis.localStorage;
  const reset = () => { mem.clear(); failSet = new Set(); dropSet = new Set(); failRead = false; globalThis.localStorage = faulty; sealStore.setHeld(bundle); };
  const after = () => { globalThis.localStorage = real; };
  const held = new Set<string>();
  const locks = { request: async (name: string, _o: unknown, cb: (l: unknown) => Promise<unknown>) => {
    if (held.has(name)) return cb(null); held.add(name); try { return await cb({}); } finally { held.delete(name); } } };
  const go = (sign: (p: string) => Promise<string> = mockWallet) =>
    runLockedTransfer({ bundle, give: { [k(1)]: bob }, coin, address, feeRate: 4, sign, currentWallet: () => address, locks });
  const labels = () => sealStore.held().map((h) => h.c.note.label).sort();
  const PK = "bitmapwin:sealed-pending", IK = "bitmapwin:sealed-intent", HK = "bitmapwin:sealed-notes";

  it("BEFORE signing: if the signing lock can't be saved, the wallet never opens", async () => {
    reset(); failSet.add(IK);
    const spy = vi.fn(mockWallet);
    await expect(go(spy)).rejects.toBeInstanceOf(VaultStorageError);
    expect(spy).not.toHaveBeenCalled();
    expect(labels()).toEqual(["Key", "Map", "Pass"]);
    after();
  });
  it("BEFORE signing: a save the browser silently drops is caught too", async () => {
    reset(); dropSet.add(IK);
    const spy = vi.fn(mockWallet);
    await expect(go(spy)).rejects.toThrow(/DID NOT KEEP|SIGNING LOCK/);
    expect(spy).not.toHaveBeenCalled();
    after();
  });
  it("AFTER signing: if the signed transfer can't be saved, the signature is discarded, notes unchanged, coin stays blocked", async () => {
    reset(); failSet.add(PK);
    await expect(go()).rejects.toThrow(/COULD NOT SAVE THE SIGNED TRANSFER/);
    expect(labels()).toEqual(["Key", "Map", "Pass"]);
    expect(intentStore.onAnchor(coin)).toHaveLength(1); // shows as interrupted
    failSet.clear();
    const spy = vi.fn(mockWallet);
    await expect(go(spy)).rejects.toThrow(/INTERRUPTED/);
    expect(spy).not.toHaveBeenCalled();
    after();
  });
  it("AFTER signing: if only the notes list fails to save, the transfer record repairs it on reload", async () => {
    reset(); failSet.add(HK);
    const r = await go();
    expect(labels()).toEqual(["Key", "Map", "Pass"]); // stale on disk
    failSet.clear();
    const fixed = loadHeld(); // "reload"
    expect(fixed.map((h) => h.c.note.label).sort()).toEqual(["Key", "Map"]);
    expect(fixed.every((h) => h.mine.txid === r.txid)).toBe(true);
    expect(pendingStore.onAnchor(coin)[0]!.sent.map((x) => x.label)).toEqual(["Pass"]);
    expect(pendingStore.onAnchor(coin)[0]!.before!.map((h) => h.c.note.label).sort()).toEqual(["Key", "Map", "Pass"]);
    after();
  });
  it("a corrupted unfinished-transfer record blocks new transfers instead of reading as empty", async () => {
    reset(); mem.set(PK, "{not json");
    const spy = vi.fn(mockWallet);
    await expect(go(spy)).rejects.toThrow(/DAMAGED VAULT RECORD/);
    expect(spy).not.toHaveBeenCalled();
    expect(() => pendingStore.put({ txid: "1".repeat(64), rawHex: "", anchor: coin, address, network: "mainnet", sent: [], at: "" })).toThrow(/DAMAGED/);
    expect(mem.get(PK)).toBe("{not json"); // never overwritten
    after();
  });
  it("a wrongly shaped signing-lock record also blocks (fail closed)", async () => {
    reset(); mem.set(IK, JSON.stringify([{ anchor: { txid: "zz", vout: "x" } }]));
    await expect(go()).rejects.toThrow(/DAMAGED/);
    after();
  });
  it("a corrupted notes list is never overwritten by an empty one", () => {
    reset(); mem.set(HK, JSON.stringify([{ junk: true }]));
    expect(() => loadHeld()).toThrow(/DAMAGED/);
    expect(() => sealStore.setHeld([])).toThrow(/DAMAGED/);
    expect(mem.get(HK)).toBe(JSON.stringify([{ junk: true }]));
    after();
  });
  it("storage that can't be read at all refuses everything", async () => {
    reset(); failRead = true;
    const spy = vi.fn(mockWallet);
    await expect(go(spy)).rejects.toThrow(/UNAVAILABLE/);
    expect(spy).not.toHaveBeenCalled();
    failRead = false; after();
  });
  it("repair never duplicates or drops notes", () => {
    const p: PendingTransfer = { txid: "5".repeat(64), rawHex: "", anchor: coin, address, network: "mainnet", sent: [], at: "", before: bundle, kept: bundle.slice(0, 2).map((h) => ({ ...h, mine: { txid: "5".repeat(64), vout: 0, salt: "" } })) };
    const once = repairedHeld(bundle, [p]);
    expect(once.map((h) => h.c.note.label)).toEqual(["Key", "Pass"]);
    expect(repairedHeld(once, [p])).toBe(once); // idempotent
  });
});

describe("restoring backups with damaged or outdated recovery records", () => {
  const mem = new Map<string, string>();
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) } as unknown as Storage;
  const real = globalThis.localStorage;
  const lk = new Set<string>();
  const locks = { request: async (name: string, _o: unknown, cb: (l: unknown) => Promise<unknown>) => {
    if (lk.has(name)) return cb(null); lk.add(name); try { return await cb({}); } finally { lk.delete(name); } } };
  const PK = "bitmapwin:sealed-pending", IK = "bitmapwin:sealed-intent", HK = "bitmapwin:sealed-notes";
  const unspent = async () => ({ spent: false });
  const old = { held: bundle, recv: {}, sent: [] }; // backup taken before any transfer
  const reset = () => { mem.clear(); globalThis.localStorage = store; sealStore.setHeld(bundle); };
  const go = (sign: (p: string) => Promise<string> = mockWallet) =>
    runLockedTransfer({ bundle, give: { [k(1)]: bob }, coin, address, feeRate: 4, sign, currentWallet: () => address, locks });
  const labels = () => sealStore.held().map((h) => h.c.note.label).sort();

  it("an outdated backup can't erase a signed transfer or bring the given note back", async () => {
    reset();
    const r = await go();
    const pBefore = mem.get(PK);
    const res = await restoreBackup(old, { outspend: unspent, locks });
    expect(mem.get(PK)).toBe(pBefore);
    expect(res.restored).toEqual([]);
    expect(labels()).toEqual(["Key", "Map"]);
    expect(sealStore.held().every((h) => h.mine.txid === r.txid)).toBe(true);
    const spy = vi.fn(mockWallet);
    await expect(go(spy)).rejects.toThrow(/UNFINISHED TRANSFER/);
    expect(spy).not.toHaveBeenCalled();
    globalThis.localStorage = real;
  });
  it("restoring while a signing is in progress never clears it, and the coin stays blocked", async () => {
    reset();
    let release!: () => void;
    const a = go((p) => new Promise((res) => { release = () => res(mockWallet(p)); }));
    await new Promise((r) => setTimeout(r, 0));
    sealStore.setHeld([]); // pretend notes list was lost
    const res = await restoreBackup(old, { outspend: unspent, locks });
    expect(res.skippedInFlight.sort()).toEqual(["Key", "Map", "Pass"]);
    expect(intentStore.onAnchor(coin)).toHaveLength(1);
    release(); await a;
    expect(pendingStore.onAnchor(coin)).toHaveLength(1);
    globalThis.localStorage = real;
  });
  it("an interrupted signing survives a restore and still blocks new transfers", async () => {
    reset();
    intentStore.put({ anchor: { txid: coin.txid, vout: coin.vout }, address, network: "mainnet", at: "t", attempt: "x" });
    await restoreBackup(old, { outspend: unspent, locks });
    expect(intentStore.onAnchor(coin)).toHaveLength(1);
    const spy = vi.fn(mockWallet);
    await expect(go(spy)).rejects.toThrow(/INTERRUPTED/);
    expect(spy).not.toHaveBeenCalled();
    globalThis.localStorage = real;
  });
  it("notes whose coin is spent on Bitcoin are not resurrected", async () => {
    reset(); sealStore.setHeld([]);
    const res = await restoreBackup(old, { outspend: async () => ({ spent: true, txid: "f".repeat(64) }), locks });
    expect(res.skippedSpent.sort()).toEqual(["Key", "Map", "Pass"]);
    expect(sealStore.held()).toEqual([]);
    globalThis.localStorage = real;
  });
  it("if the coin can't be checked, nothing is restored", async () => {
    reset(); sealStore.setHeld([]);
    await expect(restoreBackup(old, { outspend: async () => { throw new Error("down"); }, locks })).rejects.toThrow(/NOTHING RESTORED/);
    expect(sealStore.held()).toEqual([]);
    globalThis.localStorage = real;
  });
  it("a damaged transfer or signing record stops the restore and is never overwritten", async () => {
    for (const key of [PK, IK]) {
      reset(); mem.set(key, "{bad");
      await expect(restoreBackup(old, { outspend: unspent, locks })).rejects.toThrow(/DAMAGED/);
      expect(mem.get(key)).toBe("{bad");
    }
    globalThis.localStorage = real;
  });
  it("a damaged notes list is healed from the backup, with every note once", async () => {
    reset(); mem.set(HK, JSON.stringify([{ junk: true }]));
    const res = await restoreBackup(old, { outspend: unspent, locks });
    expect(res.restored.sort()).toEqual(["Key", "Map", "Pass"]);
    expect(labels()).toEqual(["Key", "Map", "Pass"]);
    await restoreBackup(old, { outspend: unspent, locks }); // twice: no duplicates
    expect(labels()).toEqual(["Key", "Map", "Pass"]);
    globalThis.localStorage = real;
  });
  it("a malformed backup file changes nothing", async () => {
    reset(); const before = new Map(mem);
    await expect(restoreBackup({ held: [{ junk: 1 }] }, { outspend: unspent, locks })).rejects.toThrow(/NOT A VALID/);
    expect(mem).toEqual(before);
    globalThis.localStorage = real;
  });
});

describe("restore under storage failures, reloads, tab races and wallet switches", () => {
  const mem = new Map<string, string>();
  let failSet = new Set<string>();
  const store = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { if (failSet.has(k)) throw new DOMException("quota", "QuotaExceededError"); mem.set(k, v); },
    removeItem: (k: string) => void mem.delete(k),
  } as unknown as Storage;
  const real = globalThis.localStorage;
  const lk = new Set<string>();
  const locks = { request: async (name: string, _o: unknown, cb: (l: unknown) => Promise<unknown>) => {
    if (lk.has(name)) return cb(null); lk.add(name); try { return await cb({}); } finally { lk.delete(name); } } };
  const HK = "bitmapwin:sealed-notes", SK = "bitmapwin:sealed-sent", JK = "bitmapwin:sealed-restore-journal", PK = "bitmapwin:sealed-pending";
  const unspent = async () => ({ spent: false });
  const old = { held: bundle, recv: {}, sent: [{ label: "Old", code: "SEAL-x", at: "t" }] };
  const reset = () => { mem.clear(); failSet = new Set(); lk.clear(); globalThis.localStorage = store; sealStore.setHeld([]); };
  const go = (sign: (p: string) => Promise<string> = mockWallet) =>
    runLockedTransfer({ bundle, give: { [k(1)]: bob }, coin, address, feeRate: 4, sign, currentWallet: () => address, locks });
  const done = () => { globalThis.localStorage = real; };

  it("a save failing halfway puts every record back as before (all or nothing)", async () => {
    reset(); const before = new Map(mem);
    failSet.add(SK); // notes list saves, then sent list fails
    await expect(restoreBackup(old, { outspend: unspent, locks, address })).rejects.toThrow(/PUT BACK AS BEFORE/);
    expect(mem).toEqual(before);
    done();
  });
  it("if even the safety record can't be saved, nothing is touched", async () => {
    reset(); const before = new Map(mem); failSet.add(JK);
    await expect(restoreBackup(old, { outspend: unspent, locks, address })).rejects.toThrow(/SAFETY RECORD/);
    expect(mem).toEqual(before);
    done();
  });
  it("a crash mid-restore is undone on reload, without touching an unfinished transfer", async () => {
    reset(); sealStore.setHeld(bundle);
    const r = await go(); const pend = mem.get(PK); const heldBefore = mem.get(HK);
    mem.set(JK, JSON.stringify({ prev: { [HK]: heldBefore, "bitmapwin:sealed-recv": null, [SK]: mem.get(SK) ?? null }, next: { [HK]: JSON.stringify(bundle) } }));
    mem.set(HK, JSON.stringify(bundle)); // half-written stale notes
    const l = loadHeld(); // "reload"
    expect(mem.has(JK)).toBe(false);
    expect(mem.get(PK)).toBe(pend);
    expect(l.map((h) => h.c.note.label).sort()).toEqual(["Key", "Map"]);
    expect(l.every((h) => h.mine.txid === r.txid)).toBe(true);
    done();
  });
  it("a damaged safety record blocks the vault instead of being ignored", () => {
    reset(); mem.set(JK, "{bad");
    expect(() => loadHeld()).toThrow(/DAMAGED/);
    expect(() => recoverInterruptedRestore()).toThrow(/DAMAGED/);
    expect(mem.get(JK)).toBe("{bad");
    done();
  });
  it("Bitcoin checks are discarded if the wallet switches during them", async () => {
    reset(); let cur: string | null = address;
    const slow = async () => { cur = "bc1qother0000000000000000000000000000000"; return { spent: false }; };
    await expect(restoreBackup(old, { outspend: slow, locks, address, currentWallet: () => cur })).rejects.toThrow(/WALLET OR NETWORK CHANGED/);
    expect(sealStore.held()).toEqual([]);
    done();
  });
  it("Bitcoin checks are discarded after a network switch", async () => {
    reset(); let cur: string | null = address;
    const slow = async () => { cur = "tb1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"; return { spent: false }; };
    await expect(restoreBackup(old, { outspend: slow, locks, address, currentWallet: () => cur })).rejects.toThrow(/CHANGED/);
    done();
  });
  it("two tabs restoring at once: the second is refused", async () => {
    reset(); let release!: () => void;
    const slow = () => new Promise<{ spent: boolean }>((res) => { release = () => res({ spent: false }); });
    const a = restoreBackup(old, { outspend: slow, locks, address });
    lk.add("bitmapwin:seal-restore"); // tab A has reached the write step
    await expect(restoreBackup(old, { outspend: unspent, locks, address })).rejects.toThrow(/ANOTHER TAB IS RESTORING/);
    lk.delete("bitmapwin:seal-restore"); release(); await a;
    expect(sealStore.held().map((h) => h.c.note.label).sort()).toEqual(["Key", "Map", "Pass"]);
    done();
  });
  it("a tab that starts signing during the Bitcoin check wins: the restore skips that coin", async () => {
    reset(); sealStore.setHeld(bundle);
    let release!: () => void;
    const slow = () => new Promise<{ spent: boolean }>((res) => { release = () => res({ spent: false }); });
    sealStore.setHeld([]);
    const rest = restoreBackup(old, { outspend: slow, locks, address });
    await new Promise((r) => setTimeout(r, 0));
    sealStore.setHeld(bundle);
    const tx = await go(); // other tab signs and files a transfer while restore waits
    release();
    const res = await rest;
    expect(res.restored).toEqual([]); // nothing resurrected
    expect(res.skippedInFlight).toEqual(["Pass"]); // the given note stays given
    expect(sealStore.held().map((h) => h.c.note.label).sort()).toEqual(["Key", "Map"]);
    expect(sealStore.held().every((h) => h.mine.txid === tx.txid)).toBe(true);
    expect(pendingStore.onAnchor(coin).map((p) => p.txid)).toEqual([tx.txid]);
    const spy = vi.fn(mockWallet);
    await expect(go(spy)).rejects.toThrow(/UNFINISHED TRANSFER/);
    expect(spy).not.toHaveBeenCalled();
    done();
  });
  it("a tab holding the coin's signing lock (wallet popup open) keeps the coin out of the restore", async () => {
    reset(); lk.add(`bitmapwin:seal-anchor:${coin.txid}:${coin.vout}`);
    const res = await restoreBackup(old, { outspend: unspent, locks, address });
    expect(res.skippedInFlight).toHaveLength(3);
    expect(sealStore.held()).toEqual([]);
    done();
  });
  it("without a lock manager restore refuses rather than race", async () => {
    reset();
    await expect(restoreBackup(old, { outspend: unspent, address })).rejects.toThrow(/TWO TABS/);
    done();
  });
});

describe("crashes during restore rollback and journal recovery, with another tab signing", () => {
  const mem = new Map<string, string>();
  let failSet = new Set<string>(), failRemove = false;
  const store = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { if (failSet.has(k)) throw new DOMException("quota", "QuotaExceededError"); mem.set(k, v); },
    removeItem: (k: string) => { if (!failRemove) mem.delete(k); },
  } as unknown as Storage;
  const real = globalThis.localStorage;
  const lk = new Set<string>();
  const locks = { request: async (name: string, _o: unknown, cb: (l: unknown) => Promise<unknown>) => {
    if (lk.has(name)) return cb(null); lk.add(name); try { return await cb({}); } finally { lk.delete(name); } } };
  const HK = "bitmapwin:sealed-notes", SK = "bitmapwin:sealed-sent", RK = "bitmapwin:sealed-recv", JK = "bitmapwin:sealed-restore-journal", PK = "bitmapwin:sealed-pending";
  const reset = () => { mem.clear(); failSet = new Set(); failRemove = false; lk.clear(); globalThis.localStorage = store; sealStore.setHeld(bundle); };
  const go = (sign: (p: string) => Promise<string> = mockWallet) =>
    runLockedTransfer({ bundle, give: { [k(1)]: bob }, coin, address, feeRate: 4, sign, currentWallet: () => address, locks });
  const labels = () => sealStore.held().map((h) => h.c.note.label).sort();
  /** Leaves a journal as if a restore crashed right after writing `written` (its own value for the notes list). */
  const crashedRestore = (written: string) => {
    mem.set(JK, JSON.stringify({ prev: { [HK]: mem.get(HK) ?? null, [RK]: mem.get(RK) ?? null, [SK]: mem.get(SK) ?? null }, next: { [HK]: written, [RK]: "{}", [SK]: "[]" } }));
    mem.set(HK, written);
  };
  const done = () => { globalThis.localStorage = real; };

  it("another tab signs after the crash: recovery runs first, then the transfer, nothing lost", async () => {
    reset(); crashedRestore(JSON.stringify([]));
    const r = await go(); // signing settles the half-finished restore first
    expect(mem.has(JK)).toBe(false);
    expect(labels()).toEqual(["Key", "Map"]);
    expect(pendingStore.onAnchor(coin)[0]!.before!.map((h) => h.c.note.label).sort()).toEqual(["Key", "Map", "Pass"]);
    expect(sealStore.held().every((h) => h.mine.txid === r.txid)).toBe(true);
    done();
  });
  it("a transfer saved after the restore wrote its notes is never rolled back by recovery", async () => {
    reset(); const prevHeld = mem.get(HK);
    const r = await go(); // other tab filed a transfer and saved newer notes
    const newer = mem.get(HK); const pend = mem.get(PK);
    // a crashed restore's journal is found, whose own write was later overwritten by that tab
    mem.set(JK, JSON.stringify({ prev: { [HK]: prevHeld, [RK]: null, [SK]: null }, next: { [HK]: JSON.stringify(bundle), [RK]: "{}", [SK]: "[]" } }));
    loadHeld();
    expect(mem.get(HK)).toBe(newer);
    expect(mem.get(PK)).toBe(pend);
    expect(labels()).toEqual(["Key", "Map"]);
    expect(sealStore.held().every((h) => h.mine.txid === r.txid)).toBe(true);
    done();
  });
  it("newer notes saved after a crash survive recovery (only the restore's own writes are undone)", () => {
    reset(); crashedRestore(JSON.stringify([bundle[0]]));
    mem.set(HK, JSON.stringify(bundle.slice(0, 2))); // another tab saved newer notes
    mem.set(SK, JSON.stringify([{ label: "New", code: "c", at: "t" }]));
    recoverInterruptedRestore();
    expect(labels()).toEqual(["Key", "Pass"]);
    expect(sealStore.sent().map((x) => x.label)).toEqual(["New"]);
    expect(mem.has(JK)).toBe(false);
    done();
  });
  it("an unresolved transfer is never touched by recovery", async () => {
    reset(); await go(); const pend = mem.get(PK);
    crashedRestore(JSON.stringify(bundle));
    loadHeld();
    expect(mem.get(PK)).toBe(pend);
    expect(labels()).toEqual(["Key", "Map"]); // stale restore value undone, then repaired from the transfer
    done();
  });
  it("storage failing during rollback: fail closed, journal kept, signing refused before the wallet opens", async () => {
    reset(); crashedRestore(JSON.stringify([])); failSet.add(HK);
    expect(() => loadHeld()).toThrow(/COULDN'T BE UNDONE/);
    expect(mem.has(JK)).toBe(true);
    const spy = vi.fn(mockWallet);
    await expect(go(spy)).rejects.toThrow(/COULDN'T BE UNDONE/);
    expect(spy).not.toHaveBeenCalled();
    failSet.clear(); loadHeld(); // later: recovers fully
    expect(labels()).toEqual(["Key", "Map", "Pass"]);
    done();
  });
  it("journal that can't be removed after rollback stays and blocks (fail closed), then clears", () => {
    reset(); crashedRestore(JSON.stringify([])); failRemove = true;
    expect(() => recoverInterruptedRestore()).toThrow(/COULDN'T BE UNDONE/);
    expect(labels()).toEqual(["Key", "Map", "Pass"]); // notes already put back
    failRemove = false;
    expect(recoverInterruptedRestore()).toBe(true);
    expect(labels()).toEqual(["Key", "Map", "Pass"]); // second run doesn't double-undo
    done();
  });
  it("crash during a failed restore's own rollback is finished on reload", async () => {
    reset(); const before = mem.get(HK);
    failSet.add(SK); failRemove = true; // write fails, rollback can't clear the journal
    await expect(restoreBackup({ held: [], recv: {}, sent: [{ label: "x", code: "y", at: "t" }] }, { outspend: async () => ({ spent: false }), locks, address })).rejects.toThrow();
    failSet.clear(); failRemove = false;
    loadHeld(); // "reload"
    expect(mem.has(JK)).toBe(false);
    expect(mem.get(HK)).toBe(before);
    done();
  });
});

import { describe, expect, it } from "vitest";
import { Address, NETWORK, OutScript, Transaction } from "@scure/btc-signer";
import { base64, hex } from "@scure/base";
import { anchorScript, mintSealed, noteKey, readAnchorScript, verifySealed, type ChainView } from "./shadow-seal";
import { KEEP_VOUT, applySpend, buildSealSpendPsbt, decodeConsignment, planBundle, sealFee, sealReceiveCode, type HeldSealed } from "./shadow-seal-wallet";

const ADDR = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
const coin = { txid: "a".repeat(64), vout: 0, value: 10_000, confirmed: true };
const A = { txid: coin.txid, vout: 0, salt: "s-a" };
const held: HeldSealed[] = ["Cold Key", "Press Pass", "Map"].map((l, i) => ({ c: { note: mintSealed(l, "item", A, `2026-10-21T00:00:0${i}Z`), steps: [], reveals: [] }, mine: A }));
const bob = { txid: "b".repeat(64), vout: 2, salt: "s-bob" };

describe("seal spend preparation", () => {
  it("one spend: coin in, change back to self at output 0, seal record at output 1", () => {
    const { commitment } = planBundle(held, { [noteKey(held[0]!.c.note.genesis)]: sealReceiveCode(bob) });
    const { psbt, keepValue, fee } = buildSealSpendPsbt({ coin, address: ADDR, commitment, feeRate: 3 });
    const tx = Transaction.fromPSBT(base64.decode(psbt), { allowUnknownOutputs: true });
    expect(tx.inputsLength).toBe(1);
    expect(tx.outputsLength).toBe(2);
    expect(hex.encode(tx.getOutput(0).script!)).toBe(hex.encode(OutScript.encode(Address(NETWORK).decode(ADDR))));
    expect(Number(tx.getOutput(0).amount)).toBe(keepValue);
    expect(readAnchorScript(hex.encode(tx.getOutput(1).script!))).toBe(commitment);
    expect(fee).toBe(sealFee(3));
    expect(keepValue + fee).toBe(coin.value);
  });

  it("refuses a coin too small to pay the fee and keep a spendable change", () => {
    expect(() => buildSealSpendPsbt({ coin: { ...coin, value: 700 }, address: ADDR, commitment: "0".repeat(64), feeRate: 2 })).toThrow();
  });

  it("review: the given note goes to its recipient, the rest stay on output 0, and all verify after 6 blocks", async () => {
    const k0 = noteKey(held[0]!.c.note.genesis);
    const { assignments, commitment } = planBundle(held, { [k0]: sealReceiveCode(bob) });
    expect(assignments.filter((a) => a.to.kind === "witness" && a.to.vout === KEEP_VOUT)).toHaveLength(2);
    const T1 = "1".repeat(64);
    const { kept, sent } = applySpend(held, assignments, T1);
    expect(kept.map((k) => k.c.note.label)).toEqual(["Press Pass", "Map"]);
    expect(sent.map((s) => s.label)).toEqual(["Cold Key"]);
    const chain: ChainView = {
      tip: async () => 205,
      outspend: async (o) => (o.txid === coin.txid ? { spent: true, txid: T1, status: { confirmed: true, block_height: 200 } } : { spent: false }),
      tx: async (id) => ({ status: { confirmed: true, block_height: 200 }, vout: id === T1 ? [{ scriptpubkey: "00" }, { scriptpubkey: anchorScript(commitment) }] : [] }),
    };
    expect((await verifySealed(decodeConsignment(sent[0]!.code)!, chain, bob)).state).toBe("SEALED");
    for (const k of kept) expect((await verifySealed(k.c, chain, k.mine)).state).toBe("SEALED");
  });

  it("rejects a malformed receive code", () => {
    expect(() => planBundle(held, { [noteKey(held[0]!.c.note.genesis)]: "SEAL-RECV-v1.nope" })).toThrow();
  });
});

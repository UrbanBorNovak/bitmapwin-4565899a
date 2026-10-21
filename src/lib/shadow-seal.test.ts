import { describe, expect, it } from "vitest";
import {
  anchorCommitment, anchorScript, blindSeal, mintSealed, noteKey, planAnchor, verifySealed,
  type Anchor, type ChainView, type Consignment, type Reveal, type TxStatus,
} from "./shadow-seal";

const T = (c: string) => c.repeat(64);
/** Pretend Bitcoin: who spent which output, and each tx's outputs + block. */
function fakeChain(tip: number, spends: Record<string, string>, txs: Record<string, { h?: number | undefined; scripts: string[] }>, down = false): ChainView {
  const st = (x?: { h?: number }): TxStatus => (x?.h ? { confirmed: true, block_height: x.h } : { confirmed: false });
  return {
    tip: async () => { if (down) throw new Error("UNREACHABLE"); return tip; },
    outspend: async (o) => { const t = spends[`${o.txid}:${o.vout}`]; return t ? { spent: true, txid: t, status: st(txs[t]) } : { spent: false }; },
    tx: async (id) => ({ status: st(txs[id]), vout: (txs[id]?.scripts ?? []).map((s) => ({ scriptpubkey: s })) }),
  };
}

// Alice's seal coin A holds a bundle of three notes.
const A: Reveal = { txid: T("a"), vout: 0, salt: "s-a" };
const bob: Reveal = { txid: T("b"), vout: 0, salt: "s-bob" };
const carol: Reveal = { txid: T("c"), vout: 0, salt: "s-carol" };
const n1 = mintSealed("Cold Key", "item", A, "2026-10-21T00:00:00Z");
const n2 = mintSealed("Press Pass", "item", A, "2026-10-21T00:00:01Z");
const n3 = mintSealed("Map of 1138", "item", A, "2026-10-21T00:00:02Z");
const bundle = [n1, n2, n3].map((n) => noteKey(n.genesis));
const toBob = planAnchor(bundle, { [bundle[0]!]: { kind: "blind", hash: blindSeal(bob) } }, 1);
const toCarol = planAnchor(bundle, { [bundle[0]!]: { kind: "blind", hash: blindSeal(carol) } }, 1);
const T1 = T("1"), T2 = T("2");
const step1: Anchor = { txid: T1, assignments: toBob };
const consign = (note = n1, steps: Anchor[] = [step1]): Consignment => ({ note, steps, reveals: [A] });

const baseTxs = (t1h?: number) => ({
  [T("a")]: { h: 100, scripts: [] }, [T("b")]: { h: 100, scripts: [] }, [T("c")]: { h: 100, scripts: [] },
  [T1]: { h: t1h, scripts: ["0014" + "00".repeat(20), anchorScript(anchorCommitment(toBob))] },
  [T2]: { h: 200, scripts: [anchorScript(anchorCommitment(toCarol))] },
});

describe("shadow seal bundles", () => {
  it("every note in a spent seal is either transferred or kept on the spending tx", () => {
    expect(toBob).toHaveLength(3);
    expect(toBob[0]!.to).toEqual({ kind: "blind", hash: blindSeal(bob) });
    expect(toBob[1]!.to).toEqual({ kind: "witness", vout: 1 });
    expect(toBob[2]!.to).toEqual({ kind: "witness", vout: 1 });
    expect(() => planAnchor(bundle, { [T("f")]: { kind: "witness", vout: 0 } }, 1)).toThrow();
    expect(() => anchorCommitment([...toBob, toBob[0]!])).toThrow();
  });

  it("only becomes SEALED at 6 confirmations", async () => {
    const at = (tip: number) => fakeChain(tip, { [`${T("a")}:0`]: T1 }, baseTxs(200));
    expect((await verifySealed(consign(), at(204), bob)).state).toBe("PENDING");
    expect(await verifySealed(consign(), at(205), bob)).toEqual({ state: "SEALED", confirmations: 6 });
  });

  it("kept notes stay with the sender on the witness output", async () => {
    const chain = fakeChain(210, { [`${T("a")}:0`]: T1 }, baseTxs(200));
    expect((await verifySealed(consign(n2), chain, { txid: T1, vout: 1, salt: "" })).state).toBe("SEALED");
    expect((await verifySealed(consign(n2), chain, bob)).state).toBe("NOT_YOURS");
  });

  it("double transfer: only the handoff Bitcoin confirmed wins, the other is CONFLICT", async () => {
    const chain = fakeChain(210, { [`${T("a")}:0`]: T1 }, baseTxs(200));
    expect((await verifySealed(consign(), chain, bob)).state).toBe("SEALED");
    const carolView = await verifySealed(consign(n1, [{ txid: T2, assignments: toCarol }]), chain, carol);
    expect(carolView).toMatchObject({ state: "CONFLICT", spentBy: T1 });
  });

  it("a replaced unconfirmed handoff shows CONFLICT, then follows the tx that confirmed", async () => {
    const replaced = fakeChain(210, { [`${T("a")}:0`]: T2 }, baseTxs(undefined));
    expect((await verifySealed(consign(), replaced, bob)).state).toBe("CONFLICT");
    const confirmed = fakeChain(210, { [`${T("a")}:0`]: T1 }, baseTxs(209));
    expect((await verifySealed(consign(), confirmed, bob)).state).toBe("PENDING");
  });

  it("a reorg that unconfirms a handoff drops SEALED back to PENDING", async () => {
    const after = fakeChain(210, { [`${T("a")}:0`]: T1 }, baseTxs(undefined));
    expect(await verifySealed(consign(), after, bob)).toMatchObject({ state: "PENDING", confirmations: 0 });
  });

  it("a seal spent without a seal record loses every note in it", async () => {
    const T9 = T("9");
    const chain = fakeChain(210, { [`${T("a")}:0`]: T9 }, { ...baseTxs(200), [T9]: { h: 200, scripts: ["0014" + "11".repeat(20)] } });
    for (const n of [n1, n2, n3]) expect((await verifySealed(consign(n), chain)).state).toBe("LOST");
  });

  it("rejects a forged record, a wrong recipient, a changed note and a never-broadcast handoff", async () => {
    const chain = fakeChain(210, { [`${T("a")}:0`]: T1 }, baseTxs(200));
    const forged = consign(n1, [{ txid: T1, assignments: toCarol }]);
    expect((await verifySealed(forged, chain, carol)).state).toBe("INVALID");
    expect((await verifySealed(consign(), chain, carol)).state).toBe("NOT_YOURS");
    expect((await verifySealed(consign({ ...n1, label: "Hot Key" }), chain, bob)).state).toBe("INVALID");
    const unsent = fakeChain(210, {}, baseTxs(200));
    expect((await verifySealed(consign(), unsent, bob)).state).toBe("PENDING");
  });

  it("an unreachable data source is UNAVAILABLE, never owned or conflict", async () => {
    const down = fakeChain(210, { [`${T("a")}:0`]: T1 }, baseTxs(200), true);
    expect((await verifySealed(consign(), down, bob)).state).toBe("UNAVAILABLE");
  });

  it("a recipient who later spends their seal sees the note as MOVED", async () => {
    const chain = fakeChain(210, { [`${T("a")}:0`]: T1, [`${T("b")}:0`]: T("7") }, baseTxs(200));
    expect((await verifySealed(consign(), chain, bob)).state).toBe("MOVED");
  });
});

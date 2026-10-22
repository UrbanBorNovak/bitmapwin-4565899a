import { describe, expect, it } from "vitest";
import { decodeNote, encodeNote, mintNote, ownerCommit, transferNote, verifyNote } from "./shadow-notes";

const A = "a".repeat(64), B = "b".repeat(64), C = "c".repeat(64), X = "d".repeat(64);
const base = () => { const n = mintNote("Map", "memo", A); return transferNote({ note: n, secret: A }, ownerCommit(B)); };

describe("shadow note validation", () => {
  it("accepts an honest handoff chain", () => {
    const n = base();
    expect(verifyNote(transferNote({ note: n, secret: B }, ownerCommit(C)))).toBe(true);
  });
  it("rejects altered history (label, recipient, timestamp)", () => {
    expect(verifyNote({ ...base(), label: "Gold" })).toBe(false);
    const n = base(); n.chain[1] = { ...n.chain[1]!, to: ownerCommit(X) };
    expect(verifyNote(n)).toBe(false);
    const m = base(); m.chain[0] = { ...m.chain[0]!, at: "2020-01-01T00:00:00.000Z" };
    expect(verifyNote(m)).toBe(false);
  });
  it("rejects a forged transfer appended without the holder's secret", () => {
    const n = base();
    expect(() => transferNote({ note: n, secret: X }, ownerCommit(X))).toThrow();
    const tip = n.chain.at(-1)!;
    const forged = transferNote({ note: { ...n, chain: [...n.chain.slice(0, -1), { ...tip, to: ownerCommit(X) }] }, secret: X }, ownerCommit(X));
    expect(verifyNote(forged)).toBe(false);
    const noAuth = transferNote({ note: n, secret: B }, ownerCommit(X)); delete noAuth.chain[2]!.auth;
    expect(verifyNote(noAuth)).toBe(false);
  });
  it("rejects truncated, reordered and junk notes without throwing", () => {
    const n = transferNote({ note: base(), secret: B }, ownerCommit(C));
    expect(verifyNote({ ...n, chain: [n.chain[0]!, n.chain[2]!] })).toBe(false);
    expect(verifyNote({ ...n, chain: [n.chain[1]!, n.chain[0]!, n.chain[2]!] })).toBe(false);
    expect(verifyNote({ v: 1, chain: [null] } as never)).toBe(false);
    expect(decodeNote("SHADOW-NOTE-v1.!!!")).toBeNull();
  });
  it("cannot detect a copied note given twice (no duplicate prevention)", () => {
    const n = base();
    const toC = transferNote({ note: n, secret: B }, ownerCommit(C));
    const toX = transferNote({ note: decodeNote(encodeNote(n))!, secret: B }, ownerCommit(X));
    expect(verifyNote(toC) && verifyNote(toX)).toBe(true);
  });
});

import { noteStatus } from "./shadow-notes";
describe("note status", () => {
  it("separates legacy unsigned handoffs from forged ones", () => {
    const A = "a".repeat(64), B = "b".repeat(64);
    const h = transferNote({ note: mintNote("Map", "memo", A), secret: A }, ownerCommit(B));
    expect(noteStatus(h)).toBe("intact");
    const legacy = structuredClone(h); delete legacy.chain[1]!.auth;
    expect(noteStatus(legacy)).toBe("legacy");
    expect(noteStatus({ ...legacy, label: "Gold" })).toBe("broken");
    const wrong = structuredClone(h); wrong.chain[1]!.auth = "e".repeat(64);
    expect(noteStatus(wrong)).toBe("broken");
  });
});

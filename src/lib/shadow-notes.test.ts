import { sha256 } from "@noble/hashes/sha2.js";
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
    const noAuth = transferNote({ note: n, secret: B }, ownerCommit(X)); delete noAuth.chain[2]!.sig;
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

import { legacyCommit, noteStatus } from "./shadow-notes";
describe("note status", () => {
  it("separates legacy unsigned handoffs from forged ones", () => {
    const A = "a".repeat(64), B = "b".repeat(64);
    const h = transferNote({ note: mintNote("Map", "memo", A), secret: A }, ownerCommit(B));
    expect(noteStatus(h)).toBe("intact");
    const legacy = structuredClone(h); delete legacy.chain[1]!.sig; legacy.chain[1]!.auth = B;
    expect(noteStatus(legacy)).toBe("legacy");
    expect(noteStatus({ ...legacy, label: "Gold" })).toBe("broken");
    const wrong = structuredClone(h); wrong.chain[1]!.sig = "e".repeat(128);
    expect(noteStatus(wrong)).toBe("broken");
  });
});

describe("handoff signatures", () => {
  it("never put a holder's secret inside the note", () => {
    const A = "a".repeat(64), B = "b".repeat(64), C = "c".repeat(64);
    const n = transferNote({ note: transferNote({ note: mintNote("Map", "memo", A), secret: A }, ownerCommit(B)), secret: B }, ownerCommit(C));
    const wire = JSON.stringify(n);
    expect(wire.includes(A) || wire.includes(B) || wire.includes(C)).toBe(false);
  });
  it("stops a later recipient re-signing an earlier handoff to fork the history", () => {
    const A = "a".repeat(64), B = "b".repeat(64), C = "c".repeat(64), Z = "d".repeat(64);
    const n = transferNote({ note: transferNote({ note: mintNote("Map", "memo", A), secret: A }, ownerCommit(B)), secret: B }, ownerCommit(C));
    // C forges B's handoff to Z, signing with the only key C has (C's own).
    const fake = transferNote({ note: { ...n, chain: [...n.chain.slice(0, 2), { ...n.chain[1]!, to: ownerCommit(C) }].slice(0, 2).map((l, i) => (i === 1 ? { ...l, to: ownerCommit(C) } : l)) }, secret: C }, ownerCommit(Z));
    const forked = { ...n, chain: [...n.chain.slice(0, 2), fake.chain.at(-1)!] };
    forked.chain[2] = { ...forked.chain[2]!, prev: n.chain[1]!.hash };
    expect(noteStatus(forked)).toBe("broken");
  });
  it("refuses to hand on a note sealed to an older receive code", () => {
    const A = "a".repeat(64);
    const n = mintNote("Old", "memo", A); n.chain[0]!.to = legacyCommit(A);
    expect(() => transferNote({ note: n, secret: A }, ownerCommit("b".repeat(64)))).toThrow(/OLDER/);
  });
});

import { recoveryFor, reissueNote } from "./shadow-notes";
describe("recovery of older-format notes", () => {
  const A = "a".repeat(64), B = "b".repeat(64);
  const H = (x: string) => Array.from(sha256(new TextEncoder().encode(x)), (v) => v.toString(16).padStart(2, "0")).join("");
  const legacyMint = (secret: string) => {
    const at = "2026-10-01T00:00:00.000Z", to = legacyCommit(secret);
    const genesis = H(`bitmapwin:note:genesis|memo|Old map|${at}|${to}`);
    return { v: 1 as const, label: "Old map", kind: "memo", genesis, chain: [{ to, prev: genesis, at, hash: H(`bitmapwin:note:link|${genesis}|${to}|${at}`) }] };
  };
  it("reissues a self-minted, never-handed-on note when this device proves the secret", () => {
    const old = legacyMint(A);
    expect(recoveryFor({ note: old, secret: A }).state).toBe("reissuable");
    const fresh = reissueNote({ note: old, secret: A }, B);
    expect(noteStatus(fresh.note)).toBe("intact");
    expect(fresh.note.reissuedFrom).toBe(old.genesis);
    expect(fresh.note.chain[0]!.to).toBe(ownerCommit(B));
  });
  it("marks notes received over old handoffs as stranded and refuses to reissue", () => {
    const n = mintNote("Got it", "memo", A);
    const held = { note: { ...n, chain: [...n.chain, { ...n.chain[0]!, to: legacyCommit(B), auth: A }] }, secret: B };
    expect(recoveryFor(held).state).toBe("stranded");
    expect(() => reissueNote(held)).toThrow();
  });
  it("refuses when the device secret doesn't match", () => {
    const old = legacyMint(A);
    expect(recoveryFor({ note: old, secret: B }).state).toBe("stranded");
  });
  it("binds the replaced note's origin into the new history", () => {
    const n = mintNote("Old", "memo", B, undefined, "f".repeat(64));
    expect(noteStatus(n)).toBe("intact");
    expect(noteStatus({ ...n, reissuedFrom: "e".repeat(64) })).toBe("broken");
  });
});

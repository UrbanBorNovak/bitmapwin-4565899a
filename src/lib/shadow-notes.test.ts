import { describe, expect, it } from "vitest";
import { decodeNote, encodeNote, mintNote, ownerCommit, transferNote, verifyNote } from "./shadow-notes";

const A = "a".repeat(64), B = "b".repeat(64);

describe("shadow notes", () => {
  it("a minted and transferred note validates on the client", () => {
    const n = mintNote("Cold Key", "item", A, "2026-10-21T00:00:00Z");
    const moved = transferNote({ note: n, secret: A }, ownerCommit(B), "2026-10-21T00:01:00Z");
    expect(verifyNote(moved)).toBe(true);
    expect(moved.chain.at(-1)!.to).toBe(ownerCommit(B));
    expect(verifyNote(decodeNote(encodeNote(moved))!)).toBe(true);
  });
  it("only the current holder can move a note", () => {
    const n = mintNote("Cold Key", "item", A);
    expect(() => transferNote({ note: n, secret: B }, ownerCommit(B))).toThrow();
  });
  it("a tampered chain fails validation", () => {
    const n = mintNote("Cold Key", "item", A);
    expect(verifyNote({ ...n, label: "Hot Key" })).toBe(false);
    const moved = transferNote({ note: n, secret: A }, ownerCommit(B));
    expect(verifyNote({ ...moved, chain: [moved.chain[0]!, { ...moved.chain[1]!, to: ownerCommit(A) }] })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { applyOp, emptyState, exportAssembly, liveBlocks, parseOp } from "@/lib/co-forge";

const ID = "a".repeat(64) + "i0";

describe("co-forge merge", () => {
  it("same ops in any order reach the same build (last write wins)", () => {
    const a = emptyState(), b = emptyState();
    const ops = [
      [{ op: "b+", x: 1, y: 0, z: 1, k: 2 }, { t: 1, by: "alice" }],
      [{ op: "b+", x: 1, y: 0, z: 1, k: 5 }, { t: 2, by: "bob" }],
    ] as const;
    ops.forEach(([o, s]) => applyOp(a, o, s));
    [...ops].reverse().forEach(([o, s]) => applyOp(b, o, s));
    expect(liveBlocks(a)).toEqual([{ dx: 1, dy: 0, dz: 1, k: 5 }]);
    expect(liveBlocks(b)).toEqual(liveBlocks(a));
  });

  it("a removed piece is not exported, even if its placement arrives late", () => {
    const s = emptyState();
    applyOp(s, { op: "p-", oid: "abcd1" }, { t: 5, by: "bob" });
    applyOp(s, { op: "p+", oid: "abcd1", id: ID, x: 0, y: 0, z: 0, r: 0 }, { t: 3, by: "alice" });
    expect(exportAssembly(s).parts).toEqual([]);
  });

  it("exports at most 32 pieces and reports the rest as dropped", () => {
    const s = emptyState();
    for (let i = 0; i < 35; i++) applyOp(s, { op: "p+", oid: `part${i}`, id: ID, x: i, y: 0, z: 0, r: 0 }, { t: i, by: "a" });
    const e = exportAssembly(s);
    expect(e.parts.length).toBe(32);
    expect(e.dropped).toBe(3);
  });

  it("rejects ops outside the canvas or with bad ids", () => {
    expect(parseOp({ op: "b+", x: 64, y: 0, z: 0, k: 1 })).toBeNull();
    expect(parseOp({ op: "p+", oid: "abcd1", id: "nope", x: 0, y: 0, z: 0, r: 0 })).toBeNull();
    expect(parseOp({ op: "p+", oid: "abcd1", id: ID, x: 1, y: 2, z: 3, r: 5 })).toMatchObject({ r: 1 });
  });
});

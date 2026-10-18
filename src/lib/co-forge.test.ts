import { describe, expect, it } from "vitest";
import { applyOp, buildState, canEdit, emptyState, exportAssembly, liveBlocks, nextConfig, openConfig, parseOp } from "@/lib/co-forge";

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

describe("co-forge room owner", () => {
  const O = "o".repeat(0) + "1".repeat(64), A = "2".repeat(64), V = "3".repeat(64);
  const place = (x: number) => ({ ops: [{ op: "b+" as const, x, y: 0, z: 0, k: 1 }] });
  it("only the owner and approved builders change the build", () => {
    const cfg = nextConfig(openConfig(), O, O, { allow: [A] }, 10);
    const s = buildState([{ ...place(1), t: 20, by: O }, { ...place(2), t: 21, by: A }, { ...place(3), t: 22, by: V }], cfg, O);
    expect(liveBlocks(s).map((b) => b.dx).sort()).toEqual([1, 2]);
  });
  it("removing a builder drops everything they built", () => {
    const hist = [{ ...place(2), t: 21, by: A }];
    const cfg = nextConfig(nextConfig(openConfig(), O, O, { allow: [A] }, 10), O, O, { allow: [] }, 30);
    expect(liveBlocks(buildState(hist, cfg, O))).toEqual([]);
  });
  it("locking keeps earlier work but blocks new builder edits; owner can still edit", () => {
    const cfg = nextConfig(openConfig(), O, O, { allow: [A], locked: true }, 50);
    const s = buildState([{ ...place(1), t: 40, by: A }, { ...place(2), t: 60, by: A }, { ...place(3), t: 61, by: O }], cfg, O);
    expect(liveBlocks(s).map((b) => b.dx).sort()).toEqual([1, 3]);
    expect(canEdit(cfg, O, A)).toBe(false);
    expect(canEdit(cfg, O, O)).toBe(true);
  });
  it("ignores control events not signed by the owner", () => {
    expect(nextConfig(openConfig(), O, V, { allow: [V] }, 99).allow).toEqual([]);
  });
});

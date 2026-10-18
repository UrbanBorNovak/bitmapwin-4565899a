import { describe, expect, it } from "vitest";
import { applyOp, buildState, canEdit, emptyState, exportAssembly, liveBlocks, nextConfig, openConfig, parseOp, sealFor } from "@/lib/co-forge";

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
  let n = 0;
  const place = (x: number) => ({ ops: [{ op: "b+" as const, x, y: 0, z: 0, k: 1 }], id: (++n).toString(16).padEnd(64, "0") });
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
  it("locking keeps sealed work, blocks later builder edits even with a faked early time; owner can still edit", () => {
    const early = { ...place(1), t: 40, by: A };
    const open = nextConfig(openConfig(), O, O, { allow: [A] }, 10);
    const cfg = nextConfig(open, O, O, { allow: [A], locked: true, seal: sealFor([early], open, O) }, 50);
    const sneaky = { ...place(2), t: 5, by: A }; // backdated before the lock
    const s = buildState([early, sneaky, { ...place(3), t: 61, by: O }], cfg, O);
    expect(liveBlocks(s).map((b) => b.dx).sort()).toEqual([1, 3]);
    expect(canEdit(cfg, O, A)).toBe(false);
    expect(canEdit(cfg, O, O)).toBe(true);
  });
  it("edits sneaked in during a lock stay out after unlock and for late joiners", () => {
    const early = { ...place(1), t: 40, by: A }, sneaky = { ...place(2), t: 5, by: A };
    const open = nextConfig(openConfig(), O, O, { allow: [A] }, 10);
    const locked = nextConfig(open, O, O, { allow: [A], locked: true, seal: sealFor([early], open, O) }, 50);
    const unlocked = nextConfig(locked, O, O, { allow: [A], locked: false, deny: [sneaky.id.slice(0, 16)] }, 70);
    // late joiner replays in reverse arrival order
    expect(liveBlocks(buildState([sneaky, early], unlocked, O)).map((b) => b.dx)).toEqual([1]);
  });
  it("ignores control events not signed by the owner", () => {
    expect(nextConfig(openConfig(), O, V, { allow: [V] }, 99).allow).toEqual([]);
  });
});

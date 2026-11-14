import { describe, expect, it } from "vitest";
import { BACKGROUND_LIMIT, limited, limiterState, missingGradeFacts, promoteGrade } from "@/lib/slab-block";

const full = { classes: [1, 2, 3], hash: "00ab", txCount: 3, covered: 3 };

describe("grade facts", () => {
  it("grades only with every transaction, the hash and the sat", () => {
    expect(missingGradeFacts(full, 123)).toBeNull();
    expect(missingGradeFacts({ ...full, classes: [1, 2] }, 123)).toMatch(/2 of 3/);
    expect(missingGradeFacts({ ...full, hash: null }, 123)).toMatch(/hash/);
    expect(missingGradeFacts(full, null)).toMatch(/sat/);
  });
});

describe("pre-grade limiter", () => {
  it("runs at most two background grades and lets the active BITMAP jump the line", async () => {
    expect(BACKGROUND_LIMIT).toBe(2);
    const gates: Record<number, () => void> = {};
    const started: number[] = [];
    const job = (k: number) => limited(k, () => new Promise<number>((r) => { started.push(k); gates[k] = () => r(k); }));
    const p = [1, 2, 3, 4].map(job);
    await Promise.resolve();
    expect(started).toEqual([1, 2]);
    expect(limiterState()).toEqual({ running: 2, waiting: 2 });
    promoteGrade(4);
    expect(started).toEqual([1, 2, 4]);
    gates[1]!();
    await p[0];
    await new Promise((r) => setTimeout(r, 0));
    expect(started).toEqual([1, 2, 4, 3]);
    gates[2]!(); gates[3]!(); gates[4]!();
    await Promise.all(p);
    expect(limiterState()).toEqual({ running: 0, waiting: 0 });
    promoteGrade(undefined);
  });
});

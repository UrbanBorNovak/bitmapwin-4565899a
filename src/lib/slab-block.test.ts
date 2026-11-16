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

describe("partial block reads", () => {
  it("retries a partial block answer with a fresh, uncached request", async () => {
    const { vi } = await import("vitest");
    const { fetchBlock } = await import("@/lib/slab-block");
    vi.useFakeTimers();
    const calls: Array<{ url: string; cache?: string }> = [];
    const answer = (covered: number) =>
      new Response(new Uint8Array(covered).fill(1), {
        headers: { "x-tx-count": "3", "x-tx-covered": String(covered), "x-block-hash": "00ab" },
      });
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url, cache: init?.cache });
      return answer(calls.length === 1 ? 2 : 3);
    });
    const p = fetchBlock(552718);
    await vi.runAllTimersAsync();
    const facts = await p;
    vi.unstubAllGlobals();
    vi.useRealTimers();
    expect(calls).toHaveLength(2);
    expect(calls[0]!.url).toBe("/api/public/blocks/552718");
    expect(calls[1]!.url).toMatch(/^\/api\/public\/blocks\/552718\?fresh=\d+$/);
    expect(calls[1]!.cache).toBe("no-store");
    expect(facts && missingGradeFacts(facts, 1)).toBeNull();
  });
});

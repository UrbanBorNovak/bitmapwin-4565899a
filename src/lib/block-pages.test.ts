import { describe, expect, it } from "vitest";
import { collectPages } from "@/lib/block-pages";

const page = (start: number, n: number) => Array.from({ length: n }, (_, i) => start + i);
const opts = { concurrency: 4, rounds: 3, deadline: Number.POSITIVE_INFINITY };

describe("backup page loader", () => {
  it("reads every page of a block larger than 600 transactions", async () => {
    const values = await collectPages(1_234, async (start) => page(start, Math.min(25, 1_234 - start)), opts);
    expect(values.complete).toBe(true);
    expect(values.values).toHaveLength(1_234);
    expect(values.values[1_233]).toBe(1_233);
  });

  it("recovers pages that fail temporarily", async () => {
    const tries = new Map<number, number>();
    const result = await collectPages(700, async (start) => {
      const n = (tries.get(start) ?? 0) + 1;
      tries.set(start, n);
      if (start % 100 === 0 && n < 3) throw new Error("429");
      return page(start, 25);
    }, opts);
    expect(result.complete).toBe(true);
    expect(result.values).toEqual(page(0, 700));
  });

  it("never marks a block complete while a page is missing, and never shifts positions", async () => {
    const result = await collectPages(100, async (start) => {
      if (start === 50) throw new Error("down");
      return page(start, 25);
    }, opts);
    expect(result.complete).toBe(false);
    expect(result.values).toEqual(page(0, 50));
  });

  it("rejects a short page instead of counting it", async () => {
    const result = await collectPages(50, async (start) => page(start, start === 25 ? 24 : 25), opts);
    expect(result.complete).toBe(false);
    expect(result.values).toEqual(page(0, 25));
  });
});

describe("backup page loader across retries", () => {
  it("continues from pages already read instead of starting over", async () => {
    const first = await collectPages(100, async (start) => {
      if (start >= 50) throw new Error("down");
      return page(start, 25);
    }, opts);
    expect(first.complete).toBe(false);
    const asked: number[] = [];
    const second = await collectPages(100, async (start) => {
      asked.push(start);
      return page(start, 25);
    }, { ...opts, resume: first.pages });
    expect(asked.sort((a, b) => a - b)).toEqual([50, 75]);
    expect(second.complete).toBe(true);
    expect(second.values).toEqual(page(0, 100));
  });
});

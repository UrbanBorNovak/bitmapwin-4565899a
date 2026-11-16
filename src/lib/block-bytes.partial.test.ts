import { afterEach, describe, expect, it, vi } from "vitest";
import { blockSizeMapQuery, fetchBlockSizeMap } from "@/lib/block-bytes";

afterEach(() => vi.unstubAllGlobals());

const answer = (covered: number, count = 3) =>
  new Response(new Uint8Array(covered).fill(1), {
    headers: { "x-tx-count": String(count), "x-tx-covered": String(covered), "x-block-hash": "00ab" },
  });

describe("block size map with missing transactions", () => {
  it("re-reads an incomplete map once, bypassing caches", async () => {
    const calls: Array<{ url: string; cache: string | undefined }> = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url, cache: init?.cache });
      return answer(calls.length === 1 ? 2 : 3);
    });
    const map = await fetchBlockSizeMap(700000);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.url).toMatch(/^\/api\/public\/blocks\/700000\?fresh=\d+$/);
    expect(calls[1]!.cache).toBe("no-store");
    expect(map.classes).toHaveLength(3);
    expect(map.complete).toBe(true);
  });

  it("marks a still-incomplete map so it is not kept forever", async () => {
    vi.stubGlobal("fetch", async () => answer(2));
    const map = await fetchBlockSizeMap(700001);
    expect(map.complete).toBe(false);
    const staleTime = blockSizeMapQuery(700001).staleTime as (q: unknown) => number;
    expect(staleTime({ state: { data: map } })).toBe(60_000);
    expect(staleTime({ state: { data: { ...map, complete: true } } })).toBe(Infinity);
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
import { poolStats } from "./puzzle-pool.server";

/** Fake data API that, like the real one, returns at most 1,000 rows per read. */
function fakeDb(rows: Record<string, unknown>[]) {
  return {
    from: () => ({
      select: () => ({
        order: () => ({
          range: async (a: number, b: number) => ({ data: rows.slice(a, Math.min(b + 1, a + 1000)) }),
        }),
      }),
    }),
  };
}

describe("pool stats paging", () => {
  it("counts every finished slice past the 1,000-row page limit", async () => {
    const done = new Date().toISOString();
    const rows = Array.from({ length: 2500 }, (_, i) => ({
      slice_index: i, worker: i < 1800 ? "A" : "B", done_at: done, leased_at: done,
    }));
    const s = await poolStats("test", fakeDb(rows));
    expect(s.slices).toBe(2500);
    expect(s.top.find((t) => t.worker === "A")?.slices).toBe(1800);
    expect(s.top.find((t) => t.worker === "B")?.slices).toBe(700);
  });
});

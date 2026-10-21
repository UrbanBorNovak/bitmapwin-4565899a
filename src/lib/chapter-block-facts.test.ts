import { describe, expect, it } from "vitest";
import { resolveChapterFacts } from "./chapter-block-facts";

const H = "a".repeat(64);
const none = { txCount: null, avgFeeRate: null, minedAt: null };
const mock = (routes: Record<string, () => Response>) => async (url: string) => {
  for (const [k, r] of Object.entries(routes)) if (url.endsWith(k)) return r();
  return new Response("", { status: 500 });
};
const ok = (v: unknown) => () => new Response(JSON.stringify(v), { status: 200 });

describe("chapter block facts", () => {
  it("uses the explorer for blocks past the records", async () => {
    const f = await resolveChapterFacts(900000, none, mock({ "/block-height/900000": ok(H), [`/v1/block/${H}`]: ok({ id: H, height: 900000, tx_count: 4321, timestamp: 1750000000, extras: { avgFeeRate: 3 } }) }));
    expect(f).toMatchObject({ txCount: 4321, avgFeeRate: 3, source: "explorer", note: null });
    expect(f.minedAt).toBe(new Date(1750000000 * 1000).toISOString());
  });
  it("rejects a block whose height does not match", async () => {
    const f = await resolveChapterFacts(900000, none, mock({ "/block-height/900000": ok(H), [`/v1/block/${H}`]: ok({ id: H, height: 1, tx_count: 9 }) }));
    expect(f).toMatchObject({ txCount: null, source: "unavailable", note: "EXPLORER RETURNED A DIFFERENT BLOCK" });
  });
  it("reports unreachable explorers without inventing data", async () => {
    const f = await resolveChapterFacts(900000, none, async () => { throw new Error("down"); });
    expect(f).toMatchObject({ txCount: null, avgFeeRate: null, minedAt: null, source: "unavailable", note: "BLOCK EXPLORER UNREACHABLE" });
  });
  it("unmined block is not mined yet", async () => {
    const f = await resolveChapterFacts(9999999, none, mock({ "/block-height/9999999": () => new Response("", { status: 404 }) }));
    expect(f.note).toBe("BLOCK NOT MINED YET");
  });
  it("keeps stored values and fills only gaps", async () => {
    const f = await resolveChapterFacts(800000, { txCount: 3721, avgFeeRate: null, minedAt: null }, mock({ "/block-height/800000": ok(H), [`/v1/block/${H}`]: ok({ id: H, height: 800000, tx_count: 1, timestamp: 1690000000 }) }));
    expect(f).toMatchObject({ txCount: 3721, avgFeeRate: null, source: "mixed", note: "SOME FIELDS NOT REPORTED" });
  });
  it("complete records need no network", async () => {
    const f = await resolveChapterFacts(5, { txCount: 1, avgFeeRate: 0, minedAt: "2009-01-09T00:00:00.000Z" }, async () => { throw new Error("no"); });
    expect(f.source).toBe("records");
  });
});

import { describe, expect, it } from "vitest";
import { CITIZENS, citizenAt, decide, needsApproval, type Proposal } from "./agent-colony";

describe("agent colony", () => {
  it("trades and spends always need owner approval; walking and talking do not", () => {
    expect(needsApproval("trade")).toBe(true);
    expect(needsApproval("spend")).toBe(true);
    expect(needsApproval("walk")).toBe(false);
    expect(needsApproval("talk")).toBe(false);
  });
  it("a decided proposal cannot be flipped again", () => {
    const p: Proposal = { id: "a", citizenId: "broker", kind: "trade", summary: "x", href: "/", status: "pending", createdAt: 0 };
    const rejected = decide([p], "a", false);
    expect(decide(rejected, "a", true)[0]!.status).toBe("rejected");
  });
  it("every visitor sees a citizen at the same spot for the same time", () => {
    const c = CITIZENS[0]!;
    expect(citizenAt(c, 1_800_000_000)).toEqual(citizenAt(c, 1_800_000_000));
  });
});

import { brokerPicks as _bp } from "./agent-colony";
describe("broker picks", () => {
  const L = [
    { id: "a", bitmapHeight: 500000, priceSats: 30000, status: "open" },
    { id: "b", bitmapHeight: 9000, priceSats: 10000, status: "open" },
    { id: "c", bitmapHeight: 700000, priceSats: 5000, status: "sold" },
    { id: "d", bitmapHeight: 600000, priceSats: 20000, status: "open" },
  ];
  it("only uses open listings, cheapest first, max 3", () => {
    expect(_bp(L).map((p) => p.offerId)).toEqual(["b", "d", "a"]);
  });
  it("shows item, price and reason", () => {
    const p = _bp(L)[0];
    expect(p.item).toBe("9000.bitmap");
    expect(p.priceSats).toBe(10000);
    expect(p.reason).toContain("50% below the median ask of 20,000 sats");
  });
});

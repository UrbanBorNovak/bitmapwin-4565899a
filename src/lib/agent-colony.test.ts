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

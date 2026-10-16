import { describe, expect, it } from "vitest";
import { bidApiMessage, MAX_LIVE_HOLDS_PER_BUYER, RATE_LIMITS, signatureAgeProblem } from "./market-api-guard";

const NOW = Date.parse("2026-10-16T17:00:00.000Z");

describe("trading API guard", () => {
  it("accepts a signature issued within 10 minutes", () => {
    expect(signatureAgeProblem("2026-10-16T16:51:00.000Z", NOW)).toBeNull();
  });
  it("rejects a signature older than 10 minutes", () => {
    expect(signatureAgeProblem("2026-10-16T16:49:59.000Z", NOW)).toMatch(/expired/);
  });
  it("rejects a signature dated more than 1 minute ahead", () => {
    expect(signatureAgeProblem("2026-10-16T17:01:30.000Z", NOW)).toMatch(/future/);
  });
  it("binds the issued time into the signed bid message", () => {
    const a = bidApiMessage(840000, 10_000, "bc1qx", "2026-10-16T16:59:00.000Z");
    const b = bidApiMessage(840000, 10_000, "bc1qx", "2026-10-16T16:59:01.000Z");
    expect(a).not.toEqual(b);
    expect(a.endsWith("issued: 2026-10-16T16:59:00.000Z")).toBe(true);
  });
  it("caps buyers at 2 live holds and writes at 20/min per IP", () => {
    expect(MAX_LIVE_HOLDS_PER_BUYER).toBe(2);
    expect(RATE_LIMITS.writePerIp.limit).toBe(20);
  });
});

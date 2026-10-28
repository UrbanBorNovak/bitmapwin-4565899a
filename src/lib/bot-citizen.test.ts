import { describe, it, expect } from "vitest";
import { statusFor, validateCommission, createBot, MIN_DEPOSIT_SATS } from "./bot-citizen";

const ok = { name: "Unit-07", height: 819245, parcelIndex: null, prompt: "Radio tower" };
describe("bot citizen", () => {
  it("is funded only at 10,000 confirmed sats", () => {
    expect(statusFor(9_999, 5_000)).toBe("FUNDS_PENDING");
    expect(statusFor(MIN_DEPOSIT_SATS, 0)).toBe("FUNDED");
    expect(statusFor(0, 0)).toBe("AWAITING_FUNDS");
  });
  it("rejects empty prompts and bad heights", () => {
    expect(validateCommission(ok)).toBeNull();
    expect(validateCommission({ ...ok, prompt: "" })).not.toBeNull();
    expect(validateCommission({ ...ok, height: -1 })).not.toBeNull();
  });
  it("gives each bot its own taproot address", () => {
    const a = createBot({ ...ok, maxFeeSats: 5000 }), b = createBot({ ...ok, maxFeeSats: 5000 });
    expect(a.address.startsWith("tb1p")).toBe(true);
    expect(a.address).not.toBe(b.address);
  });
});

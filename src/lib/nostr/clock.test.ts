import { describe, it, expect } from "vitest";
import { clockOffset } from "./clock";
describe("clockOffset", () => {
  it("corrects a device clock one hour fast", () => {
    expect(clockOffset(10_000_000, 10_000_000 - 3_600_000, 10_000_200)).toBe(-3_600_100);
  });
  it("ignores drift under 5 seconds", () => {
    expect(clockOffset(1000, 3000, 1200)).toBe(0);
  });
});

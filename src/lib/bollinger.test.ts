import { describe, expect, it } from "vitest";
import { bollinger } from "./bollinger";

describe("bollinger", () => {
  it("uses a 20-sale window with ±2σ", () => {
    const prices = Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 90 : 110));
    const b = bollinger(prices);
    expect(b[18]).toBeNull();
    expect(b[19]).toEqual({ mid: 100, upper: 120, lower: 80 });
  });
  it("never lets the lower band go below zero", () => {
    const prices = Array.from({ length: 20 }, (_, i) => (i === 19 ? 1000 : 1));
    expect(bollinger(prices)[19]?.lower).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { foundersOf, loungeSeat } from "./launch-seats";

describe("VIP lounge", () => {
  const seats = [{ seat: 1, address: "bc1qAAA" }, { seat: 100, address: "bc1qbbb" }, { seat: 101, address: "bc1qccc" }];
  it("opens only for a seated wallet, case-insensitive", () => {
    expect(loungeSeat(seats, "BC1QAAA")?.seat).toBe(1);
    expect(loungeSeat(seats, "bc1qzzz")).toBeNull();
  });
  it("Hall of Founders shows seats 1–100 only", () => {
    expect(foundersOf(seats).map((s) => s.seat)).toEqual([1, 100]);
  });
});

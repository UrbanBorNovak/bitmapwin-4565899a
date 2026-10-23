import { describe, expect, it } from "vitest";
import { foundersKeycard, grandstandFeed } from "./batcave-feed";

describe("Batcave grandstand feed", () => {
  it("counts seats and shows newest first with seats left to next tier", () => {
    const f = grandstandFeed([1, 2, 3].map((seat) => ({ seat })), 2);
    expect(f.count).toBe(3);
    expect(f.latest.map((s) => s.seat)).toEqual([3, 2]);
    expect(f.tier).toEqual({ name: "FOUNDERS ROW", left: 97 });
  });
});

describe("Founders Row keycard", () => {
  it("is granted to seats 1–100 only", () => {
    expect(foundersKeycard({ seat: 100 })?.code).toBe("FR-100");
    expect(foundersKeycard({ seat: 101 })).toBeNull();
    expect(foundersKeycard(null)).toBeNull();
  });
});

import { backchannelMessage, loungeMessage, seatMessage } from "./launch-seats";
describe("dev9 backchannel signature", () => {
  it("can't reuse a lounge or seat signature", () => {
    const m = backchannelMessage("bc1qx", "t");
    expect(m).not.toBe(loungeMessage("bc1qx", "t"));
    expect(m).not.toBe(seatMessage("bc1qx", "t"));
  });
});

import { describe, expect, it } from "vitest";
import { VALUE_ANCHORED_WORLDS, valueAnchors } from "./inscribed-world-anchors";

describe("value anchors", () => {
  it("422 sats anchors to 422.BITMAP only", () => {
    expect(valueAnchors(422, 422)).toBe(true);
    expect(valueAnchors(546, 422)).toBe(false);
  });
  it("seeds the 422 world", () => {
    expect(VALUE_ANCHORED_WORLDS[422]).toContain("fa66c1e1ef9e8d609cff0301806963eb966dfc98a72cbb2f9dedf3b831009381i0");
  });
});

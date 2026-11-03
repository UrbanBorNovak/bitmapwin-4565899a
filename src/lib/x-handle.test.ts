import { describe, expect, it } from "vitest";
import { isValidXHandle, normalizeXHandle } from "./x-handle";

describe("x handle", () => {
  it("strips @ and profile URLs", () => {
    expect(normalizeXHandle("@bitmapwin")).toBe("bitmapwin");
    expect(normalizeXHandle("https://x.com/bitmapwin?s=1")).toBe("bitmapwin");
    expect(normalizeXHandle("https://twitter.com/bitmap_win/status/1")).toBe("bitmap_win");
    expect(normalizeXHandle("  ")).toBeNull();
  });
  it("rejects handles over 15 chars or with bad characters", () => {
    expect(isValidXHandle("a".repeat(16))).toBe(false);
    expect(isValidXHandle("bad-handle")).toBe(false);
    expect(isValidXHandle("good_handle1")).toBe(true);
  });
});

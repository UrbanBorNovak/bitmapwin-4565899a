import { describe, expect, it } from "vitest";
import { bannerLive, tipLine, tipName } from "./tip-banner";

describe("tip banner", () => {
  it("lasts exactly 15 seconds", () => {
    const b = { name: "x", sats: 1, screen: "cafe" as const, at: 0 };
    expect(bannerLive(b, 14_999)).toBe(true);
    expect(bannerLive(b, 15_000)).toBe(false);
  });
  it("blank names become Anonymous Bitmapper", () => {
    expect(tipName("  ")).toBe("Anonymous Bitmapper");
    expect(tipLine({ name: tipName(""), sats: 2100 })).toBe("⚡ Anonymous Bitmapper tipped 2,100 sats!");
  });
});

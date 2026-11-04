import { describe, expect, it } from "vitest";
import { parseBuildConfig } from "./build-sdk";

describe("myspace build", () => {
  it("keeps at most 8 Top 8 friends", () => {
    const top8 = Array.from({ length: 12 }, (_, i) => ({ height: i, nickname: "x" }));
    expect(parseBuildConfig("myspace", { top8 }).top8).toHaveLength(8);
  });
  it("drops friends without a valid block height", () => {
    const c = parseBuildConfig("myspace", { top8: [{ height: -3 }, { height: "abc" }, { height: 742309 }] });
    expect(c.top8.map((f) => f.height)).toEqual([742309]);
  });
  it("falls back to the classic skin for unknown skins", () => {
    expect(parseBuildConfig("myspace", { skin: "neon" }).skin).toBe("classic");
  });
});

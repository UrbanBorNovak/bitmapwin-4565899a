import { describe, expect, it } from "vitest";
import { BOT_PRESETS, matches, newMatches, starterConfig } from "./market-bot";

const l = (id: string, h: number, sats: number, extra = {}) => ({ id, bitmap_height: h, price_sats: sats, seller_address: "bc1qx", ...extra });

describe("market bot", () => {
  it("sub-100k preset ignores heights from 100000", () => {
    expect(matches(BOT_PRESETS[0]!, l("a", 99_999, 100_000))).toBe(true);
    expect(matches(BOT_PRESETS[0]!, l("b", 100_000, 100_000))).toBe(false);
  });
  it("skips listings on checkout hold", () => {
    expect(matches(BOT_PRESETS[2]!, l("a", 5, 10, { on_hold: true }))).toBe(false);
  });
  it("alerts once per listing", () => {
    expect(newMatches(BOT_PRESETS[2]!, [l("a", 5, 10), l("b", 6, 10)], new Set(["a"])).map((x) => x.id)).toEqual(["b"]);
  });
  it("exported config never auto-buys", () => {
    expect(JSON.parse(starterConfig(BOT_PRESETS[0]!)).autoBuy).toBe(false);
  });
});

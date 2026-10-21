import { describe, expect, it } from "vitest";
import { ARTISTS, PIXELS, STARRED_SERIES, filterPixels } from "./bitmap-pixels-catalog";

describe("BITMAP Pixels catalog", () => {
  it("holds all 4,320 inscriptions across 174 series", () => {
    expect(PIXELS.length).toBe(4320);
    expect(ARTISTS.length).toBe(174);
  });
  it("every starred series exists in the catalog", () => {
    const names = new Set(ARTISTS.map((a) => a.artist));
    for (const s of Object.values(STARRED_SERIES)) expect(names.has(s)).toBe(true);
  });
  it("starred filter only returns starred series", () => {
    const out = filterPixels(PIXELS, "", "", true);
    expect(out.every((p) => Object.values(STARRED_SERIES).includes(p.artist))).toBe(true);
    expect(filterPixels(PIXELS, "ninja dabber", "", false).length).toBe(1);
  });
});

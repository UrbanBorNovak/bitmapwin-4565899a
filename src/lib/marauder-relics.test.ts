import { describe, it, expect } from "vitest";
import { relicMetadata, relicVoxels, verifyRelic, relicTier, withinTip, RELIC_KINDS, RELIC_MAX_VOXELS } from "./marauder-relics";

describe("marauder relics", () => {
  it("same kind + height always derives the same relic", () => {
    expect(relicMetadata("cassette", 840000)).toEqual(relicMetadata("cassette", 840000));
    expect(relicMetadata("cassette", 840000).v).not.toBe(relicMetadata("cassette", 840001).v);
  });
  it("every relic stays within the one-draw-call voxel budget", () => {
    for (const k of RELIC_KINDS) expect(relicVoxels(k, 999999).length).toBeLessThanOrEqual(RELIC_MAX_VOXELS);
  });
  it("verifies derived metadata and rejects tampered voxels or wrong height", () => {
    const m = relicMetadata("pizza", 1138);
    expect(verifyRelic(m)).toEqual({ ok: true });
    expect(verifyRelic({ ...m, v: m.v.replace(/^\d/, "9") }).ok).toBe(false);
    expect(verifyRelic({ ...m, h: 1139 }).ok).toBe(false);
    expect(verifyRelic({ ...m, p: "OTHER" }).ok).toBe(false);
  });
  it("has the eleven relic kinds", () => { expect(RELIC_KINDS.length).toBe(11); });
  it("refuses heights past the chain tip", () => {
    expect(withinTip(900000, 900000)).toBe(true);
    expect(withinTip(900001, 900000)).toBe(false);
    expect(withinTip(5, 0)).toBe(false);
    expect(verifyRelic(relicMetadata("floppy", 900001), 900000)).toEqual({ ok: false, reason: "BEYOND CHAIN TIP" });
    expect(verifyRelic(relicMetadata("floppy", 900000), 900000).ok).toBe(true);
  });
  it("tier comes only from the height", () => {
    expect(relicTier(840000)).toBe("GOLD");
    expect(relicTier(12321)).toBe("GOLD");
    expect(relicTier(5000)).toBe("VOID");
    expect(relicTier(21 * 5001)).toBe("CYAN");
    expect(relicTier(800001)).toBe("STEEL");
  });
});

import { relicTribute, firstSatRarity, relicVoxels as rv2, RELIC_MAX_VOXELS as MAX2 } from "./marauder-relics";
import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("lore relics + tier split", () => {
  i2("premium 2100, standard 1092, split half to holder", () => {
    e2(relicTribute(840000)).toEqual({ total: 2100, holder: 1050, treasury: 1050 });
    e2(relicTribute(5000).total).toBe(2100);
    e2(relicTribute(800001)).toEqual({ total: 1092, holder: 546, treasury: 546 });
  });
  i2("first-sat rarity", () => {
    e2(firstSatRarity(0)).toBe("MYTHIC"); e2(firstSatRarity(630000)).toBe("EPIC");
    e2(firstSatRarity(2016)).toBe("RARE"); e2(firstSatRarity(2017)).toBe("UNCOMMON");
  });
  i2("new relics stay within voxel cap", () => {
    for (const k of ["times", "crt", "radar", "pickaxe"] as const) for (const h of [0, 9, 57043, 840000]) {
      const v = rv2(k, h); e2(v.length).toBeGreaterThan(0); e2(v.length).toBeLessThanOrEqual(MAX2);
    }
  });
});

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
  it("has the seven relic kinds", () => { expect(RELIC_KINDS.length).toBe(7); });
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

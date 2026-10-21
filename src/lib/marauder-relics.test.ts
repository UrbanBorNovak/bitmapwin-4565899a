import { describe, it, expect } from "vitest";
import { relicMetadata, relicVoxels, verifyRelic, RELIC_KINDS, RELIC_MAX_VOXELS } from "./marauder-relics";

describe("marauder relics", () => {
  it("same kind + height always derives the same relic", () => {
    expect(relicMetadata("keycard", 840000)).toEqual(relicMetadata("keycard", 840000));
    expect(relicMetadata("keycard", 840000).v).not.toBe(relicMetadata("keycard", 840001).v);
  });
  it("every relic stays within the one-draw-call voxel budget", () => {
    for (const k of RELIC_KINDS) expect(relicVoxels(k, 999999).length).toBeLessThanOrEqual(RELIC_MAX_VOXELS);
  });
  it("verifies derived metadata and rejects tampered voxels or wrong height", () => {
    const m = relicMetadata("fuse", 1138);
    expect(verifyRelic(m)).toEqual({ ok: true });
    expect(verifyRelic({ ...m, v: m.v.replace(/^\d/, "9") }).ok).toBe(false);
    expect(verifyRelic({ ...m, h: 1139 }).ok).toBe(false);
    expect(verifyRelic({ ...m, p: "OTHER" }).ok).toBe(false);
  });
});

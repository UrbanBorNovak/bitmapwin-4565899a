import { describe, expect, it } from "vitest";
import { claimLag, inscriptionEra, milestoneAt, nearbyMilestones } from "./archaeology-dossier";

describe("inscriptionEra", () => {
  it("vanguard starts at 792,435 and ends at 793,499", () => {
    expect(inscriptionEra(792_435)?.id).toBe("vanguard");
    expect(inscriptionEra(793_499)?.id).toBe("vanguard");
    expect(inscriptionEra(793_500)?.id).toBe("rush");
  });
  it("consolidation ends at 799,999, modern from 800,000", () => {
    expect(inscriptionEra(799_999)?.id).toBe("consolidation");
    expect(inscriptionEra(800_000)?.id).toBe("modern");
  });
  it("unknown or pre-genesis claims have no era", () => {
    expect(inscriptionEra(null)).toBeNull();
    expect(inscriptionEra(792_434)).toBeNull();
  });
});

describe("milestones", () => {
  it("matches exact heights only", () => {
    expect(milestoneAt(170)?.title).toBe("FIRST P2P TRANSACTION");
    expect(milestoneAt(171)).toBeNull();
  });
  it("finds neighbours", () => {
    const n = nearbyMilestones(500_000);
    expect(n.prev?.height).toBe(481_824);
    expect(n.next?.height).toBe(630_000);
  });
  it("claim lag is genesis minus height", () => {
    expect(claimLag(100, 792_500)).toBe(792_400);
    expect(claimLag(100, null)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { RELIC_SIGNING_ENABLED, qualifiesForRelic, relicDraft, relicSigningBlockers } from "./puzzle-relic";

const hash = "f6f54" + "0".repeat(35);
const ok = { verified: true, nibbles: 5, foundAt: "x" };

describe("near-miss relic", () => {
  it("qualifies from 5 matching characters, not 4", () => {
    expect(qualifiesForRelic(4)).toBe(false);
    expect(qualifiesForRelic(5)).toBe(true);
  });
  it("keeps the exact match count out of 40", () => {
    expect(relicDraft({ nibbles: 7, hash }, { ...ok, nibbles: 7 }, { height: null, build: null, guardian: null }).match).toBe("7/40");
  });
  it("marks proof unverified when the record count differs", () => {
    expect(relicDraft({ nibbles: 6, hash }, ok, { height: null, build: null, guardian: null }).proof).toBe("unverified");
  });
  it("attaches build and Guardian only with a BITMAP", () => {
    const d = relicDraft({ nibbles: 5, hash }, ok, { height: 840000, build: { inscriptionId: "abci0", blockCount: 3 }, guardian: "gi0" });
    expect([d.bitmap, d.build, d.guardian]).toEqual(["840000.bitmap", "abci0", "gi0"]);
  });
  it("keeps signing disabled even for a verified find", () => {
    expect(RELIC_SIGNING_ENABLED).toBe(false);
    expect(relicSigningBlockers(ok, { nibbles: 5 }).length).toBeGreaterThan(0);
  });
});

import { DEMO_RELIC, draftSigningBlockers } from "./puzzle-relic";
describe("demo relic", () => {
  it("is flagged demo, unverified, and always blocked from signing", () => {
    expect(DEMO_RELIC.demo).toBe(true);
    expect(DEMO_RELIC.proof).toBe("unverified");
    expect(draftSigningBlockers(DEMO_RELIC).some((r) => r.startsWith("Demo badge"))).toBe(true);
  });
});

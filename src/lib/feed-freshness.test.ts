import { describe, expect, it } from "vitest";
import { feedFreshness, utcStamp } from "./feed-freshness";

const now = Date.parse("2026-10-16T16:00:00Z");
describe("feedFreshness", () => {
  it("is live within 15 minutes", () => expect(feedFreshness("2026-10-16T15:50:00Z", now)).toBe("live"));
  it("is delayed between 15 and 60 minutes", () => expect(feedFreshness("2026-10-16T15:30:00Z", now)).toBe("delayed"));
  it("is stale after 60 minutes", () => expect(feedFreshness("2026-10-16T14:30:00Z", now)).toBe("stale"));
  it("is unknown without a sync", () => expect(feedFreshness(null, now)).toBe("unknown"));
  it("formats UTC", () => expect(utcStamp("2026-10-11T17:14:50Z")).toBe("2026-10-11 17:14 UTC"));
});

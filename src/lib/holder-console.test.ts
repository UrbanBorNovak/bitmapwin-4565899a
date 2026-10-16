import { describe, expect, it } from "vitest";
import { filterRoster, heightTags } from "./holder-console";

describe("holder console", () => {
  it("tags heights below 1000 as 999 CLUB", () => {
    expect(heightTags(422)).toContain("999 CLUB");
    expect(heightTags(1000)).not.toContain("999 CLUB");
  });
  it("tags palindromic heights of 3+ digits", () => {
    expect(heightTags(12321)).toContain("PALINDROME");
    expect(heightTags(77)).not.toContain("PALINDROME");
  });
  it("empty filter keeps only untouched land", () => {
    const rows = [
      { height: 5, built: true, guardian: false, deployments: 0 },
      { height: 800000, built: false, guardian: false, deployments: 0 },
    ];
    expect(filterRoster(rows, "empty").map((r) => r.height)).toEqual([800000]);
  });
});

import { describe, it, expect } from "vitest";
import { momentToUnix, checkMoment, gapLabel, GENESIS_UNIX } from "./milestone-block";
describe("milestone matcher", () => {
  it("parses UTC moments", () => { expect(momentToUnix("2009-01-03T18:15", true)).toBe(1231006500); });
  it("rejects garbage", () => { expect(momentToUnix("nope", true)).toBeNull(); });
  it("flags dates before genesis", () => { expect(checkMoment(GENESIS_UNIX - 1, 2e9)).toBe("pre-genesis"); });
  it("flags future dates", () => { expect(checkMoment(2e9 + 1, 2e9)).toBe("future"); });
  it("labels gaps", () => { expect(gapLabel(1000, 1180)).toBe("3 min after"); expect(gapLabel(1180, 1000)).toBe("3 min before"); });
});

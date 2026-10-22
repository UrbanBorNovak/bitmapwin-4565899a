import { describe, expect, it } from "vitest";
import { backroomFor, earnedFrom } from "./biternam-backroom";

describe("biternam backrooms", () => {
  it("vault pass is earned by solving the island", () => expect(backroomFor("vault")?.earnedBy).toBe("island"));
  it("lair pass is earned by solving the vault", () => expect(backroomFor("lair")?.earnedBy).toBe("vault"));
  it("other rooms need no pass", () => expect(backroomFor("batcave")).toBeNull());
  it("one step is not enough to earn a pass", () => { expect(earnedFrom(1)).toBe(false); expect(earnedFrom(2)).toBe(true); });
});

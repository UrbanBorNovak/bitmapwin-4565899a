import { describe, expect, it } from "vitest";
import { backroomStepGate } from "./hideout-progress.server";

const C = "a".repeat(64);
const yes = async () => true;
const no = async () => false;

describe("backroom step gate", () => {
  it("vault step without a pass is sealed", async () => expect(await backroomStepGate("vault", undefined, yes)).toBe("sealed"));
  it("lair step with a pass not on the list is sealed", async () => expect(await backroomStepGate("lair", C, no)).toBe("sealed"));
  it("vault step with a listed pass opens", async () => expect(await backroomStepGate("vault", C, yes)).toBe("open"));
  it("checks the pass against the room's own door", async () => {
    let seen = "";
    await backroomStepGate("lair", C, async (s) => { seen = s; return true; });
    expect(seen).toBe("biternam-backroom-lair");
  });
  it("ordinary rooms need no pass", async () => expect(await backroomStepGate("island", undefined, no)).toBe("open"));
});

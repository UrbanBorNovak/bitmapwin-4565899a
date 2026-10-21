import { describe, expect, it } from "vitest";
import { checkScript, resolveLabVerb } from "./lab-verbs";

const none = { seen: false, boptimized: false, deployed: false };

describe("bop's boptimization lab", () => {
  it("only removing every junk op and nothing else is boptimal", () => {
    expect(checkScript([0, 2, 3, 6])).toBe("ok");
    expect(checkScript([0, 2, 3])).toBe("bloated");
    expect(checkScript([0, 1, 2, 3, 6])).toBe("broken");
  });
  it("cannot deploy before boptimizing", () => {
    expect(resolveLabVerb("use", "deploy", none).effect).toBeNull();
    expect(resolveLabVerb("use", "deploy", { ...none, boptimized: true }).effect).toBe("deploy");
  });
  it("yanking the rack cable vents steam", () => {
    expect(resolveLabVerb("pickup", "rack", none).effect).toBe("steam");
  });
});

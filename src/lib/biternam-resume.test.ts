import { describe, it, expect } from "vitest";
import { resumeTarget } from "./biternam-resume";

describe("resumeTarget", () => {
  it("fresh account starts at the arcade", () => expect(resumeTarget(0, 0).to).toBe("/biternam/arcade"));
  it("after 3 heist links goes to the museum", () => expect(resumeTarget(3, 0).to).toBe("/biternam/museum"));
  it("finished heist goes to the void", () => expect(resumeTarget(7, 1).to).toBe("/biternam/void"));
  it("finished void goes to the batcave", () => expect(resumeTarget(7, 3, 0, 0).to).toBe("/biternam/batcave"));
  it("half-done batcave stays in the batcave", () => expect(resumeTarget(7, 3, 1, 0).to).toBe("/biternam/batcave"));
  it("finished batcave goes to the island", () => expect(resumeTarget(7, 3, 2, 1).to).toBe("/biternam/island"));
  it("unfinished void comes before the batcave", () => expect(resumeTarget(7, 2, 2, 2).to).toBe("/biternam/void"));
  it("finished island goes to the 1138 vault", () => expect(resumeTarget(7, 3, 2, 2, 0).to).toBe("/biternam/vault"));
  it("everything finished is done", () => expect(resumeTarget(7, 3, 2, 2, 2).done).toBe(true));
});

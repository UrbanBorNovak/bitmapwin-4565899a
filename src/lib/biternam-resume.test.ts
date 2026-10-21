import { describe, it, expect } from "vitest";
import { resumeTarget } from "./biternam-resume";

describe("resumeTarget", () => {
  it("fresh account starts at the arcade", () => expect(resumeTarget(0, 0).to).toBe("/biternam/arcade"));
  it("after 3 heist links goes to the museum", () => expect(resumeTarget(3, 0).to).toBe("/biternam/museum"));
  it("finished heist goes to the void", () => expect(resumeTarget(7, 1).to).toBe("/biternam/void"));
  it("everything finished is done", () => expect(resumeTarget(7, 3).done).toBe(true));
});

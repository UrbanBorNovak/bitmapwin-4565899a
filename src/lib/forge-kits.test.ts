import { describe, expect, it } from "vitest";
import { KITS, behaviorPose } from "@/lib/forge-kits";
import { blueprintBlocks } from "@/lib/forge-blueprints";

describe("forge kits", () => {
  it("ships the castle and the train", () => {
    expect(KITS.map((k) => k.id)).toEqual(["kit-citadel", "kit-express"]);
  });
  it("every block stays on the 64×64 canvas", () => {
    for (const k of KITS) for (const b of blueprintBlocks(k)) {
      expect(b.dx).toBeGreaterThanOrEqual(0); expect(b.dx).toBeLessThan(64);
      expect(b.dz).toBeGreaterThanOrEqual(0); expect(b.dz).toBeLessThan(64);
    }
  });
  it("behaviors only target real steps", () => {
    for (const k of KITS) for (const b of k.behaviors) for (const s of b.steps) expect(k.steps[s]?.blocks?.length).toBeGreaterThan(0);
  });
  it("gate stays shut with no visitor near", () => {
    const gate = KITS[0]!.behaviors.find((b) => b.card === "gate_sensor")!;
    expect(behaviorPose(gate, 2, false).y).toBe(0);
  });
});

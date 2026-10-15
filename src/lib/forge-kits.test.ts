import { describe, expect, it } from "vitest";
import { KITS, behaviorPose } from "@/lib/forge-kits";
import { blueprintBlocks } from "@/lib/forge-blueprints";

describe("forge kits", () => {
  it("ships twenty-five boxed sets", () => {
    expect(KITS.map((k) => k.id)).toEqual(["kit-citadel", "kit-express", "kit-array", "kit-vault", "kit-dragon", "kit-mega", "kit-colossus", "kit-ark", "kit-bismarck", "kit-tiger", "kit-spitfire", "kit-hospital", "kit-police", "kit-fire", "kit-school", "kit-pyramid", "kit-colosseum", "kit-eiffel", "kit-taj", "kit-greatwall", "kit-petra", "kit-machu", "kit-terracotta", "kit-angkor", "kit-genesis-coin", "kit-black-pearl"]);
  });
  it("every step comes in a numbered bag, in order", () => {
    for (const k of KITS) {
      expect(k.bags.length).toBe(k.steps.length);
      expect(k.bags[0]).toBe(1);
      for (let i = 1; i < k.bags.length; i++) expect(k.bags[i]! - k.bags[i - 1]!).toBeGreaterThanOrEqual(0);
    }
  });
  it("every block stays on the 64×64 canvas", () => {
    for (const k of KITS) for (const b of blueprintBlocks(k)) {
      expect(b.dx).toBeGreaterThanOrEqual(0); expect(b.dx).toBeLessThan(64);
      expect(b.dz).toBeGreaterThanOrEqual(0); expect(b.dz).toBeLessThan(64);
    }
  });
  it("every set fits the 12,000-brick inscription limit", () => {
    for (const k of KITS) expect(blueprintBlocks(k).length).toBeLessThanOrEqual(12000);
  });
  it("behaviors only target real steps", () => {
    for (const k of KITS) for (const b of k.behaviors) for (const s of b.steps) expect(k.steps[s]?.blocks?.length).toBeGreaterThan(0);
  });
  it("gate stays shut with no visitor near", () => {
    const gate = KITS[0]!.behaviors.find((b) => b.card === "gate_sensor")!;
    expect(behaviorPose(gate, 2, false).y).toBe(0);
  });
});

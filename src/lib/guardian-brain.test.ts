import { describe, it, expect } from "vitest";
import { wireBrain, SYNAPSES, agentSlots, decideDrive, sensesAt, think } from "./guardian-brain";

describe("guardian brain", () => {
  it("has exactly 8000 synapses", () => {
    expect(wireBrain(840000).w.length).toBe(8000);
    expect(SYNAPSES).toBe(8000);
  });
  it("one agent per Guardian held", () => {
    expect(agentSlots(3)).toBe(3);
    expect(agentSlots(0)).toBe(0);
  });
  it("same Guardian thinks the same on every device", () => {
    const s = sensesAt(840000, 10);
    expect(think(wireBrain(840000), s)).toEqual(think(wireBrain(840000), s));
  });
  it("exhausted Guardian always rests", () => {
    const s = { ...sensesAt(1, 1), fatigue: 0.9, threat: 0.9 };
    expect(decideDrive(wireBrain(1), s).drive).toBe("rest");
  });
});

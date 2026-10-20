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

import { forageRef, FORAGE_BIT } from "./guardian-brain";
describe("forage reward", () => {
  it("pays 5 BIT, keyed once per Guardian per UTC day", () => {
    expect(FORAGE_BIT).toBe(5);
    const t = Date.UTC(2026, 9, 20, 3);
    expect(forageRef(840000, t)).toBe(forageRef(840000, t + 3600_000 * 10));
    expect(forageRef(840000, t)).not.toBe(forageRef(840000, t + 86400_000));
  });
});

import { describe, expect, it } from "vitest";
import { ROOM_EXHIBITS, blankGear, combine, salvage, type GearRoom, type GearState } from "./biternam-gear";
import { RIDES } from "./world-vehicle";

describe("biternam gear locker", () => {
  it("every room shows a real on-chain ride", () => {
    for (const e of Object.values(ROOM_EXHIBITS)) expect(RIDES.some((r) => r.id === e.ride)).toBe(true);
  });
  it("a room's part can be salvaged only once", () => {
    const s = salvage(blankGear(), "outpost")!;
    expect(s.inv).toEqual(["truck-battery"]);
    expect(salvage(s, "outpost")).toBeNull();
  });
  it("combining needs both items held and consumes them", () => {
    const s: GearState = { inv: ["truck-battery"], salvaged: [] };
    expect(combine(s, "truck-battery", "saucer-coil")).toBeNull();
    const t = combine({ ...s, inv: ["saucer-coil", "truck-battery"] }, "saucer-coil", "truck-battery")!;
    expect(t.inv).toEqual(["hover-cell"]);
  });
  it("all eight rooms rebuild the hover-skiff", () => {
    let s = blankGear();
    for (const r of Object.keys(ROOM_EXHIBITS) as GearRoom[]) s = salvage(s, r)!;
    const steps: [string, string][] = [["truck-battery", "saucer-coil"], ["jet-nozzle", "headlamp"], ["dash-camera", "nav-chip"], ["tread-link", "dog-tag"], ["hover-cell", "skiff-anchor"], ["signal-flare", "explorer-scope"], ["skiff-engine", "beacon"]];
    for (const [a, b] of steps) s = combine(s, a, b)!;
    expect(s.inv).toEqual(["hover-skiff"]);
  });
});

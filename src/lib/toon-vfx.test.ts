import { describe, expect, it } from "vitest";
import { HOUSE_VFX, VFX_MAX_INSTANCES, parseVFX, particleAt } from "./toon-vfx";
import { parseEpisode } from "./toon-script";

describe("toon vfx", () => {
  it("particles are a pure function of time (scrub-safe)", () => {
    const fx = HOUSE_VFX[0]!;
    expect(particleAt(fx, 7, 3, 0.8)).toEqual(particleAt(fx, 7, 3, 0.8));
  });
  it("burst particles die after their life", () => {
    const fx = HOUSE_VFX[0]!;
    expect(particleAt(fx, 1, 0, fx.life + 0.1).alive).toBe(false);
    expect(particleAt(fx, 1, 0, -0.1).alive).toBe(false);
  });
  it("caps instance count at the one-draw-call budget", () => {
    const fx = parseVFX({ ...HOUSE_VFX[0]!, id: "me/big-v1", count: 99999 });
    expect(fx.count).toBe(VFX_MAX_INSTANCES);
  });
  it("rejects wrong format and bad colors", () => {
    expect(() => parseVFX({ ...HOUSE_VFX[0]!, format: "x" })).toThrow();
    expect(() => parseVFX({ ...HOUSE_VFX[0]!, keys: [{ t: 0, scale: 1, color: "red", opacity: 1 }] })).toThrow();
  });
  it("episode parser keeps valid cues and drops out-of-scene ones", () => {
    const e = parseEpisode(JSON.stringify({ title: "t", scenes: [{ block: 1, duration: 5, shot: "wide", cast: [], lines: [], fx: [{ id: "a/b-v1", at: 2 }, { id: "a/b-v1", at: 9 }] }] }));
    expect(e.scenes[0].fx).toEqual([{ id: "a/b-v1", at: 2 }]);
  });
});

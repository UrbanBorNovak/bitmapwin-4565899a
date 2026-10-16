import { afterEach, describe, expect, it } from "vitest";
import { boxSurfaceAt, boxWallAt, setBoxes } from "./box-collision";

const STEP = 0.0145, BODY = 0.018;

describe("inscribed-world box collision", () => {
  afterEach(() => setBoxes("t", null));

  it("a stair rise of 0.0133 can be stepped onto", () => {
    setBoxes("t", [{ x0: 0, x1: 1, y0: 0, y1: 0.0133, z0: 0, z1: 1 }]);
    expect(boxSurfaceAt(0.5, 0.5, 0, STEP)).toBeCloseTo(0.0133);
    expect(boxWallAt(0.5, 0.5, 0, BODY, STEP)).toBe(false);
  });

  it("a tall pillar blocks the body", () => {
    setBoxes("t", [{ x0: 0, x1: 1, y0: 0, y1: 0.13, z0: 0, z1: 1 }]);
    expect(boxSurfaceAt(0.5, 0.5, 0, STEP)).toBeNull();
    expect(boxWallAt(0.5, 0.5, 0, BODY, STEP)).toBe(true);
  });
});

describe("pillar body width", () => {
  afterEach(() => setBoxes("p", null));
  it("a thin pillar blocks a body just beside it", () => {
    setBoxes("p", [{ x0: 0, x1: 0.026, y0: 0, y1: 0.13, z0: 0, z1: 0.026 }]);
    expect(boxWallAt(0.029, 0.013, 0, 0.018, 0.0145, 0.004)).toBe(true);
    expect(boxWallAt(0.035, 0.013, 0, 0.018, 0.0145, 0.004)).toBe(false);
  });
});

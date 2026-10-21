import { describe, expect, it } from "vitest";
import { clampCamera, setBoundsFor } from "./BiternamRooms";

describe("film set bounds", () => {
  it("keeps the camera in front of the back wall of a room set", () => {
    const c = [0, 10, -60, 0, 4, 0]; clampCamera("b-museum", c); expect(c[2]).toBe(-24);
  });
  it("keeps extras on the Mempool Void catwalk", () => {
    expect(setBoundsFor("b-void")!.walk.x1).toBe(0.45);
  });
});

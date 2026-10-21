import { describe, expect, it } from "vitest";
import { clampCamera, setBoundsFor, ROOMS } from "./BiternamRooms";
import { gallerySlots } from "./EcoGallery";

describe("film set bounds", () => {
  it("keeps the camera in front of the back wall of a room set", () => {
    const c = [0, 10, -60, 0, 4, 0]; clampCamera("b-museum", c); expect(c[2]).toBe(-24);
  });
  it("keeps extras on the Mempool Void catwalk", () => {
    expect(setBoundsFor("b-void")!.walk.x1).toBe(0.45);
  });
});

describe("gallery pictures", () => {
  it("never overlap back-wall props or each other in any walled room", () => {
    for (const [name, r] of Object.entries(ROOMS)) {
      if (r.open) continue;
      const slots = gallerySlots(r.props);
      expect(slots.length, name).toBeGreaterThan(0);
      for (const [x, y] of slots) for (const b of r.props) if (b.p[2] - b.s[2] / 2 < -20)
        expect(Math.abs(b.p[0] - x) >= b.s[0] / 2 + 5 || Math.abs(b.p[1] - y) >= b.s[1] / 2 + 5, `${name} ${x},${y}`).toBe(true);
    }
  });
});

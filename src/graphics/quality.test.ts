import { afterEach, describe, expect, it, vi } from "vitest";
import { qualitySettings } from "./quality";

const saved = { mode: "auto" as const, overrides: { shadows: true, viewDistance: "far" as const, plotGlow: true } };

describe("phone quality", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("ignores saved shadows, far view and glow on touch screens", () => {
    vi.stubGlobal("window", { ontouchstart: null });
    vi.stubGlobal("navigator", { maxTouchPoints: 5 });
    const q = qualitySettings(saved, "high");
    expect(q.shadows).toBe(false);
    expect(q.viewDistance).toBe("medium");
    expect(q.plotGlow).toBe(false);
  });

  it("still honours saved shadows on desktop", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { maxTouchPoints: 0 });
    expect(qualitySettings(saved, "high").shadows).toBe(true);
  });
});

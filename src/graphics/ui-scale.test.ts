import { describe, expect, it } from "vitest";
import { effectiveUiScale } from "./ui-scale";

describe("ui scale", () => {
  it("keeps 1.5x on wide screens", () => expect(effectiveUiScale(1.5, 1772)).toBe(1.5));
  it("caps zoom so a 390px phone lays out at least 360px wide", () => expect(390 / effectiveUiScale(1.5, 390)).toBeGreaterThanOrEqual(360));
  it("never zooms below 1", () => expect(effectiveUiScale(1.5, 320)).toBe(1));
});

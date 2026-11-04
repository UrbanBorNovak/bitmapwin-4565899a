import { describe, expect, it } from "vitest";
import { buildRings, ringNeighbours } from "./webrings";

describe("webrings", () => {
  it("groups by kind and era, sorted by height", () => {
    const rings = buildRings([
      { height: 742309, kind: "myspace", title: null },
      { height: 715093, kind: "myspace", title: null },
      { height: 5, kind: "info", title: null },
    ]);
    expect(rings.find((r) => r.slug === "kind-myspace")!.members).toEqual([715093, 742309]);
    expect(rings.find((r) => r.slug === "era-0")!.members).toEqual([5]);
    expect(rings.find((r) => r.slug === "era-3")!.members).toEqual([715093, 742309]);
  });
  it("wraps around at the ends", () => {
    expect(ringNeighbours([1, 2, 3], 3)).toEqual({ prev: 2, next: 1 });
    expect(ringNeighbours([1, 2, 3], 1)).toEqual({ prev: 3, next: 2 });
    expect(ringNeighbours([1, 2, 3], 9)).toBeNull();
  });
});

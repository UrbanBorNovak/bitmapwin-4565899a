import { describe, expect, it } from "vitest";
import { episodeLength, generateEpisode, parseEpisode, sceneAt, actorPositionAt as apa } from "./toon-script";

describe("toon script", () => {
  it("generates the same episode for the same BITMAPs", () => {
    expect(generateEpisode(840000, 77819)).toEqual(generateEpisode(840000, 77819));
  });
  it("finds the scene playing at a given second", () => {
    const e = generateEpisode(1, 2);
    expect(sceneAt(e, 5.5)).toEqual({ index: 1, local: 0.5 });
    expect(episodeLength(e)).toBe(21);
  });
  it("rejects more than 4 Guardians in a scene", () => {
    const e = generateEpisode(1, 2);
    e.scenes[0]!.cast = Array(5).fill(e.scenes[0]!.cast[0]);
    expect(() => parseEpisode(JSON.stringify(e))).toThrow();
  });
});

describe("actorPositionAt", () => {
  const a = { height: 1, name: "1.bitmap", x: -10, z: 0, pose: "walk" as const, to: { x: 10, z: 6 } };
  it("starts at start, ends at end, halfway in the middle", () => {
    expect(apa(a, 0)).toMatchObject({ x: -10, z: 0 });
    expect(apa(a, 1)).toMatchObject({ x: 10, z: 6 });
    expect(apa(a, 0.5)).toMatchObject({ x: 0, z: 3, moving: true });
  });
  it("stays put without an end position", () => {
    const { to: _t, ...still } = a;
    expect(apa(still, 0.7)).toEqual({ x: -10, z: 0, moving: false });
  });
});

import { describe, expect, it } from "vitest";
import { episodeLength, generateEpisode, parseEpisode, sceneAt } from "./toon-script";

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

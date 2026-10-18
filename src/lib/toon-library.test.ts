import { describe, expect, it } from "vitest";
import { applyCast, upsertEpisode } from "./toon-library";
import { generateEpisode } from "./toon-script";

describe("toon library", () => {
  it("recasts every scene by slot and keeps extra slots", () => {
    const e = applyCast(generateEpisode(1, 2), [500]);
    expect(e.scenes[1]!.cast.map((a) => a.height)).toEqual([500, 2]);
  });
  it("overwrites an episode with the same id instead of duplicating it", () => {
    const ep = generateEpisode(1, 2);
    let lib = { series: [{ id: "s", name: "S1", episodes: [] }], casts: [] };
    lib = upsertEpisode(lib, "s", { id: "e", savedAt: 1, episode: ep });
    lib = upsertEpisode(lib, "s", { id: "e", savedAt: 2, episode: ep });
    expect(lib.series[0]!.episodes.length).toBe(1);
  });
});

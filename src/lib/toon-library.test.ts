import { describe, expect, it } from "vitest";
import { applyCast, mergeLibraries, upsertEpisode, type ToonLibrary } from "./toon-library";
import { generateEpisode } from "./toon-script";

describe("toon library", () => {
  it("recasts every scene by slot and keeps extra slots", () => {
    const e = applyCast(generateEpisode(1, 2), [500]);
    expect(e.scenes[1]!.cast.map((a) => a.height)).toEqual([500, 2]);
  });
  it("overwrites an episode with the same id instead of duplicating it", () => {
    const ep = generateEpisode(1, 2);
    let lib: ToonLibrary = { series: [{ id: "s", name: "S1", episodes: [] }], casts: [] };
    lib = upsertEpisode(lib, "s", { id: "e", savedAt: 1, episode: ep });
    lib = upsertEpisode(lib, "s", { id: "e", savedAt: 2, episode: ep });
    expect(lib.series[0]!.episodes.length).toBe(1);
  });
});

describe("toon library merge", () => {
  it("keeps every series and cast from both sides and the newer copy of an episode", () => {
    const ep = generateEpisode(1, 2);
    const a: ToonLibrary = { series: [{ id: "s", name: "S", episodes: [{ id: "e", savedAt: 1, episode: ep }] }], casts: [{ id: "c1", name: "A", heights: [1] }] };
    const b: ToonLibrary = { series: [{ id: "s", name: "S", episodes: [{ id: "e", savedAt: 5, episode: { ...ep, title: "new" } }] }, { id: "t", name: "T", episodes: [] }], casts: [{ id: "c2", name: "B", heights: [2] }] };
    const m = mergeLibraries(a, b);
    expect(m.series.length).toBe(2);
    expect(m.series[0]!.episodes[0]!.episode.title).toBe("new");
    expect(m.casts.length).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import { applyCast, episodeFromTemplate, mergeLibraries, toTemplate, upsertEpisode, type ToonLibrary } from "./toon-library";
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

describe("series templates", () => {
  it("keeps cast, locations and camera but starts with no dialogue, numbered as the next episode", () => {
    const ep = generateEpisode(840000, 77819);
    const series = { id: "s", name: "Season 1", episodes: [{ id: "e", savedAt: 1, episode: ep }], template: { savedAt: 1, episode: toTemplate(ep) } };
    const next = episodeFromTemplate(series)!;
    expect(next.title).toBe("Season 1 — EP2");
    expect(next.scenes.map((s) => [s.block, s.shot])).toEqual(ep.scenes.map((s) => [s.block, s.shot]));
    expect(next.scenes[1]!.cast.map((a) => a.height)).toEqual([840000, 77819]);
    expect(next.scenes.every((s) => s.lines.length === 0)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { applyCast, autosaveEpisode, episodeFromTemplate, mergeLibraries, toTemplate, upsertEpisode, type ToonLibrary } from "./toon-library";
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

describe("autosave versions", () => {
  const base = (): ToonLibrary => ({ series: [{ id: "s", name: "S", episodes: [{ id: "e", savedAt: 0, episode: generateEpisode(1, 2) }] }], casts: [] });
  it("keeps the previous saved copy so it can be recovered", () => {
    const lib = autosaveEpisode(base(), "s", "e", { ...generateEpisode(1, 2), title: "edited" }, 1000);
    const e = lib.series[0]!.episodes[0]!;
    expect(e.episode.title).toBe("edited");
    expect(e.history![0]!.episode.title).toBe("1.bitmap vs 2.bitmap");
  });
  it("folds saves within a minute into one version and keeps at most 10", () => {
    let lib = base();
    for (let i = 1; i <= 5; i++) lib = autosaveEpisode(lib, "s", "e", generateEpisode(i, 2), i * 1000);
    expect(lib.series[0]!.episodes[0]!.history!.length).toBe(1);
    for (let i = 1; i <= 30; i++) lib = autosaveEpisode(lib, "s", "e", generateEpisode(i, 2), 100_000 + i * 120_000);
    expect(lib.series[0]!.episodes[0]!.history!.length).toBe(10);
  });
});

describe("series characters", () => {
  it("merging keeps characters from both devices, one per Guardian", () => {
    const c = (height: number, nickname: string) => ({ height, nickname, personality: "", voice: "", relationships: "" });
    const a: ToonLibrary = { series: [{ id: "s", name: "S", episodes: [], characters: [c(1, "Ace")] }], casts: [] };
    const b: ToonLibrary = { series: [{ id: "s", name: "S", episodes: [], characters: [c(1, "Other"), c(2, "Bo")] }], casts: [] };
    expect(mergeLibraries(a, b).series[0]!.characters!.map((x) => x.nickname)).toEqual(["Ace", "Bo"]);
  });
});

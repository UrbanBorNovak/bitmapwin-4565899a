// Toon Studio library: series of saved episodes and recurring Guardian casts, kept on this device.
import type { ToonEpisode } from "./toon-script";

export interface SavedEpisode { id: string; savedAt: number; episode: ToonEpisode; }
export interface ToonSeries { id: string; name: string; episodes: SavedEpisode[]; }
export interface ToonCast { id: string; name: string; heights: number[]; }
export interface ToonLibrary { series: ToonSeries[]; casts: ToonCast[]; }

const KEY = "toon-studio-library-v1";
export const emptyLibrary = (): ToonLibrary => ({ series: [], casts: [] });
export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function loadLibrary(): ToonLibrary {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as ToonLibrary | null;
    return v && Array.isArray(v.series) && Array.isArray(v.casts) ? v : emptyLibrary();
  } catch { return emptyLibrary(); }
}
export function saveLibrary(lib: ToonLibrary): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(lib)); return true; } catch { return false; }
}

/** Saves into a series: same episode id overwrites, otherwise appends. */
export function upsertEpisode(lib: ToonLibrary, seriesId: string, saved: SavedEpisode): ToonLibrary {
  return {
    ...lib,
    series: lib.series.map((s) => {
      if (s.id !== seriesId) return s;
      const has = s.episodes.some((e) => e.id === saved.id);
      return { ...s, episodes: has ? s.episodes.map((e) => (e.id === saved.id ? saved : e)) : [...s.episodes, saved] };
    }),
  };
}

/** Recasts every scene: actor slot N becomes cast member N (extra slots keep their Guardian). */
export function applyCast(ep: ToonEpisode, heights: number[]): ToonEpisode {
  return {
    ...ep,
    scenes: ep.scenes.map((s) => ({
      ...s,
      cast: s.cast.map((a, i) => {
        const h = heights[i];
        return h === undefined ? a : { ...a, height: h, name: `${h}.bitmap` };
      }),
    })),
  };
}

// Toon Studio library: series of saved episodes and recurring Guardian casts, kept on this device.
import type { ToonEpisode } from "./toon-script";

export interface EpisodeVersion { savedAt: number; episode: ToonEpisode; }
export interface SavedEpisode { id: string; savedAt: number; episode: ToonEpisode; history?: EpisodeVersion[]; }
export interface SeriesTemplate { savedAt: number; episode: ToonEpisode; }
/** Recurring Guardian character in a series, keyed by the Guardian's BITMAP block. */
export interface ToonCharacter { height: number; nickname: string; personality: string; voice: string; relationships: string; }
/** Continuity note: an episode event, or a storyline thread that can be resolved later. */
export interface ContinuityNote { id: string; kind: "event" | "thread"; text: string; episode: string; at: number; resolved?: boolean; guardians?: number[]; }
export interface ToonSeries { id: string; name: string; episodes: SavedEpisode[]; template?: SeriesTemplate; characters?: ToonCharacter[]; notes?: ContinuityNote[]; }
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

/** Combines two libraries without losing anything: items matched by id, newer saved episode wins. */
export function mergeLibraries(a: ToonLibrary, b: ToonLibrary): ToonLibrary {
  const series = new Map(a.series.map((s) => [s.id, s]));
  for (const s of b.series) {
    const cur = series.get(s.id);
    if (!cur) { series.set(s.id, s); continue; }
    const eps = new Map(cur.episodes.map((e) => [e.id, e]));
    for (const e of s.episodes) { const x = eps.get(e.id); if (!x || e.savedAt > x.savedAt) eps.set(e.id, e); }
    const template = !cur.template || (s.template && s.template.savedAt > cur.template.savedAt) ? s.template ?? cur.template : cur.template;
    const chars = new Map((cur.characters ?? []).map((c) => [c.height, c]));
    for (const c of s.characters ?? []) if (!chars.has(c.height)) chars.set(c.height, c);
    const notes = new Map((cur.notes ?? []).map((n) => [n.id, n]));
    for (const n of s.notes ?? []) if (!notes.has(n.id)) notes.set(n.id, n);
    series.set(s.id, { ...cur, ...(notes.size ? { notes: [...notes.values()].sort((x, y) => x.at - y.at) } : {}), ...(template ? { template } : {}), ...(chars.size ? { characters: [...chars.values()] } : {}), episodes: [...eps.values()].sort((x, y) => x.savedAt - y.savedAt) });
  }
  const casts = new Map(a.casts.map((c) => [c.id, c]));
  for (const c of b.casts) if (!casts.has(c.id)) casts.set(c.id, c);
  return { series: [...series.values()], casts: [...casts.values()] };
}

const migratedKey = (userId: string) => `toon-studio-migrated-${userId}`;
export const isMigrated = (userId: string) => { try { return localStorage.getItem(migratedKey(userId)) === "1"; } catch { return false; } };
export const markMigrated = (userId: string) => { try { localStorage.setItem(migratedKey(userId), "1"); } catch { /* ignore */ } };

/** Template = the episode's structure (cast, BITMAP locations, camera, timing, format, effects) without its dialogue. */
export function toTemplate(ep: ToonEpisode): ToonEpisode {
  return { ...structuredClone(ep), scenes: ep.scenes.map((sc) => ({ ...structuredClone(sc), lines: [] })) };
}

/** Starts the next episode of a series from its template. */
export function episodeFromTemplate(series: ToonSeries): ToonEpisode | null {
  if (!series.template) return null;
  return { ...structuredClone(series.template.episode), title: `${series.name} — EP${series.episodes.length + 1}` };
}

export const MAX_VERSIONS = 10;
/** Edits within this window fold into one version so autosave doesn't flood the history. */
export const VERSION_WINDOW_MS = 60_000;

/** Autosave: stores the new copy and moves the previous saved copy into the version history. */
export function autosaveEpisode(lib: ToonLibrary, seriesId: string, id: string, episode: ToonEpisode, now: number): ToonLibrary {
  return {
    ...lib,
    series: lib.series.map((s) => {
      if (s.id !== seriesId) return s;
      return {
        ...s,
        episodes: s.episodes.map((e) => {
          if (e.id !== id) return e;
          const hist = e.history ?? [];
          const last = hist[hist.length - 1];
          const prev = { savedAt: e.savedAt, episode: e.episode };
          const next = last && prev.savedAt - last.savedAt < VERSION_WINDOW_MS ? hist : [...hist, prev].slice(-MAX_VERSIONS);
          return { ...e, savedAt: now, episode, history: next };
        }),
      };
    }),
  };
}

/** Notes tagged with a Guardian (by BITMAP block); null = every note. */
export const notesFor = (notes: ContinuityNote[], guardian: number | null) =>
  guardian === null ? notes : notes.filter((n) => n.guardians?.includes(guardian));

import raw from "@/lib/vendor/bitmap-pixels-catalog.json";
// dev9 wears MM-9, BOP wears DG - 9 (added to STARRED_SERIES below).

export type PixelItem = { number: number; name: string; id: string; artist: string };

/** The 4,320-entry BITMAP Pixels inscription gallery supplied by the community (number, name, inscription id, series). */
export const PIXELS: PixelItem[] = (raw as [number, string, string, string][]).map(([number, name, id, artist]) => ({ number, name, id, artist }));

/** Series each starred Biternam character's skin comes from (matched by series name). */
export const STARRED_SERIES: Record<string, string> = {
  wierdamoto: "V for Vendetta",
  dabber: "Ninja Dabber",
  "mr-shiddy": "MrShiddy3D",
  kodro: "DJ Kodro - 9 by Urbannoki",
  "mr-gold": "Mr. gold 1/1 by Urbannoki",
  "john-wick": "Jhon Wick",
  iman: "DeWayn NextHustle (NXH)",
  will: "Bitcoin Dude",
  bitoshi: "ThanosGob",
  jahbooble: "Goose Avatar",
  sunset: "Green Eyed King",
  limitless: "Limitless",
  curator: "Astral Arkitekt by @shanghaicrypto",
  "elon-x": "Elon",
  bukele: "Nayib Bukele by urbannoki",
  "kane-mayfield": "Kane Mayfield Genesis",
  batman: "Batman",
  deadpool: "Deadpool",
  "donald-x": "Donald",
};

/** Crew ids starring a given series. */
export function starsOf(artist: string): string[] {
  return Object.entries(STARRED_SERIES).filter(([, a]) => a === artist).map(([k]) => k);
}

export function filterPixels(items: PixelItem[], q: string, artist: string, starredOnly: boolean): PixelItem[] {
  const s = q.trim().toLowerCase();
  const starred = new Set(Object.values(STARRED_SERIES));
  return items.filter((i) =>
    (!artist || i.artist === artist) &&
    (!starredOnly || starred.has(i.artist)) &&
    (!s || i.name.toLowerCase().includes(s) || i.artist.toLowerCase().includes(s) || String(i.number) === s || i.id.startsWith(s)));
}

export const ARTISTS: { artist: string; count: number }[] = (() => {
  const m = new Map<string, number>();
  for (const p of PIXELS) m.set(p.artist, (m.get(p.artist) ?? 0) + 1);
  return [...m].map(([artist, count]) => ({ artist, count })).sort((a, b) => b.count - a.count);
})();

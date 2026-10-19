// Release Kit: platform-ready titles, descriptions, chapters and hashtags for
// YouTube, Shorts, TikTok and X, built only from the episode's real scenes.
import type { ToonEpisode } from "@/lib/toon-script";

export type Platform = "youtube" | "shorts" | "tiktok" | "x";
export type Channels = { youtube: string; tiktok: string; x: string };

const KEY = "bitmapwin.release.channels";
const SITE = "https://bitmapwin.app";

export function loadChannels(): Channels {
  try { return { youtube: "", tiktok: "", x: "", ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { youtube: "", tiktok: "", x: "" }; }
}
export function saveChannels(c: Channels) { localStorage.setItem(KEY, JSON.stringify(c)); }

/** Normalise a handle or URL to "@handle"; returns "" for anything unusable. */
export function cleanHandle(v: string): string {
  const s = v.trim().replace(/^https?:\/\/(www\.)?(youtube\.com|tiktok\.com|x\.com|twitter\.com)\//i, "").replace(/^@/, "").split(/[/?#]/)[0] ?? "";
  return /^[A-Za-z0-9._-]{2,40}$/.test(s) ? `@${s}` : "";
}

export function channelUrl(p: keyof Channels, handle: string) {
  const h = cleanHandle(handle); if (!h) return "";
  return p === "youtube" ? `https://www.youtube.com/${h}` : p === "tiktok" ? `https://www.tiktok.com/${h}` : `https://x.com/${h.slice(1)}`;
}

const stamp = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function chapters(ep: ToonEpisode): string[] {
  let t = 0;
  return ep.scenes.map((s, i) => { const line = `${stamp(t)} Scene ${i + 1} · ${s.block}.BITMAP`; t += s.duration; return line; });
}

const BASE_TAGS = ["Bitmap", "Bitcoin", "Ordinals", "BitmapWin", "VoxelArt"];
const PLATFORM_TAGS: Record<Platform, string[]> = {
  youtube: ["Animation", "BitcoinArt"], shorts: ["Shorts", "Animation"], tiktok: ["fyp", "animation", "3d"], x: [],
};
export const hashtags = (p: Platform) => [...BASE_TAGS, ...PLATFORM_TAGS[p]].map((t) => `#${t}`).join(" ");

export function releaseTitle(ep: ToonEpisode, p: Platform) {
  const t = ep.title.trim() || "Toon episode";
  if (p === "shorts") return `${t} #Shorts`.slice(0, 100);
  if (p === "youtube") return `${t} | BITMAP Toon on Bitcoin`.slice(0, 100);
  return t;
}

export function releaseDescription(ep: ToonEpisode, p: Platform, ch: Channels): string {
  const blocks = [...new Set(ep.scenes.map((s) => s.block))];
  const cast = [...new Set(ep.scenes.flatMap((s) => s.cast.map((c) => c.name).filter(Boolean)))];
  const credit = [ch.youtube && `YouTube ${cleanHandle(ch.youtube)}`, ch.tiktok && `TikTok ${cleanHandle(ch.tiktok)}`, ch.x && `X ${cleanHandle(ch.x)}`].filter(Boolean).join(" · ");
  if (p === "tiktok" || p === "x") {
    const s = `${ep.title} — filmed on ${blocks.map((b) => `${b}.bitmap`).join(", ")} 🟧 Make yours: ${SITE}/toon ${hashtags(p)}`;
    return s.slice(0, p === "x" ? 280 : 2200);
  }
  return [
    `${ep.title} — a Toon Studio episode filmed on real BITMAP land on Bitcoin.`,
    "",
    "CHAPTERS", ...chapters(ep), "",
    "FILMED ON", ...blocks.map((b) => `${b}.bitmap → ${SITE}/bitmap/${b}`), "",
    ...(cast.length ? ["STARRING", cast.join(", "), ""] : []),
    ...(credit ? ["CREATOR", credit, ""] : []),
    `Make your own: ${SITE}/toon`, "",
    hashtags(p),
  ].join("\n").slice(0, 5000);
}

export const UPLOAD_URL: Record<Platform, string> = {
  youtube: "https://studio.youtube.com/",
  shorts: "https://studio.youtube.com/",
  tiktok: "https://www.tiktok.com/upload",
  x: "https://x.com/compose/post",
};

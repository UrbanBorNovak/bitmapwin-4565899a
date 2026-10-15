/**
 * INSCRIBED WORLDS — recursive HTML 3D worlds (e.g. Inscribed.space) that live
 * on a BITMAP as a child or as a reinscription on its sat. Detection is pure
 * and reads only the inscription's own HTML; nothing here trusts the browser.
 */

export type WorldEngine = "inscribed.space" | "html3d";

export type WorldInfo = {
  engine: WorldEngine;
  title: string | null;
  description: string | null;
  backgroundId: string | null;
};

const ID = /[0-9a-f]{64}i\d+/;

export function detectInscribedWorld(html: string): WorldInfo | null {
  if (!html || html.length < 40) return null;
  const head = html.slice(0, 200_000);
  const title = head.match(/<title>([^<]{0,120})<\/title>/i)?.[1]?.trim() || null;
  const description = head.match(/<meta\s+name="description"\s+content="([^"]{0,240})"/i)?.[1]?.trim() || null;
  const bg = head.match(/worldBackground\s*=\s*["']\/content\/([0-9a-f]{64}i\d+)["']/)?.[1] ?? null;

  const isInscribedSpace =
    /Built with Inscribed\.space/i.test(head) || (/\bworldData\s*=/.test(head) && /<canvas[^>]+id="application"/.test(head));
  if (isInscribedSpace) return { engine: "inscribed.space", title, description, backgroundId: bg };

  // Generic recursive 3D world: a canvas + at least two recursive /content scripts.
  const recursiveScripts = head.match(/<script[^>]+src="\/content\/[0-9a-f]{64}i\d+"/g)?.length ?? 0;
  if (/<canvas/i.test(head) && recursiveScripts >= 2) return { engine: "html3d", title, description, backgroundId: bg };
  return null;
}

/** Accepts a raw id or any ordinals URL containing one. */
export function normalizeWorldId(input: string): string | null {
  return input.trim().toLowerCase().match(ID)?.[0] ?? null;
}

export const worldContentUrl = (id: string) => `https://ordinals.com/content/${id}`;
export const worldInscriptionUrl = (id: string) => `https://ordinals.com/inscription/${id}`;
export const WORLD_ENGINE_LABEL: Record<WorldEngine, string> = {
  "inscribed.space": "INSCRIBED.SPACE",
  html3d: "RECURSIVE 3D HTML",
};

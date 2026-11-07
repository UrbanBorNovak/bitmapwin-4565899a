/**
 * BITMAP Webrings: rings are derived only from public BITMAP pages that holders
 * actually saved. No sign-up, no stored ring rows — membership is the page itself.
 */
export type RingPage = { height: number; kind: string; title: string | null };
export type Ring = { slug: string; name: string; blurb: string; members: number[] };

const KIND_NAMES: Record<string, string> = {
  myspace: "MySpace '06 Ring",
  info: "Info Page Ring",
  gallery: "Gallery Ring",
  game3d: "3D Game Ring",
  game2d: "2D Game Ring",
  shop: "Shop Ring",
};

export const ERA_SIZE = 210_000;

/** Build kind rings + halving-era rings, each ordered by block height. */
export function buildRings(pages: RingPage[]): Ring[] {
  const byKind = new Map<string, Set<number>>();
  const byEra = new Map<number, Set<number>>();
  for (const p of pages) {
    if (!Number.isInteger(p.height) || p.height < 0) continue;
    (byKind.get(p.kind) ?? byKind.set(p.kind, new Set()).get(p.kind)!).add(p.height);
    const era = Math.floor(p.height / ERA_SIZE);
    (byEra.get(era) ?? byEra.set(era, new Set()).get(era)!).add(p.height);
  }
  const sorted = (s: Set<number>) => [...s].sort((a, b) => a - b);
  const rings: Ring[] = [];
  for (const [kind, s] of byKind) {
    rings.push({ slug: `kind-${kind}`, name: KIND_NAMES[kind] ?? `${kind} Ring`, blurb: `Every BITMAP with a saved ${kind} page.`, members: sorted(s) });
  }
  for (const [era, s] of [...byEra].sort((a, b) => a[0] - b[0])) {
    const lo = era * ERA_SIZE;
    rings.push({ slug: `era-${era}`, name: `Era ${era} Settlers`, blurb: `Built BITMAPs from block ${lo.toLocaleString("en-US")} to ${(lo + ERA_SIZE - 1).toLocaleString("en-US")}.`, members: sorted(s) });
  }
  return rings.sort((a, b) => b.members.length - a.members.length);
}

/** Circular neighbours: next after the last wraps to the first. */
export function ringNeighbours(members: number[], height: number) {
  const i = members.indexOf(height);
  if (i < 0 || members.length === 0) return null;
  const n = members.length;
  return { prev: members[(i - 1 + n) % n] as number, next: members[(i + 1) % n] as number };
}

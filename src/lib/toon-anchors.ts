// Screen anchors for Toon Studio speech bubbles: the 3D stage writes each Guardian's head
// position (0..1 of the stage canvas) every frame; the 2D overlay reads it to place bubbles.
export interface HeadAnchor { x: number; y: number; scene: number }
export const toonHeads = new Map<number, HeadAnchor>();
/** Emote icon circles: centre (0..1) and radius as a fraction of stage height. */
export const toonEmotes = new Map<number, HeadAnchor & { r: number }>();

export interface Rect { x: number; y: number; w: number; h: number }

/** Places a w×h bubble near the head at (hx,hy), inside the frame and clear of `taken` rects
 * (earlier bubbles, emote icons). Tries above, then above each obstacle, then the sides, then below;
 * if every spot collides it takes the one with the least overlap. */
export function placeBubble(hx: number, hy: number, w: number, h: number, W: number, H: number, gap: number, margin: number, taken: Rect[]): Rect {
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const fit = (x: number, y: number): Rect => ({ x: clamp(x, margin, Math.max(margin, W - margin - w)), y: clamp(y, margin, Math.max(margin, H - margin - h)), w, h });
  const overlap = (a: Rect) => taken.reduce((s, r) => s + Math.max(0, Math.min(a.x + a.w, r.x + r.w) - Math.max(a.x, r.x)) * Math.max(0, Math.min(a.y + a.h, r.y + r.h) - Math.max(a.y, r.y)), 0);
  const cx = hx - w / 2, pad = margin / 2;
  const cands: Rect[] = [fit(cx, hy - gap - h)];
  for (const r of taken) cands.push(fit(cx, r.y - h - pad), fit(r.x - w - pad, hy - gap - h), fit(r.x + r.w + pad, hy - gap - h));
  cands.push(fit(hx - w - gap, hy - h / 2), fit(hx + gap, hy - h / 2));
  for (const r of taken) cands.push(fit(cx, r.y + r.h + pad));
  let best = cands[0]!, bestO = Infinity;
  for (const c of cands) { const o = overlap(c); if (o === 0) return c; if (o < bestO) { bestO = o; best = c; } }
  return best;
}

// Screen anchors for Toon Studio speech bubbles: the 3D stage writes each Guardian's head
// position (0..1 of the stage canvas) every frame; the 2D overlay reads it to place bubbles.
export interface HeadAnchor { x: number; y: number; scene: number }
export const toonHeads = new Map<number, HeadAnchor>();
/** Emote icon circles: centre (0..1) and radius as a fraction of stage height. */
export const toonEmotes = new Map<number, HeadAnchor & { r: number }>();

export interface Rect { x: number; y: number; w: number; h: number }

/** Places a w×h bubble above the head at (hx,hy), kept inside the frame and off already-placed bubbles. */
export function placeBubble(hx: number, hy: number, w: number, h: number, W: number, H: number, gap: number, margin: number, taken: Rect[]): Rect {
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const x = clamp(hx - w / 2, margin, Math.max(margin, W - margin - w));
  let y = clamp(hy - gap - h, margin, Math.max(margin, H - margin - h));
  for (let i = 0; i < 6; i++) {
    const hit = taken.find((r) => x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y);
    if (!hit) break;
    const down = hit.y + hit.h + margin / 2;
    y = down + h <= H - margin ? down : clamp(hit.y - h - margin / 2, margin, H - margin - h);
  }
  return { x, y, w, h };
}

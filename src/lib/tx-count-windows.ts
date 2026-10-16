/** Upstream returns 15 consecutive blocks ending at `top`. Pick the fewest tops covering every height. */
export const WINDOW = 15;
export function planWindows(heights: number[]): number[] {
  const sorted = [...new Set(heights)].sort((a, b) => b - a);
  const tops: number[] = [];
  for (const h of sorted) {
    const last = tops[tops.length - 1];
    if (last !== undefined && h > last - WINDOW) continue;
    tops.push(h);
  }
  return tops;
}

/** Split heights into request-sized chunks, newest first. */
export function chunkHeights(heights: number[], size: number): number[][] {
  const s = [...heights].sort((a, b) => b - a);
  const out: number[][] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}

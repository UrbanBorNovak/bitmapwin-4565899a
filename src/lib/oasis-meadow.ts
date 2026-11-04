/**
 * OASIS MEADOW MODE — device-local storybook look (soft cyan sky, clover turf,
 * cream paths, warm sun). Stored only in this browser; changes no world data.
 */
export const MEADOW_KEY = "bitmapwin:oasis-meadow";
export const MEADOW_EVENT = "bitmapwin:oasis-meadow-change";

export const MEADOW = {
  sky: "#9fd3f2",
  sand: "#f5efd4",
  forest: "#7cc26a",
  grid: "#b9d9a8",
} as const;

export function readMeadow(): boolean {
  try { return localStorage.getItem(MEADOW_KEY) === "1"; } catch { return false; }
}

export function writeMeadow(on: boolean) {
  try { localStorage.setItem(MEADOW_KEY, on ? "1" : "0"); } catch { /* blocked */ }
  window.dispatchEvent(new Event(MEADOW_EVENT));
}

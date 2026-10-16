// Device-local page size preference (same effect as browser zoom).
export const UI_SCALE_KEY = "bitmapwin.uiScale";
export const UI_SCALES = [1, 1.25, 1.5] as const;

export function loadUiScale(): number {
  if (typeof window === "undefined") return 1;
  const v = Number(localStorage.getItem(UI_SCALE_KEY));
  return (UI_SCALES as readonly number[]).includes(v) ? v : 1;
}

export function applyUiScale(scale: number) {
  if (typeof document === "undefined") return;
  (document.documentElement.style as CSSStyleDeclaration & { zoom: string }).zoom = scale === 1 ? "" : String(scale);
}

export function saveUiScale(scale: number) {
  localStorage.setItem(UI_SCALE_KEY, String(scale));
  applyUiScale(scale);
}

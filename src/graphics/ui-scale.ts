// Device-local page size preference (same effect as browser zoom).
export const UI_SCALE_KEY = "bitmapwin.uiScale";
export const UI_SCALES = [1, 1.25, 1.5] as const;

export const DEFAULT_UI_SCALE = 1.5;
/** Narrowest layout width (CSS px after zoom) the site is designed for. */
export const MIN_LAYOUT_WIDTH = 360;

export function loadUiScale(): number {
  if (typeof window === "undefined") return DEFAULT_UI_SCALE;
  const raw = localStorage.getItem(UI_SCALE_KEY);
  const v = Number(raw);
  return raw !== null && (UI_SCALES as readonly number[]).includes(v) ? v : DEFAULT_UI_SCALE;
}

/** Zoom actually applied: never so large that the page is laid out narrower than MIN_LAYOUT_WIDTH. */
export function effectiveUiScale(scale: number, viewportWidth: number): number {
  const cap = viewportWidth / MIN_LAYOUT_WIDTH;
  return Math.max(1, Math.min(scale, cap));
}

let wanted = DEFAULT_UI_SCALE;
let listening = false;
function paint() {
  const s = effectiveUiScale(wanted, window.innerWidth);
  (document.documentElement.style as CSSStyleDeclaration & { zoom: string }).zoom = s === 1 ? "" : String(Math.round(s * 1000) / 1000);
}

export function applyUiScale(scale: number) {
  if (typeof document === "undefined") return;
  wanted = scale;
  paint();
  if (!listening) { listening = true; window.addEventListener("resize", paint); }
}

export function saveUiScale(scale: number) {
  localStorage.setItem(UI_SCALE_KEY, String(scale));
  applyUiScale(scale);
}

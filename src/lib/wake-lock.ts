/**
 * Screen Wake Lock for long scans: while held, the OS won't sleep or dim the
 * display. Browsers drop the lock when the tab is hidden, so it is re-acquired
 * on return. Unsupported browsers simply report "unsupported".
 */
export type WakeStatus = "off" | "active" | "unsupported" | "denied";

type Sentinel = { released: boolean; release(): Promise<void>; addEventListener(t: "release", f: () => void): void };
let sentinel: Sentinel | null = null;
let wanted = false;
let status: WakeStatus = "off";
const listeners = new Set<() => void>();
const emit = (s: WakeStatus) => { status = s; listeners.forEach((l) => l()); };

export const wakeStatus = () => status;
export function onWakeChange(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

async function acquire() {
  const wl = (navigator as unknown as { wakeLock?: { request(t: "screen"): Promise<Sentinel> } }).wakeLock;
  if (!wl) return emit("unsupported");
  if (document.visibilityState !== "visible" || (sentinel && !sentinel.released)) return;
  try {
    sentinel = await wl.request("screen");
    sentinel.addEventListener("release", () => { sentinel = null; if (!wanted) emit("off"); });
    if (!wanted) { await sentinel.release(); return; }
    emit("active");
  } catch { emit("denied"); }
}

let bound = false;
export function setWakeLock(on: boolean) {
  if (typeof window === "undefined" || on === wanted) return;
  wanted = on;
  if (!bound) {
    bound = true;
    document.addEventListener("visibilitychange", () => { if (wanted && document.visibilityState === "visible") void acquire(); });
  }
  if (on) void acquire();
  else { void sentinel?.release(); sentinel = null; emit("off"); }
}

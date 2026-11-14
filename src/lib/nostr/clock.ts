import { serverNowFn } from "./clock.functions";

let offsetMs = 0;
let synced: Promise<void> | null = null;

/** Offset to add to the device clock; ignore tiny drift and half-RTT noise. */
export function clockOffset(deviceBefore: number, server: number, deviceAfter: number) {
  const mid = (deviceBefore + deviceAfter) / 2;
  const off = server - mid;
  return Math.abs(off) < 5000 ? 0 : Math.round(off);
}

export function syncClock(force = false) {
  if (synced && !force) return synced;
  synced = (async () => {
    try {
      const a = Date.now();
      const { now } = await serverNowFn();
      offsetMs = clockOffset(a, now, Date.now());
    } catch { /* keep previous offset */ }
  })();
  return synced;
}

/** Network-corrected unix seconds. */
export const nostrNow = () => Math.floor((Date.now() + offsetMs) / 1000);
export const clockSkewMs = () => offsetMs;

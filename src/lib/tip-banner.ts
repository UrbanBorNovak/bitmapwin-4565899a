/**
 * Celebration banner after a tip. Device-local: the banner only appears on the
 * tipper's own screen, because a browser-reported tip cannot be proven to others.
 */
import { useEffect, useState } from "react";

export const TIP_BANNER_MS = 15_000;
export const QUICK_TIP_SATS = 1000;
/** Lightning Address that receives Café TV and Jumbotron tips. */
export const CAFE_TIP_ADDRESS = "inspiringupliftment32114@getalby.com";

export type TipBanner = { name: string; sats: number; screen: "cafe" | "launch"; at: number };

let current: TipBanner | null = null;
const subs = new Set<() => void>();

/** Short, safe display name; blank becomes "Anonymous Bitmapper". */
export function tipName(raw: string): string {
  const clean = raw.replace(/[^\p{L}\p{N}@._\- ]/gu, "").trim().slice(0, 24);
  return clean || "Anonymous Bitmapper";
}

export function tipLine(b: Pick<TipBanner, "name" | "sats">): string {
  return `⚡ ${b.name} tipped ${b.sats.toLocaleString("en-US")} sats!`;
}

export function bannerLive(b: TipBanner | null, now: number): boolean {
  return !!b && now - b.at < TIP_BANNER_MS;
}

export function celebrateTip(name: string, sats: number, screen: TipBanner["screen"]) {
  current = { name: tipName(name), sats: Math.max(1, Math.floor(sats)), screen, at: Date.now() };
  subs.forEach((f) => f());
}

export function useTipBanner(screen: TipBanner["screen"]): TipBanner | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    subs.add(f);
    const i = setInterval(f, 1000);
    return () => { subs.delete(f); clearInterval(i); };
  }, []);
  return current && current.screen === screen && bannerLive(current, Date.now()) ? current : null;
}

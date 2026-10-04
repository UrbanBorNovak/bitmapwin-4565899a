/**
 * On-chain sky events. The chain tip drives the Oasis sky:
 * - a new block → lightning strike
 * - the last 72 blocks before / first 72 after a difficulty adjustment → Blood Moon
 * Other systems (roars, cannon volleys) can call strikeLightning().
 */
const EVENT = "bitmap:lightning";

export const isBloodMoonHeight = (h: number) => {
  if (!Number.isFinite(h) || h <= 0) return false;
  const m = h % 2016;
  return m >= 2016 - 72 || m <= 72;
};

export function strikeLightning(epic = false) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { epic } }));
}

export function onLightning(fn: (epic: boolean) => void) {
  const h = (e: Event) => fn(Boolean((e as CustomEvent).detail?.epic));
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}

/** Polls the real chain tip; calls back on every height change. */
export function watchTip(fn: (height: number, isNew: boolean) => void) {
  let last = 0;
  let alive = true;
  const tick = async () => {
    try {
      const r = await fetch("https://mempool.space/api/blocks/tip/height");
      const h = Number(await r.text());
      if (alive && Number.isFinite(h) && h > 0 && h !== last) {
        fn(h, last > 0);
        last = h;
      }
    } catch {
      /* offline — keep the sky as it is */
    }
  };
  void tick();
  const id = window.setInterval(tick, 45_000);
  return () => {
    alive = false;
    window.clearInterval(id);
  };
}

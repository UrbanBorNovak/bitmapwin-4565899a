/**
 * DAMAGE VEIL — what a hit feels like, not just what it costs.
 *
 * A bite or a bullet punches a red vignette across the edges of the view, snaps
 * the world a few pixels off centre for a fraction of a second, and blurs the
 * screen slightly while it settles. Below a quarter health the edges keep a slow
 * heartbeat so the danger is felt without reading the health bar, and being
 * knocked out desaturates everything.
 *
 * Everything is painted from an animation frame onto two elements, so nothing
 * re-renders React and nothing allocates per frame.
 */

import { useEffect, useRef } from "react";

type Props = {
  /** current health, 0–100 */
  hp: number;
  maxHp: number;
  /** timestamp of the latest hit taken (Date.now) */
  hitAt: number;
  /** damage of that hit, for how hard the screen kicks */
  lastDamage: number;
  /** the element holding the 3D view — it is the thing that shakes */
  shakeTarget?: React.RefObject<HTMLElement | null>;
};

/** how long one hit reaction lasts, ms */
const REACT_MS = 620;

export function DamageVeil({ hp, maxHp, hitAt, lastDamage, shakeTarget }: Props) {
  const veil = useRef<HTMLDivElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const state = useRef({ hp, maxHp, hitAt, lastDamage });
  state.current = { hp, maxHp, hitAt, lastDamage };

  useEffect(() => {
    let frame = 0;
    const paint = () => {
      frame = requestAnimationFrame(paint);
      const veilEl = veil.current;
      const flashEl = flash.current;
      if (!veilEl || !flashEl) return;
      const { hp: health, maxHp: max, hitAt: at, lastDamage: damage } = state.current;

      const since = at ? Date.now() - at : Number.POSITIVE_INFINITY;
      const hit = since < REACT_MS ? 1 - since / REACT_MS : 0;
      const bite = Math.min(1, Math.max(0.35, damage / 20));
      const down = health <= 0;
      const low = health > 0 ? Math.max(0, 1 - health / (max * 0.25)) : 1;
      const beat = low > 0 ? (Math.sin(Date.now() / 380) * 0.5 + 0.5) * low * 0.45 : 0;

      // Edge vignette: a punch on the hit, a heartbeat when badly hurt.
      veilEl.style.opacity = String(Math.min(1, hit * bite * 0.95 + beat + (down ? 0.55 : 0)));
      // A brief full-screen wash on the heaviest hits only.
      flashEl.style.opacity = String(hit * hit * bite * 0.28);

      const target = shakeTarget?.current;
      if (target) {
        if (hit > 0) {
          const kick = hit * hit * (6 + damage * 0.7);
          const t = Date.now() / 22;
          target.style.transform = `translate3d(${Math.sin(t) * kick}px, ${Math.cos(t * 1.4) * kick * 0.7}px, 0) rotate(${Math.sin(t * 0.8) * hit * 0.5}deg)`;
          target.style.filter = `saturate(${1 + hit * 0.5}) blur(${hit * 1.4}px)`;
        } else if (target.style.transform) {
          target.style.transform = "";
          target.style.filter = down ? "grayscale(0.85) brightness(0.8)" : "";
        } else if (down) {
          target.style.filter = "grayscale(0.85) brightness(0.8)";
        } else if (target.style.filter) {
          target.style.filter = "";
        }
      }
    };
    frame = requestAnimationFrame(paint);
    return () => {
      cancelAnimationFrame(frame);
      const target = shakeTarget?.current;
      if (target) {
        target.style.transform = "";
        target.style.filter = "";
      }
    };
  }, [shakeTarget]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[45] overflow-hidden" aria-hidden>
      <div
        ref={veil}
        className="absolute inset-0"
        style={{
          opacity: 0,
          background:
            "radial-gradient(ellipse at center, transparent 38%, rgba(180,18,18,0.45) 78%, rgba(120,0,0,0.9) 100%)",
          transition: "opacity 90ms linear",
        }}
      />
      <div
        ref={flash}
        className="absolute inset-0"
        style={{ opacity: 0, background: "rgba(200,30,30,1)" }}
      />
    </div>
  );
}

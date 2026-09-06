/**
 * DAMAGE / HEAL VEIL — what a hit feels like, not just what it costs.
 *
 * A bite or a bullet punches a red vignette across the edges of the view and
 * snaps the view a few pixels off centre for a fraction of a second. Below a
 * quarter health the edges keep a slow heartbeat, and being knocked out
 * desaturates everything.
 *
 * Healing reads the other way: a green vignette rises with how much health came
 * back, so a big heal glows and a slow trickle only breathes.
 *
 * Everything is painted from an animation frame onto overlay elements. The 3D
 * view itself is never given a CSS `filter` — a blur or saturate on the element
 * that holds the WebGL canvas forces a full-surface re-composite every frame and
 * tanks the frame rate exactly while you are trying to run away. Only a cheap
 * transform is applied, and only while a hit is actually reacting.
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
const REACT_MS = 520;
/** how long one heal reaction lasts, ms */
const HEAL_MS = 900;

export function DamageVeil({ hp, maxHp, hitAt, lastDamage, shakeTarget }: Props) {
  const veil = useRef<HTMLDivElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const heal = useRef<HTMLDivElement>(null);
  const state = useRef({ hp, maxHp, hitAt, lastDamage });
  state.current = { hp, maxHp, hitAt, lastDamage };

  // Healing is derived, not reported: any rise in health is a heal, and how big
  // the rise was decides how strongly the green reads.
  const healState = useRef({ last: hp, at: 0, amount: 0 });
  useEffect(() => {
    const previous = healState.current.last;
    healState.current.last = hp;
    if (hp > previous && previous > 0) {
      healState.current.at = Date.now();
      // share of maximum health restored by this step, 0–1
      healState.current.amount = Math.min(1, (hp - previous) / Math.max(1, maxHp));
    }
  }, [hp, maxHp]);

  useEffect(() => {
    let frame = 0;
    let shaking = false;
    const paint = () => {
      frame = requestAnimationFrame(paint);
      const veilEl = veil.current;
      const flashEl = flash.current;
      const healEl = heal.current;
      if (!veilEl || !flashEl || !healEl) return;
      const { hp: health, maxHp: max, hitAt: at, lastDamage: damage } = state.current;
      const now = Date.now();

      const since = at ? now - at : Number.POSITIVE_INFINITY;
      const hit = since < REACT_MS ? 1 - since / REACT_MS : 0;
      const bite = Math.min(1, Math.max(0.35, damage / 20));
      const down = health <= 0;
      const low = health > 0 ? Math.max(0, 1 - health / (max * 0.25)) : 1;
      const beat = low > 0 ? (Math.sin(now / 380) * 0.5 + 0.5) * low * 0.45 : 0;

      // Edge vignette: a punch on the hit, a heartbeat when badly hurt.
      veilEl.style.opacity = String(Math.min(1, hit * bite * 0.9 + beat + (down ? 0.55 : 0)));
      // A brief full-screen wash on the heaviest hits only.
      flashEl.style.opacity = String(hit * hit * bite * 0.24);

      // REGENERATION — green glow, scaled by the share of health restored. A
      // 3% trickle barely breathes; a full-health pickup washes the edges.
      const healSince = healState.current.at ? now - healState.current.at : Number.POSITIVE_INFINITY;
      const healing = healSince < HEAL_MS ? 1 - healSince / HEAL_MS : 0;
      const share = healState.current.amount;
      // percent healed drives the tone: small sips stay faint, big heals bloom
      const strength = Math.min(1, 0.18 + share * 3.4);
      const breathe = Math.sin((1 - healing) * Math.PI) * 0.6 + healing * 0.4;
      healEl.style.opacity = String(down ? 0 : healing * breathe * strength * 0.85);
      healEl.style.transform = `scale(${1 + healing * 0.05 * strength})`;

      const target = shakeTarget?.current;
      if (target) {
        if (hit > 0) {
          // A short, light kick. No filter — see the note at the top of the file.
          const kick = hit * hit * (4 + damage * 0.45);
          const t = now / 24;
          target.style.transform = `translate3d(${Math.sin(t) * kick}px, ${Math.cos(t * 1.4) * kick * 0.6}px, 0)`;
          shaking = true;
        } else if (shaking) {
          target.style.transform = "";
          shaking = false;
        }
        const wanted = down ? "grayscale(0.85) brightness(0.8)" : "";
        if (target.style.filter !== wanted) target.style.filter = wanted;
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
        ref={heal}
        className="absolute inset-0"
        style={{
          opacity: 0,
          background:
            "radial-gradient(ellipse at center, rgba(90,220,140,0.10) 20%, rgba(46,190,110,0.34) 72%, rgba(16,140,80,0.6) 100%)",
          transition: "opacity 120ms linear",
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

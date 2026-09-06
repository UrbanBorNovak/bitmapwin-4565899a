/**
 * DRIVE BLUR — the speed feel around the edges of the frame while driving.
 *
 * Reads the shared ride "rush" value each frame (never through React state, so
 * it costs nothing) and blends two layers: a soft edge smear that grows with
 * speed, and fine streaks rushing outward from the centre of the road ahead.
 */

import { useEffect, useRef } from "react";
import { vehicle } from "@/lib/world-vehicle";

export function DriveBlur({ active }: { active: boolean }) {
  const edge = useRef<HTMLDivElement>(null);
  const streaks = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) {
      if (edge.current) edge.current.style.opacity = "0";
      if (streaks.current) streaks.current.style.opacity = "0";
      return;
    }
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const rush = Math.max(0, Math.min(1, vehicle.rush));
      const soft = edge.current;
      const lines = streaks.current;
      if (soft) {
        soft.style.opacity = (rush * 0.9).toFixed(3);
        soft.style.backdropFilter = `blur(${(rush * 7).toFixed(2)}px)`;
        soft.style.setProperty("--hole", `${(46 - rush * 16).toFixed(1)}%`);
      }
      if (lines) {
        lines.style.opacity = (Math.max(0, rush - 0.25) * 0.85).toFixed(3);
        lines.style.transform = `scale(${(1 + rush * 0.5).toFixed(3)})`;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden>
      {/* Soft smear that only touches the edges of the frame, never the road ahead. */}
      <div
        ref={edge}
        className="absolute inset-0 opacity-0 transition-opacity duration-200"
        style={{
          // @ts-expect-error custom property drives the clear centre
          "--hole": "46%",
          WebkitMaskImage:
            "radial-gradient(ellipse 62% 58% at 50% 52%, transparent var(--hole), black 100%)",
          maskImage:
            "radial-gradient(ellipse 62% 58% at 50% 52%, transparent var(--hole), black 100%)",
        }}
      />
      {/* Fine streaks pulling out of the vanishing point. */}
      <div
        ref={streaks}
        className="absolute inset-[-25%] opacity-0"
        style={{
          background:
            "repeating-conic-gradient(from 0deg at 50% 52%, rgba(255,255,255,0.10) 0deg 0.5deg, transparent 0.5deg 2.6deg)",
          WebkitMaskImage:
            "radial-gradient(ellipse 55% 52% at 50% 52%, transparent 34%, black 82%)",
          maskImage: "radial-gradient(ellipse 55% 52% at 50% 52%, transparent 34%, black 82%)",
        }}
      />
    </div>
  );
}

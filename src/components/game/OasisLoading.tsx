/**
 * OASIS LOADING WINDOW — the curtain while the world assembles.
 *
 * Shown until the models and textures the first view needs have arrived. It
 * reports real progress from the asset loader, so the bar reflects work rather
 * than a timer, and it fades out instead of snapping away.
 */

import { useEffect, useState } from "react";
import { useProgress } from "@react-three/drei";
import oasisLogo from "@/assets/oasis-logo.png";

const LINES = [
  "READING BITMAP DISTRICTS",
  "UNPACKING INSCRIBED MODELS",
  "RAISING STRUCTURES",
  "SEEDING THE SAND",
];

export function OasisLoading() {
  const { progress, item } = useProgress();
  const [gone, setGone] = useState(false);
  const [line, setLine] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setLine((n) => (n + 1) % LINES.length), 1100);
    return () => window.clearInterval(timer);
  }, []);

  // The first view is ready as soon as progress reaches 100 once. Background
  // chunk streaming keeps the loader "active" forever after that, so the
  // curtain must never wait for it — and a hard ceiling covers a stalled asset.
  useEffect(() => {
    if (progress >= 100) {
      const timer = window.setTimeout(() => setGone(true), 520);
      return () => window.clearTimeout(timer);
    }
    const ceiling = window.setTimeout(() => setGone(true), 12_000);
    return () => window.clearTimeout(ceiling);
  }, [progress]);


  if (gone) return null;

  const pct = Math.max(4, Math.round(progress));

  return (
    <div
      className={`absolute inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-background transition-opacity duration-500 ${
        progress >= 100 ? "opacity-0" : "opacity-100"
      }`}
      role="status"
      aria-live="polite"
    >
      <img
        src={oasisLogo}
        alt="The Oasis"
        width={816}
        height={816}
        className="h-28 w-28 [image-rendering:pixelated]"
      />
      <div className="text-center font-mono">
        <div className="text-sm font-bold tracking-[0.35em] text-foreground" data-no-translate>
          THE OASIS
        </div>
        <div className="mt-1 text-[10px] tracking-[0.2em] text-muted-foreground">
          {LINES[line]}
        </div>
      </div>
      <div className="h-[6px] w-[min(280px,60vw)] border border-border bg-background">
        <div
          className="h-full bg-bitcoin transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="font-mono text-[10px] text-muted-foreground" data-no-translate>
        {pct}%{item ? " · LOADING" : ""}
      </div>
    </div>
  );
}

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
      className={`oasis-loader absolute inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-500 ${
        progress >= 100 ? "opacity-0" : "opacity-100"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="hud-panel w-[min(420px,calc(100%-2rem))] px-5 py-4 font-mono">
        <div className="flex items-center gap-4">
          <img
            src={oasisLogo}
            alt="The Oasis"
            width={816}
            height={816}
            className="h-16 w-16 shrink-0 [image-rendering:pixelated]"
          />
          <div className="min-w-0 flex-1">
            <div className="hud-telemetry-title" data-no-translate>
              THE OASIS // WORLD LINK
            </div>
            <div className="mt-1 truncate text-[10px] text-muted-foreground">
              {LINES[line]}
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-[9px] text-muted-foreground">
          <span>ASSET STREAM</span>
          <span className="hud-live" data-no-translate>{pct}%{item ? " · LINK ACTIVE" : " · READY"}</span>
        </div>
        <div className="mt-2 h-[5px] border border-border bg-background">
          <div
            className="h-full bg-bitcoin transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[8px] text-muted-foreground" data-no-translate>
          <span className="border-l border-signal pl-2">CHAIN / LIVE</span>
          <span className="border-l border-border pl-2">MODELS / LINKED</span>
          <span className="border-l border-border pl-2">WORLD / SYNC</span>
        </div>
      </div>
    </div>
  );
}

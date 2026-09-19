/**
 * SPRITE CRITTERS — animated pixel characters inscribed on Bitcoin.
 *
 * Each inscription is a sprite sheet laid out as a fixed grid. We step one row
 * of frames on a timer (no CSS steps() so the frame count can stay dynamic) and
 * hold still for anyone who asked the system to reduce motion.
 */

import { useEffect, useMemo, useRef, useState } from "react";

const CONTENT = "https://ordinals.com/content/";

export type SpriteSheet = {
  /** Ordinals inscription id of the sprite sheet PNG. */
  id: string;
  /** Friendly name used for the tooltip / alt text. */
  name: string;
  /** Sheet grid. */
  cols: number;
  rows: number;
  /** Row of the sheet to animate (0-based). */
  row: number;
  /** Frames used from that row — defaults to every column. */
  frames?: number;
  /** Milliseconds per frame. */
  speed?: number;
  /** Native frame size in pixels. */
  frameWidth: number;
  frameHeight: number;
};

/** The five inscribed characters that wander the site. */
export const SPRITES: SpriteSheet[] = [
  { id: "e1c65c82ec79b72f81718368d2c75f71ae1604c3309ab54f46aebe3366cc75e7i0", name: "GOOSE", cols: 3, rows: 2, row: 1, frameWidth: 76, frameHeight: 77, speed: 160 },
  { id: "ceb91002e6c1ba8c29fb1f78d3031c00ec9bd0f098f310c37e20635bcda4350ai0", name: "PLUMBER PEPE", cols: 3, rows: 4, row: 1, frameWidth: 157, frameHeight: 212, speed: 180 },
  { id: "2d434b7c00b697e4b4e97767d8784ac183e08e5c6e16d5ee240e6a4a510d62a0i0", name: "BUILDER PEPE", cols: 6, rows: 3, row: 1, frameWidth: 76, frameHeight: 88, speed: 150 },
  { id: "41d2ca443590e2980381b9af4b213d2028a88ca35c619961d9610893e5cb378ai0", name: "SUIT PEPE", cols: 5, rows: 4, row: 1, frames: 3, frameWidth: 77, frameHeight: 86, speed: 200 },
  { id: "a4eb035d90333c3d8a1a5b2be230ca5adddd6c786aa9a951ef5712f5edd68df2i0", name: "OFFICER PEPE", cols: 3, rows: 3, row: 1, frameWidth: 168, frameHeight: 234, speed: 220 },
];

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** One looping character, scaled to the given pixel height. */
export function SpriteCritter({
  sheet,
  height = 72,
  flip = false,
  className = "",
}: {
  sheet: SpriteSheet;
  height?: number;
  flip?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const frames = Math.max(1, Math.min(sheet.frames ?? sheet.cols, sheet.cols));
  const [frame, setFrame] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (reduced || frames < 2) return;
    const step = sheet.speed ?? 170;
    timer.current = window.setInterval(() => setFrame((f) => (f + 1) % frames), step);
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, [frames, reduced, sheet.speed]);

  const scale = height / sheet.frameHeight;
  const width = Math.round(sheet.frameWidth * scale);

  const style = useMemo(
    () => ({
      width,
      height,
      backgroundImage: `url(${CONTENT}${sheet.id})`,
      backgroundRepeat: "no-repeat" as const,
      backgroundSize: `${sheet.cols * width}px ${sheet.rows * height}px`,
      backgroundPosition: `${-frame * width}px ${-sheet.row * height}px`,
      imageRendering: "pixelated" as const,
      transform: flip ? "scaleX(-1)" : undefined,
    }),
    [frame, flip, height, sheet.cols, sheet.id, sheet.row, sheet.rows, width],
  );

  return <div role="img" aria-label={sheet.name} title={sheet.name} style={style} className={className} />;
}

/** A row of characters strolling across the page. */
export function SpriteParade({ height = 72 }: { height?: number }) {
  const reduced = useReducedMotion();
  return (
    <div
      className="relative overflow-hidden border-y border-border bg-background/60"
      aria-label="Inscribed pixel characters"
      data-no-translate
    >
      <div className="pointer-events-none flex items-end gap-6 px-4 py-4 sm:gap-10 md:px-8">
        {SPRITES.map((sheet, index) => (
          <div
            key={sheet.id}
            className={reduced ? "" : index % 2 === 0 ? "animate-sprite-stroll" : "animate-sprite-stroll-slow"}
            style={reduced ? undefined : { animationDelay: `${index * 0.45}s` }}
          >
            <SpriteCritter sheet={sheet} height={height} flip={index % 2 === 1} />
          </div>
        ))}
      </div>
    </div>
  );
}

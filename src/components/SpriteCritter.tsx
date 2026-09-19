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

/** The inscribed characters that wander the site. */
export const SPRITES: SpriteSheet[] = [
  { id: "e1c65c82ec79b72f81718368d2c75f71ae1604c3309ab54f46aebe3366cc75e7i0", name: "GOOSE", cols: 3, rows: 2, row: 1, frameWidth: 76, frameHeight: 77, speed: 160 },
  { id: "ceb91002e6c1ba8c29fb1f78d3031c00ec9bd0f098f310c37e20635bcda4350ai0", name: "PLUMBER PEPE", cols: 3, rows: 4, row: 1, frameWidth: 157, frameHeight: 212, speed: 180 },
  { id: "2d434b7c00b697e4b4e97767d8784ac183e08e5c6e16d5ee240e6a4a510d62a0i0", name: "BUILDER PEPE", cols: 6, rows: 3, row: 1, frameWidth: 76, frameHeight: 88, speed: 150 },
  { id: "41d2ca443590e2980381b9af4b213d2028a88ca35c619961d9610893e5cb378ai0", name: "SUIT PEPE", cols: 5, rows: 4, row: 1, frames: 3, frameWidth: 77, frameHeight: 86, speed: 200 },
  { id: "a4eb035d90333c3d8a1a5b2be230ca5adddd6c786aa9a951ef5712f5edd68df2i0", name: "OFFICER PEPE", cols: 3, rows: 3, row: 1, frameWidth: 168, frameHeight: 234, speed: 220 },
  { id: "b70e2a60a23b4dc515b0733ded675c2ef56be623f3f2452282c3c3685d65a18bi0", name: "DOCKHAND PEPE", cols: 3, rows: 3, row: 1, frameWidth: 91, frameHeight: 109, speed: 180 },
  { id: "74afe9607a7acaa82f28f9a73cacaf19285ebf5964c9dba69738b06549a902e4i0", name: "OASIS GUARD", cols: 6, rows: 2, row: 1, frames: 3, frameWidth: 196, frameHeight: 208, speed: 165 },
  { id: "5cfc3acbf3715c45281f3d07c12f687aa39584c6e44f4faa9d432420f3c74754i0", name: "CROWNED PEPE", cols: 3, rows: 3, row: 1, frameWidth: 168, frameHeight: 189, speed: 190 },
];

const STREET_SHEET = "6d405ea56303d7795f6b86a9e72724363d956be542a7586424e44f7687420d46i0";

type StreetProp = {
  name: string;
  crop: readonly [number, number, number, number];
  width: number;
};

type ComicPiece =
  | { kind: "sprite"; index: number; height?: number; flip?: boolean }
  | { kind: "prop"; index: number; className?: string };

type ComicScene = {
  chapter: string;
  line: string;
  pieces: readonly ComicPiece[];
};

const STREET_PROPS = [
  { name: "MARKET KIOSK", crop: [8, 8, 184, 184], width: 76 },
  { name: "STREET VENDOR", crop: [216, 8, 120, 160], width: 48 },
  { name: "OASIS TREE", crop: [360, 8, 56, 152], width: 25 },
  { name: "STONE MONUMENT", crop: [432, 16, 136, 152], width: 58 },
  { name: "WHITE GOOSE", crop: [584, 16, 112, 152], width: 44 },
  { name: "OASIS SHOP", crop: [8, 208, 280, 216], width: 108 },
  { name: "BLUE STREET SIGN", crop: [312, 208, 56, 184], width: 25 },
  { name: "BITMAP SIGN", crop: [400, 184, 288, 240], width: 112 },
] as const satisfies readonly StreetProp[];

const COMIC_SCENES: readonly ComicScene[] = [
  {
    chapter: "01 // THE SIGNAL",
    line: "A NEW BITMAP IS FORMING ON BITCOIN…",
    pieces: [
      { kind: "prop", index: 2 },
      { kind: "sprite", index: 0, height: 54 },
      { kind: "sprite", index: 5, height: 76 },
      { kind: "prop", index: 6 },
      { kind: "sprite", index: 6, height: 82, flip: true },
    ],
  },
  {
    chapter: "02 // THE PLAN",
    line: "THE OASIS GATHERS AROUND THE NEXT BLOCK.",
    pieces: [
      { kind: "sprite", index: 3, height: 72 },
      { kind: "prop", index: 7 },
      { kind: "sprite", index: 7, height: 84, flip: true },
      { kind: "prop", index: 3 },
      { kind: "sprite", index: 4, height: 82, flip: true },
    ],
  },
  {
    chapter: "03 // THE BUILD",
    line: "BUILDERS PREPARE THE STREET BEFORE CONFIRMATION.",
    pieces: [
      { kind: "prop", index: 0 },
      { kind: "sprite", index: 1, height: 78 },
      { kind: "sprite", index: 2, height: 72, flip: true },
      { kind: "prop", index: 1 },
      { kind: "sprite", index: 5, height: 74, flip: true },
    ],
  },
  {
    chapter: "04 // THE ARRIVAL",
    line: "ONE BLOCK CLOSES. A NEW WORLD OPENS.",
    pieces: [
      { kind: "prop", index: 5 },
      { kind: "sprite", index: 0, height: 50 },
      { kind: "sprite", index: 2, height: 70 },
      { kind: "sprite", index: 7, height: 82, flip: true },
      { kind: "sprite", index: 6, height: 78, flip: true },
      { kind: "prop", index: 4 },
    ],
  },
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

function StreetProp({ prop, className = "" }: { prop: StreetProp; className?: string }) {
  const [x, y, cropWidth, cropHeight] = prop.crop;
  const scale = prop.width / cropWidth;
  return (
    <div
      role="img"
      aria-label={prop.name}
      title={prop.name}
      className={className}
      style={{
        width: prop.width,
        height: Math.round(cropHeight * scale),
        backgroundImage: `url(${CONTENT}${STREET_SHEET})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${704 * scale}px ${432 * scale}px`,
        backgroundPosition: `${-x * scale}px ${-y * scale}px`,
        imageRendering: "pixelated",
      }}
    />
  );
}

/** A living, centered comic whose composition changes as Bitcoin advances. */
export function SpriteParade({ height = 72 }: { height?: number }) {
  const reduced = useReducedMotion();
  const [sceneIndex, setSceneIndex] = useState(0);
  const [nextBlock, setNextBlock] = useState<number | null>(null);

  useEffect(() => {
    if (reduced) return;
    const timerId = window.setTimeout(
      () => setSceneIndex((sceneIndex + 1) % COMIC_SCENES.length),
      9_000,
    );
    return () => window.clearTimeout(timerId);
  }, [reduced, sceneIndex]);

  useEffect(() => {
    let active = true;
    const refreshTip = async () => {
      try {
        const response = await fetch("https://mempool.space/api/blocks/tip/height");
        const tip = Number(await response.text());
        if (active && response.ok && Number.isFinite(tip)) setNextBlock(tip + 1);
      } catch {
        // The story remains useful when a public indexer is briefly unavailable.
      }
    };
    void refreshTip();
    const timerId = window.setInterval(refreshTip, 60_000);
    return () => {
      active = false;
      window.clearInterval(timerId);
    };
  }, []);

  const scene = COMIC_SCENES[sceneIndex] ?? COMIC_SCENES[0];
  if (!scene) return null;

  return (
    <div
      className="relative overflow-hidden border-y border-border bg-background/60 px-3 py-5 sm:px-6"
      aria-label="Living story of inscribed pixel characters"
      data-sprite-parade
    >
      <div className="mx-auto flex max-w-5xl items-end justify-between gap-4 border-b border-border pb-3 font-mono text-[10px]">
        <span className="text-bitcoin">{scene.chapter}</span>
        <span className="text-right text-muted-foreground" data-no-translate>
          {nextBlock ? `AWAITING ${nextBlock}.BITMAP` : "AWAITING NEXT BITMAP"}
        </span>
      </div>

      <div key={sceneIndex} className={reduced ? "" : "animate-comic-scene"}>
        <div className="pointer-events-none mx-auto flex min-h-32 max-w-5xl items-end justify-center gap-3 overflow-hidden px-1 pt-5 sm:gap-8 md:gap-12">
          {scene.pieces.map((piece, index) => {
            if (piece.kind === "prop") {
              const prop = STREET_PROPS[piece.index];
              return prop ? (
                <StreetProp
                  key={`prop-${piece.index}-${index}`}
                  prop={prop}
                  className={`shrink-0 opacity-90 ${piece.className ?? ""}`}
                />
              ) : null;
            }
            const sheet = SPRITES[piece.index];
            return sheet ? (
              <div
                key={`sprite-${piece.index}-${index}`}
                className={reduced ? "shrink-0" : `shrink-0 ${index % 2 === 0 ? "animate-sprite-stroll" : "animate-sprite-stroll-slow"}`}
                style={reduced ? undefined : { animationDelay: `${index * 0.45}s` }}
              >
                <SpriteCritter
                  sheet={sheet}
                  height={Math.min(piece.height ?? height, height + 12)}
                  flip={piece.flip ?? index % 2 === 1}
                />
              </div>
            ) : null;
          })}
        </div>
        <p className="mx-auto mt-2 min-h-5 max-w-xl text-center font-mono text-[10px] font-bold text-foreground sm:text-xs">
          {scene.line}
        </p>
      </div>

      <div className="mt-4 flex justify-center gap-2" aria-hidden="true">
        {COMIC_SCENES.map((item, index) => (
          <span key={item.chapter} className={`h-1 w-7 ${index === sceneIndex ? "bg-bitcoin" : "bg-border-strong"}`} />
        ))}
      </div>
    </div>
  );
}

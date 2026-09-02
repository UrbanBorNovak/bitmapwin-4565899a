import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

import { MASCOT_THOUGHTS, mascotLineForPath, onMascot, type MascotMood } from "@/lib/mascot";

/**
 * Pixel stickman companion. It roams the bottom edge of the page, pauses to
 * think, and reacts briefly when something important happens. Purely
 * decorative: pointer events off, hidden from assistive tech, and it stands
 * still when the visitor prefers reduced motion.
 */

const UNIT = 3; // pixel size
const W = 16;
const H = 22;
const SPRITE_W = W * UNIT;

type Rect = [x: number, y: number, w: number, h: number];

const HEAD: Rect[] = [
  [6, 1, 4, 1],
  [5, 2, 1, 3],
  [10, 2, 1, 3],
  [6, 5, 4, 1],
];

const TORSO: Rect[] = [[7, 6, 2, 7]];

const ARMS_WALK: Rect[] = [
  [4, 8, 3, 1],
  [9, 9, 3, 1],
];

const ARMS_THINK: Rect[] = [
  [4, 9, 3, 1],
  [9, 6, 1, 3],
  [9, 5, 2, 1],
];

const ARMS_CHEER: Rect[] = [
  [4, 5, 1, 3],
  [4, 4, 2, 1],
  [11, 5, 1, 3],
  [10, 4, 2, 1],
];

const LEGS_A: Rect[] = [
  [6, 13, 1, 4],
  [9, 13, 1, 4],
  [5, 17, 2, 1],
  [9, 17, 2, 1],
];

const LEGS_B: Rect[] = [
  [4, 13, 1, 2],
  [5, 15, 1, 2],
  [5, 17, 2, 1],
  [10, 13, 1, 2],
  [11, 15, 1, 2],
  [10, 17, 2, 1],
];

function Pixels({ rects, className }: { rects: Rect[]; className?: string }) {
  return (
    <g className={className}>
      {rects.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill="currentColor" />
      ))}
    </g>
  );
}

type Pose = "walk" | "think" | "cheer";

function Sprite({ pose, frame }: { pose: Pose; frame: number }) {
  const arms = pose === "think" ? ARMS_THINK : pose === "cheer" ? ARMS_CHEER : ARMS_WALK;
  const legs = pose === "walk" && frame === 1 ? LEGS_B : LEGS_A;
  return (
    <svg
      width={SPRITE_W}
      height={H * UNIT}
      viewBox={`0 0 ${W} ${H}`}
      shapeRendering="crispEdges"
      className="text-foreground"
    >
      <Pixels rects={HEAD} />
      <Pixels rects={TORSO} />
      <Pixels rects={arms} />
      <Pixels rects={legs} />
      {/* single orange pixel: the eye / signal lamp */}
      <rect x={8} y={3} width={1} height={1} className="text-primary" fill="currentColor" />
    </svg>
  );
}

export function MascotStickman() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [x, setX] = useState(24);
  const [duration, setDuration] = useState(0);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [pose, setPose] = useState<Pose>("think");
  const [frame, setFrame] = useState(0);
  const [bubble, setBubble] = useState<string | null>(null);

  const timers = useRef<number[]>([]);
  const bubbleTimer = useRef<number | undefined>(undefined);

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  };

  const say = (text: string, mood: MascotMood, ms = 4200) => {
    setBubble(text);
    setPose(mood === "cheer" ? "cheer" : "think");
    window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setBubble(null), ms);
  };

  // Mount: respect reduced motion and start near the left edge.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    setX(Math.min(48, Math.max(16, window.innerWidth * 0.08)));
    setReady(true);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Roaming loop.
  useEffect(() => {
    if (!ready || reduced) return;
    let cancelled = false;

    const step = () => {
      if (cancelled) return;
      const max = Math.max(24, window.innerWidth - SPRITE_W - 16);
      const target = 16 + Math.random() * (max - 16);
      setX((prev) => {
        const dx = target - prev;
        setFacing(dx >= 0 ? 1 : -1);
        setDuration(Math.min(5200, Math.max(1100, (Math.abs(dx) / 70) * 1000)));
        return target;
      });
      setPose("walk");

      later(() => {
        if (cancelled) return;
        setPose("think");
        if (Math.random() < 0.55) {
          const thought = MASCOT_THOUGHTS[Math.floor(Math.random() * MASCOT_THOUGHTS.length)]!;
          say(thought, "think", 3800);
        }
        later(step, 3200 + Math.random() * 5200);
      }, 5300);
    };

    const first = later(step, 2600);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
  }, [ready, reduced]);

  // Leg cycle while walking.
  useEffect(() => {
    if (pose !== "walk" || reduced) return;
    const id = window.setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), 170);
    return () => window.clearInterval(id);
  }, [pose, reduced]);

  // React to navigation.
  useEffect(() => {
    if (!ready) return;
    say(mascotLineForPath(pathname), "think", 3600);
  }, [pathname, ready]);

  // React to app events.
  useEffect(() => onMascot(({ text, mood }) => say(text, mood, mood === "alert" ? 6000 : 4600)), []);

  useEffect(() => () => window.clearTimeout(bubbleTimer.current), []);

  if (!ready) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-1 left-0 z-20 hidden select-none sm:block"
      style={{
        transform: `translate3d(${Math.round(x)}px, 0, 0)`,
        transition: reduced ? "none" : `transform ${duration}ms linear`,
        willChange: "transform",
      }}
    >
      <div className="relative" style={{ width: SPRITE_W }}>
        {bubble ? (
          <div className="absolute bottom-full left-1/2 mb-1 w-max max-w-[46vw] -translate-x-1/2 animate-fade-in border border-border bg-background/95 px-2 py-1 font-mono text-[10px] uppercase leading-tight tracking-wider text-muted-foreground shadow-sm">
            {bubble}
          </div>
        ) : null}
        <div style={{ transform: `scaleX(${facing})` }}>
          <Sprite pose={pose} frame={frame} />
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { seededRandom, type Game2dConfig } from "@/lib/build-sdk";

type Cell = { x: number; y: number };

const COLS = 24;
const ROWS = 16;

/**
 * A tiny deterministic maze-run arcade. The maze and coin layout come from the
 * bitmap height, so every visitor plays the same block.
 */
export function Game2DBuild({ config, height }: { config: Game2dConfig; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(config.coins);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rand = seededRandom(height + config.coins * 31 + config.walls * 7);
    const walls = new Set<string>();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (x === 0 && y === 0) continue;
        if (rand() * 100 < config.walls) walls.add(`${x},${y}`);
      }
    }
    const coins: Cell[] = [];
    let guard = 0;
    while (coins.length < config.coins && guard++ < 2000) {
      const x = Math.floor(rand() * COLS);
      const y = Math.floor(rand() * ROWS);
      const key = `${x},${y}`;
      if (walls.has(key) || (x === 0 && y === 0)) continue;
      if (coins.some((c) => c.x === x && c.y === y)) continue;
      coins.push({ x, y });
    }
    setTotal(coins.length);
    setScore(0);

    const player: Cell = { x: 0, y: 0 };
    const collected = new Set<string>();
    let raf = 0;

    const cell = () => canvas.width / COLS;

    function draw() {
      const size = cell();
      const styles = getComputedStyle(canvas);
      ctx.fillStyle = styles.getPropertyValue("--bg-fill") || "#0a0a0a";
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#232323";
      walls.forEach((k) => {
        const [x, y] = k.split(",").map(Number);
        ctx.fillRect(x * size, y * size, size - 1, size - 1);
      });

      ctx.fillStyle = "#f7931a";
      coins.forEach((c) => {
        if (collected.has(`${c.x},${c.y}`)) return;
        ctx.beginPath();
        ctx.arc(c.x * size + size / 2, c.y * size + size / 2, size * 0.22, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(player.x * size + 2, player.y * size + 2, size - 5, size - 5);
      raf = requestAnimationFrame(draw);
    }

    function move(dx: number, dy: number) {
      const nx = Math.min(COLS - 1, Math.max(0, player.x + dx));
      const ny = Math.min(ROWS - 1, Math.max(0, player.y + dy));
      if (walls.has(`${nx},${ny}`)) return;
      player.x = nx;
      player.y = ny;
      const key = `${nx},${ny}`;
      if (coins.some((c) => c.x === nx && c.y === ny) && !collected.has(key)) {
        collected.add(key);
        setScore(collected.size);
      }
    }

    function onKey(e: KeyboardEvent) {
      const map: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        w: [0, -1],
        s: [0, 1],
        a: [-1, 0],
        d: [1, 0],
      };
      const dir = map[e.key];
      if (!dir) return;
      e.preventDefault();
      setRunning(true);
      move(dir[0], dir[1]);
    }

    canvas.addEventListener("keydown", onKey);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("keydown", onKey);
    };
  }, [config.coins, config.walls, config.speed, height]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="display text-sm">{config.title.toUpperCase()}</span>
        <span className="label">
          {score}/{total} COINS · {running ? "RUNNING" : "CLICK THE BOARD, THEN ARROWS / WASD"}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={COLS * 24}
        height={ROWS * 24}
        tabIndex={0}
        aria-label={`2D arcade build on ${height}.bitmap`}
        className="w-full rounded-md border border-border outline-none focus:border-primary"
      />
    </div>
  );
}

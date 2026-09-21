import { useEffect, useRef, useState } from "react";

import { seededRandom } from "@/lib/build-sdk";
import { colorForVisitor, mapHandle, mapVisitorId } from "@/lib/map-identity";
import { useRunPresence } from "@/lib/arcade-presence";
import { cn } from "@/lib/utils";

/**
 * BLOCK RUN — a tiny shared-screen platformer. The level is generated from a
 * Bitcoin block height, so everybody who opens the same block runs the same
 * course, and everyone in it sees each other move in real time.
 */

type Platform = { x: number; y: number; w: number; h: number };
type Coin = { x: number; y: number };

const VIEW_W = 960;
const VIEW_H = 540;
const GROUND_Y = 470;
const GRAVITY = 2400;
const RUN_SPEED = 330;
const JUMP_V = 860;
const BODY = 26;

function buildLevel(height: number) {
  const rand = seededRandom(height + 7);
  const platforms: Platform[] = [];
  const coins: Coin[] = [];
  let x = 260;
  let y = GROUND_Y - 90;
  while (x < 3400) {
    const w = 90 + Math.floor(rand() * 150);
    platforms.push({ x, y, w, h: 16 });
    if (rand() > 0.35) coins.push({ x: x + w / 2, y: y - 34 });
    x += w + 70 + Math.floor(rand() * 130);
    y = Math.max(160, Math.min(GROUND_Y - 60, y + (rand() - 0.5) * 190));
  }
  for (let i = 0; i < 8; i++) coins.push({ x: 180 + i * 420, y: GROUND_Y - 40 });
  return { platforms, coins, finishX: x + 120 };
}

export default function BlockRun({ height }: { height: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keys = useRef({ left: false, right: false, jump: false });
  const [coins, setCoins] = useState(0);
  const [totalCoins, setTotalCoins] = useState(0);
  const [finished, setFinished] = useState(false);
  const [online, setOnline] = useState(0);

  const { peers, peersRef, selfRef } = useRunPresence(String(height));
  const peersList = peers;

  useEffect(() => setOnline(peers.length), [peers.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const level = buildLevel(height);
    setTotalCoins(level.coins.length);
    setCoins(0);
    setFinished(false);

    const me = {
      x: 60,
      y: GROUND_Y - BODY,
      vx: 0,
      vy: 0,
      grounded: true,
      face: 1 as 1 | -1,
      coins: 0,
      done: false,
    };
    const taken = new Set<number>();
    const selfId = mapVisitorId();
    const selfColor = colorForVisitor(selfId);
    const selfHandle = mapHandle();

    let camera = 0;
    let last = performance.now();
    let raf = 0;

    const onKey = (event: KeyboardEvent, down: boolean) => {
      const k = event.key.toLowerCase();
      if (k === "arrowleft" || k === "a") keys.current.left = down;
      else if (k === "arrowright" || k === "d") keys.current.right = down;
      else if (k === " " || k === "arrowup" || k === "w") keys.current.jump = down;
      else return;
      event.preventDefault();
    };
    const downHandler = (e: KeyboardEvent) => onKey(e, true);
    const upHandler = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", downHandler);
    window.addEventListener("keyup", upHandler);

    function step(dt: number) {
      const dir = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0);
      me.vx = dir * RUN_SPEED;
      if (dir !== 0) me.face = dir > 0 ? 1 : -1;
      if (keys.current.jump && me.grounded) {
        me.vy = -JUMP_V;
        me.grounded = false;
      }
      me.vy += GRAVITY * dt;
      me.x = Math.max(0, Math.min(level.finishX + 200, me.x + me.vx * dt));

      const nextY = me.y + me.vy * dt;
      me.grounded = false;
      // ground
      if (nextY + BODY >= GROUND_Y) {
        me.y = GROUND_Y - BODY;
        me.vy = 0;
        me.grounded = true;
      } else {
        me.y = nextY;
        // platforms: landing only, so jumping up through one feels forgiving
        if (me.vy > 0) {
          for (const p of level.platforms) {
            const overlap = me.x + BODY > p.x && me.x < p.x + p.w;
            const crossed = me.y + BODY >= p.y && me.y + BODY <= p.y + 22;
            if (overlap && crossed) {
              me.y = p.y - BODY;
              me.vy = 0;
              me.grounded = true;
              break;
            }
          }
        }
      }

      level.coins.forEach((coin, index) => {
        if (taken.has(index)) return;
        if (Math.abs(coin.x - (me.x + BODY / 2)) < 24 && Math.abs(coin.y - (me.y + BODY / 2)) < 28) {
          taken.add(index);
          me.coins = taken.size;
          setCoins(taken.size);
        }
      });

      if (!me.done && me.x > level.finishX) {
        me.done = true;
        setFinished(true);
      }

      selfRef.current = { x: me.x, y: me.y, face: me.face, coins: me.coins, finished: me.done };
      camera += (Math.max(0, me.x - VIEW_W * 0.4) - camera) * Math.min(1, dt * 6);
    }

    function draw() {
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);
      const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      sky.addColorStop(0, "#1b2436");
      sky.addColorStop(1, "#2c3627");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      ctx.save();
      ctx.translate(-camera, 0);

      // distant hills, drawn from the same seed feel as the world
      ctx.fillStyle = "rgba(120,150,110,0.22)";
      for (let i = 0; i < 16; i++) {
        const hx = i * 300 - (camera * 0.3 - camera);
        ctx.beginPath();
        ctx.ellipse(hx, GROUND_Y - 10, 220, 120, 0, Math.PI, 0);
        ctx.fill();
      }

      ctx.fillStyle = "#3a4a32";
      ctx.fillRect(-200, GROUND_Y, level.finishX + 800, VIEW_H);
      ctx.fillStyle = "#4d6040";
      ctx.fillRect(-200, GROUND_Y, level.finishX + 800, 8);

      ctx.fillStyle = "#6b7a5a";
      for (const p of level.platforms) {
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = "#87996f";
        ctx.fillRect(p.x, p.y, p.w, 3);
        ctx.fillStyle = "#6b7a5a";
      }

      ctx.fillStyle = "#f7931a";
      level.coins.forEach((coin, index) => {
        if (taken.has(index)) return;
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, 8, 0, Math.PI * 2);
        ctx.fill();
      });

      // finish banner
      ctx.fillStyle = "#22d3ee";
      ctx.fillRect(level.finishX, GROUND_Y - 120, 4, 120);
      ctx.fillRect(level.finishX, GROUND_Y - 120, 46, 26);

      const drawRunner = (
        x: number,
        y: number,
        color: string,
        label: string,
        dim: boolean,
      ) => {
        ctx.globalAlpha = dim ? 0.8 : 1;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, BODY, BODY);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(x + 4, y + 6, 5, 5);
        ctx.fillRect(x + BODY - 9, y + 6, 5, 5);
        ctx.globalAlpha = 1;
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillText(label.toUpperCase(), x + BODY / 2, y - 8);
      };

      for (const peer of peersRef.current.values()) {
        peer.rx += (peer.x - peer.rx) * 0.25;
        peer.ry += (peer.y - peer.ry) * 0.25;
        drawRunner(peer.rx, peer.ry, peer.color, peer.handle, true);
      }
      drawRunner(me.x, me.y, selfColor, selfHandle, false);

      ctx.restore();
    }

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(dt);
      draw();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", downHandler);
      window.removeEventListener("keyup", upHandler);
    };
  }, [height, peersRef, selfRef]);

  const hold = (key: "left" | "right" | "jump", down: boolean) => () => {
    keys.current[key] = down;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="display text-sm">BLOCK RUN · {height}.BITMAP</span>
        <span className="label text-muted-foreground">
          {coins}/{totalCoins} COINS · {online + 1} RUNNING
          {finished ? " · COURSE CLEARED" : ""}
        </span>
      </div>

      <canvas
        ref={canvasRef}
        width={VIEW_W}
        height={VIEW_H}
        aria-label={`Multiplayer platformer on ${height}.bitmap`}
        className="w-full rounded-md border border-border bg-background"
      />

      <div className="flex items-center justify-between gap-2 sm:hidden">
        <div className="flex gap-2">
          <PadKey label="◀" onHold={hold("left", true)} onRelease={hold("left", false)} />
          <PadKey label="▶" onHold={hold("right", true)} onRelease={hold("right", false)} />
        </div>
        <PadKey label="JUMP" strong onHold={hold("jump", true)} onRelease={hold("jump", false)} />
      </div>

      <div className="label hidden text-muted-foreground sm:block">
        ARROWS / A D TO RUN · SPACE OR W TO JUMP · REACH THE CYAN BANNER
      </div>

      {peersList.length > 0 ? (
        <ul className="grid gap-1 sm:grid-cols-2">
          {peersList.map((peer) => (
            <li key={peer.id} className="label flex items-center gap-2 border border-border px-2 py-1">
              <span className="h-2 w-2" style={{ backgroundColor: peer.color }} />
              <span className="truncate">{peer.handle}</span>
              <span className="ml-auto text-muted-foreground">
                {peer.coins} COINS{peer.finished ? " · CLEARED" : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="label text-muted-foreground">
          NOBODY ELSE ON THIS COURSE YET — SHARE THE LINK AND RUN IT TOGETHER
        </p>
      )}
    </div>
  );
}

function PadKey({
  label,
  onHold,
  onRelease,
  strong = false,
}: {
  label: string;
  onHold: () => void;
  onRelease: () => void;
  strong?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "grid place-items-center rounded-full border font-mono text-[10px] tracking-widest outline-none active:scale-95",
        strong
          ? "h-20 w-20 border-bitcoin bg-bitcoin/20 text-bitcoin"
          : "h-16 w-16 border-border bg-background/60 text-muted-foreground",
      )}
      style={{ touchAction: "none" }}
      onPointerDown={(event) => {
        event.preventDefault();
        onHold();
      }}
      onPointerUp={(event) => {
        onRelease();
        event.currentTarget.blur();
      }}
      onPointerCancel={() => onRelease()}
      onPointerLeave={() => onRelease()}
    >
      {label}
    </button>
  );
}

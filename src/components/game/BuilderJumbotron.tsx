import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Billboard } from "@react-three/drei";
import type { PlayerState } from "@/lib/player-state";
import { builderAvatar, fetchActiveBuilders, shortAddr, type ActiveBuilder } from "@/lib/forge-builders";

/**
 * Arena-style 4-sided jumbotron hanging high over the Oasis centre, cycling
 * the most active Land Forge builders. Fog-free so it reads from far away.
 */
const W = 1024, H = 576;

function paint(ctx: CanvasRenderingContext2D, b: ActiveBuilder | null, rank: number, total: number) {
  ctx.fillStyle = "#05070b"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#f7931a"; ctx.lineWidth = 10; ctx.strokeRect(5, 5, W - 10, H - 10);
  ctx.fillStyle = "#f7931a"; ctx.font = "bold 40px monospace";
  ctx.fillText("ACTIVE BUILDERS", 40, 70);
  ctx.fillStyle = "#4fd6e8"; ctx.font = "26px monospace";
  ctx.fillText(total ? `${rank + 1} / ${total}  ·  LAND FORGE` : "LAND FORGE", 40, 110);
  if (!b) {
    ctx.fillStyle = "#e8e8e8"; ctx.font = "bold 44px monospace";
    ctx.fillText("PUBLISH A PIECE AT /forge", 40, 300);
    ctx.font = "30px monospace"; ctx.fillStyle = "#9aa";
    ctx.fillText("THE FIRST BUILDER TAKES THIS SCREEN", 40, 360);
    return;
  }
  const { hue, cells } = builderAvatar(b.address);
  const s = 56, ox = 40, oy = 150;
  ctx.fillStyle = "#11151c"; ctx.fillRect(ox - 6, oy - 6, s * 5 + 12, s * 5 + 12);
  ctx.fillStyle = `hsl(${hue} 85% 55%)`;
  cells.forEach((on, i) => { if (on) ctx.fillRect(ox + (i % 5) * s, oy + Math.floor(i / 5) * s, s, s); });
  const tx = 380;
  ctx.fillStyle = "#f7931a"; ctx.font = "bold 34px monospace"; ctx.fillText(`#${rank + 1} BUILDER`, tx, 190);
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 46px monospace"; ctx.fillText(shortAddr(b.address), tx, 250);
  ctx.fillStyle = "#9aa"; ctx.font = "24px monospace"; ctx.fillText("NEWEST PIECE", tx, 320);
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 38px monospace"; ctx.fillText(b.latest.name.slice(0, 22).toUpperCase(), tx, 365);
  ctx.fillStyle = "#4fd6e8"; ctx.font = "28px monospace";
  ctx.fillText(`${b.latest.sphere.toUpperCase()} · ${b.latest.blocks} BLOCKS`, tx, 410);
  ctx.fillText(`${b.pieces} PIECES · ${b.uses} USES`, tx, 455);
}

function paintBoard(ctx: CanvasRenderingContext2D, list: ActiveBuilder[]) {
  ctx.fillStyle = "#05070b"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#4fd6e8"; ctx.lineWidth = 8; ctx.strokeRect(4, 4, W - 8, H - 8);
  ctx.fillStyle = "#4fd6e8"; ctx.font = "bold 42px monospace"; ctx.fillText("BUILDER LEADERBOARD", 40, 70);
  if (!list.length) { ctx.fillStyle = "#9aa"; ctx.font = "30px monospace"; ctx.fillText("NO PIECES YET — PUBLISH AT /forge", 40, 160); return; }
  list.slice(0, 6).forEach((b, i) => {
    const y = 140 + i * 70;
    const { hue, cells } = builderAvatar(b.address);
    ctx.fillStyle = `hsl(${hue} 85% 55%)`;
    cells.forEach((on, k) => { if (on) ctx.fillRect(110 + (k % 5) * 10, y - 40 + Math.floor(k / 5) * 10, 10, 10); });
    ctx.fillStyle = i === 0 ? "#f7931a" : "#ffffff"; ctx.font = "bold 36px monospace";
    ctx.fillText(`${i + 1}`, 40, y);
    ctx.fillText(shortAddr(b.address), 190, y);
    ctx.fillStyle = "#9aa"; ctx.font = "28px monospace";
    ctx.fillText(`${b.pieces}P · ${b.uses}U`, 720, y);
  });
}

export function BuilderJumbotron({ pose, surface }: { pose: React.MutableRefObject<PlayerState>; surface: (x: number, z: number) => number }) {
  const follow = useRef<THREE.Group>(null);
  const [builders, setBuilders] = useState<ActiveBuilder[]>([]);
  const [idx, setIdx] = useState(0);
  const spin = useRef<THREE.Group>(null);

  useEffect(() => {
    let live = true;
    const load = () => fetchActiveBuilders(10).then((b) => { if (live) setBuilders(b); }).catch(() => {});
    load();
    const poll = setInterval(load, 120_000);
    const cycle = setInterval(() => setIdx((i) => i + 1), 8_000);
    return () => { live = false; clearInterval(poll); clearInterval(cycle); };
  }, []);

  const { canvas, texture } = useMemo(() => {
    const c = typeof document !== "undefined" ? document.createElement("canvas") : null;
    if (c) { c.width = W; c.height = H; }
    const t = c ? new THREE.CanvasTexture(c) : null;
    if (t) t.colorSpace = THREE.SRGBColorSpace;
    return { canvas: c, texture: t };
  }, []);
  const board = useMemo(() => {
    const c = typeof document !== "undefined" ? document.createElement("canvas") : null;
    if (c) { c.width = W; c.height = H; }
    const t = c ? new THREE.CanvasTexture(c) : null;
    if (t) t.colorSpace = THREE.SRGBColorSpace;
    return { canvas: c, texture: t };
  }, []);
  useEffect(() => {
    const ctx = board.canvas?.getContext("2d");
    if (!ctx || !board.texture) return;
    paintBoard(ctx, builders);
    board.texture.needsUpdate = true;
  }, [builders, board]);
  useEffect(() => () => board.texture?.dispose(), [board]);

  useEffect(() => {
    const ctx = canvas?.getContext("2d");
    if (!ctx || !texture) return;
    const rank = builders.length ? idx % builders.length : 0;
    paint(ctx, builders[rank] ?? null, rank, builders.length);
    texture.needsUpdate = true;
  }, [builders, idx, canvas, texture]);

  useEffect(() => () => texture?.dispose(), [texture]);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.08;
    const g = follow.current, p = pose.current;
    if (!g) return;
    // Rides the sky above the walker so it is always overhead, never left behind.
    const k = 1 - Math.exp(-3 * Math.min(dt, 0.05));
    g.position.x += (p.x - g.position.x) * k;
    g.position.z += (p.z - g.position.z) * k;
    g.position.y += (surface(p.x, p.z) + ALT - g.position.y) * k;
  });

  if (!texture || !board.texture) return null;
  const sw = 6, sh = 3.4, half = sw / 2;
  return (
    <group ref={follow} renderOrder={10}>
      <group ref={spin}>
        <mesh>
          <boxGeometry args={[sw - 0.15, sh, sw - 0.15]} />
          <meshBasicMaterial color="#0a0c10" fog={false} />
        </mesh>
        {[0, 1, 2, 3].map((k) => (
          <group key={k} rotation={[0, (k * Math.PI) / 2, 0]}>
            <mesh position={[0, 0, half]} rotation={[-0.25, 0, 0]}>
              <planeGeometry args={[sw, sh]} />
              <meshBasicMaterial map={texture} toneMapped={false} fog={false} />
            </mesh>
          </group>
        ))}
        {[sh / 2 + 0.1, -sh / 2 - 0.1].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <boxGeometry args={[sw + 0.15, 0.12, sw + 0.15]} />
            <meshBasicMaterial color="#f7931a" toneMapped={false} fog={false} />
          </mesh>
        ))}
      </group>
      <Billboard position={[0, sh + 2.6, 0]}>
        <mesh>
          <planeGeometry args={[7, 3.94]} />
          <meshBasicMaterial map={board.texture} toneMapped={false} fog={false} side={THREE.DoubleSide} />
        </mesh>
      </Billboard>
    </group>
  );
}

const ALT = 9;

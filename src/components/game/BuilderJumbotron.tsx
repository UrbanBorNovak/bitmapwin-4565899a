import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
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

export function BuilderJumbotron({ center }: { center: [number, number, number] }) {
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

  useEffect(() => {
    const ctx = canvas?.getContext("2d");
    if (!ctx || !texture) return;
    const rank = builders.length ? idx % builders.length : 0;
    paint(ctx, builders[rank] ?? null, rank, builders.length);
    texture.needsUpdate = true;
  }, [builders, idx, canvas, texture]);

  useEffect(() => () => texture?.dispose(), [texture]);
  useFrame((_, dt) => { if (spin.current) spin.current.rotation.y += dt * 0.08; });

  if (!texture) return null;
  const sw = 16, sh = 9, half = sw / 2;
  return (
    <group position={center}>
      {/* suspension cables + ground beacon */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 4, 30, 0]}>
          <boxGeometry args={[0.08, 50, 0.08]} />
          <meshBasicMaterial color="#555" fog={false} />
        </mesh>
      ))}
      <mesh position={[0, -center[1] / 2, 0]}>
        <cylinderGeometry args={[0.15, 0.15, center[1], 6, 1, true]} />
        <meshBasicMaterial color="#4fd6e8" transparent opacity={0.35} fog={false} />
      </mesh>
      <group ref={spin}>
        <mesh>
          <boxGeometry args={[sw - 0.4, sh, sw - 0.4]} />
          <meshBasicMaterial color="#0a0c10" fog={false} />
        </mesh>
        {[0, 1, 2, 3].map((k) => (
          <group key={k} rotation={[0, (k * Math.PI) / 2, 0]}>
            <mesh position={[0, 0, half]} rotation={[-0.2, 0, 0]}>
              <planeGeometry args={[sw, sh]} />
              <meshBasicMaterial map={texture} toneMapped={false} fog={false} />
            </mesh>
          </group>
        ))}
        {[sh / 2 + 0.25, -sh / 2 - 0.25].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <boxGeometry args={[sw + 0.4, 0.3, sw + 0.4]} />
            <meshBasicMaterial color="#f7931a" toneMapped={false} fog={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Animated 2D painter of a bred pet (same on-chain voxel blueprint, slowly turning). */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { blueprint, type OnchainG } from "@/lib/onchain-guardian";

export function PetPortrait({ genome, size = 280 }: { genome: OnchainG; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const g = c.getContext("2d"); if (!g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.height = size * dpr;
    const V = blueprint(genome);
    const shades = new Map<string, [string, string, string]>();
    const col = new THREE.Color();
    for (const v of V) if (!shades.has(v[6])) {
      col.set(v[6]);
      shades.set(v[6], ["#" + col.clone().multiplyScalar(0.64).getHexString(), "#" + col.getHexString(), "#" + col.clone().lerp(new THREE.Color("#ffffff"), 0.2).getHexString()]);
    }
    let raf = 0;
    const draw = (t: number) => {
      const w = size * dpr, k = w / 34, a = t / 3000, ca = Math.cos(a), sa = Math.sin(a), bob = Math.sin(t / 400) * k * 0.4;
      g.clearRect(0, 0, w, w);
      const P = V.map((v) => ({ v, x: v[0] * ca - v[2] * sa, z: v[0] * sa + v[2] * ca })).sort((p, q) => p.z - q.z || p.v[1] - q.v[1]);
      for (const p of P) {
        const v = p.v, bw = Math.max(v[3], v[5]) * k * 0.9, bh = v[4] * k, s = shades.get(v[6])!;
        const px = w / 2 + p.x * k - bw / 2, py = w * 0.82 - (v[1] + p.z * 0.25) * k - bh / 2 + bob;
        g.fillStyle = s[0]; g.fillRect(px, py, bw, bh);
        g.fillStyle = s[1]; g.fillRect(px + bw * 0.12, py, bw * 0.76, bh);
        g.fillStyle = s[2]; g.fillRect(px, py, bw, Math.max(1, bh * 0.3));
        if (v[7]) { g.shadowColor = v[6]; g.shadowBlur = 10; g.fillRect(px, py, bw, bh * 0.3); g.shadowBlur = 0; }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [genome, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-label="Bred Guardian pet preview" />;
}

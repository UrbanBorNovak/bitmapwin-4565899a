/** 2D painter portrait of the on-chain voxel Guardian (same blueprint, ¾ projection, painter-sorted). */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { GuardianDna } from "@/lib/bitmon";
import { useQuery } from "@tanstack/react-query";
import { guardianDnaQuery } from "@/lib/bitmon-queries";
import { blueprint, onchainGenome } from "@/lib/onchain-guardian";

export function GuardianPortrait({ height, dna: given, size = 56, className = "" }: { height: number; dna?: GuardianDna; size?: number; className?: string }) {
  const q = useQuery({ ...guardianDnaQuery(height), enabled: !given, staleTime: Infinity });
  const dna = given ?? q.data;
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c || !dna) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.height = size * dpr;
    const g = c.getContext("2d"); if (!g) return;
    g.scale(dpr, dpr);
    const bg = g.createRadialGradient(size / 2, size * 0.45, 2, size / 2, size / 2, size * 0.7);
    bg.addColorStop(0, "#14203a"); bg.addColorStop(1, "#05080f");
    g.fillStyle = bg; g.fillRect(0, 0, size, size);
    const V = blueprint(onchainGenome(dna));
    const ca = Math.cos(0.6), sa = Math.sin(0.6);
    const P = V.map((v) => { const x = v[0] * ca - v[2] * sa, z = v[0] * sa + v[2] * ca; return { v, x, y: v[1], z }; }).sort((a, b) => a.z - b.z || a.y - b.y);
    const k = size / 30, ox = size / 2, oy = size * 0.88;
    const col = new THREE.Color();
    for (const p of P) {
      const w = Math.max(p.v[3], p.v[5]) * k * 0.9, h = p.v[4] * k;
      const px = ox + p.x * k - w / 2, py = oy - (p.y + p.z * 0.25) * k - h / 2;
      col.set(p.v[6]);
      g.fillStyle = "#" + col.clone().multiplyScalar(0.72).getHexString(); g.fillRect(px, py, w, h);
      g.fillStyle = "#" + col.clone().multiplyScalar(p.v[7] ? 1.3 : 1.1).getHexString(); g.fillRect(px, py, w, Math.max(1, h * 0.3));
      if (p.v[7]) { g.shadowColor = p.v[6]; g.shadowBlur = 6; g.fillRect(px, py, w, h); g.shadowBlur = 0; }
    }
    const rc = dna.rarity === "MYTHIC" ? "#fbbf24" : dna.rarity === "EPIC" ? "#c084fc" : dna.rarity === "RARE" ? "#60a5fa" : "#94a3b8";
    const rf = dna.rarity === "MYTHIC" ? 1 : dna.rarity === "EPIC" ? 0.75 : dna.rarity === "RARE" ? 0.5 : 0.25;
    g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(3, size - 6, size - 6, 3);
    g.fillStyle = rc; g.fillRect(3, size - 6, (size - 6) * rf, 3);
  }, [dna, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} className={`rounded-md border border-border ${className}`} aria-label={`${height}.BITMAP Guardian portrait`} />;
}

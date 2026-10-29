/// <reference lib="webworker" />
/** Walks server-assigned kangaroos and posts every distinguished point. */
import { pointFromHex } from "./kangaroo";
import { isDp, jumpSet, pointFor } from "./kangaroo-pool";

let running = false;
self.onmessage = async (e: MessageEvent) => {
  const m = e.data as { type: "stop" } | { type: "start"; pubHex: string; jumps: number; dpBits: number; starts: { tame: boolean; dHex: string }[] };
  if (m.type === "stop") { running = false; return; }
  running = true;
  const P = pointFromHex(m.pubHex);
  const { dist, pts } = jumpSet(m.jumps);
  const J = BigInt(m.jumps);
  const herd = m.starts.map((s) => { const d = BigInt("0x" + s.dHex); return { tame: s.tame, d, pt: pointFor(P, s.tame, d) }; });
  let steps = 0;
  const t0 = performance.now();
  while (running) {
    const dps: { xHex: string; tame: boolean; dHex: string }[] = [];
    for (let s = 0; s < 64; s++) for (const h of herd) {
      const x = h.pt.toAffine().x;
      if (isDp(x, m.dpBits)) dps.push({ xHex: x.toString(16), tame: h.tame, dHex: h.d.toString(16) });
      const j = Number(x % J);
      h.pt = h.pt.add(pts[j]!); h.d += dist[j]!; steps++;
    }
    self.postMessage({ type: "tick", steps, ms: performance.now() - t0, dps });
    await new Promise((r) => setTimeout(r, 0));
  }
};

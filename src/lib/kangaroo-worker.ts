/// <reference lib="webworker" />
import { solver, pointFromHex, cryptoRand } from "./kangaroo";

let running = false;
self.onmessage = async (e: MessageEvent) => {
  const m = e.data as { type: "start"; pubHex: string; loHex: string; hiHex: string; herd: number } | { type: "stop" };
  if (m.type === "stop") { running = false; return; }
  running = true;
  const s = solver(pointFromHex(m.pubHex), BigInt("0x" + m.loHex), BigInt("0x" + m.hiHex), m.herd, cryptoRand);
  const t0 = performance.now();
  while (running) {
    const k = s.step(64);
    self.postMessage({ type: "tick", steps: s.steps(), dps: s.dps(), ms: performance.now() - t0 });
    if (k !== null) { self.postMessage({ type: "found", keyHex: k.toString(16), steps: s.steps(), ms: performance.now() - t0 }); running = false; return; }
    await new Promise((r) => setTimeout(r, 0));
  }
};

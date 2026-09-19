import { useEffect, useState } from "react";

export type FpsSample = { fps: number; frameMs: number; drawCalls: number; triangles: number; pixelRatio: number };
let sample: FpsSample = { fps: 60, frameMs: 16.7, drawCalls: 0, triangles: 0, pixelRatio: 1 };
const listeners = new Set<() => void>();

export function reportFrame(deltaSeconds: number) {
  const ms = Math.min(deltaSeconds * 1000, 250);
  const frameMs = sample.frameMs * 0.9 + ms * 0.1;
  sample = { ...sample, frameMs, fps: 1000 / Math.max(1, frameMs) };
  for (const listener of listeners) listener();
}

export function reportRenderer(drawCalls: number, triangles: number, pixelRatio: number) {
  sample = { ...sample, drawCalls, triangles, pixelRatio };
}

export function fpsSnapshot() { return sample; }

export function useFps() {
  const [value, setValue] = useState(sample);
  useEffect(() => {
    const timer = window.setInterval(() => setValue(sample), 500);
    return () => window.clearInterval(timer);
  }, []);
  return value;
}
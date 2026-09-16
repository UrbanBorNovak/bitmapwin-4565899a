/**
 * WORLD PERF PROBE — measured numbers instead of guesses.
 *
 * Two things are timed: how long a chunk of the Oasis takes to arrive and be
 * folded into the world, and how long each frame takes while the player is
 * travelling fast or flying. Everything is kept in small fixed arrays, so the
 * probe itself never becomes the cost. `window.__oasisPerf.report()` prints a
 * summary from a browser session.
 */

type ChunkSample = { keys: number; ms: number; source: string };

const CHUNK_KEEP = 64;
const FRAME_KEEP = 600;

const chunkSamples: ChunkSample[] = [];
const frameSamples: number[] = [];
const flyFrameSamples: number[] = [];

export function markChunkLoad(source: string, keys: number, ms: number) {
  chunkSamples.push({ source, keys, ms });
  if (chunkSamples.length > CHUNK_KEEP) chunkSamples.shift();
}

export function markFrame(ms: number, flying: boolean) {
  frameSamples.push(ms);
  if (frameSamples.length > FRAME_KEEP) frameSamples.shift();
  if (flying) {
    flyFrameSamples.push(ms);
    if (flyFrameSamples.length > FRAME_KEEP) flyFrameSamples.shift();
  }
}

const stats = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  return {
    n: sorted.length,
    avg: +(sum / sorted.length).toFixed(2),
    p50: +sorted[Math.floor(sorted.length * 0.5)]!.toFixed(2),
    p95: +sorted[Math.floor(sorted.length * 0.95)]!.toFixed(2),
    max: +sorted[sorted.length - 1]!.toFixed(2),
  };
};

export function perfReport() {
  const bySource: Record<string, ReturnType<typeof stats>> = {};
  for (const source of new Set(chunkSamples.map((sample) => sample.source))) {
    bySource[source] = stats(
      chunkSamples.filter((sample) => sample.source === source).map((sample) => sample.ms),
    );
  }
  return {
    chunkLoadsMs: bySource,
    chunkKeysPerLoad: stats(chunkSamples.map((sample) => sample.keys)),
    frameMs: stats(frameSamples),
    flyingFrameMs: stats(flyFrameSamples),
  };
}

export function perfReset() {
  chunkSamples.length = 0;
  frameSamples.length = 0;
  flyFrameSamples.length = 0;
}

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>)["__oasisPerf"] = {
    report: perfReport,
    reset: perfReset,
  };
}

/**
 * One-shot practice run on the unfunded "test" pool: claim a 2^16-key slice,
 * scan it in the same Web Worker the #71 pool uses, then submit the canary
 * proof. Takes a few seconds; earns test-pool credit only.
 */
import { claimSliceFn, reportSliceFn } from "@/lib/puzzle-pool.functions";
import { canaryProof } from "@/lib/puzzle-pool";

export type TestRunResult = { ok: boolean; message: string; index?: string; canariesFound?: number; ms?: number };

export async function runTestSlice(worker: string, onStatus: (s: string) => void): Promise<TestRunResult> {
  onStatus("CLAIMING TEST SLICE…");
  const lease = await claimSliceFn({ data: { worker, pool: "test" } });
  if (!lease.ok) return { ok: false, message: lease.error };
  onStatus(`SCANNING TEST SLICE #${lease.index}`);
  const t0 = performance.now();
  const w = new Worker(new URL("./puzzle-worker.ts", import.meta.url), { type: "module" });
  const done = await new Promise<{ offset: number; hash: string; canaryKeys: string[] }>((resolve, reject) => {
    w.onmessage = (e) => { if (e.data.type === "slice-done") resolve(e.data); };
    w.onerror = (e) => reject(new Error(e.message || "worker failed"));
    w.postMessage({
      type: "start", startHex: lease.startHex, endHex: lease.endHex, duty: 1,
      target: lease.targetHash160.match(/../g)!.map((x) => parseInt(x, 16)),
      slice: { startHex: lease.startHex, size: lease.size, canaries: lease.canaryHash160 },
    });
  }).finally(() => w.terminate());
  const ms = Math.round(performance.now() - t0);
  onStatus("SUBMITTING PROOF…");
  const r = await reportSliceFn({ data: { pool: "test", index: lease.index, token: lease.token, canaryProof: canaryProof(done.canaryKeys) } });
  return r.ok
    ? { ok: true, message: `CREDITED · found ${done.canaryKeys.length}/3 trap keys in ${(ms / 1000).toFixed(1)}s`, index: lease.index, canariesFound: done.canaryKeys.length, ms }
    : { ok: false, message: r.error, index: lease.index, canariesFound: done.canaryKeys.length, ms };
}

/** Scout a BITMAP block's own #71 slice. A real #71 hit is handed to onFound. */
export async function runBlockSlice(worker: string, height: number, onStatus: (s: string) => void, onFound: (keyHex: string) => void,
  onProgress?: (p: { done: number; size: number; rate: number }) => void): Promise<TestRunResult> {
  onStatus(`CLAIMING ${height}.bitmap SECTOR…`);
  const lease = await claimSliceFn({ data: { worker, pool: "71", height } });
  if (!lease.ok) return { ok: false, message: lease.error };
  onStatus(`SCANNING SLICE #${lease.index}`);
  const t0 = performance.now();
  const w = new Worker(new URL("./puzzle-worker.ts", import.meta.url), { type: "module" });
  let scanned = 0;
  const done = await new Promise<{ canaryKeys: string[] }>((resolve, reject) => {
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === "found") onFound(m.keyHex);
      else if (m.type === "batch") {
        scanned += m.count;
        const secs = (performance.now() - t0) / 1000;
        onProgress?.({ done: scanned, size: lease.size, rate: secs > 0 ? scanned / secs : 0 });
      }
      else if (m.type === "slice-done") resolve(m);
    };
    w.onerror = (e) => reject(new Error(e.message || "worker failed"));
    w.postMessage({
      type: "start", startHex: lease.startHex, endHex: lease.endHex, duty: 1,
      target: lease.targetHash160.match(/../g)!.map((x) => parseInt(x, 16)),
      slice: { startHex: lease.startHex, size: lease.size, canaries: lease.canaryHash160 },
    });
  }).finally(() => w.terminate());
  const ms = Math.round(performance.now() - t0);
  onStatus("SUBMITTING PROOF…");
  const r = await reportSliceFn({ data: { pool: "71", index: lease.index, token: lease.token, canaryProof: canaryProof(done.canaryKeys) } });
  return r.ok
    ? { ok: true, message: `${height}.bitmap SCOUTED · 3/3 trap keys in ${(ms / 60000).toFixed(1)} min — badge is on the Jumbotron`, index: lease.index, ms }
    : { ok: false, message: r.error, index: lease.index, ms };
}

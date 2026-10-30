/// <reference lib="webworker" />
/**
 * Experimental WebGPU key scanner. Same message protocol as puzzle-worker.ts,
 * plus "gpu-ready" / "gpu-fail". A known-answer self-test against
 * @noble/curves must pass before any scanning; every GPU hit is re-checked on
 * the CPU before it is reported, so a buggy driver can't fake a find.
 */
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { ripemd160 } from "@noble/hashes/legacy.js";
import { GPU_THREADS, GPU_WG, PUZZLE_WGSL } from "./puzzle-gpu-shader";

type Slice = { startHex: string; size: number; canaries: string[] };
type Start = { type: "start"; startHex: string; endHex: string; target: number[]; duty: number; nearMin?: number; slice?: Slice };
type Msg = Start | { type: "stop" } | { type: "duty"; duty: number };

/* eslint-disable @typescript-eslint/no-explicit-any */
type Gpu = { device: any; pipeline: any; params: any; table: any; out: any; hits: any; readOut: any; readHits: any; bind: any };

const G = secp256k1.Point.BASE;
const toHex = (h: Uint8Array) => Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
const hash160 = (k: bigint) => ripemd160(sha256(G.multiply(k).toBytes(true)));
const key64 = (k: bigint) => k.toString(16).padStart(64, "0");
let running = false;
let duty = 0.5;
let gpu: Gpu | null = null;
let ready: Promise<Gpu> | null = null;

function limbs(v: bigint, out: Uint32Array, at: number) {
  for (let i = 0; i < 8; i++) { out[at + i] = Number(v & 0xffffffffn); v >>= 32n; }
}
function hashWords(h: Uint8Array, out: Uint32Array, at: number) {
  const dv = new DataView(h.buffer, h.byteOffset, 20);
  for (let i = 0; i < 5; i++) out[at + i] = dv.getUint32(i * 4, true);
}
function wordsToBytes(w: Uint32Array, at: number) {
  const b = new Uint8Array(20); const dv = new DataView(b.buffer);
  for (let i = 0; i < 5; i++) dv.setUint32(i * 4, w[at + i]!, true);
  return b;
}
function randomIn(lo: bigint, hi: bigint): bigint {
  const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
  let r = 0n; for (const b of bytes) r = (r << 8n) | BigInt(b);
  return lo + (r % (hi - lo));
}

async function init(): Promise<Gpu> {
  const nav = self.navigator as any;
  if (!nav.gpu) throw new Error("WebGPU not available in this browser");
  const adapter = await nav.gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) throw new Error("No GPU adapter");
  const device = await adapter.requestDevice();
  const module = device.createShaderModule({ code: PUZZLE_WGSL });
  const info = await module.getCompilationInfo?.();
  const err = info?.messages?.find((m: any) => m.type === "error");
  if (err) throw new Error(`Shader: ${err.message}`);
  const pipeline = await device.createComputePipelineAsync({ layout: "auto", compute: { module, entryPoint: "main" } });
  const U = (globalThis as any).GPUBufferUsage;
  const params = device.createBuffer({ size: 64 * 4, usage: U.STORAGE | U.COPY_DST });
  const table = device.createBuffer({ size: GPU_THREADS * 16 * 4, usage: U.STORAGE | U.COPY_DST });
  const out = device.createBuffer({ size: GPU_THREADS * 8 * 4, usage: U.STORAGE | U.COPY_SRC });
  const hits = device.createBuffer({ size: 17 * 4, usage: U.STORAGE | U.COPY_SRC | U.COPY_DST });
  const readOut = device.createBuffer({ size: GPU_THREADS * 8 * 4, usage: U.MAP_READ | U.COPY_DST });
  const readHits = device.createBuffer({ size: 17 * 4, usage: U.MAP_READ | U.COPY_DST });
  // table[t] = (t+1)·G, affine
  const tab = new Uint32Array(GPU_THREADS * 16);
  let P = G;
  for (let t = 0; t < GPU_THREADS; t++) {
    const a = P.toAffine(); limbs(a.x, tab, t * 16); limbs(a.y, tab, t * 16 + 8);
    P = P.add(G);
  }
  device.queue.writeBuffer(table, 0, tab);
  const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
    { binding: 0, resource: { buffer: params } }, { binding: 1, resource: { buffer: table } },
    { binding: 2, resource: { buffer: out } }, { binding: 3, resource: { buffer: hits } },
  ] });
  device.lost.then(() => { gpu = null; ready = null; if (running) { running = false; self.postMessage({ type: "gpu-fail", reason: "GPU device lost" }); } });
  const g: Gpu = { device, pipeline, params, table, out, hits, readOut, readHits, bind };
  await selfTest(g);
  self.postMessage({ type: "gpu-ready", name: adapter.info?.description || adapter.info?.vendor || "WebGPU" });
  return g;
}

const D_POINT = (() => { let a: { x: bigint; y: bigint } | null = null; return () => (a ??= G.multiply(BigInt(GPU_THREADS)).toAffine()); })();

/** Run one dispatch over keys start .. start+limit-1. */
async function dispatch(g: Gpu, start: bigint, steps: number, limit: number, dest: Uint8Array, canaries: Uint8Array[]) {
  const p = new Uint32Array(64);
  const B = G.multiply(start - 1n).toAffine(); const D = D_POINT();
  limbs(B.x, p, 0); limbs(B.y, p, 8); limbs(D.x, p, 16); limbs(D.y, p, 24);
  hashWords(dest, p, 32);
  canaries.slice(0, 3).forEach((c, i) => hashWords(c, p, 37 + i * 5));
  p[52] = Math.min(3, canaries.length); p[53] = steps; p[54] = limit;
  g.device.queue.writeBuffer(g.params, 0, p);
  g.device.queue.writeBuffer(g.hits, 0, new Uint32Array(17));
  const enc = g.device.createCommandEncoder();
  const pass = enc.beginComputePass();
  pass.setPipeline(g.pipeline); pass.setBindGroup(0, g.bind);
  pass.dispatchWorkgroups(GPU_THREADS / GPU_WG); pass.end();
  enc.copyBufferToBuffer(g.out, 0, g.readOut, 0, GPU_THREADS * 32);
  enc.copyBufferToBuffer(g.hits, 0, g.readHits, 0, 68);
  g.device.queue.submit([enc.finish()]);
  const MR = (globalThis as any).GPUMapMode.READ;
  await Promise.all([g.readOut.mapAsync(MR), g.readHits.mapAsync(MR)]);
  const out = new Uint32Array(g.readOut.getMappedRange().slice(0));
  const hw = new Uint32Array(g.readHits.getMappedRange().slice(0));
  g.readOut.unmap(); g.readHits.unmap();
  const hitOffs = Array.from(hw.slice(1, 1 + Math.min(16, hw[0]!)));
  return { out, hitOffs };
}

async function selfTest(g: Gpu) {
  const start = randomIn(1n << 70n, (1n << 71n) - 1n);
  const offs = [0, GPU_THREADS + 1, 3 * GPU_THREADS + 777];
  const [t, ...c] = offs.map((o) => hash160(start + BigInt(o)));
  const { out, hitOffs } = await dispatch(g, start, 4, GPU_THREADS * 4, t!, c);
  const got = [...hitOffs].sort((a, b) => a - b);
  if (got.join() !== offs.join()) throw new Error(`self-test failed (hits ${got.join() || "none"})`);
  // spot-check a thread's lowest-hash proof
  const off = out[5 * 8 + 5]!;
  if (toHex(wordsToBytes(out, 5 * 8)) !== toHex(hash160(start + BigInt(off)))) throw new Error("self-test failed (hash mismatch)");
}

async function run(m: Start) {
  try { gpu ??= await (ready ??= init()); }
  catch (e) { ready = null; running = false; self.postMessage({ type: "gpu-fail", reason: (e as Error).message }); return; }
  const g = gpu;
  const lo = BigInt("0x" + m.startHex), hi = BigInt("0x" + m.endHex);
  const dest = Uint8Array.from(m.target);
  const pool = m.slice;
  const canaryHashes = (pool?.canaries ?? []).map((h) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16))));
  const canarySet = new Set(pool?.canaries ?? []);
  const destHex = toHex(dest);
  const nearMin = m.nearMin ?? 4;
  let k = pool ? BigInt("0x" + pool.startHex) : randomIn(lo, hi);
  const k0 = k;
  const end = pool ? k + BigInt(pool.size) : hi;
  let best: string | null = null, bestOff = 0n;
  const foundCanaries: string[] = [];
  let steps = 4;
  self.postMessage({ type: "slice", startHex: k.toString(16) });
  while (running) {
    const remain = end - k;
    const limit = Number(remain < BigInt(GPU_THREADS * steps) ? remain : BigInt(GPU_THREADS * steps));
    const t0 = performance.now();
    let res;
    try { res = await dispatch(g, k, steps, limit, dest, canaryHashes); }
    catch (e) { running = false; self.postMessage({ type: "gpu-fail", reason: (e as Error).message }); return; }
    const ms = performance.now() - t0;
    // CPU re-check of every hit
    for (const off of res.hitOffs) {
      const key = k + BigInt(off); const hx = toHex(hash160(key));
      if (hx === destHex) { running = false; self.postMessage({ type: "found", keyHex: key64(key) }); return; }
      if (canarySet.has(hx) && !foundCanaries.includes(key64(key))) foundCanaries.push(key64(key));
    }
    let nb = 0, nbOff = 0;
    for (let t = 0; t < GPU_THREADS; t++) {
      const o = t * 8;
      if (pool && res.out[o + 5] !== 0xffffffff) {
        const hx = toHex(wordsToBytes(res.out, o));
        if (best === null || hx < best) { best = hx; bestOff = k - k0 + BigInt(res.out[o + 5]!); }
      }
      if (res.out[o + 6]! > nb) { nb = res.out[o + 6]!; nbOff = res.out[o + 7]!; }
    }
    if (nb >= nearMin) {
      const key = k + BigInt(nbOff); const hx = toHex(hash160(key));
      let n = 0; while (n < 40 && hx[n] === destHex[n]) n++;
      if (n >= nearMin) self.postMessage({ type: "near", nibbles: n, hash: hx, keyHex: n >= 5 ? key64(key) : undefined });
    }
    k += BigInt(limit);
    self.postMessage({ type: "batch", count: limit });
    if (pool && k >= end) {
      running = false;
      // confirm the proof on the CPU before reporting
      if (best && toHex(hash160(k0 + bestOff)) !== best) { self.postMessage({ type: "gpu-fail", reason: "proof check failed" }); return; }
      self.postMessage({ type: "slice-done", offset: Number(bestOff), hash: best!, canaryKeys: foundCanaries });
      return;
    }
    if (!pool && k >= hi) k = randomIn(lo, hi);
    // keep each dispatch near 40ms so the OS GPU watchdog never trips
    if (ms < 25 && steps < 512) steps *= 2; else if (ms > 80 && steps > 1) steps = Math.max(1, steps >> 1);
    const rest = ms / Math.max(0.05, duty) - ms;
    await new Promise((r) => setTimeout(r, rest));
  }
}

self.onmessage = (e: MessageEvent<Msg>) => {
  const m = e.data;
  if (m.type === "start") { duty = m.duty; if (!running) { running = true; void run(m); } }
  else if (m.type === "stop") running = false;
  else if (m.type === "duty") duty = m.duty;
};

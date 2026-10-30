import { guardUnload } from "@/lib/puzzle-secret";
import { sealFoundKey } from "@/lib/key-vault";
import { takeLegacyStoredKey } from "@/lib/puzzle-secret";
/**
 * Bitmap Lottery: one site-wide background scanner for Bitcoin Puzzle #71.
 * Lives outside React so it keeps running across page changes. Device-only,
 * pays no BIT, and remembers the on/off choice in localStorage.
 */
import { useSyncExternalStore } from "react";
import { PUZZLE_71, hash160Of } from "@/lib/puzzle-sweep";
import { claimSliceFn, reportSliceFn } from "@/lib/puzzle-pool.functions";
import { submitNearRecordFn } from "@/lib/puzzle-record.functions";
import { canaryProof } from "@/lib/puzzle-pool";

export const LOTTERY_POWER = [
  { id: "ECO", duty: 0.15 },
  { id: "BALANCED", duty: 0.5 },
  { id: "TURBO", duty: 1 },
] as const;
export type LotteryPower = (typeof LOTTERY_POWER)[number]["id"];

export type LotteryState = {
  on: boolean; power: LotteryPower; scanned: number; rate: number;
  slice: string | null; found: string | null;
  /** Pool mode: payout address shown on the board, or null for solo. */
  poolWorker: string | null; poolDone: number; poolMsg: string | null;
  /** Keys checked in the current pool slice, and that slice's size (0 = none). */
  poolScanned: number; poolSize: number;
  /** Near-miss Hash160 prefix hits this session (newest first) and best ever on this device. */
  nears: NearMiss[]; bestNear: number;
  /** Scanner engine: CPU worker or experimental WebGPU (falls back to CPU on any failure). */
  engine: LotteryEngine; gpuStatus: "idle" | "testing" | "ok" | "failed"; gpuNote: string | null;
};
export type LotteryEngine = "CPU" | "GPU";
const ENGINE_KEY = "bitmap.lottery.engine";
/** True when the browser exposes WebGPU at all (a GPU may still be refused). */
export function webgpuAvailable() { return typeof navigator !== "undefined" && "gpu" in navigator; }
export type NearMiss = { nibbles: number; hash: string; at: number };
const BEST_NEAR_KEY = "bitmap.lottery.bestNear";
/** A Hash160 is 40 hex characters; only all 40 matching is the prize key. */
export const FULL_HASH_CHARS = 40;
/** Hex characters matching the target's Hash160 → near-miss tier. No tier pays or improves odds. */
export function nearTier(n: number) {
  if (n >= 7) return { id: "DIAMOND", odds: 16 ** n, pays: false };
  if (n >= 6) return { id: "GOLD", odds: 16 ** n, pays: false };
  if (n >= 5) return { id: "SILVER", odds: 16 ** n, pays: false };
  if (n >= 4) return { id: "BRONZE", odds: 16 ** n, pays: false };
  return { id: "DUST", odds: 16 ** n, pays: false };
}
/** Only an exact Hash160 wins — a 39-character prefix is not the key. */
export function isFullMatch(hashHex: string, targetHex: string) {
  return hashHex.length === FULL_HASH_CHARS && hashHex === targetHex;
}
/**
 * Chance a scan of `keys` keys holds the prize key: keys ÷ keys in the #71 range.
 * Tiers and near misses never enter it — every key is an independent draw.
 */
export function ticketWinChance(keys: number) {
  const lo = BigInt("0x" + PUZZLE_71.startHex), hi = BigInt("0x" + PUZZLE_71.endHex);
  return Number((BigInt(keys) * 10n ** 24n) / (hi - lo + 1n)) / 1e24;
}
export function chime(n: number) {
  try {
    const ctx = new AudioContext();
    const notes = [523, 659, 784, 1047].slice(0, Math.min(4, Math.max(1, n - 2)));
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "square"; o.frequency.value = f; g.gain.value = 0.04;
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.09); o.stop(ctx.currentTime + i * 0.09 + 0.08);
    });
    setTimeout(() => void ctx.close(), 800);
  } catch { /* no audio */ }
}
const POOL_KEY = "bitmap.pool.worker";
const POOL_DONE_KEY = "bitmap.pool.done";
let lease: { index: string; token: string } | null = null;

const ON_KEY = "bitmap.lottery.on";
const POWER_KEY = "bitmap.lottery.power";
/** Report a key found by another scanner on this page; held in memory only. */
export function lotteryFound(keyHex: string) { set({ found: keyHex, on: false, rate: 0 }); guardUnload(true); void sealFoundKey(keyHex); }

let state: LotteryState = { on: false, power: "ECO", scanned: 0, rate: 0, slice: null, found: null, poolWorker: null, poolDone: 0, poolMsg: null, poolScanned: 0, poolSize: 0, nears: [], bestNear: 0, engine: "CPU", gpuStatus: "idle", gpuNote: null };
const listeners = new Set<() => void>();
let worker: Worker | null = null;
let lastStart: Record<string, unknown> | null = null;
let recent: { t: number; n: number }[] = [];
let booted = false;

const SERVER: LotteryState = state;
function set(p: Partial<LotteryState>) { state = { ...state, ...p }; listeners.forEach((l) => l()); }
const dutyOf = (p: LotteryPower) => LOTTERY_POWER.find((x) => x.id === p)!.duty;

function ensureWorker() {
  if (worker) return worker;
  worker = state.engine === "GPU"
    ? new Worker(new URL("./puzzle-gpu-worker.ts", import.meta.url), { type: "module" })
    : new Worker(new URL("./puzzle-worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === "gpu-ready") set({ gpuStatus: "ok", gpuNote: String(m.name ?? "WebGPU") });
    else if (m.type === "gpu-fail") {
      // fall back to the CPU worker, resuming the same job
      worker?.terminate(); worker = null;
      set({ engine: "CPU", gpuStatus: "failed", gpuNote: String(m.reason ?? "GPU error") });
      if (state.on && lastStart) ensureWorker().postMessage(lastStart);
    } else if (m.type === "batch") {
      const now = performance.now();
      recent.push({ t: now, n: m.count });
      recent = recent.filter((x) => now - x.t < 5000);
      set({ scanned: state.scanned + m.count, rate: Math.round(recent.reduce((a, b) => a + b.n, 0) / 5), poolScanned: lease ? state.poolScanned + m.count : state.poolScanned });
    } else if (m.type === "near") {
      const best = Math.max(state.bestNear, m.nibbles);
      if (best > state.bestNear) localStorage.setItem(BEST_NEAR_KEY, String(best));
      if (m.nibbles >= 5) chime(m.nibbles);
      if (m.keyHex && m.nibbles >= 5) void Promise.resolve().then(() => submitNearRecordFn({ data: { keyHex: m.keyHex } })).catch(() => {});
      set({ bestNear: best, nears: [{ nibbles: m.nibbles, hash: m.hash, at: Date.now() }, ...state.nears].slice(0, 12) });
    } else if (m.type === "slice") set({ slice: m.startHex });
    else if (m.type === "slice-done") void finishSlice(m.offset, m.hash, m.canaryKeys ?? []);
    else if (m.type === "found") {
      localStorage.setItem(ON_KEY, "0");
      set({ found: m.keyHex, on: false, rate: 0 });
      void sealFoundKey(m.keyHex); // encrypted local backup, if a passphrase is set
      guardUnload(true); // site-wide: warn before closing on any page
    }
  };
  return worker;
}

function startWorker(slice?: { startHex: string; size: number; canaries: string[] }) {
  lastStart = {
    type: "start", startHex: PUZZLE_71.startHex, endHex: PUZZLE_71.endHex,
    target: Array.from(hash160Of(PUZZLE_71.address)), duty: dutyOf(state.power), slice,
  };
  if (state.engine === "GPU" && state.gpuStatus !== "ok") set({ gpuStatus: "testing", gpuNote: null });
  ensureWorker().postMessage(lastStart);
}

async function nextSlice() {
  if (!state.on || !state.poolWorker) return;
  set({ poolMsg: "GETTING A SLICE…" });
  try {
    const r = await claimSliceFn({ data: { worker: state.poolWorker } });
    if (!r.ok) { set({ poolMsg: r.error }); setTimeout(nextSlice, 60_000); return; }
    lease = { index: r.index, token: r.token };
    set({ poolMsg: `SCANNING SLICE #${r.index}`, poolScanned: 0, poolSize: r.size });
    if (state.on) startWorker({ startHex: r.startHex, size: r.size, canaries: r.canaryHash160 });
  } catch { set({ poolMsg: "POOL OFFLINE — RETRYING" }); setTimeout(nextSlice, 30_000); }
}

async function finishSlice(offset: number, hash: string, canaryKeys: string[]) {
  const l = lease; lease = null;
  if (l) {
    try {
      const r = await reportSliceFn({ data: { ...l, offset, hash, canaryProof: canaryProof(canaryKeys) } });
      if (r.ok) {
        const done = state.poolDone + 1;
        localStorage.setItem(POOL_DONE_KEY, String(done));
        set({ poolDone: done });
      } else set({ poolMsg: r.error });
    } catch { set({ poolMsg: "REPORT FAILED" }); }
  }
  void nextSlice();
}

/** Join the shared pool with a payout address (starts scanning), or pass null to scan solo. */
export function lotterySetPool(worker: string | null) {
  const wasOn = state.on;
  if (wasOn) lotteryStop();
  if (worker) localStorage.setItem(POOL_KEY, worker); else localStorage.removeItem(POOL_KEY);
  set({ poolWorker: worker, poolMsg: null, poolScanned: 0, poolSize: 0 });
  if (wasOn || worker) lotteryStart();
}

export function lotteryStart() {
  if (state.found || typeof window === "undefined") return;
  set({ on: true });
  if (state.poolWorker) void nextSlice(); else startWorker();
  localStorage.setItem(ON_KEY, "1");
}
export function lotteryStop() {
  worker?.postMessage({ type: "stop" });
  localStorage.setItem(ON_KEY, "0");
  recent = [];
  lease = null;
  set({ on: false, rate: 0, poolMsg: null });
}
export function lotteryToggle() { if (state.on) lotteryStop(); else lotteryStart(); }
export function lotterySetPower(power: LotteryPower) {
  localStorage.setItem(POWER_KEY, power);
  worker?.postMessage({ type: "duty", duty: dutyOf(power) });
  set({ power });
}

/** Switch engine; restarts the current job on the new engine. */
export function lotterySetEngine(engine: LotteryEngine) {
  if (engine === state.engine) return;
  const wasOn = state.on;
  if (wasOn) lotteryStop();
  worker?.terminate(); worker = null;
  localStorage.setItem(ENGINE_KEY, engine);
  set({ engine, gpuStatus: engine === "GPU" ? "idle" : state.gpuStatus, gpuNote: engine === "GPU" ? null : state.gpuNote });
  if (wasOn) lotteryStart();
}

/** Restore the saved choice once in the browser. */
export function lotteryBoot() {
  if (booted || typeof window === "undefined") return;
  booted = true;
  const power = localStorage.getItem(POWER_KEY) as LotteryPower | null;
  const found = state.found ?? takeLegacyStoredKey();
  const engine: LotteryEngine = localStorage.getItem(ENGINE_KEY) === "GPU" && webgpuAvailable() ? "GPU" : "CPU";
  set({ engine, power: LOTTERY_POWER.some((p) => p.id === power) ? power! : "ECO", found,
    poolWorker: localStorage.getItem(POOL_KEY), poolDone: Number(localStorage.getItem(POOL_DONE_KEY) ?? 0) || 0,
    bestNear: Number(localStorage.getItem(BEST_NEAR_KEY) ?? 0) || 0 });
  if (found) guardUnload(true);
  if (!found && localStorage.getItem(ON_KEY) === "1") lotteryStart();
}

export function useLottery(): LotteryState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state, () => SERVER,
  );
}

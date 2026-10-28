/**
 * Bitmap Lottery: one site-wide background scanner for Bitcoin Puzzle #71.
 * Lives outside React so it keeps running across page changes. Device-only,
 * pays no BIT, and remembers the on/off choice in localStorage.
 */
import { useSyncExternalStore } from "react";
import { PUZZLE_71, hash160Of } from "@/lib/puzzle-sweep";

export const LOTTERY_POWER = [
  { id: "ECO", duty: 0.15 },
  { id: "BALANCED", duty: 0.5 },
  { id: "TURBO", duty: 1 },
] as const;
export type LotteryPower = (typeof LOTTERY_POWER)[number]["id"];

export type LotteryState = {
  on: boolean; power: LotteryPower; scanned: number; rate: number;
  slice: string | null; found: string | null;
};

const ON_KEY = "bitmap.lottery.on";
const POWER_KEY = "bitmap.lottery.power";
export const FOUND_KEY = "bitmap.puzzle.found";

let state: LotteryState = { on: false, power: "ECO", scanned: 0, rate: 0, slice: null, found: null };
const listeners = new Set<() => void>();
let worker: Worker | null = null;
let recent: { t: number; n: number }[] = [];
let booted = false;

const SERVER: LotteryState = state;
function set(p: Partial<LotteryState>) { state = { ...state, ...p }; listeners.forEach((l) => l()); }
const dutyOf = (p: LotteryPower) => LOTTERY_POWER.find((x) => x.id === p)!.duty;

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./puzzle-worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === "batch") {
      const now = performance.now();
      recent.push({ t: now, n: m.count });
      recent = recent.filter((x) => now - x.t < 5000);
      set({ scanned: state.scanned + m.count, rate: Math.round(recent.reduce((a, b) => a + b.n, 0) / 5) });
    } else if (m.type === "slice") set({ slice: m.startHex });
    else if (m.type === "found") {
      localStorage.setItem(FOUND_KEY, m.keyHex);
      const blob = new Blob([`PUZZLE #71 KEY\n${m.keyHex}\n${new Date().toISOString()}\n`], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "puzzle71-key.txt"; a.click();
      localStorage.setItem(ON_KEY, "0");
      set({ found: m.keyHex, on: false, rate: 0 });
    }
  };
  return worker;
}

export function lotteryStart() {
  if (state.found || typeof window === "undefined") return;
  ensureWorker().postMessage({
    type: "start", startHex: PUZZLE_71.startHex, endHex: PUZZLE_71.endHex,
    target: Array.from(hash160Of(PUZZLE_71.address)), duty: dutyOf(state.power),
  });
  localStorage.setItem(ON_KEY, "1");
  set({ on: true });
}
export function lotteryStop() {
  worker?.postMessage({ type: "stop" });
  localStorage.setItem(ON_KEY, "0");
  recent = [];
  set({ on: false, rate: 0 });
}
export function lotteryToggle() { if (state.on) lotteryStop(); else lotteryStart(); }
export function lotterySetPower(power: LotteryPower) {
  localStorage.setItem(POWER_KEY, power);
  worker?.postMessage({ type: "duty", duty: dutyOf(power) });
  set({ power });
}

/** Restore the saved choice once in the browser. */
export function lotteryBoot() {
  if (booted || typeof window === "undefined") return;
  booted = true;
  const power = localStorage.getItem(POWER_KEY) as LotteryPower | null;
  const found = localStorage.getItem(FOUND_KEY);
  set({ power: LOTTERY_POWER.some((p) => p.id === power) ? power! : "ECO", found });
  if (!found && localStorage.getItem(ON_KEY) === "1") lotteryStart();
}

export function useLottery(): LotteryState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state, () => SERVER,
  );
}

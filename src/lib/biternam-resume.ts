import { HEIST_STEPS } from "@/lib/void-heist";
import { VOID_STEPS } from "@/lib/void-progress";

export type ResumeTarget = { to: string; label: string; done: boolean };

/** Next unfinished puzzle from server-saved counts: Heist links first, then the Void. */
export function resumeTarget(heistStage: number, voidCount: number): ResumeTarget {
  if (heistStage < HEIST_STEPS.length) {
    const s = HEIST_STEPS[Math.max(0, heistStage)]!;
    return { to: `/biternam/${s.room}`, label: `CH.4 · ${heistStage + 1}/${HEIST_STEPS.length} · ${s.hint}`, done: false };
  }
  if (voidCount < VOID_STEPS.length) {
    return { to: "/biternam/void", label: `THE MEMPOOL VOID · ${voidCount + 1}/${VOID_STEPS.length}`, done: false };
  }
  return { to: "/biternam/void", label: "ALL PUZZLES SOLVED · REVISIT THE VOID", done: true };
}

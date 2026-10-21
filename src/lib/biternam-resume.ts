import { HEIST_STEPS } from "@/lib/void-heist";
import { VOID_STEPS } from "@/lib/void-progress";
import { HIDEOUT_STEPS } from "@/lib/hideout-progress";

export type ResumeTarget = { to: string; label: string; done: boolean };

/** Next unfinished puzzle from server-saved counts, in story order: Heist, Void, Batcave, Island Hotel. */
export function resumeTarget(heistStage: number, voidCount: number, batcaveCount = 0, islandCount = 0): ResumeTarget {
  if (heistStage < HEIST_STEPS.length) {
    const s = HEIST_STEPS[Math.max(0, heistStage)]!;
    return { to: `/biternam/${s.room}`, label: `CH.4 · ${heistStage + 1}/${HEIST_STEPS.length} · ${s.hint}`, done: false };
  }
  if (voidCount < VOID_STEPS.length) {
    return { to: "/biternam/void", label: `THE MEMPOOL VOID · ${voidCount + 1}/${VOID_STEPS.length}`, done: false };
  }
  if (batcaveCount < HIDEOUT_STEPS.batcave.length) {
    return { to: "/biternam/batcave", label: `DEV9'S BATCAVE · ${batcaveCount + 1}/${HIDEOUT_STEPS.batcave.length}`, done: false };
  }
  if (islandCount < HIDEOUT_STEPS.island.length) {
    return { to: "/biternam/island", label: `URBAN'S ISLAND HOTEL · ${islandCount + 1}/${HIDEOUT_STEPS.island.length}`, done: false };
  }
  return { to: "/biternam/island", label: "ALL PUZZLES SOLVED · REVISIT URBAN'S ISLAND", done: true };
}

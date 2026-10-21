import { HEIST_STEPS } from "@/lib/void-heist";
import { VOID_STEPS } from "@/lib/void-progress";
import { HIDEOUT_STEPS } from "@/lib/hideout-progress";

export type ResumeTarget = { to: string; label: string; done: boolean };

/** Next unfinished puzzle from server-saved counts, in story order: Heist, Void, Batcave, Island Hotel, 1138 Vault, Re-Org Lair, Void Basement. */
export function resumeTarget(heistStage: number, voidCount: number, batcaveCount = 0, islandCount = 0, vaultCount = 0, lairCount = 0, basementCount = 0): ResumeTarget {
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
  if (vaultCount < HIDEOUT_STEPS.vault.length) {
    return { to: "/biternam/vault", label: `CH.5 · BENEATH 1138 · ${vaultCount + 1}/${HIDEOUT_STEPS.vault.length}`, done: false };
  }
  if (lairCount < HIDEOUT_STEPS.lair.length) {
    return { to: "/biternam/lair", label: `CH.6 · THE RE-ORG LAIR · ${lairCount + 1}/${HIDEOUT_STEPS.lair.length}`, done: false };
  }
  if (basementCount < HIDEOUT_STEPS.basement.length) {
    return { to: "/biternam/basement", label: `CH.7 · THE VOID BASEMENT · ${basementCount + 1}/${HIDEOUT_STEPS.basement.length}`, done: false };
  }
  return { to: "/biternam/basement", label: "ALL PUZZLES SOLVED · REVISIT THE VOID BASEMENT", done: true };
}

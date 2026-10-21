/**
 * Dev-only test hooks for Shadow Gate archways (tests/browser/gate_recheck_harness.py).
 * `harnessAllowed` is false in every production bundle (Vite replaces DEV/MODE at build
 * time, so the hooks are dead code there). The hooks only move where the gate thinks
 * you stand — opening still needs a pass or a 6-confirmation SEALED keycard.
 */
export type HarnessPos = { x: number; z: number };
type Env = { DEV?: boolean; PROD?: boolean; MODE?: string };

export const harnessAllowed = (env: Env = import.meta.env): boolean =>
  env.DEV === true && env.PROD !== true && env.MODE !== "production";

const valid = (p: unknown): p is HarnessPos =>
  !!p && typeof p === "object" && Number.isFinite((p as HarnessPos).x) && Number.isFinite((p as HarnessPos).z);

export function harnessPose(env: Env = import.meta.env, w: unknown = typeof window === "undefined" ? undefined : window): HarnessPos | null {
  if (!harnessAllowed(env) || !w) return null;
  const p = (w as { __bwGateHarness?: unknown }).__bwGateHarness;
  return valid(p) ? p : null;
}

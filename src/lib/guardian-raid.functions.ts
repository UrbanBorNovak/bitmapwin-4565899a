import { createServerFn } from "@tanstack/react-start";

/** Settle due raids and chain Walker laps. Idempotent; computed from server data only. */
export const settleRaidsFn = createServerFn({ method: "POST" }).handler(async () => {
  const { walkerTick } = await import("@/lib/guardian-walker.server");
  return walkerTick();
});

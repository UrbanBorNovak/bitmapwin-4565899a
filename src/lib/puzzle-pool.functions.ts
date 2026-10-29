import { createServerFn } from "@tanstack/react-start";
import { isPoolId, type PoolId } from "@/lib/puzzle-pool";

const poolOf = (p: unknown): PoolId => (typeof p === "string" && isPoolId(p) ? p : "71");

/** Hand out an unscanned slice (with trap canaries) to a worker address. */
export const claimSliceFn = createServerFn({ method: "POST" })
  .inputValidator((d: { worker: string; pool?: PoolId }) => ({ worker: String(d?.worker ?? "").trim(), pool: poolOf(d?.pool) }))
  .handler(async ({ data }) => {
    const { claimSlice } = await import("@/lib/puzzle-pool.server");
    return claimSlice(data.worker, data.pool);
  });

/** Mark a slice scanned after checking its canary proof. */
export const reportSliceFn = createServerFn({ method: "POST" })
  .inputValidator((d: { index: string; token: string; canaryProof: string; offset?: number; hash?: string; pool?: PoolId }) => ({
    pool: poolOf(d.pool), index: String(d.index), token: String(d.token), canaryProof: String(d.canaryProof),
    offset: d.offset === undefined ? undefined : Number(d.offset), hash: d.hash ? String(d.hash).slice(0, 40) : undefined,
  }))
  .handler(async ({ data }) => {
    const { reportSlice } = await import("@/lib/puzzle-pool.server");
    return reportSlice(data);
  });

/** Public pool totals, top contributors and the range heatmap. */
export const poolStatsFn = createServerFn({ method: "GET" })
  .inputValidator((d: { pool?: PoolId } | undefined) => ({ pool: poolOf(d?.pool) }))
  .handler(async ({ data }) => {
    const { poolStats } = await import("@/lib/puzzle-pool.server");
    return poolStats(data.pool);
  });

import { createServerFn } from "@tanstack/react-start";

/** Hand out an unscanned slice (with trap canaries) to a worker address. */
export const claimSliceFn = createServerFn({ method: "POST" })
  .inputValidator((d: { worker: string }) => ({ worker: String(d?.worker ?? "").trim() }))
  .handler(async ({ data }) => {
    const { claimSlice } = await import("@/lib/puzzle-pool.server");
    return claimSlice(data.worker);
  });

/** Mark a slice scanned after checking its canary proof. */
export const reportSliceFn = createServerFn({ method: "POST" })
  .inputValidator((d: { index: string; token: string; canaryProof: string; offset?: number; hash?: string }) => ({
    index: String(d.index), token: String(d.token), canaryProof: String(d.canaryProof),
    offset: d.offset === undefined ? undefined : Number(d.offset), hash: d.hash ? String(d.hash).slice(0, 40) : undefined,
  }))
  .handler(async ({ data }) => {
    const { reportSlice } = await import("@/lib/puzzle-pool.server");
    return reportSlice(data);
  });

/** Public pool totals, top contributors and the range heatmap. */
export const poolStatsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { poolStats } = await import("@/lib/puzzle-pool.server");
  return poolStats();
});

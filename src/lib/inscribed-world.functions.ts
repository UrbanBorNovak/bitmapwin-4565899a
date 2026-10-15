import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ID = z.string().regex(/^[0-9a-f]{64}i\d+$/);

/** Public read: 3D worlds inscribed on one BITMAP (sat reinscriptions + children), verified from chain. */
export const getBitmapWorldsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ height: z.number().int().min(0).max(10_000_000) }).parse(d))
  .handler(async ({ data }) => {
    const { worldsForHeight } = await import("@/lib/inscribed-world.server");
    return worldsForHeight(data.height);
  });

/** Public read: worlds across a batch of BITMAPs (directory scan, max 12 per call). */
export const scanBitmapWorldsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ heights: z.array(z.number().int().min(0).max(10_000_000)).max(12) }).parse(d))
  .handler(async ({ data }) => {
    const { worldsForHeight } = await import("@/lib/inscribed-world.server");
    const rows = await Promise.all(data.heights.map(async (height) => ({ height, worlds: await worldsForHeight(height) })));
    return rows.filter((r) => r.worlds.length > 0);
  });

/** Public read: is this inscription a runnable 3D world? */
export const inspectWorldFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: ID }).parse(d))
  .handler(async ({ data }) => {
    const { inspectWorld } = await import("@/lib/inscribed-world.server");
    return inspectWorld(data.id);
  });

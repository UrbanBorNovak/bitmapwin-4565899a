import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public read: the newest Land Forge build inscribed on a BITMAP, verified from chain. */
export const getForgeBuildFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ height: z.number().int().min(0).max(10_000_000) }).parse(d))
  .handler(async ({ data }) => {
    const { forgeBuildForHeight } = await import("@/lib/forge.server");
    return forgeBuildForHeight(data.height);
  });

/** Public read: parcel-sat builds and every HTML inscription living on a BITMAP's land. */
export const getForgeLandFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ height: z.number().int().min(0).max(10_000_000) }).parse(d))
  .handler(async ({ data }) => {
    const { forgeLandFor } = await import("@/lib/forge.server");
    return forgeLandFor(data.height);
  });

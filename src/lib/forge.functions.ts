import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public read: the newest Land Forge build inscribed on a BITMAP, verified from chain. */
export const getForgeBuildFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ height: z.number().int().min(0).max(10_000_000) }).parse(d))
  .handler(async ({ data }) => {
    const { forgeBuildForHeight } = await import("@/lib/forge.server");
    return forgeBuildForHeight(data.height);
  });

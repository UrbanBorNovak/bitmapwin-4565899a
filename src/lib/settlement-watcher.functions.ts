import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** One pass of the settlement watcher over the open offer book. */
export const watchSettlementsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        heights: z.array(z.number().int().min(0)).max(50).optional(),
        limit: z.number().int().min(1).max(100).default(40),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { watchSettlements } = await import("@/lib/settlement-watcher.server");
    return watchSettlements({ heights: data.heights, limit: data.limit });
  });

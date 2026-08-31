import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** One pass of the real-chain trade watcher. */
export const watchTradesFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        heights: z.array(z.number().int().min(0)).max(50).optional(),
        limit: z.number().int().min(1).max(120).default(40),
        maxHops: z.number().int().min(1).max(10).default(8),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { watchChainTrades } = await import("@/lib/watcher.server");
    return watchChainTrades({
      heights: data.heights,
      limit: data.limit,
      maxHops: data.maxHops,
    });
  });

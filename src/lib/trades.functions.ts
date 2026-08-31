import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const claimSchema = z.object({
  bitmapHeight: z.number().int().min(0),
  txid: z.string().regex(/^[0-9a-fA-F]{64}$/),
  inscriptionId: z.string().nullish(),
});

export const traceBitmapTradesFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        claims: z.array(claimSchema).min(1).max(40),
        maxHops: z.number().int().min(1).max(10).default(6),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { traceMany } = await import("@/lib/trades.server");
    return traceMany(data.claims, data.maxHops);
  });

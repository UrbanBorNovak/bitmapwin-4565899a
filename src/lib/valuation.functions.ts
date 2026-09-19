import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { scanValuation } from "@/lib/valuation.server";

const input = z.object({
  height: z.number().int().min(0).max(1_000_000),
  claimId: z.string().trim().max(120).nullable().optional(),
  full: z.boolean().optional(),
});

export const runValuationScan = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }) => scanValuation(data));

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const rangeShape = z
  .object({
    lo: z.number().int().min(0).max(10_000_000).optional(),
    hi: z.number().int().min(0).max(10_000_000).optional(),
  })
  .optional();

const asRange = (input: { lo?: number | undefined; hi?: number | undefined } | undefined) =>
  input && input.lo !== undefined && input.hi !== undefined && input.lo <= input.hi
    ? { lo: input.lo, hi: input.hi }
    : undefined;

/** Advances BSS scene discovery by one throttled batch. */
export const runBssCrawlFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({ batch: z.number().int().min(1).max(24).optional(), range: rangeShape })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { crawlBssScenes } = await import("@/lib/bss-crawl.server");
    try {
      return await crawlBssScenes(data.batch ?? 12, asRange(data.range));
    } catch {
      return { skipped: true, scanned: 0, scenesFound: 0, heights: [] as number[] };
    }
  });

/** Public progress of scene discovery, optionally for one district range. */
export const getBssCrawlProgress = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ range: rangeShape }).parse(data ?? {}))
  .handler(async ({ data }) => {
    const { bssCrawlProgress } = await import("@/lib/bss-crawl.server");
    try {
      return await bssCrawlProgress(asRange(data.range));
    } catch {
      return { scanned: 0, scenes: 0 };
    }
  });

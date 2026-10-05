import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public: holding boosts (height bonus + dividend multiplier) for nearby BITMAPs. */
export const getLandBoostsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ heights: z.array(z.number().int().min(0).max(10_000_000)).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { readLandBoosts } = await import("@/lib/land-epoch.server");
    return { boosts: [...(await readLandBoosts(data.heights)).values()] };
  });

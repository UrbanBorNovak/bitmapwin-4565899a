import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MAX_BITMAP } from "@/lib/oci";

export const getBitmapRegistryRange = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        start: z.number().int().min(0).max(MAX_BITMAP).default(MAX_BITMAP - 59),
        count: z.number().int().min(1).max(120).default(60),
        resolveLimit: z.number().int().min(0).max(120).default(40),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { getRegistryRange } = await import("@/lib/oci.server");
    return getRegistryRange(data.start, data.count, data.resolveLimit);
  });

export const getBitmapRegistryEntry = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ height: z.number().int().min(0).max(MAX_BITMAP) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { getRegistryEntry } = await import("@/lib/oci.server");
    return getRegistryEntry(data.height);
  });

export const getBitmapRegistryStats = createServerFn({ method: "GET" }).handler(async () => {
  const { getRegistryStats } = await import("@/lib/oci.server");
  return getRegistryStats();
});

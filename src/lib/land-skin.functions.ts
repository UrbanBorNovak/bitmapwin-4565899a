import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Image reinscriptions painted on the BITMAPs around the avatar. */
export const getLandSkins = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ heights: z.array(z.number().int().min(0)).min(1).max(12) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { landSkinsFor } = await import("@/lib/land-skin.server");
    return landSkinsFor(data.heights);
  });

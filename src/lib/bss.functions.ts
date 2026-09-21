import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public read of a BITMAP's on-chain BSS scene. */
export const getBssScene = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ height: z.number().int().min(0).max(10_000_000) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { bssSceneForHeight } = await import("@/lib/bss.server");
    return bssSceneForHeight(data.height);
  });

/** Decodes a specific BSS BMP inscription. */
export const getBssSceneByInscription = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ inscriptionId: z.string().trim().regex(/^[0-9a-fA-F]{64}i\d+$/) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { bssSceneFromInscription } = await import("@/lib/bss.server");
    return bssSceneFromInscription(data.inscriptionId);
  });

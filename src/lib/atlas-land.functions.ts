import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public atlas land endpoints. Reads return indexed BITMAP claims for the
 * sampled heights the map is showing; the frontier call indexes freshly mined
 * blocks from the ordinals index so the map is not blank at the chain tip.
 */

export const getAtlasClaims = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({ heights: z.array(z.number().int().min(0).max(1_048_575)).max(400) })
      .parse(data ?? { heights: [] }),
  )
  .handler(async ({ data }) => {
    const { claimsForHeights } = await import("@/lib/atlas-land.server");
    return { claims: await claimsForHeights([...new Set(data.heights)]) };
  });

export const getAtlasLandForAddress = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ address: z.string().min(8).max(120) }).parse(data))
  .handler(async ({ data }) => {
    const { landForAddress } = await import("@/lib/atlas-land.server");
    return { claims: await landForAddress(data.address) };
  });

export const getAtlasParcelization = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({
      claims: z.array(z.object({
        height: z.number().int().min(0).max(1_048_575),
        inscriptionId: z.string().regex(/^[0-9a-fA-F]{64}i\d+$/),
      })).max(16),
    }).parse(data ?? { claims: [] }),
  )
  .handler(async ({ data }) => {
    const { summarizeParcelization } = await import("@/lib/parcels.server");
    return { parcelized: await summarizeParcelization(data.claims) };
  });

export const indexAtlasFrontier = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        chainTip: z.number().int().min(0).max(1_048_575),
        batch: z.number().int().min(1).max(24).default(12),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { indexFrontier } = await import("@/lib/atlas-land.server");
    return indexFrontier(data.chainTip, data.batch);
  });

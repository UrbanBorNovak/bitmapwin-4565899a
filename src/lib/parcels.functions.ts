import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getParcels = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        height: z.number().int().min(0),
        inscriptionId: z.string().regex(/^[0-9a-fA-F]{64}i\d+$/),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { scanParcels } = await import("@/lib/parcels.server");
    return scanParcels(data.height, data.inscriptionId);
  });

export const getInscriptionChildren = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ inscriptionId: z.string().regex(/^[0-9a-fA-F]{64}i\d+$/) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { scanChildInscriptions } = await import("@/lib/parcels.server");
    return scanChildInscriptions(data.inscriptionId);
  });

export const getReinscriptions = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ inscriptionId: z.string().regex(/^[0-9a-fA-F]{64}i\d+$/) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { scanReinscriptions } = await import("@/lib/parcels.server");
    return scanReinscriptions(data.inscriptionId);
  });

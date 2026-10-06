import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public read: checks which parcel claims an address really holds on chain. */
export const verifyHeldParcelsFn = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        address: z.string().min(10).max(120),
        claims: z.array(z.object({ id: z.string().regex(/^[0-9a-f]{64}i\d+$/), index: z.number().int().min(0), height: z.number().int().min(0) })).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { verifyHeldParcels } = await import("@/lib/parcel-fief.server");
    return verifyHeldParcels(data.address, data.claims);
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const addressSchema = z
  .string()
  .trim()
  .min(20)
  .max(100)
  .regex(/^(bc1[a-z0-9]{8,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/, "Not a valid Bitcoin address");

/** Resolves the live UTXO holding a bitmap inscription, straight from the chain. */
export const locateBitmapFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({ height: z.number().int().min(0).max(10_000_000), address: addressSchema })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { locateBitmap } = await import("@/lib/locate-bitmap.server");
    return locateBitmap({ height: data.height, address: data.address });
  });

/** Public read of the address currently holding the BITMAP inscription. */
export const getBitmapHolderFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ height: z.number().int().min(0).max(10_000_000) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { locateBitmapHolder } = await import("@/lib/locate-bitmap.server");
    return locateBitmapHolder(data.height);
  });

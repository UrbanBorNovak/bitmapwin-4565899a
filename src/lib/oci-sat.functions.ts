import { createServerFn } from "@tanstack/react-start";

/** Public: sat proof for a BITMAP from the on-chain LiveOCI pages (0–969,999). */
export const getOciSatFn = createServerFn({ method: "GET" })
  .inputValidator((d: { height: number }) => {
    const h = Number(d?.height);
    if (!Number.isInteger(h) || h < 0) throw new Error("bad height");
    return { height: h };
  })
  .handler(async ({ data }) => {
    try {
      const { ociBitmapSat, BITMAP_OCI_MODULE_ID } = await import("@/lib/bitmap-oci.server");
      const r = await ociBitmapSat(data.height);
      return r ? { ...r, module: BITMAP_OCI_MODULE_ID } : null;
    } catch {
      return null;
    }
  });

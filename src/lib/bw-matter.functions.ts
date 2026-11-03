import { createServerFn } from "@tanstack/react-start";

/** Public: canonical first-is-first BITMAP for a height via bop's LiveOCI (cache pages, then live blocks). */
export const liveBitmapFn = createServerFn({ method: "GET" })
  .inputValidator((d: { height: number }) => {
    const h = Number(d?.height);
    if (!Number.isInteger(h) || h < 0 || h > 2_000_000) throw new Error("bad height");
    return { height: h };
  })
  .handler(async ({ data }) => {
    try {
      const oci = await import("@/lib/bitmap-oci.server");
      if (data.height < oci.BITMAP_OCI_MAX) {
        const [id, sat] = await Promise.all([oci.ociBitmapInscriptionId(data.height), oci.ociBitmapSat(data.height)]);
        return { inscriptionId: id, sat: sat?.sat ?? null, source: "LIVEOCI CACHE" as const, error: null };
      }
      const { resolveBitmapFromChain } = await import("@/lib/bitmap-live-resolver.server");
      const id = await resolveBitmapFromChain(data.height);
      return { inscriptionId: id, sat: null, source: "LIVEOCI BLOCK PARSER" as const, error: null };
    } catch (e) {
      console.error("liveBitmapFn", e);
      return { inscriptionId: null, sat: null, source: null, error: "LiveOCI lookup unavailable right now" };
    }
  });

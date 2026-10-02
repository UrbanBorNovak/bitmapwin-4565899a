import { createServerFn } from "@tanstack/react-start";
import { guardianMasterGeneratorHtml } from "@/lib/guardian-delegate";

/** Brotli-packs the Master Generator page for inscribing with `content-encoding: br`. */
export const brotliMasterGenerator = createServerFn({ method: "GET" }).handler(async () => {
  const zlib = await import("zlib");
  const raw = Buffer.from(guardianMasterGeneratorHtml(), "utf8");
  const packed = zlib.brotliCompressSync(raw, {
    params: {
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_LGWIN]: 24,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
    },
  });
  // Round-trip check so we never hand out a broken file.
  if (!zlib.brotliDecompressSync(packed).equals(raw)) throw new Error("BROTLI ROUND-TRIP FAILED");
  return { base64: packed.toString("base64"), rawBytes: raw.length, packedBytes: packed.length };
});

import { createServerFn } from "@tanstack/react-start";
import { guardianMasterGeneratorHtml } from "@/lib/guardian-delegate";
import { guardianMasterGeneratorHtmlV7 } from "@/lib/guardian-delegate-v7";

/** Brotli-packs the Master Generator page for inscribing with `content-encoding: br`. */
export const brotliMasterGenerator = createServerFn({ method: "GET" })
  .inputValidator((d: { version?: "v6" | "v7" } | undefined) => ({ version: d?.version === "v7" ? "v7" : "v6" }))
  .handler(async ({ data }) => {
    const zlib = await import("zlib");
    const html = data.version === "v7" ? guardianMasterGeneratorHtmlV7() : guardianMasterGeneratorHtml();
    const raw = Buffer.from(html, "utf8");
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

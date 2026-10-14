import { createServerFn } from "@tanstack/react-start";

/** Brotli-packs an HTML artifact for an Ordinals tag-9 (`content-encoding: br`) inscription. */
export const brotliPackFn = createServerFn({ method: "POST" })
  .inputValidator((d: { text: string }) => {
    if (typeof d?.text !== "string" || d.text.length > 400_000) throw new Error("BAD INPUT");
    return { text: d.text };
  })
  .handler(async ({ data }) => {
    const zlib = await import("zlib");
    const raw = Buffer.from(data.text, "utf8");
    const packed = zlib.brotliCompressSync(raw, {
      params: {
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
      },
    });
    if (!zlib.brotliDecompressSync(packed).equals(raw)) throw new Error("BROTLI ROUND-TRIP FAILED");
    return { base64: packed.toString("base64"), rawBytes: raw.length, packedBytes: packed.length };
  });

const cache = new Map<string, Promise<string | null>>();

/** BRC-420 pixel avatars are HTML that declare a PNG texture (sometimes behind a bare /content pointer);
 * resolve to the PNG inscription id, or the id itself if it is already an image. */
export function resolvePixelTexture(id: string, depth = 0): Promise<string | null> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`/api/public/inscription/${id}`).then(async (r) => {
      if (!r.ok) return null;
      if ((r.headers.get("content-type") ?? "").startsWith("image/")) return id;
      const body = await r.text();
      const m = body.match(/<texture[^>]*src=["']\/content\/([0-9a-f]{64}i\d+)/i);
      if (m) return m[1]!;
      const ptr = body.trim().match(/^\/content\/([0-9a-f]{64}i\d+)$/i);
      return ptr && depth < 3 ? resolvePixelTexture(ptr[1]!, depth + 1) : null;
    }).catch(() => { cache.delete(id); return null; });
    cache.set(id, p);
  }
  return p;
}

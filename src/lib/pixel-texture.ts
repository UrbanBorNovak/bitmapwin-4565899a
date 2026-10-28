export type PixelAsset = { texture: string | null; model: string | null; name: string | null };

const cache = new Map<string, Promise<PixelAsset | null>>();
const REF = String.raw`["'](?:https?:\/\/[^"'\/]+)?\/content\/([0-9a-f]{64}i\d+)`;

/** Parse a BRC-420 body: texture PNG, GLB model and name; relative or absolute (any mirror) /content URLs. */
export function parseBrc420(body: string): PixelAsset & { pointer: string | null } {
  const texture = body.match(new RegExp(`<texture[^>]*src=${REF}`, "i"))?.[1] ?? null;
  const model = body.match(new RegExp(`<metaverse[^>]*src=${REF}`, "i"))?.[1] ?? null;
  const name = body.match(/<metaverse[^>]*name=["']([^"']+)["']/i)?.[1] ?? null;
  const pointer = body.trim().match(/^(?:https?:\/\/[^\s\/]+)?\/content\/([0-9a-f]{64}i\d+)$/i)?.[1] ?? null;
  return { texture, model, name, pointer };
}

/** Follows text pointers (/content/<id>) and BRC-420 metadata to the real image + 3D model inscriptions. */
export function resolvePixelAsset(id: string, depth = 0): Promise<PixelAsset | null> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`/api/public/inscription/${id}`).then(async (r): Promise<PixelAsset | null> => {
      if (!r.ok) return null;
      if ((r.headers.get("content-type") ?? "").startsWith("image/")) return { texture: id, model: null, name: null };
      const b = parseBrc420(await r.text());
      if (b.texture || b.model) return { texture: b.texture, model: b.model, name: b.name };
      return b.pointer && depth < 3 ? resolvePixelAsset(b.pointer, depth + 1) : null;
    }).catch(() => { cache.delete(id); return null; });
    cache.set(id, p);
  }
  return p;
}

/** Resolve to the PNG inscription id, or the id itself if it is already an image. */
export function resolvePixelTexture(id: string): Promise<string | null> {
  return resolvePixelAsset(id).then((a) => a?.texture ?? null);
}

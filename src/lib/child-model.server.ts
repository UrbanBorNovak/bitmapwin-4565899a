/**
 * LAND MODELS — a 3D model inscribed as a child of a BITMAP.
 *
 * A BITMAP claim can have children. When one of those children is a model file
 * (glb / gltf), the owner has in effect placed a building on their land, so the
 * world stands it on top of that BITMAP. Nothing is invented: with no model
 * child, the land carries nothing.
 */

const ORD = "https://ordinals.com";
const UA = "bitmapwin/1.0";

export type ChildModel = {
  height: number;
  /** The model child inscribed under this BITMAP. */
  inscriptionId: string;
  contentType: string;
  /** The BITMAP claim inscription the model hangs from. */
  bitmapInscriptionId: string;
};

const cache = new Map<number, { at: number; model: ChildModel | null }>();
const TTL = 60 * 60 * 1000;
const inflight = new Map<number, Promise<ChildModel | null>>();

async function ordJson<T>(path: string): Promise<T | null> {
  try {
    const resp = await fetch(`${ORD}${path}`, {
      headers: { "user-agent": UA, accept: "application/json" },
    });
    if (!resp.ok) return null;
    return (await resp.json()) as T;
  } catch {
    return null;
  }
}

/** glb and gltf children are models; everything else is left alone. */
const isModel = (type: string | null | undefined) => {
  const t = (type ?? "").toLowerCase();
  return t.startsWith("model/gltf") || t === "model/glb" || t.startsWith("model/");
};

async function resolve(height: number): Promise<ChildModel | null> {
  const { bitmapInscriptionFor } = await import("@/lib/land-skin.server");
  const bitmapInscriptionId = await bitmapInscriptionFor(height);
  if (!bitmapInscriptionId) return null;

  type ChildRow = { id: string; number?: number };
  const rows: ChildRow[] = [];
  for (let page = 0; page < 2; page++) {
    const json = await ordJson<{ children?: ChildRow[]; more?: boolean }>(
      `/r/children/${bitmapInscriptionId}/inscriptions/${page}`,
    );
    const children = json?.children ?? [];
    rows.push(...children);
    if (!json?.more || children.length === 0) break;
  }
  if (rows.length === 0) return null;

  // Newest children first: the latest model placed on the land is the one shown.
  const candidates = rows.slice(-60).reverse();
  for (const child of candidates) {
    const meta = await ordJson<{ content_type?: string }>(`/r/inscription/${child.id}`);
    if (isModel(meta?.content_type)) {
      return {
        height,
        inscriptionId: child.id,
        contentType: meta?.content_type ?? "model/gltf-binary",
        bitmapInscriptionId,
      };
    }
  }
  return null;
}

/** The model standing on one BITMAP, or null when its land is empty. */
export async function childModelFor(height: number): Promise<ChildModel | null> {
  const hit = cache.get(height);
  if (hit && Date.now() - hit.at < TTL) return hit.model;
  const running = inflight.get(height);
  if (running) return running;

  const task = resolve(height)
    .catch(() => null)
    .then((model) => {
      cache.set(height, { at: Date.now(), model });
      inflight.delete(height);
      return model;
    });
  inflight.set(height, task);
  return task;
}

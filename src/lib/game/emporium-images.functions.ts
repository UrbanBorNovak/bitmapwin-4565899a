import { createServerFn } from "@tanstack/react-start";
import { getPuppetsFn } from "./puppets.functions";

/**
 * Emporium market shows only image children of the parent — text/HTML children
 * (e.g. parcels) are dropped. Children from one reveal share a content type, so
 * one HEAD per reveal txid classifies the batch.
 */
let cache: { ids: string[]; at: number } | null = null;
const typeByTx = new Map<string, boolean>();

async function isImage(id: string): Promise<boolean> {
  try {
    const res = await fetch(`https://ordinals.com/content/${id}`, { method: "HEAD", headers: { "User-Agent": "bitmapwin/1.0" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return true; // unknown → keep; browser hides it if it doesn't render
    return (res.headers.get("content-type") ?? "").toLowerCase().startsWith("image/");
  } catch { return true; }
}

export const getEmporiumImagesFn = createServerFn({ method: "GET" }).handler(async () => {
  if (cache && Date.now() - cache.at < 6 * 3600_000) return { ids: cache.ids };
  const { ids } = await getPuppetsFn();
  const firstByTx = new Map<string, string>();
  for (const id of ids) { const tx = id.split("i")[0]; if (!firstByTx.has(tx)) firstByTx.set(tx, id); }
  const todo = [...firstByTx.entries()].filter(([tx]) => !typeByTx.has(tx));
  for (let i = 0; i < todo.length; i += 16) {
    await Promise.all(todo.slice(i, i + 16).map(async ([tx, id]) => typeByTx.set(tx, await isImage(id))));
  }
  const images = ids.filter((id) => typeByTx.get(id.split("i")[0]) !== false);
  cache = { ids: images, at: Date.now() };
  return { ids: images };
});

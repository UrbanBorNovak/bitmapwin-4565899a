/**
 * Fallback BITMAP parent discovery for blocks the local index doesn't cover yet.
 * Everything here is verified against ordinals.com content — nothing is trusted
 * from the browser.
 */
const ORD = "https://ordinals.com";
const HEADERS = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" };
const ID_RE = /^[0-9a-f]{64}i\d+$/;

async function contentText(id: string): Promise<string | null> {
  try {
    const r = await fetch(`${ORD}/content/${id}`, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const type = r.headers.get("content-type") ?? "";
    if (!type.startsWith("text/")) return null;
    const len = Number(r.headers.get("content-length") ?? "0");
    if (len > 64) return null;
    return (await r.text()).trim();
  } catch {
    return null;
  }
}

/** True only when the inscription's content is exactly `<height>.bitmap`. */
export async function isBitmapInscription(id: string, height: number): Promise<boolean> {
  const clean = id.trim().toLowerCase();
  if (!ID_RE.test(clean)) return false;
  return (await contentText(clean)) === `${height}.bitmap`;
}

/** Scans the inscriptions currently at an address for `<height>.bitmap`. */
export async function scanWalletForBitmap(address: string, height: number): Promise<string | null> {
  if (!/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,90}$/.test(address)) return null;
  let html = "";
  try {
    const r = await fetch(`${ORD}/address/${address}`, { headers: HEADERS, signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return null;
    html = await r.text();
  } catch {
    return null;
  }
  const ids = [...new Set([...html.matchAll(/\/inscription\/([0-9a-f]{64}i\d+)/g)].map((m) => m[1]!))].slice(0, 120);
  const target = `${height}.bitmap`;
  for (let i = 0; i < ids.length; i += 8) {
    const batch = ids.slice(i, i + 8);
    const texts = await Promise.all(batch.map((id) => contentText(id)));
    const hit = batch.find((_, k) => texts[k] === target);
    if (hit) return hit;
  }
  return null;
}

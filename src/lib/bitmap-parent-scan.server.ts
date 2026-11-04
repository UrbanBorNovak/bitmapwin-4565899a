/**
 * Fallback BITMAP parent discovery for blocks the local index doesn't cover yet.
 * Every candidate is verified against its on-chain content — nothing is trusted
 * from the browser.
 */
import { ORD_UA, ordContent } from "@/lib/ord-fallback.server";

const ORD = "https://ordinals.com";
const TURBO = "https://turbo.ordinalswallet.com";
const HEADERS = { "user-agent": ORD_UA };
const ID_RE = /^[0-9a-f]{64}i\d+$/;

async function contentText(id: string): Promise<string | null> {
  const r = await ordContent(id);
  if (!r) return null;
  try {
    const type = r.headers.get("content-type") ?? "";
    if (!type.startsWith("text/")) return null;
    const len = Number(r.headers.get("content-length") ?? "0");
    if (len > 64) return null;
    const text = (await r.text()).trim();
    return text.length > 64 ? null : text;
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

/** Candidate ids at an address: text inscriptions from the wallet index, else the ordinals.com address page. */
async function candidateIds(address: string): Promise<string[] | null> {
  try {
    const r = await fetch(`${TURBO}/wallet/${address}`, { headers: { ...HEADERS, accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
    if (r.ok) {
      const j = (await r.json()) as { inscriptions?: { id?: string; content_type?: string }[] };
      if (Array.isArray(j.inscriptions)) {
        return j.inscriptions
          .filter((x) => x.id && ID_RE.test(x.id) && (!x.content_type || x.content_type.startsWith("text/")))
          .map((x) => x.id!);
      }
    }
  } catch { /* fall through */ }
  try {
    const r = await fetch(`${ORD}/address/${address}`, { headers: HEADERS, signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return null;
    const html = await r.text();
    return [...new Set([...html.matchAll(/\/inscription\/([0-9a-f]{64}i\d+)/g)].map((m) => m[1]!))];
  } catch {
    return null;
  }
}

/** Scans the inscriptions currently at an address for `<height>.bitmap`. */
export async function scanWalletForBitmap(address: string, height: number): Promise<string | null> {
  if (!/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,90}$/.test(address)) return null;
  const ids = (await candidateIds(address))?.slice(0, 400);
  if (!ids?.length) return null;
  const target = `${height}.bitmap`;
  for (let i = 0; i < ids.length; i += 8) {
    const batch = ids.slice(i, i + 8);
    const texts = await Promise.all(batch.map((id) => contentText(id)));
    const hit = batch.find((_, k) => texts[k] === target);
    if (hit) return hit;
  }
  return null;
}

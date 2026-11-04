/**
 * Ordinals index reads with a second public indexer as fallback (server only).
 * ordinals.com sits behind a Cloudflare bot challenge that sometimes refuses
 * server requests; turbo.ordinalswallet.com runs the same ord index. Spend
 * status and output value always come from mempool.space / blockstream.
 */
const ORD = "https://ordinals.com";
const TURBO = "https://turbo.ordinalswallet.com";
const ESPLORA = ["https://mempool.space/api", "https://blockstream.info/api"];
export const ORD_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function getJson<T>(url: string, ms = 10_000): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: { accept: "application/json", "user-agent": ORD_UA }, signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export type OrdInscriptionInfo = { satpoint: string; address: string | null; value: number | null };

/** Current satpoint + holder of an inscription; null when no indexer answers. */
export async function ordInscription(id: string): Promise<OrdInscriptionInfo | null> {
  type Raw = { satpoint?: string; address?: string | null; value?: number | null };
  const a = await getJson<Raw>(`${ORD}/r/inscription/${id}`);
  const j = a?.satpoint ? a : await getJson<Raw>(`${TURBO}/inscription/${id}`);
  if (!j?.satpoint || !/^[0-9a-f]{64}:\d+:\d+$/.test(j.satpoint)) return null;
  return { satpoint: j.satpoint, address: j.address ?? null, value: typeof j.value === "number" ? j.value : null };
}

/** Inscription ids at an address, with their outpoints, from the fallback indexer. */
export async function walletInscriptions(address: string): Promise<{ id: string; outpoint: string }[] | null> {
  const j = await getJson<{ inscriptions?: { id?: string; outpoint?: string }[] }>(`${TURBO}/wallet/${address}`, 15_000);
  if (!j?.inscriptions) return null;
  return j.inscriptions.flatMap((x) => (x.id && x.outpoint ? [{ id: x.id, outpoint: x.outpoint }] : []));
}

export type ChainOutput = { address: string | null; inscriptions: string[]; outpoint: string; spent: boolean; value: number };

/** Output facts without ordinals.com: spend + value from esplora, inscriptions from the fallback wallet index. */
export async function chainOutput(outpoint: string): Promise<ChainOutput | null> {
  const [txid, voutRaw] = outpoint.split(":");
  const vout = Number(voutRaw);
  if (!txid || !Number.isInteger(vout)) return null;
  for (const host of ESPLORA) {
    const tx = await getJson<{ vout?: { value?: number; scriptpubkey_address?: string }[] }>(`${host}/tx/${txid}`);
    const out = tx?.vout?.[vout];
    if (!out || typeof out.value !== "number") continue;
    const sp = await getJson<{ spent?: boolean }>(`${host}/tx/${txid}/outspend/${vout}`);
    if (!sp) continue;
    const address = out.scriptpubkey_address ?? null;
    const list = address ? await walletInscriptions(address) : null;
    if (!list) return null; // inscription count unknown: fail closed
    return { address, outpoint, spent: sp.spent === true, value: out.value, inscriptions: list.filter((x) => x.outpoint === outpoint).map((x) => x.id) };
  }
  return null;
}

/** Inscription body text from ordinals.com, else the UniSat content mirror (same immutable bytes). */
export async function ordContent(id: string, ms = 8000): Promise<Response | null> {
  for (const base of [`${ORD}/content/`, "https://static.unisat.io/content/"]) {
    try {
      const r = await fetch(`${base}${id}`, { headers: { "user-agent": ORD_UA }, signal: AbortSignal.timeout(ms) });
      if (r.ok) return r;
    } catch { /* next */ }
  }
  return null;
}

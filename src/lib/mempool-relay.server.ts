/**
 * Private-first broadcast. Signed sale transactions go to private relays
 * (direct-to-miner endpoints or our own node) before any public mempool API,
 * so the seller's SIGHASH_SINGLE|ANYONECANPAY signature is not gossiped to
 * snipe bots. Relays come from PRIVATE_RELAY_URLS (comma-separated; each must
 * accept a raw hex POST and answer with the txid). If none are configured or
 * all fail, we fall back to public mirrors and report that honestly.
 */

export type RelayRoute = "private_direct" | "public_fallback";
export type RelayResult =
  | { txid: string; route: RelayRoute; relay: string }
  | { error: string };

const PUBLIC_HOSTS = [
  "https://mempool.space/api",
  "https://blockstream.info/api",
  "https://mempool.emzy.de/api",
];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const TXID = /^[0-9a-f]{64}$/i;

function privateRelays(): string[] {
  return (process.env["PRIVATE_RELAY_URLS"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("https://"));
}

function readTxid(body: string): string | null {
  const t = body.trim();
  if (TXID.test(t)) return t;
  try {
    const j = JSON.parse(t) as { txid?: string; result?: string };
    const v = j.txid ?? j.result;
    return v && TXID.test(v) ? v : null;
  } catch {
    return null;
  }
}

async function push(url: string, rawHex: string, timeout: number) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "text/plain", "user-agent": UA },
    body: rawHex,
    signal: AbortSignal.timeout(timeout),
  });
  const body = await resp.text();
  const txid = resp.ok ? readTxid(body) : null;
  return txid ? { txid } : { error: body.trim() || `HTTP ${resp.status}` };
}

export async function relayTransaction(rawHex: string): Promise<RelayResult> {
  let lastError = "no response from any broadcast endpoint";
  for (const url of privateRelays()) {
    try {
      const r = await push(url, rawHex, 4_000);
      if ("txid" in r) return { txid: r.txid, route: "private_direct", relay: new URL(url).host };
      lastError = r.error;
    } catch (e) {
      lastError = e instanceof Error ? e.message : "network error";
    }
  }
  for (const host of PUBLIC_HOSTS) {
    try {
      const r = await push(`${host}/tx`, rawHex, 15_000);
      if ("txid" in r) return { txid: r.txid, route: "public_fallback", relay: new URL(host).host };
      lastError = r.error;
    } catch (e) {
      lastError = e instanceof Error ? e.message : "network error";
    }
  }
  return { error: lastError };
}

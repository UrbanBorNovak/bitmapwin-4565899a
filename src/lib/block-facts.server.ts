import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Block facts indexer. Reads real block headers + stats from mempool.space
 * compatible APIs (15 blocks per call) in ascending height order and stores
 * the fields official traits are judged on. Nothing is inferred: a block with
 * no record simply never matches a block-facts trait.
 */

const MIRRORS = ["https://mempool.space/api", "https://mempool.emzy.de/api"];
const PAGES_PER_RUN = 6;
const LOCK_SECONDS = 20;
const PATOSHI_SOURCE =
  "https://raw.githubusercontent.com/bensig/patoshi-addresses/main/patoshi_pubkeys_COMPLETE.csv";

type ApiBlock = {
  id: string;
  height: number;
  timestamp: number;
  size: number;
  extras?: {
    totalOutputAmt?: number;
    avgFeeRate?: number;
    coinbaseRaw?: string;
    pool?: { name?: string } | null;
  };
};

async function getJson<T>(path: string): Promise<T> {
  let last: unknown;
  for (const base of MIRRORS) {
    try {
      const res = await fetch(`${base}${path}`, {
        headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return (await res.json()) as T;
      last = new Error(`${base}${path} ${res.status}`);
    } catch (error) {
      last = error;
    }
  }
  throw last instanceof Error ? last : new Error("block provider unavailable");
}

/** Readable miner text inside the coinbase script (runs of ≥ 8 printable chars). */
export function coinbaseText(hex: string | undefined): string | null {
  if (!hex) return null;
  let current = "";
  const runs: string[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16);
    if (code >= 0x20 && code < 0x7f) current += String.fromCharCode(code);
    else {
      if (current.length >= 8) runs.push(current);
      current = "";
    }
  }
  if (current.length >= 8) runs.push(current);
  const text = runs.join(" ").trim();
  return text && /[a-z]{3}/i.test(text) ? text.slice(0, 200) : null;
}

const dayPrice = new Map<number, number | null>();
async function priceOnDay(timestamp: number): Promise<number | null> {
  const day = Math.floor(timestamp / 86400) * 86400;
  if (dayPrice.has(day)) return dayPrice.get(day)!;
  try {
    const data = await getJson<{ prices?: { USD?: number }[] }>(
      `/v1/historical-price?currency=USD&timestamp=${day}`,
    );
    const usd = data.prices?.[0]?.USD;
    // The price feed starts mid-2010; earlier days have no real price.
    const value = typeof usd === "number" && usd > 0 ? usd : null;
    dayPrice.set(day, value);
    return value;
  } catch {
    return null;
  }
}

async function ensurePatoshi() {
  const { count } = await supabaseAdmin
    .from("patoshi_blocks")
    .select("block_height", { count: "exact", head: true });
  if ((count ?? 0) > 0) return;
  const res = await fetch(PATOSHI_SOURCE, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) return;
  const heights = new Set<number>();
  for (const line of (await res.text()).split("\n").slice(1)) {
    const h = Number(line.split(",")[0]);
    if (Number.isInteger(h) && h >= 0) heights.add(h);
  }
  const rows = [...heights].map((block_height) => ({ block_height }));
  for (let i = 0; i < rows.length; i += 2000) {
    await supabaseAdmin.from("patoshi_blocks").upsert(rows.slice(i, i + 2000));
  }
}

export async function crawlBlockFacts() {
  const { data: start, error } = await supabaseAdmin.rpc("claim_block_facts_crawl", {
    _lock_seconds: LOCK_SECONDS,
  });
  if (error) throw error;
  if (start === null || start === undefined) return { skipped: true, stored: 0, nextHeight: null };

  await ensurePatoshi().catch(() => undefined);

  let next = Number(start);
  let stored = 0;
  let lastError: string | null = null;
  try {
    const tip = await getJson<number>("/blocks/tip/height");
    for (let page = 0; page < PAGES_PER_RUN && next <= tip; page++) {
      const top = Math.min(next + 14, tip);
      const blocks = await getJson<ApiBlock[]>(`/v1/blocks/${top}`);
      const wanted = blocks.filter((b) => b.height >= next && b.height <= top);
      if (!wanted.length) break;
      const rows = [];
      for (const b of wanted) {
        rows.push({
          block_height: b.height,
          block_hash: b.id,
          mined_at: new Date(b.timestamp * 1000).toISOString(),
          size_bytes: b.size,
          total_output_sats: b.extras?.totalOutputAmt ?? null,
          avg_fee_rate: b.extras?.avgFeeRate ?? null,
          coinbase_text: coinbaseText(b.extras?.coinbaseRaw),
          pool_name: b.extras?.pool?.name && b.extras.pool.name !== "Unknown" ? b.extras.pool.name : null,
          btc_usd: await priceOnDay(b.timestamp),
        });
      }
      const { error: upsertError } = await supabaseAdmin.from("block_facts").upsert(rows);
      if (upsertError) throw upsertError;
      stored += rows.length;
      next = top + 1;
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
  }

  await supabaseAdmin
    .from("block_facts_crawl_state")
    .update({ next_height: next, last_error: lastError, locked_until: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", "main");
  return { skipped: false, stored, nextHeight: next };
}

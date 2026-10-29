/**
 * Shared Puzzle #71 pool logic used by the site (server functions) and the
 * public rig API. Completion is proven by trap canaries: each lease plants
 * CANARY_COUNT keys derived from a server secret; only a scan that covered the
 * whole slice can return SHA-256 of all of them.
 */
import {
  CANARY_COUNT, HEAT_CELLS, LEASE_MS, MAX_OPEN_LEASES, POOLS, canaryKeys, hash160Hex, hash160OfKey,
  heatCellOf, isWorkerAddress, p2pkhAddress, poolSize, poolSliceStart, verifyCanaryProof, verifyShare, type PoolId,
} from "@/lib/puzzle-pool";
import { PUZZLE_71, hash160Of } from "@/lib/puzzle-sweep";
const PUZZLE_71_H160 = hash160Of(PUZZLE_71.address);

const TABLE = { "71": "puzzle_pool_slices", test: "puzzle_test_slices" } as const;
const hexToBytes = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));

function secret(pool: PoolId = "71"): string {
  const s = process.env["PUZZLE_CANARY_SECRET"] ?? process.env["SHORD_POOL_SEED"];
  if (!s) throw new Error("Pool secret missing");
  return (pool === "71" ? "bitmapwin.puzzle71.canary/1|" : "bitmapwin.puzzletest.canary/1|") + s;
}

function randomIndex(count: bigint): bigint {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  let r = 0n;
  for (const x of b) r = (r << 8n) | BigInt(x);
  return r % count;
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export type Lease = {
  ok: true; puzzle: PoolId; targetHash160: string; index: string; token: string; startHex: string; endHex: string; size: number;
  targetAddress: string; canaryHash160: string[]; canaryAddresses: string[]; leaseExpiresAt: string;
};

export async function claimSlice(worker: string, pool: PoolId = "71"): Promise<Lease | { ok: false; error: string }> {
  if (!isWorkerAddress(worker)) return { ok: false, error: "Enter a valid Bitcoin address" };
  const db = await admin();
  const since = new Date(Date.now() - LEASE_MS).toISOString();
  const table = TABLE[pool];
  const { count } = await db.from(table).select("slice_index", { count: "exact", head: true })
    .eq("worker", worker).is("done_at", null).gte("leased_at", since);
  if ((count ?? 0) >= MAX_OPEN_LEASES) return { ok: false, error: "Too many open slices for this address — finish one first." };
  for (let i = 0; i < 5; i++) {
    const idx = randomIndex(POOLS[pool].count);
    const token = crypto.randomUUID();
    const { error } = await db.from(table).insert({ slice_index: Number(idx), worker, lease_token: token });
    if (error) continue;
    const h = canaryKeys(secret(pool), idx, token, pool).map(hash160OfKey);
    const start = poolSliceStart(pool, idx);
    const size = poolSize(pool);
    const targetHash160 = POOLS[pool].target ?? hash160Hex(PUZZLE_71_H160);
    return {
      ok: true, puzzle: pool, index: idx.toString(), token, startHex: start.toString(16), endHex: (start + size - 1n).toString(16),
      size: Number(size), targetHash160, targetAddress: p2pkhAddress(hexToBytes(targetHash160)), canaryHash160: h.map(hash160Hex), canaryAddresses: h.map(p2pkhAddress),
      leaseExpiresAt: new Date(Date.now() + LEASE_MS).toISOString(),
    };
  }
  return { ok: false, error: "Pool busy, try again." };
}

export async function reportSlice(d: { pool?: PoolId | undefined; index: string; token: string; canaryProof: string; offset?: number | undefined; hash?: string | undefined }) {
  if (!/^\d{1,16}$/.test(d.index) || typeof d.token !== "string" || !/^[0-9a-f]{64}$/i.test(String(d.canaryProof)))
    return { ok: false as const, error: "Bad report" };
  const pool = d.pool ?? "71";
  const db = await admin();
  const idx = BigInt(d.index);
  const { data: row } = await db.from(TABLE[pool]).select("lease_token, done_at, leased_at").eq("slice_index", Number(idx)).maybeSingle();
  if (!row || row.lease_token !== d.token) return { ok: false as const, error: "Unknown slice" };
  if (row.done_at) return { ok: true as const };
  if (Date.now() - new Date(row.leased_at).getTime() > LEASE_MS) return { ok: false as const, error: "Slice lease expired" };
  if (!verifyCanaryProof(secret(pool), idx, d.token, d.canaryProof, pool))
    return { ok: false as const, error: `Canary proof rejected — all ${CANARY_COUNT} trap keys must be found` };
  const share = d.offset !== undefined && d.hash && pool === "71" && Number.isSafeInteger(d.offset) && verifyShare(idx, BigInt(d.offset), d.hash);
  await db.from(TABLE[pool]).update({
    done_at: new Date().toISOString(), best_offset: share ? d.offset! : null, best_hash: share ? d.hash!.slice(0, 40) : null,
  }).eq("slice_index", Number(idx)).eq("lease_token", d.token);
  return { ok: true as const };
}

export async function poolStats(pool: PoolId = "71") {
  const db = await admin();
  const { data: rows } = await db.from(TABLE[pool]).select("slice_index, worker, done_at, leased_at").limit(50000);
  const per = new Map<string, number>();
  const done: Record<number, number> = {}, open: Record<number, number> = {};
  const cutoff = Date.now() - LEASE_MS;
  let total = 0, active = 0;
  for (const r of rows ?? []) {
    const c = pool === "71" ? heatCellOf(Number(r.slice_index)) : Math.floor(Number(r.slice_index) / (Number(POOLS[pool].count) / HEAT_CELLS));
    if (r.done_at) { total++; per.set(r.worker, (per.get(r.worker) ?? 0) + 1); done[c] = (done[c] ?? 0) + 1; }
    else if (new Date(r.leased_at).getTime() > cutoff) { active++; open[c] = (open[c] ?? 0) + 1; }
  }
  const top = [...per.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([worker, slices]) => ({ worker, slices, share: total ? slices / total : 0 }));
  return { slices: total, active, workers: per.size, top, heat: { cells: HEAT_CELLS, done, open } };
}

import { createServerFn } from "@tanstack/react-start";
import { LEASE_MS, MAX_OPEN_LEASES, SLICE_COUNT, SLICE_SIZE, isWorkerAddress, sliceStart, verifyShare } from "@/lib/puzzle-pool";

function randomIndex(): bigint {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  let r = 0n;
  for (const x of b) r = (r << 8n) | BigInt(x);
  return r % SLICE_COUNT;
}

/** Hand out an unscanned slice to a worker address. */
export const claimSliceFn = createServerFn({ method: "POST" })
  .inputValidator((d: { worker: string }) => {
    const worker = String(d?.worker ?? "").trim();
    if (!isWorkerAddress(worker)) throw new Error("Enter a valid Bitcoin address");
    return { worker };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - LEASE_MS).toISOString();
    const { count } = await supabaseAdmin.from("puzzle_pool_slices").select("slice_index", { count: "exact", head: true })
      .eq("worker", data.worker).is("done_at", null).gte("leased_at", since);
    if ((count ?? 0) >= MAX_OPEN_LEASES) return { ok: false as const, error: "Too many open slices for this address — finish one first." };
    for (let i = 0; i < 5; i++) {
      const idx = randomIndex();
      const token = crypto.randomUUID();
      const { error } = await supabaseAdmin.from("puzzle_pool_slices").insert({ slice_index: Number(idx), worker: data.worker, lease_token: token });
      if (!error) return { ok: true as const, index: idx.toString(), token, startHex: sliceStart(idx).toString(16), size: Number(SLICE_SIZE) };
    }
    return { ok: false as const, error: "Pool busy, try again." };
  });

/** Mark a slice scanned after checking its lowest-hash proof. */
export const reportSliceFn = createServerFn({ method: "POST" })
  .inputValidator((d: { index: string; token: string; offset: number; hash: string }) => ({
    index: String(d.index), token: String(d.token), offset: Number(d.offset), hash: String(d.hash).slice(0, 40),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const idx = BigInt(data.index);
    const { data: row } = await supabaseAdmin.from("puzzle_pool_slices").select("lease_token, done_at, leased_at")
      .eq("slice_index", Number(idx)).maybeSingle();
    if (!row || row.lease_token !== data.token) return { ok: false as const, error: "Unknown slice" };
    if (row.done_at) return { ok: true as const };
    if (Date.now() - new Date(row.leased_at).getTime() > LEASE_MS) return { ok: false as const, error: "Slice lease expired" };
    if (!Number.isSafeInteger(data.offset) || !verifyShare(idx, BigInt(data.offset), data.hash)) return { ok: false as const, error: "Proof rejected" };
    await supabaseAdmin.from("puzzle_pool_slices").update({ done_at: new Date().toISOString(), best_offset: data.offset, best_hash: data.hash })
      .eq("slice_index", Number(idx)).eq("lease_token", data.token);
    return { ok: true as const };
  });

/** Public pool totals and top contributors (addresses are payout labels the workers chose to show). */
export const poolStatsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows } = await supabaseAdmin.from("puzzle_pool_slices").select("worker").not("done_at", "is", null).limit(50000);
  const per = new Map<string, number>();
  for (const r of rows ?? []) per.set(r.worker, (per.get(r.worker) ?? 0) + 1);
  const total = rows?.length ?? 0;
  const top = [...per.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([worker, slices]) => ({ worker, slices, share: total ? slices / total : 0 }));
  return { slices: total, workers: per.size, top };
});

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const field = z.string().regex(/^[0-9]{1,78}$/);
const inscriptionId = z.string().regex(/^[0-9a-f]{64}i[0-9]+$/);

export const shordPoolInfo = createServerFn({ method: "GET" }).handler(async () => {
  const { poolAddress } = await import("@/lib/shord-pool.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("shord_pool_leaves").select("idx, commitment, kind, root_after").order("idx");
  const { count } = await supabaseAdmin.from("shord_pool_nullifiers").select("nullifier", { count: "exact", head: true });
  return { poolAddress: poolAddress(), leaves: data ?? [], spent: count ?? 0 };
});

export const shordPrepareDeposit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ inscriptionId, commitment: field, holderAddress: z.string().min(20).max(100), signature: z.string().min(8).max(2000) }).parse(d),
  )
  .handler(async ({ data }) => (await import("@/lib/shord-pool.server")).prepareDeposit(data));

export const shordConfirmDeposit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ inscriptionId }).parse(d))
  .handler(async ({ data }) => (await import("@/lib/shord-pool.server")).confirmDeposit(data.inscriptionId));

/** Reserves a direct-to-shield mint before the wallet pays the inscription. */
export const shordReserveMint = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        commitAddress: z.string().min(14).max(100),
        claimSecret: z.string().min(32).max(200),
        blockHeight: z.number().int().min(0).max(10_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => (await import("@/lib/shord-pool.server")).reserveMint(data));

/** Finishes a direct-to-shield mint once the inscription reveal is broadcast. */
export const shordClaimMint = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        commitAddress: z.string().min(14).max(100),
        claimSecret: z.string().min(32).max(200),
        commitment: field,
        revealTxid: z.string().regex(/^[0-9a-f]{64}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => (await import("@/lib/shord-pool.server")).claimMint(data));

export const shordSubmitSpend = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ proof: z.record(z.string(), z.unknown()), publicSignals: z.array(field).length(6) }).parse(d))
  .handler(async ({ data }) => (await import("@/lib/shord-pool.server")).submitSpend(data.proof, data.publicSignals));

export const shordWithdraw = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ proof: z.record(z.string(), z.unknown()), publicSignals: z.array(field).length(6), destination: z.string().min(14).max(100) }).parse(d),
  )
  .handler(async ({ data }) => (await import("@/lib/shord-pool.server")).submitWithdraw(data.proof, data.publicSignals, data.destination));

export const shordRelayerInfo = createServerFn({ method: "GET" }).handler(async () => {
  const { relayerBalance } = await import("@/lib/shord-relayer.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("shord_pool_nullifiers")
    .select("nullifier, relay_status, relay_txid, relay_fee_sats, relay_error, created_at")
    .neq("relay_status", "none")
    .order("created_at", { ascending: false })
    .limit(20);
  return { ...(await relayerBalance()), anchors: data ?? [] };
});

/** Public retry: only rebroadcasts anchors the pool already verified and queued. */
export const shordRelayQueued = createServerFn({ method: "POST" }).handler(async () =>
  (await import("@/lib/shord-relayer.server")).relayQueued(5),
);

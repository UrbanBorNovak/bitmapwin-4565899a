import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server side of NEXT-BLOCK PROPS. Stakes are locked from the player's BIT
 * balance on placement; settlement reads the real mined block from
 * mempool.space and pays winners through the coin ledger, once per slip.
 */

const addressSchema = z.string().trim().min(16).max(120);

/** Place a 1-click prediction on the next Bitcoin block. */
export const placeBlockPropFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        address: addressSchema,
        market: z.enum(["txs", "pool", "fee"]),
        pick: z.string().trim().min(1).max(24),
        stake: z.number().int().min(1).max(1000),
        targetHeight: z.number().int().min(1).max(99_999_999),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertControls, spendBit } = await import("@/lib/coins.server");
    const { optionFor, STAKES } = await import("@/lib/block-props");
    const option = optionFor(data.market, data.pick);
    if (!option) return { ok: false as const, error: "UNKNOWN MARKET" };
    if (!(STAKES as readonly number[]).includes(data.stake)) return { ok: false as const, error: "INVALID STAKE" };
    await assertControls(context.supabase, context.userId, data.address);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tip = await fetchTipHeight();
    if (tip == null) return { ok: false as const, error: "CHAIN FEED UNAVAILABLE" };
    const target = Math.max(data.targetHeight, tip + 1);

    const { count } = await supabaseAdmin
      .from("block_props")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("target_height", target)
      .eq("market", data.market);
    if ((count ?? 0) > 0) return { ok: false as const, error: "ONE SLIP PER MARKET PER BLOCK" };

    try {
      await spendBit({ address: data.address, amount: data.stake, reason: "block_prop", ref: `prop:${target}:${data.market}:${context.userId}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      return { ok: false as const, error: /insufficient|balance/i.test(msg) ? "NOT ENOUGH BIT" : "STAKE FAILED — TRY AGAIN" };
    }

    const { error } = await supabaseAdmin.from("block_props").insert({
      user_id: context.userId,
      address: data.address,
      target_height: target,
      market: data.market,
      pick: option.pick,
      stake: data.stake,
      multiplier: option.multiplier,
    });
    if (error) return { ok: false as const, error: "SLIP FAILED — TRY AGAIN" };
    return { ok: true as const, targetHeight: target, multiplier: option.multiplier, error: null };
  });

/** Settle the caller's open slips whose block has been mined. */
export const settleBlockPropsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { FEE_WINDOW_BLOCKS, TX_THRESHOLD } = await import("@/lib/block-props");
    const tip = await fetchTipHeight();
    if (tip == null) return { settled: [] as SettledSlip[] };

    const { data: open } = await supabaseAdmin
      .from("block_props")
      .select("id, address, target_height, market, pick, stake, multiplier")
      .eq("user_id", context.userId)
      .eq("status", "open")
      .lte("target_height", tip)
      .limit(25);

    const settled: SettledSlip[] = [];
    for (const slip of open ?? []) {
      const height = Number(slip.target_height);
      const block = await fetchBlock(height);
      if (!block) continue;
      if (slip.market === "fee" && block.feeWindow.length < FEE_WINDOW_BLOCKS) continue;
      if (slip.market === "fee" && block.baselineFeeWindow.length < FEE_WINDOW_BLOCKS) continue;
      const poolName = (block.pool ?? "").toUpperCase();
      const feeMedian = median(block.feeWindow);
      const feeLine = median(block.baselineFeeWindow);
      const actual =
        slip.market === "txs"
          ? (block.txCount ?? 0) > TX_THRESHOLD
            ? "FULL"
            : "LIGHT"
          : slip.market === "pool"
            ? poolName.includes("FOUNDRY")
              ? "FOUNDRY"
              : poolName.includes("ANTPOOL")
                ? "ANTPOOL"
                : "FIELD"
            : feeMedian > feeLine
              ? "HIGH"
              : "STANDARD";
      const won = actual === slip.pick;
      const payout = won ? Math.round(Number(slip.stake) * Number(slip.multiplier)) : 0;
      const outcome =
        slip.market === "txs"
          ? `${(block.txCount ?? 0).toLocaleString("en-US")} TXS IN BLOCK`
          : slip.market === "pool"
            ? `MINED BY ${block.pool ?? "UNKNOWN POOL"}`
            : `10-BLOCK MEDIAN ${feeMedian.toFixed(2)} SAT/VB · LINE ${feeLine.toFixed(2)}`;

      if (won) {
        const { error } = await supabaseAdmin.rpc("coin_apply", {
          _address: slip.address as string,
          _delta: payout,
          _reason: "block_prop_payout",
          _ref: `prop_payout:${slip.id}`,
        });
        if (error) continue;
      }
      const { error: upErr } = await supabaseAdmin
        .from("block_props")
        .update({ status: won ? "won" : "lost", payout, outcome, settled_at: new Date().toISOString() })
        .eq("id", slip.id as string)
        .eq("status", "open");
      if (upErr) continue;
      settled.push({ id: slip.id as string, won, payout, outcome, market: slip.market as string, height });
    }
    return { settled };
  });

type SettledSlip = { id: string; won: boolean; payout: number; outcome: string; market: string; height: number };

const MEMPOOL = "https://mempool.space/api";

async function fetchTipHeight(): Promise<number | null> {
  try {
    const res = await fetch(`${MEMPOOL}/blocks/tip/height`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const height = Number((await res.text()).trim());
    return Number.isFinite(height) ? height : null;
  } catch {
    return null;
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

async function fetchBlock(height: number): Promise<{ pool: string | null; feeWindow: number[]; baselineFeeWindow: number[]; txCount: number | null } | null> {
  try {
    const res = await fetch(`${MEMPOOL}/v1/blocks/${height}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return null;
    const blocks = (await res.json()) as {
      height: number;
      tx_count?: number;
      extras?: { pool?: { name?: string } | null; medianFee?: number };
    }[];
    const match = blocks.find((b) => Number(b.height) === height);
    if (!match) return null;
    return {
      pool: match.extras?.pool?.name ?? null,
      feeWindow: blocks
        .filter((block) => block.height <= height && block.height > height - 10)
        .map((block) => block.extras?.medianFee)
        .filter((fee): fee is number => Number.isFinite(fee)),
      baselineFeeWindow: blocks
        .filter((block) => block.height < height && block.height >= height - 10)
        .map((block) => block.extras?.medianFee)
        .filter((fee): fee is number => Number.isFinite(fee)),
      txCount: match.tx_count ?? null,
    };
  } catch {
    return null;
  }
}

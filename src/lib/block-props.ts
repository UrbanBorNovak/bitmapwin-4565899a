import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * NEXT-BLOCK PROPS — fast BIT predictions on the next real Bitcoin block.
 * Everything settles against the mined block itself (transaction count,
 * mining pool, 10-block median fee rate) read from mempool.space. No odds are
 * simulated and no result is decided locally: the chain is the referee.
 * Every market must be genuinely unknowable before the block is mined —
 * the next height is always tip + 1, so height itself is never a market.
 */

export type PropMarket = "txs" | "pool" | "fee";

export type PropOption = { pick: string; label: string; multiplier: number };

export const PROP_MARKETS: readonly { market: PropMarket; title: string; note: string; options: readonly PropOption[] }[] = [
  {
    market: "txs",
    title: "BLOCK LOAD",
    note: "OVER 3,000 TRANSACTIONS IN THE NEXT BLOCK?",
    options: [
      { pick: "FULL", label: "FULL · OVER 3,000", multiplier: 1.9 },
      { pick: "LIGHT", label: "LIGHT · UNDER 3,000", multiplier: 1.9 },
    ],
  },
  {
    market: "pool",
    title: "MINING POOL",
    note: "WHO MINES THE NEXT BLOCK?",
    options: [
      { pick: "FOUNDRY", label: "FOUNDRY USA", multiplier: 2.2 },
      { pick: "ANTPOOL", label: "ANTPOOL", multiplier: 2.3 },
      { pick: "FIELD", label: "THE FIELD", multiplier: 3.8 },
    ],
  },
  {
    market: "fee",
    title: "FEE PRESSURE",
    note: "10-BLOCK MEDIAN FEE OVER 25 SAT/VB?",
    options: [
      { pick: "HIGH", label: "HIGH · OVER 25", multiplier: 1.9 },
      { pick: "STANDARD", label: "STANDARD · 25 OR LESS", multiplier: 1.9 },
    ],
  },
];

export const STAKES = [10, 25, 50] as const;
export const FEE_THRESHOLD = 25;
export const FEE_WINDOW_BLOCKS = 10;
export const TX_THRESHOLD = 3000;

export function optionFor(market: PropMarket, pick: string): PropOption | null {
  return PROP_MARKETS.find((m) => m.market === market)?.options.find((o) => o.pick === pick) ?? null;
}

export type BlockProp = {
  id: string;
  targetHeight: number;
  market: PropMarket;
  pick: string;
  stake: number;
  multiplier: number;
  status: "open" | "won" | "lost";
  payout: number;
  outcome: string | null;
  createdAt: string;
  settledAt: string | null;
};

export async function fetchMyProps(): Promise<BlockProp[]> {
  const { data } = await supabase
    .from("block_props")
    .select("id, target_height, market, pick, stake, multiplier, status, payout, outcome, created_at, settled_at")
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    targetHeight: Number(r.target_height),
    market: r.market as PropMarket,
    pick: r.pick as string,
    stake: Number(r.stake),
    multiplier: Number(r.multiplier),
    status: r.status as BlockProp["status"],
    payout: Number(r.payout),
    outcome: (r.outcome as string | null) ?? null,
    createdAt: r.created_at as string,
    settledAt: (r.settled_at as string | null) ?? null,
  }));
}

export const myPropsQuery = () =>
  queryOptions({ queryKey: ["block-props", "mine"], queryFn: fetchMyProps, staleTime: 10_000 });

export type ChainTipInfo = { height: number; timestamp: number };

/** Live chain tip straight from mempool.space — the clock the slips run on. */
export async function fetchChainTip(): Promise<ChainTipInfo> {
  const res = await fetch("https://mempool.space/api/v1/blocks", { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`CHAIN FEED ${res.status}`);
  const blocks = (await res.json()) as { height: number; timestamp: number }[];
  const tip = blocks[0];
  if (!tip) throw new Error("CHAIN FEED EMPTY");
  return { height: Number(tip.height), timestamp: Number(tip.timestamp) };
}

export const chainTipQuery = () =>
  queryOptions({
    queryKey: ["chain-tip", "props"],
    queryFn: fetchChainTip,
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: 1,
  });

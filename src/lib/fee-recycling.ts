/** Fee Recycling rule: how each platform fee would be split once mainnet recycling is switched on. */
export const RECYCLE_SPLIT = { pool: 50, reserve: 30, runway: 20 } as const;
export const FEE_RECYCLING_ACTIVE = false;
export const RECYCLE_STREAMS = ["Living Slab skins", "Oasis screens & billboards", "Forge & relic tributes"] as const;

/** Integer split; any rounding remainder goes to the pool so no sat is lost. */
export function splitFee(sats: number) {
  const s = Math.max(0, Math.floor(sats));
  const reserve = Math.floor((s * RECYCLE_SPLIT.reserve) / 100);
  const runway = Math.floor((s * RECYCLE_SPLIT.runway) / 100);
  return { pool: s - reserve - runway, reserve, runway };
}

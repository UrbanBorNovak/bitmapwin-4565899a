/**
 * BTC MINERS — the rigs a player builds out of minerals and runs for BIT.
 *
 * A rig is a normal world structure, so it is shared and persistent like every
 * other build. What it earns is not decided in the browser: the client only asks
 * the backend to settle the yield, and the backend counts the rigs that address
 * actually built, works out the hours since the last settlement and credits BIT
 * itself. The numbers here are only used to show a live estimate while you play.
 */

import { claimMinerYieldFn, minerYieldFn } from "./world-miner.functions";

/** on-chain GLB inscription of the BTC MINER rig */
export const MINER_INSCRIPTION =
  "2a3b60a02b6cde7f0cb5faf506306d8ab676beddd0d26cedd043a1546952e8e3i0";

/** BIT one rig mines in an hour, and the longest run it banks unattended. */
export const BIT_PER_RIG_HOUR = 6;
export const MAX_UNCLAIMED_HOURS = 24;

export type MinerYield = {
  rigs: number;
  /** BIT waiting to be settled right now */
  pending: number;
  /** BIT this address has already been paid for mining */
  paid: number;
  /** ISO time of the last settlement, when there has been one */
  lastClaim: string | null;
};

export async function readMinerYield(address: string): Promise<MinerYield> {
  return minerYieldFn({ data: { address } });
}

export async function claimMinerYield(address: string) {
  return claimMinerYieldFn({ data: { address } });
}

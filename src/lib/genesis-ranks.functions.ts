import { createServerFn } from "@tanstack/react-start";
import { backfillGenesisMinters, genesisRanks } from "@/lib/genesis-minters.server";

export const getGenesisRanksFn = createServerFn({ method: "GET" }).handler(async () => {
  await backfillGenesisMinters();
  return genesisRanks();
});

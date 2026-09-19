import { queryOptions } from "@tanstack/react-query";
import { getPublicPassportFn, listProvenanceStreamFn } from "@/lib/passport.functions";
import type { Passport, ProvenanceEvent } from "@/lib/passport";

export const provenanceStreamQuery = (filter = "all", limit = 40, wallet?: string, bitmapHeight?: number) =>
  queryOptions({
    queryKey: ["provenance-stream", filter, limit, wallet ?? "", bitmapHeight ?? null],
    queryFn: async (): Promise<ProvenanceEvent[]> => (await listProvenanceStreamFn({ data: { filter, limit, wallet, bitmapHeight } })).events,
    staleTime: 20_000,
  });
export const publicPassportQuery = (wallet: string) => queryOptions({
  queryKey: ["public-passport", wallet],
  queryFn: async (): Promise<Passport> => getPublicPassportFn({ data: { wallet } }),
  enabled: Boolean(wallet), staleTime: 30_000,
});

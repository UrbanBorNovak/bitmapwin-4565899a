import { queryOptions } from "@tanstack/react-query";
import { getClanStateFn, type ClanState } from "@/lib/clans.functions";

export type ClanBadge = { tag: string; crestInscriptionId: string };

export function clanImageUrl(inscriptionId: string) {
  return `https://ordinals.com/content/${inscriptionId}`;
}

export const clanStateQuery = (enabled: boolean) =>
  queryOptions<ClanState>({
    queryKey: ["clan-state"],
    queryFn: () => getClanStateFn(),
    enabled,
    staleTime: 20_000,
  });

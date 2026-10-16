import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { inhabitedQuery } from "@/lib/inhabited.functions";
import { allGuardiansQuery, guardianDnaQuery } from "@/lib/bitmon-queries";
import { verifyBitmon, type BitmonCheck } from "@/lib/bitmon-verify";

/** Every on-chain inscribed Bitmon with rarity/species re-derived from its block; unreadable ones stay unverified. */
export function useVerifiedBitmons() {
  const inhabited = useQuery(inhabitedQuery());
  const roster = useQuery(allGuardiansQuery());
  const heights = useMemo(() => [...(inhabited.data?.keys() ?? [])].sort((a, b) => a - b), [inhabited.data]);
  const dnas = useQueries({ queries: heights.map((h) => guardianDnaQuery(h)) });
  const checks = useMemo(() => {
    const stored = new Map((roster.data ?? []).map((g) => [g.height, { rarity: g.rarity, species: g.species }]));
    const m = new Map<number, BitmonCheck>();
    heights.forEach((h, i) => {
      const q = dnas[i];
      m.set(h, verifyBitmon({ inscribed: true, dna: q?.data, dnaState: q?.isPending ? "pending" : q?.isError ? "error" : "ok", stored: stored.get(h) ?? null }));
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heights, roster.data, dnas.map((d) => d.dataUpdatedAt + ":" + d.status).join()]);
  return { inhabited, checks };
}

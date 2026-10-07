import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getChainBlocks } from "@/lib/chain.functions";

/** Latest Bitcoin block height (0 while loading) — same query the full Oasis uses. */
export function useChainTip(): number {
  const fetchBlocks = useServerFn(getChainBlocks);
  const tip = useQuery({
    queryKey: ["chain", "tip", "map"],
    queryFn: async () => {
      const blocks = await fetchBlocks({ data: { pages: 1, scan: false } });
      return Math.max(...blocks.map((b) => b.height));
    },
    staleTime: 60_000,
  });
  return tip.data ?? 0;
}

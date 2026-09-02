import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { tradeCrawlProgressFn } from "@/lib/trade-crawler.functions";

/**
 * Live progress of the continuous on-chain sale crawler: how much of the
 * registry has been checked and how many confirmed sales it has found.
 */
export function TradeCrawlerStatus() {
  const progressFn = useServerFn(tradeCrawlProgressFn);

  useQuery({
    queryKey: ["trade-crawl", "progress"],
    queryFn: () => progressFn(),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  return (
    <div
      className="flex items-center gap-2 border border-border bg-card px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
      aria-label="Chain tracing is live"
    >
      <span className="h-1.5 w-1.5 animate-pulse bg-primary" aria-hidden />
      <span>TRACING</span>
      <span className="text-primary">LIVE</span>
    </div>
  );
}

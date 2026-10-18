import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { btcPriceQuery } from "@/lib/btc-price";

/**
 * Header price ticker: live BTC spot from mempool.space, with the tick
 * direction against the previous poll.
 */
export function BtcTicker({ className = "" }: { className?: string }) {
  const { data, isPending, isError } = useQuery(btcPriceQuery());
  const previous = useRef<number | null>(null);
  const [dir, setDir] = useState<"up" | "down" | "flat">("flat");

  useEffect(() => {
    if (!data) return;
    const prev = previous.current;
    if (prev !== null && prev !== data.usd) setDir(data.usd > prev ? "up" : "down");
    previous.current = data.usd;
  }, [data]);

  if (isError) return null;

  return (
    <div data-nosnippet
      className={`flex items-center gap-2 border border-border px-2 py-1 font-mono text-[10px] ${className}`}
      aria-live="polite"
      data-no-translate
    >
      <span className="text-muted-foreground">BTC</span>
      {isPending || !data ? (
        <span className="text-muted-foreground">
          …<span className="blink">_</span>
        </span>
      ) : (
        <>
          <span className={dir === "down" ? "text-muted-foreground" : "text-primary"}>
            ${Math.round(data.usd).toLocaleString("en-US")}
          </span>
          <span className={dir === "down" ? "text-muted-foreground" : "text-primary"}>
            {dir === "down" ? "▼" : dir === "up" ? "▲" : "•"}
          </span>
        </>
      )}
    </div>
  );
}

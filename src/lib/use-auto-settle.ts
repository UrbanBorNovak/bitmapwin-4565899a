import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { settleOffersFn } from "@/lib/settle.functions";
import { formatSats } from "@/lib/trades";

const INTERVAL_MS = 60_000;

/**
 * Background closer: sweeps the open offer book and settles every listing whose
 * inscription output has been spent on chain. Accepted bids linked to those
 * listings are closed server-side, so a holder never has to press anything after
 * accepting — the sale finishes itself once the buyer broadcasts.
 */
export function useAutoSettle(enabled: boolean) {
  const queryClient = useQueryClient();
  const running = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const pass = async () => {
      if (running.current) return;
      running.current = true;
      try {
        const result = await settleOffersFn({ data: { limit: 25 } });
        if (result.settled > 0) {
          void queryClient.invalidateQueries({ queryKey: ["bids"] });
          void queryClient.invalidateQueries({ queryKey: ["offers"] });
          void queryClient.invalidateQueries({ queryKey: ["wallet-offers"] });
          void queryClient.invalidateQueries({ queryKey: ["registry"] });
          void queryClient.invalidateQueries({ queryKey: ["trades"] });
          const sale = result.results.find((r) => r.settled && r.salePriceSats);
          toast(`${result.settled} SALE(S) CLOSED ON CHAIN`, {
            description: sale?.salePriceSats
              ? `${sale.bitmapHeight ?? "?"}.BITMAP SETTLED AT ${formatSats(sale.salePriceSats)}`
              : "OWNERSHIP AND LISTINGS UPDATED",
            duration: 10_000,
          });
        }
      } catch {
        // transient chain/provider failure — the next pass retries
      } finally {
        running.current = false;
      }
    };

    void pass();
    const id = window.setInterval(() => void pass(), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [enabled, queryClient]);
}

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Keeps the marketplace in sync with the offer book: any insert/update on
 * `offers` (a new listing, a settled sale) refreshes the registry read model
 * so new listings appear without a manual reload.
 */
export function useLiveOffers() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["registry"] });
      void queryClient.invalidateQueries({ queryKey: ["offers"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-offers"] });
    };

    const channel = supabase
      .channel("offers-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "offers" }, invalidate)
      .subscribe();

    // Fallback for environments where realtime is unavailable.
    const poll = window.setInterval(invalidate, 60_000);

    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

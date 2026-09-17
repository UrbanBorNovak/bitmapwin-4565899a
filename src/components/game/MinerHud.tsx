/**
 * MINING RIGS PANEL — what your BTC MINERs have earned, and the button that
 * settles it into your BIT balance.
 *
 * The figures come straight from the backend: it counts the rigs your address
 * built in the shared world and works out the BIT itself, so nothing here is
 * decided in the browser.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BIT_PER_RIG_HOUR, claimMinerYield, readMinerYield } from "@/lib/world-miner";
import { playSfx } from "@/lib/world-audio";
import { useState } from "react";

export function MinerHud({ address }: { address: string | null }) {
  const client = useQueryClient();
  const [note, setNote] = useState<string | null>(null);

  const yieldQuery = useQuery({
    queryKey: ["miner-yield", address],
    queryFn: () => readMinerYield(address!),
    enabled: Boolean(address),
    refetchInterval: 60_000,
  });

  const claim = useMutation({
    mutationFn: () => claimMinerYield(address!),
    onSuccess: (result) => {
      playSfx("nugget");
      setNote(result.credited > 0 ? `+${result.credited} BIT SETTLED` : "NOTHING MINED YET");
      void client.invalidateQueries({ queryKey: ["miner-yield", address] });
      void client.invalidateQueries({ queryKey: ["coin-balance"] });
    },
    onError: () => setNote("LINK AND VERIFY YOUR WALLET TO SETTLE MINED BIT"),
  });

  const data = yieldQuery.data;

  return (
    <div
      data-no-translate
      className="hud-panel absolute left-3 bottom-24 z-40 w-[min(15rem,calc(100%-1.5rem))] space-y-1 px-2.5 py-2 font-mono text-[10px]"
      aria-label="Mining rigs"
    >
      <span className="hud-telemetry-title">MINING RIGS · LIVE</span>
      {!address ? (
        <p className="text-muted-foreground">
          CONNECT A WALLET TO RUN RIGS · {BIT_PER_RIG_HOUR} BIT PER RIG PER HOUR
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">RIGS STANDING</span>
            <span className="hud-live">{data?.rigs ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">MINED, UNSETTLED</span>
            <span className="hud-live">{data?.pending ?? 0} BIT</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">PAID OUT</span>
            <span className="tabular-nums text-foreground">{data?.paid ?? 0} BIT</span>
          </div>
          <button
            type="button"
            onClick={() => claim.mutate()}
            disabled={claim.isPending || !(data?.pending ?? 0)}
            className="btn-term w-full py-1 text-[9px] disabled:opacity-40"
          >
            {claim.isPending ? "SETTLING…" : "SETTLE MINED BIT"}
          </button>
          {note ? <p className="text-muted-foreground">{note}</p> : null}
        </>
      )}
    </div>
  );
}

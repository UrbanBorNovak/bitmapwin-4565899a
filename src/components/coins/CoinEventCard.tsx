import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  closeCoinEvent,
  eventEntriesQuery,
  formatBit,
  type CoinEvent,
} from "@/lib/coins";
import { drawEventFn, enterEventFn } from "@/lib/coins.functions";
import { useWalletSession, walletControls } from "@/lib/wallet-session";
import { shortenAddress } from "@/lib/registry";

const KIND_LABEL: Record<string, string> = {
  raffle: "RAFFLE",
  giveaway: "GIVEAWAY",
  event: "EVENT",
};

/**
 * A builder-hosted raffle, giveaway or ticketed event. Entries are paid in BIT
 * and the coins land in the host's balance.
 */
export function CoinEventCard({ event }: { event: CoinEvent }) {
  const wallet = useWalletSession();
  const queryClient = useQueryClient();
  const [tickets, setTickets] = useState("1");
  const entries = useQuery(eventEntriesQuery([event.id]));

  const totalTickets = (entries.data ?? []).reduce((sum, e) => sum + e.tickets, 0);
  const pot = (entries.data ?? []).reduce((sum, e) => sum + e.spent, 0);
  const isHost = walletControls(wallet, event.hostAddress);
  const count = Math.max(1, Math.round(Number(tickets) || 1));
  const cost = count * event.entryCost;
  const ended = event.endsAt !== null && new Date(event.endsAt).getTime() <= Date.now();
  const open = event.status === "open" && !ended;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["coin-events"] });
    void queryClient.invalidateQueries({ queryKey: ["coin-event-entries"] });
    void queryClient.invalidateQueries({ queryKey: ["coin-balance"] });
    void queryClient.invalidateQueries({ queryKey: ["coin-ledger"] });
  };

  const enter = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error("CONNECT UNISAT OR XVERSE FIRST");
      return enterEventFn({
        data: { eventId: event.id, address: wallet.ordinalsAddress, tickets: count },
      });
    },
    onSuccess: () => {
      invalidate();
      toast(`ENTERED ${event.title.toUpperCase()}`, {
        description: `${count} TICKET(S) · ${formatBit(cost)} SPENT`,
      });
    },
    onError: (e) => toast("ENTRY FAILED", { description: (e as Error).message.toUpperCase() }),
  });

  const draw = useMutation({
    mutationFn: () => drawEventFn({ data: { eventId: event.id } }),
    onSuccess: (result) => {
      invalidate();
      toast("WINNER DRAWN", { description: shortenAddress(result.winnerAddress) });
    },
    onError: (e) => toast("DRAW FAILED", { description: (e as Error).message.toUpperCase() }),
  });

  const close = useMutation({
    mutationFn: () => closeCoinEvent(event.id),
    onSuccess: () => {
      invalidate();
      toast("EVENT CLOSED");
    },
    onError: (e) => toast("COULD NOT CLOSE", { description: (e as Error).message.toUpperCase() }),
  });

  return (
    <article className="border border-border p-5 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="display text-lg">{event.title.toUpperCase()}</h3>
        <span className="label">{KIND_LABEL[event.kind] ?? "EVENT"}</span>
      </div>

      <p className="font-mono text-[11px] text-muted-foreground">
        HOST {shortenAddress(event.hostAddress)}
        {event.bitmapHeight !== null ? (
          <>
            {" · "}
            <Link
              to="/bitmap/$block"
              params={{ block: String(event.bitmapHeight) }}
              className="hover:text-accent"
            >
              {event.bitmapHeight}.BITMAP
            </Link>
          </>
        ) : null}
      </p>

      {event.description ? (
        <p className="font-mono text-xs text-muted-foreground">{event.description}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="ENTRY" value={event.entryCost > 0 ? formatBit(event.entryCost) : "FREE"} />
        <Stat label="TICKETS" value={`${totalTickets}${event.maxEntries ? ` / ${event.maxEntries}` : ""}`} />
        <Stat label="POT" value={formatBit(pot)} />
        <Stat label="PRIZE" value={event.prize ? event.prize.toUpperCase() : "—"} />
      </div>

      {event.winnerAddress ? (
        <p className="font-mono text-[11px] text-accent">
          WINNER {shortenAddress(event.winnerAddress)}
        </p>
      ) : null}

      {open ? (
        <div className="flex flex-wrap items-center gap-2">
          {!isHost ? (
            <>
              <input
                className="w-20 border border-border bg-transparent px-3 py-2 font-mono text-xs"
                inputMode="numeric"
                aria-label="TICKETS"
                value={tickets}
                onChange={(e) => setTickets(e.target.value)}
              />
              <button
                type="button"
                className="btn-term !px-3 !py-1.5"
                disabled={enter.isPending || !wallet}
                onClick={() => enter.mutate()}
              >
                {enter.isPending ? "[ ENTERING… ]" : `[ ENTER ${formatBit(cost)} ]`}
              </button>
            </>
          ) : null}
          {isHost ? (
            <>
              <button
                type="button"
                className="btn-term !px-3 !py-1.5"
                disabled={draw.isPending || totalTickets === 0}
                onClick={() => draw.mutate()}
              >
                {draw.isPending ? "[ DRAWING… ]" : "[ DRAW WINNER ]"}
              </button>
              <button
                type="button"
                className="btn-term !px-3 !py-1.5"
                disabled={close.isPending}
                onClick={() => close.mutate()}
              >
                [ CLOSE ]
              </button>
            </>
          ) : null}
        </div>
      ) : (
        <p className="font-mono text-[11px] text-muted-foreground">
          &gt; {event.status === "drawn" ? "DRAWN" : "CLOSED"}
          {event.endsAt ? ` · ENDED ${new Date(event.endsAt).toLocaleDateString()}` : ""}
          <span className="blink">_</span>
        </p>
      )}
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="mt-1 font-mono text-xs">{value}</p>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { watchSettlementsFn } from "@/lib/settlement-watcher.functions";
import type {
  SettlementEvent,
  SettlementEventKind,
  SettlementWatchResult,
} from "@/lib/settlement-watcher";
import { formatSats } from "@/lib/trades";
import { shortenAddress } from "@/lib/registry";

const INTERVAL_MS = 30_000;
const MAX_LOG = 40;

const KIND_LABEL: Record<SettlementEventKind, string> = {
  settled: "SETTLED",
  pending: "IN MEMPOOL",
  "awaiting-broadcast": "AWAITING BROADCAST",
};

type LogLine = { at: string; text: string };

/**
 * Terminal-style settlement watcher. Each pass asks the chain whether an open
 * offer's reveal output has been spent by the buyer's completed PSBT. Confirmed
 * spends are settled on the spot — trades stored, offer closed — and the
 * registry, marketplace and detail views are refetched immediately.
 */
export function SettlementWatcher({ heights, limit = 40 }: { heights?: number[]; limit?: number }) {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<SettlementWatchResult | null>(null);
  const [events, setEvents] = useState<SettlementEvent[]>([]);
  const [log, setLog] = useState<LogLine[]>([]);
  const running = useRef(false);
  const settledSeen = useRef(new Set<string>());

  const push = useCallback((text: string) => {
    setLog((prev) =>
      [{ at: new Date().toISOString().slice(11, 19), text }, ...prev].slice(0, MAX_LOG),
    );
  }, []);

  const pass = useCallback(
    async (announce: boolean) => {
      if (running.current) return;
      running.current = true;
      setBusy(true);
      try {
        const result = await watchSettlementsFn({
          data: { limit, ...(heights && heights.length > 0 ? { heights } : {}) },
        });
        setLast(result);
        setEvents(result.events);

        const fresh = result.events.filter(
          (event) => event.kind === "settled" && !settledSeen.current.has(event.offerId),
        );
        for (const event of fresh) settledSeen.current.add(event.offerId);

        for (const event of result.events.slice(0, 8)) {
          const price = event.salePriceSats ?? event.askPriceSats;
          push(
            `${event.bitmapHeight ?? "?"}.BITMAP ${KIND_LABEL[event.kind]}${
              event.kind === "settled" ? ` ${formatSats(price)} → ${shortenAddress(event.ownerAddress)}` : ""
            }`,
          );
        }
        if (result.events.length === 0) push(`WATCHED ${result.watched} OFFER(S) — NO SPEND YET`);

        if (fresh.length > 0) {
          void queryClient.invalidateQueries({ queryKey: ["registry"] });
          void queryClient.invalidateQueries({ queryKey: ["trades"] });
          void queryClient.invalidateQueries({ queryKey: ["offers"] });
          void queryClient.invalidateQueries({ queryKey: ["wallet-offers"] });
          toast(`${fresh.length} SALE(S) SETTLED ON CHAIN`, {
            description: `${result.savedTrades} TRANSFER(S) STORED`,
          });
        } else if (announce) {
          toast("NO NEW SETTLEMENTS", {
            description: `${result.watched} OPEN OFFER(S) · ${result.pending} IN MEMPOOL`,
          });
        }
      } catch (error) {
        push(`SETTLEMENT WATCH FAILED — ${(error as Error).message.toUpperCase()}`);
        if (announce) toast("SETTLEMENT WATCH FAILED", { description: (error as Error).message });
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [heights, limit, push, queryClient],
  );

  useEffect(() => {
    if (!live) return;
    void pass(false);
    const id = window.setInterval(() => void pass(false), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [live, pass]);

  return (
    <section className="mt-12 border border-border">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border p-6">
        <div>
          <h2 className="display text-2xl">SETTLEMENT WATCHER</h2>
          <p className="label mt-2">
            FIRES WHEN A BUYER'S SIGNED OFFER SPENDS THE BITMAP'S REVEAL OUTPUT
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="label">
            {live ? (
              <>
                LIVE · EVERY {INTERVAL_MS / 1000}S<span className="blink">_</span>
              </>
            ) : (
              "IDLE"
            )}
          </span>
          <button className="btn-term-ghost" disabled={busy} onClick={() => void pass(true)}>
            {busy ? "[ CHECKING… ]" : "[ CHECK NOW ]"}
          </button>
          <button
            className={live ? "btn-term" : "btn-term-ghost"}
            onClick={() => setLive((v) => !v)}
          >
            {live ? "[ STOP WATCHING ]" : "[ START WATCHING ]"}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 border-b border-border sm:grid-cols-4">
        <Cell k="OPEN OFFERS" v={last ? String(last.watched) : "—"} />
        <Cell k="SETTLED" v={last ? String(last.settled) : "—"} />
        <Cell k="IN MEMPOOL" v={last ? String(last.pending) : "—"} />
        <Cell k="LAST PASS" v={last ? `${last.checkedAt.slice(11, 19)} UTC` : "—"} />
      </div>

      {events.length > 0 && (
        <ul className="divide-y divide-border border-b border-border">
          {events.map((event) => (
            <li
              key={event.offerId}
              className="flex flex-wrap items-baseline justify-between gap-3 p-5"
            >
              <div className="flex flex-wrap items-baseline gap-3">
                {event.bitmapHeight === null ? (
                  <span className="display text-sm">UNKNOWN BITMAP</span>
                ) : (
                  <Link
                    to="/bitmap/$block"
                    params={{ block: String(event.bitmapHeight) }}
                    className="display text-sm underline decoration-border underline-offset-4"
                  >
                    {event.bitmapHeight}.BITMAP
                  </Link>
                )}
                <span className="label">{KIND_LABEL[event.kind]}</span>
                <span className="label">
                  {formatSats(event.salePriceSats ?? event.askPriceSats)}
                </span>
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">
                {shortenAddress(event.sellerAddress)} → {shortenAddress(event.ownerAddress)}
                {event.confirmedHeight ? ` · BLOCK ${event.confirmedHeight}` : ""}
                <span className="block">&gt; {event.note}</span>
              </div>
              {event.spendingTxid && (
                <a
                  className="btn-term-ghost !px-3 !py-1.5"
                  href={`https://mempool.space/tx/${event.spendingTxid}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  TX
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="p-6">
        <p className="label">SETTLEMENT LOG</p>
        <ul className="mt-3 space-y-1 font-mono text-[11px] text-muted-foreground">
          {log.length === 0 ? (
            <li>
              &gt; WATCHER IDLE — PRESS [ START WATCHING ] TO POLL THE OFFER BOOK
              <span className="blink">_</span>
            </li>
          ) : (
            log.map((line, i) => (
              <li key={`${line.at}-${i}`}>
                &gt; {line.at} {line.text}
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-r border-border p-5 last:border-r-0">
      <div className="label">{k}</div>
      <div className="display mt-2 text-lg">{v}</div>
    </div>
  );
}

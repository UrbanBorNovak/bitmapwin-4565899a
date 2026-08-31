import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { watchTradesFn } from "@/lib/watcher.functions";
import type { WatchEvent, WatchResult } from "@/lib/watcher";
import { formatSats } from "@/lib/trades";
import { shortenAddress } from "@/lib/registry";

const INTERVAL_MS = 45_000;
const MAX_LOG = 40;

type LogLine = { at: string; text: string };

/**
 * Terminal-style watcher. Every pass asks the chain whether a parcel has spent
 * the output holding its inscription satoshi (the reveal output, or the last
 * recorded transfer). Real spends are traced, stored and pushed into the
 * registry and marketplace views immediately.
 */
export function TradeWatcher({ heights, limit = 40 }: { heights?: number[]; limit?: number }) {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<WatchResult | null>(null);
  const [events, setEvents] = useState<WatchEvent[]>([]);
  const [log, setLog] = useState<LogLine[]>([]);
  const running = useRef(false);

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
        const result = await watchTradesFn({
          data: { limit, ...(heights && heights.length > 0 ? { heights } : {}) },
        });
        setLast(result);
        if (result.events.length > 0) {
          setEvents((prev) => {
            const seen = new Set(prev.map((e) => `${e.txid}:${e.bitmapHeight}`));
            const fresh = result.events.filter((e) => !seen.has(`${e.txid}:${e.bitmapHeight}`));
            return [...fresh, ...prev].slice(0, 50);
          });
          for (const event of result.events.slice(0, 8)) {
            push(
              `${event.bitmapHeight}.BITMAP ${event.isSale ? `SOLD ${formatSats(event.priceSats)}` : "TRANSFERRED"} → ${shortenAddress(event.buyerAddress)}`,
            );
          }
          void queryClient.invalidateQueries({ queryKey: ["registry"] });
          void queryClient.invalidateQueries({ queryKey: ["trades"] });
          void queryClient.invalidateQueries({ queryKey: ["offers"] });
          void queryClient.invalidateQueries({ queryKey: ["wallet-offers"] });
          toast(`${result.events.length} ON-CHAIN TRANSFER(S) DETECTED`, {
            description: `${result.closedOffers} LISTING(S) CLOSED · ${result.spends} SPENT OUTPUT(S)`,
          });
        } else {
          push(`WATCHED ${result.watched} BITMAP(S) — NO NEW SPEND`);
          if (announce) {
            toast("NO NEW SPENDS", { description: `${result.watched} BITMAP(S) STILL UNMOVED` });
          }
        }
      } catch (error) {
        push(`WATCH FAILED — ${(error as Error).message.toUpperCase()}`);
        if (announce) toast("WATCH FAILED", { description: (error as Error).message });
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
          <h2 className="display text-2xl">TRADE WATCHER</h2>
          <p className="label mt-2">
            FIRES WHEN A BITMAP SPENDS THE OUTPUT HOLDING ITS INSCRIPTION SAT
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
            {busy ? "[ SCANNING… ]" : "[ SCAN NOW ]"}
          </button>
          <button className={live ? "btn-term" : "btn-term-ghost"} onClick={() => setLive((v) => !v)}>
            {live ? "[ STOP WATCHING ]" : "[ START WATCHING ]"}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 border-b border-border sm:grid-cols-4">
        <Cell k="BITMAPS WATCHED" v={last ? String(last.watched) : "—"} />
        <Cell k="SPENT OUTPUTS" v={last ? String(last.spends) : "—"} />
        <Cell k="TRANSFERS FOUND" v={String(events.length)} />
        <Cell k="LAST PASS" v={last ? last.checkedAt.slice(11, 19) + " UTC" : "—"} />
      </div>

      {events.length > 0 && (
        <ul className="divide-y divide-border border-b border-border">
          {events.map((event) => (
            <li
              key={`${event.txid}-${event.bitmapHeight}`}
              className="flex flex-wrap items-baseline justify-between gap-3 p-5"
            >
              <div className="flex flex-wrap items-baseline gap-3">
                <Link
                  to="/bitmap/$block"
                  params={{ block: String(event.bitmapHeight) }}
                  className="display text-sm underline decoration-border underline-offset-4"
                >
                  {event.bitmapHeight}.BITMAP
                </Link>
                <span className="label">
                  {event.isSale ? `SOLD ${formatSats(event.priceSats)}` : "TRANSFER"}
                </span>
                <span className="label">HOP {event.hop}</span>
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">
                {shortenAddress(event.sellerAddress)} → {shortenAddress(event.buyerAddress)}
                {event.blockHeight ? ` · BLOCK ${event.blockHeight}` : " · UNCONFIRMED"}
              </div>
              <a
                className="btn-term-ghost !px-3 !py-1.5"
                href={`https://mempool.space/tx/${event.txid}`}
                target="_blank"
                rel="noreferrer"
              >
                TX
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="p-6">
        <p className="label">WATCHER LOG</p>
        <ul className="mt-3 space-y-1 font-mono text-[11px] text-muted-foreground">
          {log.length === 0 ? (
            <li>
              &gt; WATCHER IDLE — PRESS [ START WATCHING ] TO POLL THE CHAIN
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

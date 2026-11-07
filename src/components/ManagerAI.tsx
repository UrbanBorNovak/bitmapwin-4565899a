import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { fetchPortfolioActivity } from "@/lib/portfolio-activity";
import { myWatchesQuery } from "@/lib/watches";
import { managerAdviceFn, type ManagerAdvice } from "@/lib/manager-ai.functions";
import { ManagerSuggestionAction } from "@/components/ManagerSuggestionAction";


const KIND_LABEL: Record<string, string> = {
  bid: "BID",
  build: "BUILD",
  lease: "LEASE",
  watch: "WATCH",
  note: "NOTE",
};

/**
 * BITMAP MANAGER AI — reads the holder's real watchlist + portfolio activity
 * and proposes bids, builds and lease renewals. Read-only advice.
 */
export function ManagerAI({
  addresses,
  heldHeights,
  enabled,
}: {
  addresses: string[];
  heldHeights: number[];
  enabled: boolean;
}) {
  const [question, setQuestion] = useState("");
  const watches = useQuery(myWatchesQuery(enabled));
  const watchedHeights = useMemo(
    () => (watches.data ?? []).map((w) => w.height),
    [watches.data],
  );

  const key = useMemo(
    () => [[...heldHeights].sort((a, b) => a - b), [...watchedHeights].sort((a, b) => a - b)],
    [heldHeights, watchedHeights],
  );

  const activity = useQuery({
    queryKey: ["portfolio-activity", key],
    queryFn: () =>
      fetchPortfolioActivity(supabase, {
        addresses,
        heldHeights,
        watchedHeights,
        windowHours: 24,
        limit: 12,
      }),
    enabled: enabled && (heldHeights.length > 0 || watchedHeights.length > 0),
    staleTime: 30_000,
  });

  const ask = useServerFn(managerAdviceFn);
  const advice = useMutation<ManagerAdvice, Error, void>({
    mutationFn: async () => {
      const data = activity.data;
      if (!data) throw new Error("No portfolio activity to read yet");
      return ask({
        data: {
          windowHours: data.windowHours,
          totals: data.totals,
          pulses: data.pulses.map((p) => ({
            height: p.height,
            held: p.held,
            watched: p.watched,
            visits: p.visits,
            previousVisits: p.previousVisits,
            visitChangePct: p.visitChangePct,
            totalViews: p.totalViews,
            newBids: p.newBids,
            topBidSats: p.topBidSats,
            trades: p.trades,
            buildKind: p.buildKind,
            buildUpdated: p.buildUpdated,
            leaseExpiresInDays: p.leaseExpiresInDays,
            leaseOffered: p.leaseOffered,
            coinEvents: p.coinEvents,
            chatMessages: p.chatMessages,
          })),
          watchlist: watchedHeights.slice(0, 200),
          ...(question.trim() ? { question: question.trim() } : {}),
        },
      });
    },
  });

  const ready = enabled && (heldHeights.length > 0 || watchedHeights.length > 0);
  const result = advice.data;

  return (
    <section className="border border-border">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="label">BITMAP MANAGER AI</h2>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            READS YOUR WATCHLIST + LAST 24H ACTIVITY — SUGGESTS BIDS, BUILDS, LEASE RENEWALS
          </p>
        </div>
        <button
          type="button"
          className="btn-term"
          disabled={!ready || activity.isLoading || advice.isPending}
          onClick={() => advice.mutate()}
        >
          {advice.isPending ? "[ THINKING… ]" : "[ ASK THE MANAGER ]"}
        </button>
      </header>

      <div className="space-y-3 p-4">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="OPTIONAL: WHAT SHOULD I DO WITH MY QUIET BITMAPS?"
          maxLength={400}
          className="w-full border border-border bg-transparent px-3 py-2 font-mono text-[11px] outline-none placeholder:text-muted-foreground focus:border-primary"
        />

        {!ready ? (
          <p className="font-mono text-[11px] text-muted-foreground">
            &gt; HOLD OR WATCH A BITMAP TO GIVE THE MANAGER SOMETHING TO READ_
          </p>
        ) : null}

        {advice.error ? (
          <p className="font-mono text-[11px] text-primary">
            &gt; {advice.error.message.toUpperCase()}
          </p>
        ) : null}

        {result ? (
          <>
            <p className="font-mono text-xs leading-relaxed">{result.briefing}</p>
            {result.suggestions.length === 0 ? null : (
              <ul className="divide-y divide-border border border-border">
                {result.suggestions.map((s, i) => (
                  <li key={`${s.kind}-${s.height ?? "x"}-${i}`} className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="label text-primary">{KIND_LABEL[s.kind] ?? "NOTE"}</span>
                      <span className="label text-muted-foreground">{s.priority.toUpperCase()}</span>
                      {s.height !== null ? (
                        <Link
                          to="/bitmap/$block"
                          params={{ block: String(s.height) }}
                          className="font-mono text-xs hover:text-primary"
                        >
                          #{s.height.toLocaleString("en-US")}
                        </Link>
                      ) : null}
                    </div>
                    <p className="mt-1 font-mono text-xs">{s.title}</p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">{s.detail}</p>
                    <div className="mt-2">
                      <ManagerSuggestionAction
                        suggestion={s}
                        held={s.height !== null && heldHeights.includes(s.height)}
                        topBidSats={
                          (s.height !== null
                            ? (activity.data?.pulses.find((p) => p.height === s.height)?.topBidSats ?? null)
                            : null)
                        }
                      />
                    </div>
                  </li>
                ))}

              </ul>
            )}
          </>
        ) : advice.isPending ? (
          <p className="font-mono text-[11px] text-muted-foreground">&gt; READING YOUR PORTFOLIO_</p>
        ) : null}
      </div>
    </section>
  );
}

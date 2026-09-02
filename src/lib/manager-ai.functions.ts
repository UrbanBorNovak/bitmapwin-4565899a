import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const pulseSchema = z.object({
  height: z.number().int().nonnegative(),
  held: z.boolean(),
  watched: z.boolean(),
  visits: z.number(),
  previousVisits: z.number(),
  visitChangePct: z.number().nullable(),
  totalViews: z.number(),
  newBids: z.number(),
  topBidSats: z.number().nullable(),
  trades: z.number(),
  buildKind: z.string().nullable(),
  buildUpdated: z.boolean(),
  leaseExpiresInDays: z.number().nullable(),
  leaseOffered: z.boolean(),
  coinEvents: z.number(),
  chatMessages: z.number(),
});

const inputSchema = z.object({
  windowHours: z.number().int().min(1).max(720),
  totals: z.object({
    visits: z.number(),
    newBids: z.number(),
    topBidSats: z.number().nullable(),
    trades: z.number(),
    buildUpdates: z.number(),
    leasesExpiringSoon: z.number(),
    coinEvents: z.number(),
  }),
  pulses: z.array(pulseSchema).max(40),
  watchlist: z.array(z.number().int().nonnegative()).max(200),
  question: z.string().trim().max(400).optional(),
});

export type ManagerSuggestion = {
  kind: "bid" | "build" | "lease" | "watch" | "note";
  height: number | null;
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
};

export type ManagerAdvice = {
  briefing: string;
  suggestions: ManagerSuggestion[];
};

const fmtSats = (n: number) => `${n.toLocaleString("en-US")} sats`;

/**
 * BITMAP MANAGER — turns the holder's real watchlist + portfolio activity
 * into concrete bid / build / lease actions.
 *
 * Runs entirely on-server with deterministic rules over the real activity
 * data: no AI model calls, no credit usage. Advisory only, never writes.
 */
export const managerAdviceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<ManagerAdvice> => {
    const { totals, pulses, watchlist, windowHours } = data;
    const suggestions: ManagerSuggestion[] = [];

    // 1. Bids on held bitmaps — highest priority, real money on the table.
    for (const p of pulses) {
      if (p.held && p.newBids > 0) {
        suggestions.push({
          kind: "bid",
          height: p.height,
          title: `Review ${p.newBids} new bid${p.newBids === 1 ? "" : "s"} on ${p.height}.BITMAP`,
          detail: `${p.newBids} bid${p.newBids === 1 ? "" : "s"} arrived in the last ${windowHours}h${
            p.topBidSats === null ? "" : `, top bid ${fmtSats(p.topBidSats)}`
          }. Accept, counter, or decline from the bid inbox on your dashboard.`,
          priority: "high",
        });
      }
    }

    // 2. Leases ending soon on held bitmaps.
    for (const p of pulses) {
      if (p.leaseExpiresInDays !== null && p.leaseExpiresInDays <= 7) {
        suggestions.push({
          kind: "lease",
          height: p.height,
          title: `Renew the lease on ${p.height}.BITMAP`,
          detail: `The active lease ends in ${p.leaseExpiresInDays} day${
            p.leaseExpiresInDays === 1 ? "" : "s"
          }. Renew or re-list it in BIT before it lapses to keep the revenue stream running.`,
          priority: p.leaseExpiresInDays <= 3 ? "high" : "medium",
        });
      }
    }

    // 3. Attention spikes — monetise traffic.
    const spiking = pulses
      .filter((p) => p.visits >= 5 && (p.visitChangePct === null || p.visitChangePct >= 25))
      .sort((a, b) => b.visits - a.visits);
    for (const p of spiking.slice(0, 3)) {
      if (!p.buildKind) {
        suggestions.push({
          kind: "build",
          height: p.height,
          title: `Build on ${p.height}.BITMAP while traffic is up`,
          detail: `${p.visits} visits in the last ${windowHours}h (previous window ${p.previousVisits}) with no build attached. An info page, gallery or shop converts that attention.`,
          priority: "high",
        });
      } else if (!p.buildUpdated) {
        suggestions.push({
          kind: "build",
          height: p.height,
          title: `Refresh the ${p.buildKind} build on ${p.height}.BITMAP`,
          detail: `${p.visits} visits in the last ${windowHours}h but the build has not been updated in this window. New assets or copy keep returning visitors engaged.`,
          priority: "medium",
        });
      }
      if (p.held && !p.leaseOffered && p.leaseExpiresInDays === null) {
        suggestions.push({
          kind: "lease",
          height: p.height,
          title: `Offer ${p.height}.BITMAP for lease`,
          detail: `Sustained attention (${p.visits} visits, ${p.totalViews} lifetime views) and no active lease — list it for BIT to earn from builders without selling.`,
          priority: "medium",
        });
      }
    }

    // 4. Watched bitmaps with real trade activity — buying window.
    for (const p of pulses) {
      if (!p.held && p.watched && (p.trades > 0 || p.newBids > 0)) {
        suggestions.push({
          kind: "bid",
          height: p.height,
          title: `Place a bid on watched ${p.height}.BITMAP`,
          detail: `${p.trades} on-chain trade${p.trades === 1 ? "" : "s"} and ${p.newBids} bid${
            p.newBids === 1 ? "" : "s"
          } in the last ${windowHours}h${
            p.topBidSats === null ? "" : `, top bid ${fmtSats(p.topBidSats)}`
          }. The market is live — bid now or set your ceiling.`,
          priority: p.trades > 0 ? "high" : "medium",
        });
      }
    }

    // 5. Active bitmaps that are not on the watchlist yet.
    const watchSet = new Set(watchlist);
    for (const p of pulses) {
      if (!p.held && !watchSet.has(p.height) && (p.visits >= 3 || p.chatMessages >= 3)) {
        suggestions.push({
          kind: "watch",
          height: p.height,
          title: `Start watching ${p.height}.BITMAP`,
          detail: `${p.visits} visits and ${p.chatMessages} chat messages in the last ${windowHours}h and it is not on your watchlist yet.`,
          priority: "low",
        });
      }
    }

    // 6. Chat / community signal on held bitmaps.
    for (const p of pulses) {
      if (p.held && p.chatMessages >= 5) {
        suggestions.push({
          kind: "note",
          height: p.height,
          title: `Reply in the ${p.height}.BITMAP chat`,
          detail: `${p.chatMessages} messages in the last ${windowHours}h. Answering visitors keeps the community on your BITMAP.`,
          priority: "low",
        });
      }
    }

    if (data.question) {
      suggestions.unshift({
        kind: "note",
        height: null,
        title: "Your note is scoped to this activity window",
        detail: `"${data.question}" — the manager answers from your recorded activity only. The signals below cover the last ${windowHours}h across ${pulses.length} BITMAP${
          pulses.length === 1 ? "" : "s"
        }.`,
        priority: "low",
      });
    }

    const rank = { high: 0, medium: 1, low: 2 } as const;
    suggestions.sort((a, b) => rank[a.priority] - rank[b.priority]);
    const trimmed = suggestions.slice(0, 8);

    const briefing =
      pulses.length === 0
        ? `Quiet window. No recorded activity across your held or watched BITMAPs in the last ${windowHours}h${
            watchlist.length > 0 ? `, and your watchlist of ${watchlist.length} is idle` : ""
          }. Nothing needs your attention right now.`
        : [
            `Last ${windowHours}h across ${pulses.length} BITMAP${pulses.length === 1 ? "" : "s"}: ${totals.visits} visits, ${totals.newBids} new bid${
              totals.newBids === 1 ? "" : "s"
            }${totals.topBidSats === null ? "" : ` (top ${fmtSats(totals.topBidSats)})`}, ${totals.trades} on-chain trade${
              totals.trades === 1 ? "" : "s"
            }.`,
            `${totals.buildUpdates} build update${totals.buildUpdates === 1 ? "" : "s"}, ${totals.leasesExpiringSoon} lease${
              totals.leasesExpiringSoon === 1 ? "" : "s"
            } ending soon, ${totals.coinEvents} BIT event${totals.coinEvents === 1 ? "" : "s"}.`,
            trimmed.length === 0
              ? "Nothing is urgent — hold position and keep watching."
              : `${trimmed.filter((s) => s.priority === "high").length} action${
                  trimmed.filter((s) => s.priority === "high").length === 1 ? "" : "s"
                } need attention first.`,
          ].join(" ");

    return { briefing, suggestions: trimmed };
  });


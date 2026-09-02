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

const suggestionShape = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "height", "title", "detail", "priority"],
  properties: {
    kind: { type: "string", enum: ["bid", "build", "lease", "watch", "note"] },
    height: { type: ["integer", "null"] },
    title: { type: "string" },
    detail: { type: "string" },
    priority: { type: "string", enum: ["high", "medium", "low"] },
  },
} as const;

/**
 * BITMAP MANAGER AI — turns the holder's real watchlist + portfolio activity
 * into concrete bid / build / lease actions. Advisory text only, no writes.
 */
export const managerAdviceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<ManagerAdvice> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project");

    const lines = data.pulses.map((p) => {
      const bits = [
        `#${p.height}`,
        p.held ? "held" : p.watched ? "watchlist" : "tracked",
        `${p.visits} visits (prev ${p.previousVisits}${p.visitChangePct === null ? "" : `, ${p.visitChangePct}%`})`,
        `${p.totalViews} lifetime views`,
        `${p.newBids} new bids${p.topBidSats === null ? "" : ` top ${p.topBidSats} sats`}`,
        `${p.trades} on-chain trades`,
        p.buildKind ? `build ${p.buildKind}${p.buildUpdated ? " (updated)" : ""}` : "no build",
        p.leaseExpiresInDays === null ? "no active lease" : `lease ends in ${p.leaseExpiresInDays}d`,
        p.leaseOffered ? "lease offer open" : "not offered for lease",
        `${p.coinEvents} BIT events`,
        `${p.chatMessages} chat msgs`,
      ];
      return `- ${bits.join(" | ")}`;
    });

    const prompt = [
      `Window: last ${data.windowHours}h.`,
      `Totals: ${data.totals.visits} visits, ${data.totals.newBids} new bids, top bid ${data.totals.topBidSats ?? 0} sats, ${data.totals.trades} trades, ${data.totals.buildUpdates} build updates, ${data.totals.leasesExpiringSoon} leases ending soon, ${data.totals.coinEvents} BIT events.`,
      `Watchlist heights: ${data.watchlist.length > 0 ? data.watchlist.join(", ") : "none"}.`,
      "Per-bitmap activity:",
      lines.length > 0 ? lines.join("\n") : "- no recorded activity in this window",
      data.question ? `Holder question: ${data.question}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are the BITMAP MANAGER, a property manager for Bitcoin Bitmap digital land. You only reason from the supplied real activity data; never invent numbers or bitmaps not listed. Say BITMAP, never PARCEL. Prices are sats. Give a 2-3 sentence briefing, then 2-6 concrete actions: accept/counter/place bids, build or refresh a build, list or renew a lease, or start watching a bitmap. Each action must cite the real signal that justifies it. If activity is quiet, say so plainly instead of padding.",
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "manager_advice",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["briefing", "suggestions"],
              properties: {
                briefing: { type: "string" },
                suggestions: { type: "array", items: suggestionShape },
              },
            },
          },
        },
      }),
    });

    if (res.status === 429) throw new Error("AI rate limit reached — try again in a minute");
    if (res.status === 402) throw new Error("AI credits exhausted for this workspace");
    if (!res.ok) {
      console.error("manager ai gateway error", res.status, await res.text());
      throw new Error("Manager AI is unavailable right now");
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    let parsed: ManagerAdvice;
    try {
      parsed = JSON.parse(content) as ManagerAdvice;
    } catch {
      return { briefing: content.trim() || "No advice returned.", suggestions: [] };
    }
    return {
      briefing: String(parsed.briefing ?? "").trim(),
      suggestions: (parsed.suggestions ?? []).slice(0, 8).map((s) => ({
        kind: s.kind,
        height: typeof s.height === "number" ? s.height : null,
        title: String(s.title ?? ""),
        detail: String(s.detail ?? ""),
        priority: s.priority ?? "medium",
      })),
    };
  });

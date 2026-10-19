import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { blockSizeMapQuery } from "@/lib/block-bytes";
import { packParcels } from "@/components/TerritoryCanvas";
import { DataBadge } from "@/components/extenders/DataBadge";
import { SpiderHunter } from "@/components/bot/SpiderHunter";
import {
  BOT_PRESETS,
  POLL_MS,
  STARTER_REPO,
  listingsQuery,
  matches,
  newMatches,
  starterConfig,
  type BotListing,
  type BotRule,
} from "@/lib/market-bot";

export const Route = createFileRoute("/bot")({
  head: () => {
    const title = "Market Bot — BITMAP Listing Alerts | BitmapWin";
    const description =
      "Set a rule, keep the tab open and get alerted the moment a matching BITMAP lists. Export the same rule to the open-source bot starter for 24/7 alerts.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  validateSearch: (s: Record<string, unknown>): BotSearch => ({
    maxSats: optInt(s["maxSats"]),
    minHeight: optInt(s["minHeight"]),
    maxHeight: optInt(s["maxHeight"]),
  }),
  component: BotPage,
});

type BotSearch = { maxSats?: number | undefined; minHeight?: number | undefined; maxHeight?: number | undefined };
function optInt(v: unknown): number | undefined {
  const n = Number(v);
  return v === undefined || v === "" || !Number.isFinite(n) || n < 0 ? undefined : Math.floor(n);
}

const num = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.floor(Number(v))));

function chime() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.6);
  } catch {
    /* audio unavailable */
  }
}

function BotPage() {
  const search = Route.useSearch();
  const fromMarket = search.maxSats !== undefined || search.minHeight !== undefined || search.maxHeight !== undefined;
  const [rule, setRule] = useState<BotRule>(() =>
    fromMarket
      ? { name: "MARKETPLACE FILTERS", maxSats: search.maxSats ?? null, minHeight: search.minHeight ?? null, maxHeight: search.maxHeight ?? null, seller: null }
      : BOT_PRESETS[0]!,
  );
  const [running, setRunning] = useState(false);
  const [listings, setListings] = useState<BotListing[]>([]);
  const [alerts, setAlerts] = useState<BotListing[]>([]);
  const [lastPoll, setLastPoll] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    seen.current = new Set();
  }, [rule]);

  useEffect(() => {
    let cancelled = false;
    let first = true;
    const poll = async () => {
      try {
        const r = await fetch(`/api/public/market/listings?${listingsQuery(rule)}`);
        if (!r.ok) throw new Error(r.status === 429 ? "Slowing down — too many checks." : `Market check failed (${r.status})`);
        const data = (await r.json()) as { listings: BotListing[] };
        if (cancelled) return;
        setListings(data.listings);
        setError(null);
        setLastPoll(new Date().toLocaleTimeString());
        const fresh = newMatches(rule, data.listings, seen.current);
        data.listings.forEach((l) => seen.current.add(l.id));
        if (running && !first && fresh.length) {
          setAlerts((a) => [...fresh, ...a].slice(0, 30));
          chime();
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification(`${fresh.length} BITMAP match${fresh.length > 1 ? "es" : ""}`, {
              body: fresh.map((f) => `${f.bitmap_height}.bitmap · ${f.price_sats.toLocaleString()} sats`).join("\n"),
            });
          }
        }
        first = false;
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Market check failed");
      }
    };
    void poll();
    if (!running) return () => { cancelled = true; };
    const t = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [rule, running]);

  const current = listings.filter((l) => matches(rule, l));
  const huntList = listings.slice(0, 12);
  const maps = useQueries({ queries: huntList.map((l) => blockSizeMapQuery(l.bitmap_height)) });
  const mapKey = maps.map((m) => (m.data ? 1 : 0)).join("");
  const packs = useMemo(
    () => maps.map((m) => (m.data?.classes?.length ? packParcels(m.data.classes) : null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapKey, huntList.map((l) => l.id).join()],
  );

  const start = async () => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission().catch(() => undefined);
    }
    setRunning(true);
  };

  const download = () => {
    const blob = new Blob([starterConfig(rule)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bitmapwin-bot.config.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const field = (label: string, value: number | string | null, set: (v: string) => void, ph: string) => (
    <label className="block">
      <span className="label text-muted-foreground">{label}</span>
      <input
        value={value ?? ""}
        placeholder={ph}
        onChange={(e) => set(e.target.value)}
        className="mt-1 w-full border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-bitcoin"
      />
    </label>
  );

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10 md:px-8 md:py-14">
      <div className="label text-bitcoin">MARKET · BOT</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">MARKET BOT</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        Pick a rule and keep this tab open. When a matching BITMAP lists, you hear a chime and get a notification. Buying
        always goes through your own wallet — the bot never buys for you.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <DataBadge kind="live" note="REAL LISTINGS" />
        <Link to="/marketplace" className="btn-term-ghost">[ MARKETPLACE ]</Link>
        <Link to="/api" className="btn-term-ghost">[ API ]</Link>
      </div>

      <section className="mt-8 border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
          <span className="label text-bitcoin">TRADING HUNTER</span>
          <span className="label text-signal" data-no-translate>
            {running ? "● ACTIVE PATROL" : "○ IDLE PATROL"} · NODES {Math.min(listings.length, 12)} · TARGETS {current.length}
          </span>
        </div>
        <SpiderHunter
          running={running}
          targets={huntList.map((l, i) => ({
            id: l.id,
            parcels: packs[i]?.parcels,
            grid: packs[i]?.grid,
            label: `${l.bitmap_height}.bitmap`,
            price: l.price_sats,
            hot: matches(rule, l),
          }))}
        />
        <p className="label border-t border-border px-4 py-2 text-muted-foreground">
          The hunter scans real open listings; orange nodes match your rule. It only points — you buy in your own wallet.
        </p>
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-[360px_1fr]">
        <section className="border border-border bg-surface p-5">
          <h2 className="display text-lg">RULE</h2>
          <div className="mt-3 flex flex-wrap gap-1">
            {BOT_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setRule(p)}
                className={`label border px-2 py-1.5 ${rule.name === p.name ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground"}`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {field("MAX PRICE (SATS)", rule.maxSats, (v) => setRule({ ...rule, maxSats: num(v) }), "any")}
            {field("FROM BLOCK", rule.minHeight, (v) => setRule({ ...rule, minHeight: num(v) }), "0")}
            {field("TO BLOCK", rule.maxHeight, (v) => setRule({ ...rule, maxHeight: num(v) }), "any")}
            {field("SELLER ADDRESS", rule.seller, (v) => setRule({ ...rule, seller: v.trim() || null }), "any")}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {running ? (
              <button type="button" className="btn-term-ghost" onClick={() => setRunning(false)}>[ STOP WATCHING ]</button>
            ) : (
              <button type="button" className="btn-term" onClick={start}>START WATCHING</button>
            )}
          </div>
          <p className="label mt-3 text-muted-foreground">
            {running ? "● WATCHING" : "○ PAUSED"} · CHECKS EVERY {POLL_MS / 1000}S{lastPoll ? ` · LAST ${lastPoll}` : ""}
          </p>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </section>

        <section className="border border-border bg-surface p-5">
          <h2 className="display text-lg">NEW ALERTS</h2>
          {alerts.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nothing new yet. New matches appear here while watching.</p>
          ) : (
            <ListingList items={alerts} accent />
          )}
          <h2 className="display mt-6 text-lg">MATCHING NOW · {current.length}</h2>
          {current.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No open listing matches this rule right now.</p>
          ) : (
            <ListingList items={current.slice(0, 25)} />
          )}
        </section>
      </div>

      <section className="mt-8 border border-border p-6">
        <h2 className="display text-xl">RUN IT 24/7</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Want alerts with the tab closed? Download this rule and drop it into the free, open-source bot starter. It
          only watches and alerts; you still sign every purchase in your wallet.
        </p>
        <pre className="mt-3 max-h-56 overflow-auto bg-secondary p-4 font-mono text-xs" data-no-translate>{starterConfig(rule)}</pre>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-term" onClick={download}>DOWNLOAD RULE</button>
          <a href={`${STARTER_REPO}/generate`} target="_blank" rel="noreferrer" className="btn-term-ghost">[ COPY THE BOT STARTER ]</a>
          <a href={STARTER_REPO} target="_blank" rel="noreferrer" className="btn-term-ghost">[ VIEW ON GITHUB ]</a>
        </div>
      </section>
    </div>
  );
}

function ListingList({ items, accent }: { items: BotListing[]; accent?: boolean }) {
  return (
    <ul className="mt-3 divide-y divide-border border border-border">
      {items.map((l) => (
        <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2">
          <span className={`font-mono text-sm ${accent ? "text-bitcoin" : ""}`} data-no-translate>{l.bitmap_height}.bitmap</span>
          <span className="font-mono text-xs text-signal" data-no-translate>{l.price_sats.toLocaleString()} sats</span>
          <Link to="/bitmap/$block" params={{ block: String(l.bitmap_height) }} className="label text-muted-foreground hover:text-bitcoin">
            VIEW →
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Market Bot: member-facing rules matching the bitmapwin-bot-starter repo.
 * Pure matching + config export; the watchdog only reads the public API and
 * never signs or broadcasts anything.
 */
export type BotRule = {
  name: string;
  maxSats: number | null;
  minHeight: number | null;
  maxHeight: number | null;
  seller: string | null;
};

export type BotListing = {
  id: string;
  bitmap_height: number;
  price_sats: number;
  seller_address: string;
  on_hold?: boolean;
};

export const BOT_PRESETS: BotRule[] = [
  { name: "SUB-100K FLOOR", maxSats: 200_000, minHeight: 0, maxHeight: 99_999, seller: null },
  { name: "ROUND-NUMBER HUNTER", maxSats: null, minHeight: null, maxHeight: null, seller: null },
  { name: "CHEAP ANYTHING", maxSats: 50_000, minHeight: null, maxHeight: null, seller: null },
];

export const STARTER_REPO = "https://github.com/UrbanBorNovak/bitmapwin-bot-starter";
export const POLL_MS = 30_000;

export function matches(rule: BotRule, l: BotListing): boolean {
  if (l.on_hold) return false;
  if (rule.maxSats !== null && l.price_sats > rule.maxSats) return false;
  if (rule.minHeight !== null && l.bitmap_height < rule.minHeight) return false;
  if (rule.maxHeight !== null && l.bitmap_height > rule.maxHeight) return false;
  if (rule.seller && l.seller_address !== rule.seller) return false;
  if (rule.name === "ROUND-NUMBER HUNTER" && l.bitmap_height % 1000 !== 0) return false;
  return true;
}

/** Listings matching the rule that were not seen in a previous poll. */
export function newMatches(rule: BotRule, listings: BotListing[], seen: Set<string>): BotListing[] {
  return listings.filter((l) => matches(rule, l) && !seen.has(l.id));
}

/** Query string for /api/public/market/listings that pre-filters server-side. */
export function listingsQuery(rule: BotRule): string {
  const p = new URLSearchParams({ sort: "price_asc", limit: "200" });
  if (rule.maxSats !== null) p.set("max_sats", String(rule.maxSats));
  if (rule.seller) p.set("seller", rule.seller);
  return p.toString();
}

/** Config file for running the same rule 24/7 with the bot starter. */
export function starterConfig(rule: BotRule): string {
  return JSON.stringify(
    {
      baseUrl: "https://bitmapwin.app",
      pollSeconds: POLL_MS / 1000,
      strategy: rule.name,
      filters: {
        max_sats: rule.maxSats,
        min_height: rule.minHeight,
        max_height: rule.maxHeight,
        seller: rule.seller,
        round_thousands: rule.name === "ROUND-NUMBER HUNTER",
      },
      autoBuy: false,
      note: "Alerts only. Signing always happens in your own wallet.",
    },
    null,
    2,
  );
}

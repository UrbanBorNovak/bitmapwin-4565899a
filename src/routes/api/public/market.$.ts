import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Public trading API for players and bots: /api/public/market/<endpoint>.
 * Reads are open. Every write is proven by Bitcoin itself: listings are
 * seller-signed PSBTs, cancels and bids are BIP-322 signatures, and buys are
 * PSBTs the buyer signs locally. The server never holds or uses anyone's keys.
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept",
};

const address = z
  .string()
  .trim()
  .regex(/^(bc1[a-z0-9]{8,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/, "Not a valid Bitcoin address");
const psbt = z.string().min(40).max(400_000).regex(/^[A-Za-z0-9+/=\s]+$/, "Must be base64 PSBT");

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { ...CORS, "cache-control": "no-store" } });

function db() {
  return import("@supabase/supabase-js").then(({ createClient }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    return createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
  });
}

const LISTING_COLS =
  "id, bitmap_height, inscription_id, outpoint, price_sats, seller_address, status, psbt_base64, reserved_until, created_at";

async function listings(url: URL) {
  const q = z
    .object({
      height: z.coerce.number().int().min(0).optional(),
      min_sats: z.coerce.number().int().min(0).optional(),
      max_sats: z.coerce.number().int().min(0).optional(),
      seller: address.optional(),
      sort: z.enum(["price_asc", "price_desc", "recent"]).default("price_asc"),
      limit: z.coerce.number().int().min(1).max(200).default(50),
      offset: z.coerce.number().int().min(0).max(100_000).default(0),
    })
    .parse(Object.fromEntries(url.searchParams));
  let query = (await db()).from("offers").select(LISTING_COLS).eq("status", "open");
  if (q.height !== undefined) query = query.eq("bitmap_height", q.height);
  if (q.min_sats !== undefined) query = query.gte("price_sats", q.min_sats);
  if (q.max_sats !== undefined) query = query.lte("price_sats", q.max_sats);
  if (q.seller) query = query.eq("seller_address", q.seller);
  query =
    q.sort === "recent"
      ? query.order("created_at", { ascending: false })
      : query.order("price_sats", { ascending: q.sort === "price_asc" });
  const { data, error } = await query.range(q.offset, q.offset + q.limit - 1);
  if (error) throw new Error(error.message);
  const now = Date.now();
  return {
    listings: (data ?? []).map((o) => ({
      ...o,
      price_btc: o.price_sats / 1e8,
      on_hold: !!o.reserved_until && new Date(o.reserved_until).getTime() > now,
    })),
    limit: q.limit,
    offset: q.offset,
  };
}

async function bids(url: URL) {
  const q = z
    .object({
      height: z.coerce.number().int().min(0).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    })
    .parse(Object.fromEntries(url.searchParams));
  let query = (await db())
    .from("bids")
    .select("id, bitmap_height, bidder_address, price_sats, expires_at, status, created_at")
    .eq("status", "open");
  if (q.height !== undefined) query = query.eq("bitmap_height", q.height);
  const { data, error } = await query.order("price_sats", { ascending: false }).limit(q.limit);
  if (error) throw new Error(error.message);
  const now = Date.now();
  return { bids: (data ?? []).filter((b) => !b.expires_at || new Date(b.expires_at).getTime() > now) };
}

async function trades(url: URL) {
  const q = z
    .object({
      height: z.coerce.number().int().min(0).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    })
    .parse(Object.fromEntries(url.searchParams));
  let query = (await db())
    .from("trades")
    .select("txid, bitmap_height, inscription_id, price_sats, seller_address, buyer_address, block_height, block_time, created_at")
    .gt("price_sats", 0);
  if (q.height !== undefined) query = query.eq("bitmap_height", q.height);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(q.limit);
  if (error) throw new Error(error.message);
  return {
    trades: (data ?? []).map((t) => ({ ...t, confirmed: t.block_height !== null })),
  };
}

async function orderbook(url: URL) {
  const depth = Math.min(Math.max(Number(url.searchParams.get("depth")) || 20, 1), 100);
  const [{ listings: asks }, { bids: bidRows }, { trades: tape }] = await Promise.all([
    listings(new URL(`http://x/?sort=price_asc&limit=${depth}`)),
    bids(new URL(`http://x/?limit=${depth}`)),
    trades(new URL("http://x/?limit=200")),
  ]);
  const bestAsk = asks[0]?.price_sats ?? null;
  const bestBid = bidRows[0]?.price_sats ?? null;
  const dayAgo = Date.now() - 86_400_000;
  const day = tape.filter((t) => new Date(t.block_time ?? t.created_at).getTime() >= dayAgo);
  return {
    best_ask: bestAsk,
    best_bid: bestBid,
    spread: bestAsk !== null && bestBid !== null ? bestAsk - bestBid : null,
    mid: bestAsk !== null && bestBid !== null ? Math.round((bestAsk + bestBid) / 2) : null,
    last_price: tape[0]?.price_sats ?? null,
    volume_24h_sats: day.reduce((s, t) => s + t.price_sats, 0),
    trades_24h: day.length,
    asks: asks.map((a) => ({ id: a.id, bitmap_height: a.bitmap_height, price_sats: a.price_sats, on_hold: a.on_hold })),
    bids: bidRows.map((b) => ({ id: b.id, bitmap_height: b.bitmap_height, price_sats: b.price_sats })),
  };
}

async function verify(addr: string, message: string, signature: string) {
  const { Verifier } = await import("bip322-js");
  let ok = false;
  try {
    ok = Verifier.verifySignature(addr, message, signature);
  } catch {
    ok = false;
  }
  if (!ok) throw new Error("SIGNATURE DOES NOT MATCH THE ADDRESS");
}

async function post(path: string, request: Request) {
  if (path === "listings") {
    const raw = (await request.text()).trim();
    const body = raw.startsWith("{") ? z.object({ psbt }).parse(JSON.parse(raw)).psbt : psbt.parse(raw);
    const { submitOffer } = await import("@/lib/offers.server");
    const offer = await submitOffer(body.replace(/\s+/g, ""));
    return json(offer, offer.duplicate ? 200 : 201);
  }
  const body = await request.json().catch(() => ({}));
  if (path === "listings/cancel") {
    const d = z.object({ offerId: z.string().uuid(), signature: z.string().min(8).max(2000) }).parse(body);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { unlistMessage } = await import("@/lib/offers");
    const { data: offer } = await supabaseAdmin
      .from("offers")
      .select("id, status, seller_address")
      .eq("id", d.offerId)
      .maybeSingle();
    if (!offer || offer.status !== "open" || !offer.seller_address) return json({ error: "LISTING NOT OPEN" }, 404);
    await verify(offer.seller_address, unlistMessage(offer.id), d.signature);
    await supabaseAdmin.from("offers").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", offer.id).eq("status", "open");
    return json({ ok: true, offerId: offer.id });
  }
  if (path === "buy/prepare") {
    const d = z
      .object({
        offerId: z.string().uuid(),
        buyerPaymentAddress: address,
        buyerOrdinalsAddress: address,
        tapInternalKeyHex: z.string().regex(/^[0-9a-fA-F]{64}$/).optional(),
        paymentPublicKeyHex: z.string().regex(/^[0-9a-fA-F]{66}$|^[0-9a-fA-F]{130}$/).optional(),
      })
      .parse(body);
    const { buildPurchase } = await import("@/lib/purchase.server");
    return json(await buildPurchase(d));
  }
  if (path === "buy/broadcast") {
    const d = z.object({ offerId: z.string().uuid(), psbt, buyerAddress: address }).parse(body);
    const { submitPurchase } = await import("@/lib/purchase.server");
    return json(await submitPurchase({ offerId: d.offerId, psbtBase64: d.psbt, buyerAddress: d.buyerAddress }));
  }
  if (path === "buy/release") {
    const d = z.object({ offerId: z.string().uuid(), buyerAddress: address }).parse(body);
    const { releaseReservation } = await import("@/lib/purchase.server");
    return json({ released: await releaseReservation(d.offerId, d.buyerAddress) });
  }
  if (path === "bids") {
    const d = z
      .object({
        bitmapHeight: z.number().int().min(0).max(10_000_000),
        bidderAddress: address,
        priceSats: z.number().int().min(546).max(2_100_000_000_000_000),
        expiresInHours: z.number().min(1).max(24 * 90).optional(),
        signature: z.string().min(8).max(2000),
      })
      .parse(body);
    const { bidMessage } = await import("@/lib/bids");
    await verify(d.bidderAddress, bidMessage(d.bitmapHeight, d.priceSats, d.bidderAddress), d.signature);
    const { placeBid } = await import("@/lib/bids.server");
    return json(await placeBid(d), 201);
  }
  if (path === "bids/cancel") {
    const d = z.object({ bidId: z.string().uuid(), address, signature: z.string().min(8).max(2000) }).parse(body);
    const { bidActionMessage } = await import("@/lib/bids");
    await verify(d.address, bidActionMessage("cancel", d.bidId, d.address), d.signature);
    const { cancelBid } = await import("@/lib/bids.server");
    return json(await cancelBid(d.bidId, d.address));
  }
  return json({ error: "Unknown endpoint", docs: "/api" }, 404);
}

export const Route = createFileRoute("/api/public/market/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const path = (params._splat ?? "").replace(/\/+$/, "");
        try {
          if (path === "listings") return json(await listings(url));
          if (path === "bids") return json(await bids(url));
          if (path === "trades") return json(await trades(url));
          if (path === "orderbook") return json(await orderbook(url));
          if (path === "" || path === "status")
            return json({ ok: true, endpoints: ["listings", "orderbook", "trades", "bids"], docs: "https://bitmapwin.app/api" });
          return json({ error: "Unknown endpoint", docs: "/api" }, 404);
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Bad request" }, e instanceof z.ZodError ? 400 : 500);
        }
      },
      POST: async ({ request, params }) => {
        try {
          return await post((params._splat ?? "").replace(/\/+$/, ""), request);
        } catch (e) {
          if (e instanceof z.ZodError) return json({ error: "Invalid input", issues: e.issues }, 400);
          return json({ error: e instanceof Error ? e.message : "Rejected" }, 422);
        }
      },
    },
  },
});

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Server side of the bid book. Inserts go through the publishable client (the
 * insert policy allows public bids); status transitions use the admin client so
 * a browser cannot flip someone else's bid to accepted or cancelled.
 */

function publicDb() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type PlaceBidInput = {
  bitmapHeight: number;
  bidderAddress: string;
  priceSats: number;
  expiresInHours?: number | undefined;
  note?: string | undefined;
  signature?: string | undefined;
};

export async function placeBid(input: PlaceBidInput) {
  const db = publicDb();

  const expiresAt =
    input.expiresInHours && input.expiresInHours > 0
      ? new Date(Date.now() + input.expiresInHours * 3_600_000).toISOString()
      : null;

  // A wallet keeps one live bid per parcel: replace any earlier open bid.
  const { data: existing } = await db
    .from("bids")
    .select("id, price_sats")
    .eq("bitmap_height", input.bitmapHeight)
    .eq("bidder_address", input.bidderAddress)
    .eq("status", "open");

  const { data, error } = await db
    .from("bids")
    .insert({
      bitmap_height: input.bitmapHeight,
      bidder_address: input.bidderAddress,
      price_sats: input.priceSats,
      expires_at: expiresAt,
      note: input.note ?? null,
      signature: input.signature ?? null,
      status: "open",
    })
    .select("id, bitmap_height, bidder_address, price_sats, expires_at, status, created_at")
    .single();
  if (error) throw new Error(error.message.toUpperCase());

  const replaced = (existing ?? []).map((row) => row.id);
  if (replaced.length > 0) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("bids").update({ status: "cancelled" }).in("id", replaced);
  }

  return { bid: data, replaced: replaced.length };
}

async function loadBid(id: string) {
  const { data, error } = await publicDb()
    .from("bids")
    .select("id, bitmap_height, bidder_address, price_sats, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message.toUpperCase());
  if (!data) throw new Error("BID NOT FOUND");
  return data;
}

/** Bidder withdraws their own bid; the claimed address must match the bid. */
export async function cancelBid(id: string, address: string) {
  const bid = await loadBid(id);
  if (bid.bidder_address.toLowerCase() !== address.toLowerCase()) {
    throw new Error("ONLY THE BIDDING WALLET CAN WITHDRAW THIS BID");
  }
  if (bid.status !== "open") throw new Error(`BID IS ALREADY ${bid.status.toUpperCase()}`);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("bids").update({ status: "cancelled" }).eq("id", id);
  if (error) throw new Error(error.message.toUpperCase());
  return { id, status: "cancelled" as const };
}

/** Holder declines a bid standing on a bitmap they hold. */
export async function declineBid(id: string, holderAddress: string) {
  const bid = await loadBid(id);
  if (bid.status !== "open") throw new Error(`BID IS ALREADY ${bid.status.toUpperCase()}`);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: parcels } = await supabaseAdmin
    .from("bitmaps")
    .select("owner_address")
    .eq("block_height", bid.bitmap_height)
    .limit(5);
  const owner = (parcels ?? []).map((p) => p.owner_address).find(Boolean) ?? null;
  if (owner && owner.toLowerCase() !== holderAddress.toLowerCase()) {
    throw new Error("ONLY THE ON-CHAIN HOLDER CAN DECLINE THIS BID");
  }

  const { error } = await supabaseAdmin.from("bids").update({ status: "declined" }).eq("id", id);
  if (error) throw new Error(error.message.toUpperCase());

  await supabaseAdmin.from("activity").insert({
    type: "bid_declined",
    wallet_address: holderAddress,
    metadata: {
      bid_id: id,
      bitmap_height: bid.bitmap_height,
      price_sats: bid.price_sats,
      bidder_address: bid.bidder_address,
    },
  });

  return {
    id,
    status: "declined" as const,
    bitmapHeight: Number(bid.bitmap_height),
    priceSats: Number(bid.price_sats),
  };
}

/**
 * Holder accepts a bid. Acceptance is recorded so both sides see the agreed
 * price; the transfer itself only happens when the holder signs and the buyer
 * broadcasts the sale PSBT on chain.
 */
export async function acceptBid(id: string, holderAddress: string) {
  const bid = await loadBid(id);
  if (bid.status !== "open") throw new Error(`BID IS ALREADY ${bid.status.toUpperCase()}`);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // The accepting wallet must actually hold the parcel per the on-chain registry.
  const { data: parcels } = await supabaseAdmin
    .from("bitmaps")
    .select("owner_address")
    .eq("block_height", bid.bitmap_height)
    .limit(5);
  const owner = (parcels ?? []).map((p) => p.owner_address).find(Boolean) ?? null;
  if (owner && owner.toLowerCase() !== holderAddress.toLowerCase()) {
    throw new Error("ONLY THE ON-CHAIN HOLDER CAN ACCEPT THIS BID");
  }

  const { error } = await supabaseAdmin.from("bids").update({ status: "accepted" }).eq("id", id);
  if (error) throw new Error(error.message.toUpperCase());

  await supabaseAdmin.from("activity").insert({
    type: "bid_accepted",
    wallet_address: holderAddress,
    metadata: {
      bid_id: id,
      bitmap_height: bid.bitmap_height,
      price_sats: bid.price_sats,
      bidder_address: bid.bidder_address,
    },
  });

  return {
    id,
    status: "accepted" as const,
    bitmapHeight: Number(bid.bitmap_height),
    priceSats: Number(bid.price_sats),
    bidderAddress: bid.bidder_address,
  };
}

/**
 * Holder accepts a bid *with a signed sale transaction*. The seller-signed PSBT
 * is validated against the chain (it must spend the parcel's inscription output
 * and pay the seller), stored in the offer book addressed to the bidder, and the
 * bid is marked accepted and linked to that sale. When the buyer broadcasts,
 * the settlement watcher closes both the offer and the bid automatically.
 */
export async function acceptBidWithOffer(input: {
  bidId: string;
  holderAddress: string;
  psbt: string;
}) {
  const bid = await loadBid(input.bidId);
  if (bid.status !== "open") throw new Error(`BID IS ALREADY ${bid.status.toUpperCase()}`);

  const { submitOffer } = await import("@/lib/offers.server");
  const offer = await submitOffer(input.psbt);

  const priceSats = Number(bid.price_sats);
  const height = Number(bid.bitmap_height);

  if (offer.bitmapHeight !== null && offer.bitmapHeight !== height) {
    throw new Error("THE SIGNED SALE IS FOR A DIFFERENT BITMAP");
  }
  if (
    offer.sellerAddress &&
    offer.sellerAddress.toLowerCase() !== input.holderAddress.toLowerCase()
  ) {
    throw new Error("THE SIGNED SALE MUST PAY THE ACCEPTING WALLET");
  }
  if (offer.priceSats < priceSats) {
    throw new Error("THE SIGNED SALE ASKS LESS THAN THE ACCEPTED BID");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const deliveredAt = new Date().toISOString();
  const { error: offerError } = await supabaseAdmin
    .from("offers")
    .update({
      bid_id: bid.id,
      buyer_address: bid.bidder_address,
      delivered_at: deliveredAt,
      delivery_note: `ACCEPTED BID ${formatBidLabel(height, priceSats)}`,
    })
    .eq("id", offer.id);
  if (offerError) throw new Error(offerError.message.toUpperCase());

  const { error } = await supabaseAdmin
    .from("bids")
    .update({ status: "accepted", accepted_offer_id: offer.id })
    .eq("id", bid.id);
  if (error) throw new Error(error.message.toUpperCase());

  await supabaseAdmin.from("activity").insert({
    type: "bid_accepted",
    wallet_address: input.holderAddress,
    metadata: {
      bid_id: bid.id,
      offer_id: offer.id,
      bitmap_height: height,
      price_sats: priceSats,
      bidder_address: bid.bidder_address,
      outpoint: offer.outpoint,
    },
  });

  return {
    id: bid.id,
    status: "accepted" as const,
    offerId: offer.id,
    outpoint: offer.outpoint,
    bitmapHeight: height,
    priceSats: offer.priceSats,
    bidderAddress: bid.bidder_address,
  };
}

function formatBidLabel(height: number, priceSats: number) {
  return `${height}.BITMAP @ ${priceSats} SATS`;
}

/** Closes bids whose linked sale has settled on chain. */
export async function markBidSettled(offerId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("bids")
    .update({ status: "settled" })
    .eq("accepted_offer_id", offerId)
    .eq("status", "accepted");
}

/** Marks expired bids so the book only shows live demand. */
export async function expireStaleBids() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("bids")
    .update({ status: "expired" })
    .eq("status", "open")
    .lt("expires_at", new Date().toISOString())
    .select("id");
  if (error) throw new Error(error.message.toUpperCase());
  return { expired: (data ?? []).length };
}

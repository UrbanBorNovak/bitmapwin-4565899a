/**
 * Listing board engine. Every listing, fill and settler round goes through the
 * database routines, so BIT only ever moves inside a single locked transaction.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function listGoods(input: {
  address: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
}): Promise<{ id: string }> {
  const db = await admin();
  const { data, error } = await db.rpc("market_list_goods", {
    _address: input.address,
    _item: input.itemId,
    _qty: input.quantity,
    _unit_price: input.unitPrice,
  });
  if (error) throw new Error(error.message);
  return { id: String(data) };
}

export async function buyListing(input: {
  address: string;
  listingId: string;
  quantity: number;
}): Promise<{ filled: number; unitPrice: number; totalCoins: number; itemId: string }> {
  const db = await admin();
  const { data, error } = await db.rpc("market_buy_listing", {
    _buyer_address: input.address,
    _listing_id: input.listingId,
    _qty: input.quantity,
  });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as
    | { filled: number; unit_price: number; total_coins: number; item_id: string }
    | undefined;
  if (!row) throw new Error("That listing was already taken");
  return {
    filled: Number(row.filled),
    unitPrice: Number(row.unit_price),
    totalCoins: Number(row.total_coins),
    itemId: row.item_id,
  };
}

export async function cancelListing(input: {
  address: string;
  listingId: string;
}): Promise<{ itemId: string; remaining: number }> {
  const db = await admin();
  const { data, error } = await db.rpc("market_cancel_listing", {
    _address: input.address,
    _listing_id: input.listingId,
  });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as
    | { item_id: string; remaining: number }
    | undefined;
  if (!row) throw new Error("That listing was already closed");
  return { itemId: row.item_id, remaining: Number(row.remaining) };
}

/** Runs one settler trading round. The database rate-limits it to once a minute. */
export async function settlerTradeRound(): Promise<{
  listed: number;
  bought: number;
  skipped: boolean;
}> {
  const db = await admin();
  const { data, error } = await db.rpc("market_npc_tick");
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as
    | { listed: number; bought: number; skipped: boolean }
    | undefined;
  return {
    listed: Number(row?.listed ?? 0),
    bought: Number(row?.bought ?? 0),
    skipped: Boolean(row?.skipped ?? true),
  };
}

/**
 * Goods market engine. Stock and BIT movements only ever happen here, through
 * the database routine that walks the price as stock changes.
 */

export type GoodsFill = {
  filled: number;
  unitPrice: number;
  totalCoins: number;
  stock: number;
  price: number;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function tradeGoods(input: {
  address: string;
  itemId: string;
  side: "buy" | "sell";
  quantity: number;
}): Promise<GoodsFill> {
  const db = await admin();
  const { data, error } = await db.rpc("goods_trade", {
    _address: input.address,
    _item: input.itemId,
    _side: input.side,
    _qty: input.quantity,
  });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        filled: number;
        unit_price: number;
        total_coins: number;
        stock: number;
        price: number;
      }
    | undefined;
  if (!row) throw new Error("The market did not fill that order");
  return {
    filled: Number(row.filled),
    unitPrice: Number(row.unit_price),
    totalCoins: Number(row.total_coins),
    stock: Number(row.stock),
    price: Number(row.price),
  };
}

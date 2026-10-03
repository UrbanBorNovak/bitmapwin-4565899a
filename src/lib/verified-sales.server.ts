/**
 * Counts only completed BITMAPWIN purchases whose payment and inscription input
 * can be checked against a confirmed Bitcoin transaction. A transfer that
 * happens to pay its sender (including change) is not proof of a sale.
 */
export type VerifiedSale = {
  txid: string;
  inscriptionId: string;
  sellerAddress: string;
  buyerAddress: string;
  priceSats: number;
  blockHeight: number;
  blockTime: string | null;
};

export async function verifiedSalesFor(ids: readonly string[]): Promise<{ sales: VerifiedSale[]; unavailable: boolean }> {
  if (ids.length === 0) return { sales: [], unavailable: false };
  let offers: Array<{ buyer_txid: string | null; inscription_id: string | null; seller_address: string | null; buyer_address: string | null; price_sats: number; outpoint: string }>;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = await Promise.all(Array.from({ length: Math.ceil(ids.length / 60) }, (_, n) =>
      supabaseAdmin.from("offers")
        .select("inscription_id, outpoint, seller_address, buyer_address, buyer_txid, price_sats")
        .in("inscription_id", ids.slice(n * 60, n * 60 + 60))
        .not("buyer_txid", "is", null),
    ));
    if (rows.some((row) => row.error)) return { sales: [], unavailable: true };
    offers = rows.flatMap((r) => r.data ?? []);
  } catch {
    return { sales: [], unavailable: true };
  }
  const sales = await Promise.all(offers.map(async (offer): Promise<VerifiedSale | null> => {
    if (!offer.buyer_txid || !offer.inscription_id || !offer.seller_address || !offer.buyer_address ||
      offer.seller_address === offer.buyer_address || !Number.isSafeInteger(Number(offer.price_sats)) || Number(offer.price_sats) <= 0) return null;
    try {
      const response = await fetch(`https://mempool.space/api/tx/${offer.buyer_txid}`, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) return null;
      const tx = await response.json() as {
        txid: string;
        vin: Array<{ txid: string; vout: number }>;
        vout: Array<{ value: number; scriptpubkey_address?: string }>;
        status: { confirmed: boolean; block_height?: number; block_time?: number };
      };
      const [inputTxid, outputIndex] = offer.outpoint.split(":");
      if (tx.txid !== offer.buyer_txid || !tx.status.confirmed || !tx.status.block_height ||
        tx.vin[0]?.txid !== inputTxid || tx.vin[0]?.vout !== Number(outputIndex) ||
        tx.vout[0]?.scriptpubkey_address !== offer.seller_address ||
        tx.vout[0].value < Number(offer.price_sats) ||
        tx.vout[1]?.scriptpubkey_address !== offer.buyer_address) return null;
      return {
        txid: tx.txid,
        inscriptionId: offer.inscription_id,
        sellerAddress: offer.seller_address,
        buyerAddress: offer.buyer_address,
        priceSats: Number(offer.price_sats),
        blockHeight: tx.status.block_height,
        blockTime: tx.status.block_time ? new Date(tx.status.block_time * 1000).toISOString() : null,
      };
    } catch { return null; }
  }));
  return {
    sales: sales.filter((s): s is VerifiedSale => s !== null).sort((a, b) => b.blockHeight - a.blockHeight),
    unavailable: false,
  };
}

import { ticketRevealOk } from "@/lib/sponsor-slots";
import { DONATION_ADDRESS } from "@/lib/donations";

type Vin = { witness?: string[] };
type Vout = { scriptpubkey_address?: string; value: number };
type Tx = { txid: string; vin: Vin[]; vout: Vout[] };

const ORD_ENVELOPE = "0063036f7264"; // OP_FALSE OP_IF "ord"
const TICKET_MARK = "4c41554e4348204752414e445354414e44"; // "LAUNCH GRANDSTAND" in the ticket SVG

/** A treasury tx is a seat ticket only if it is an inscription reveal carrying the ticket SVG. */
export function isTicketReveal(tx: Tx): boolean {
  const w = tx.vin.map((v) => (v.witness ?? []).join("")).join("");
  return w.includes(ORD_ENVELOPE) && w.includes(TICKET_MARK);
}

let lastSweep = 0;
const SWEEP_MS = 60_000;

/** Records ticket reveals paid to the treasury that never reached the browser callback. */
export async function sweepLaunchTickets(): Promise<number> {
  if (Date.now() - lastSweep < SWEEP_MS) return 0;
  lastSweep = Date.now();
  const urls = [
    `https://mempool.space/api/address/${DONATION_ADDRESS}/txs`,
    `https://mempool.space/api/address/${DONATION_ADDRESS}/txs/mempool`,
  ];
  const txs: Tx[] = [];
  for (const u of urls) {
    const r = await fetch(u, { signal: AbortSignal.timeout(6000) }).catch(() => null);
    if (r?.ok) txs.push(...((await r.json()) as Tx[]));
  }
  const candidates = txs.filter((t) => isTicketReveal(t) && t.vout[0]?.scriptpubkey_address);
  if (!candidates.length) return 0;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let n = 0;
  for (const t of candidates) {
    const seatAddr = t.vout[0].scriptpubkey_address!;
    if (!ticketRevealOk(t.vout, seatAddr, DONATION_ADDRESS)) continue;
    const { data } = await supabaseAdmin.from("launch_seats")
      .update({ ticket_inscription_id: `${t.txid.toLowerCase()}i0` })
      .eq("address", seatAddr).is("ticket_inscription_id", null).select("seat_number");
    n += data?.length ?? 0;
  }
  return n;
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SponsorSlot } from "@/lib/sponsor-slots";

const addr = z.string().trim().regex(/^(bc1[a-z0-9]{8,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/);
const txid = z.string().regex(/^[0-9a-f]{64}$/i);

type Tx = { vin: { prevout?: { scriptpubkey_address?: string | null } | null }[]; vout: { scriptpubkey_address?: string; value: number }[] };
async function fetchTx(id: string): Promise<Tx | null> {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`https://mempool.space/api/tx/${id}`, { signal: AbortSignal.timeout(6000) }).catch(() => null);
    if (r?.ok) return (await r.json()) as Tx;
    await new Promise((s) => setTimeout(s, 1500));
  }
  return null;
}

export type SponsorSlide = { id: string; slot: SponsorSlot; title: string; handle: string; kind: "inscription" | "image"; media: string; startsAt: string; endsAt: string };

/** Live sponsor slides (public, no payer details). */
export const listSponsorSlidesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const sb = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => { const h = new Headers(init?.headers); if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization"); h.set("apikey", key); return fetch(input, { ...init, headers: h }); } },
  });
  const { data, error } = await sb.from("broadcast_sponsorships").select("id,slot,title,handle,media_kind,media,starts_at,ends_at")
    .gt("ends_at", new Date().toISOString()).order("starts_at").limit(50);
  if (error) return { slides: [] as SponsorSlide[] };
  return { slides: (data ?? []).map((r) => ({ id: r.id, slot: r.slot as SponsorSlot, title: r.title, handle: r.handle, kind: r.media_kind as "inscription" | "image", media: r.media, startsAt: r.starts_at, endsAt: r.ends_at })) };
});

/** Books a 24h slot once a signed, seen payment to the site address covers its price. One booking per txid. */
export const bookSponsorSlotFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    slot: z.enum(["cafe", "launch", "all"]), title: z.string().trim().min(2).max(40), handle: z.string().trim().max(30).default(""),
    media: z.string().trim().min(8).max(400), payer: addr, txid, signature: z.string().min(8).max(2000),
  }).parse(d))
  .handler(async ({ data }) => {
    const { parseSponsorMedia, sponsorMessage, sponsorPaymentOk, SPONSOR_HOURS } = await import("@/lib/sponsor-slots");
    const media = parseSponsorMedia(data.media);
    if (!media) return { ok: false as const, error: "Use an inscription id or an https image link" };
    const { Verifier } = await import("bip322-js");
    let valid = false;
    try { valid = Verifier.verifySignature(data.payer, sponsorMessage(data.txid), data.signature); } catch { valid = false; }
    if (!valid) return { ok: false as const, error: "Signature does not match the paying address" };
    const tx = await fetchTx(data.txid.toLowerCase());
    if (!tx) return { ok: false as const, error: "Payment not seen yet — retry in a minute" };
    const { DONATION_ADDRESS } = await import("@/lib/donations");
    if (!sponsorPaymentOk(tx, data.slot, data.payer, DONATION_ADDRESS)) return { ok: false as const, error: "That transaction does not pay this slot's price from your address" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const start = new Date();
    const end = new Date(start.getTime() + SPONSOR_HOURS * 3600_000);
    const { error } = await supabaseAdmin.from("broadcast_sponsorships").insert({
      slot: data.slot, title: data.title, handle: data.handle, media_kind: media.kind, media: media.media,
      payer_address: data.payer, pay_txid: data.txid.toLowerCase(), paid_sats: tx.vout.reduce((n, o) => n + (o.scriptpubkey_address === DONATION_ADDRESS ? o.value : 0), 0),
      starts_at: start.toISOString(), ends_at: end.toISOString(),
    });
    if (error) return { ok: false as const, error: error.code === "23505" ? "This payment already booked a slot" : "Booking failed — try again" };
    return { ok: true as const, endsAt: end.toISOString(), error: null };
  });

/** Records a seat's ticket inscription once its reveal lands on the seat address and pays the ticket fee. */
export const recordLaunchTicketFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ address: addr, revealTxid: txid }).parse(d))
  .handler(async ({ data }) => {
    const { ticketRevealOk } = await import("@/lib/sponsor-slots");
    const { DONATION_ADDRESS } = await import("@/lib/donations");
    const tx = await fetchTx(data.revealTxid.toLowerCase());
    if (!tx) return { ok: false as const, error: "Ticket not seen yet — retry in a minute" };
    if (!ticketRevealOk(tx.vout, data.address, DONATION_ADDRESS)) return { ok: false as const, error: "That reveal is not a ticket for this seat" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const id = `${data.revealTxid.toLowerCase()}i0`;
    const { data: rows, error } = await supabaseAdmin.from("launch_seats").update({ ticket_inscription_id: id })
      .eq("address", data.address).is("ticket_inscription_id", null).select("seat_number");
    if (error) return { ok: false as const, error: "Could not record ticket" };
    if (!rows?.length) return { ok: false as const, error: "No seat without a ticket for this address" };
    return { ok: true as const, inscriptionId: id, error: null };
  });

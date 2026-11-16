/** BTCPay Greenfield client for Lightning sponsor bookings. Server only. */
import { SPONSOR_HOURS, SPONSOR_SLOTS, parseSponsorMedia, type SponsorSlot } from "@/lib/sponsor-slots";

export type BtcpayConfig = { url: string; store: string; key: string };
export function btcpayConfig(): BtcpayConfig | null {
  const url = process.env["BTCPAY_SERVER_URL"]?.replace(/\/+$/, "");
  const store = process.env["BTCPAY_STORE_ID"];
  const key = process.env["BTCPAY_API_KEY"];
  return url && store && key ? { url, store, key } : null;
}

async function api<T>(c: BtcpayConfig, path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${c.url}/api/v1/stores/${c.store}${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `token ${c.key}`, ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`BTCPay ${r.status}`);
  return (await r.json()) as T;
}

export type SponsorMeta = { bw: "sponsor"; slot: SponsorSlot; title: string; handle: string; media: string };
type Invoice = { id: string; status: string; amount: string; currency: string; checkoutLink: string; metadata?: Record<string, unknown> };

export async function createSponsorInvoice(c: BtcpayConfig, meta: SponsorMeta) {
  const inv = await api<Invoice>(c, "/invoices", {
    method: "POST",
    body: JSON.stringify({
      amount: String(SPONSOR_SLOTS[meta.slot].sats), currency: "SATS",
      metadata: { ...meta, itemDesc: `BITMAPWIN ${SPONSOR_SLOTS[meta.slot].label} · ${SPONSOR_HOURS}h` },
      checkout: { expirationMinutes: 15 },
    }),
  });
  let bolt11: string | null = null;
  try {
    const pms = await api<{ paymentMethodId?: string; paymentMethod?: string; destination?: string }[]>(c, `/invoices/${inv.id}/payment-methods`);
    const ln = pms.find((p) => /LN|Lightning/i.test(p.paymentMethodId ?? p.paymentMethod ?? ""));
    bolt11 = ln?.destination?.replace(/^lightning:/i, "") ?? null;
  } catch { /* checkout link still works */ }
  return { invoiceId: inv.id, checkoutLink: inv.checkoutLink, bolt11 };
}

export const getInvoice = (c: BtcpayConfig, id: string) => api<Invoice>(c, `/invoices/${encodeURIComponent(id)}`);

/** Activates the slide for a settled invoice. Idempotent: one booking per invoice id. */
export async function activateSettledInvoice(c: BtcpayConfig, id: string): Promise<{ ok: boolean; status: string; endsAt?: string }> {
  const inv = await getInvoice(c, id);
  if (inv.status !== "Settled") return { ok: false, status: inv.status };
  const m = inv.metadata as Partial<SponsorMeta> | undefined;
  if (m?.bw !== "sponsor" || !m.slot || !(m.slot in SPONSOR_SLOTS) || !m.title || !m.media) return { ok: false, status: "NotSponsor" };
  const media = parseSponsorMedia(m.media);
  const paid = Math.round(Number(inv.amount));
  if (!media || inv.currency.toUpperCase() !== "SATS" || paid < SPONSOR_SLOTS[m.slot].sats) return { ok: false, status: "Invalid" };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ref = `btcpay:${inv.id}`;
  const { data: existing } = await supabaseAdmin.from("broadcast_sponsorships").select("ends_at").eq("pay_txid", ref).maybeSingle();
  if (existing) return { ok: true, status: "Settled", endsAt: existing.ends_at };
  const start = new Date();
  const end = new Date(start.getTime() + SPONSOR_HOURS * 3600_000);
  const { error } = await supabaseAdmin.from("broadcast_sponsorships").insert({
    slot: m.slot, title: m.title.slice(0, 40), handle: (m.handle ?? "").slice(0, 30), media_kind: media.kind, media: media.media,
    payer_address: "lightning", pay_txid: ref, paid_sats: paid, starts_at: start.toISOString(), ends_at: end.toISOString(),
  });
  if (error && error.code !== "23505") throw new Error("Booking failed");
  return { ok: true, status: "Settled", endsAt: end.toISOString() };
}

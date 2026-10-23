import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { LaunchSeat } from "@/lib/launch-seats";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const addressSchema = z
  .string()
  .trim()
  .regex(/^(bc1[a-z0-9]{8,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/, "Not a valid Bitcoin address");

type Row = { seat_number: number; address: string; pixel_id: string; pixel_source: string; held_bitmap: number | null; created_at: string; ticket_inscription_id?: string | null; club_hair?: string | null; club_proof?: string | null };
const toSeat = (r: Row): LaunchSeat => ({
  seat: r.seat_number,
  address: r.address,
  pixelId: r.pixel_id,
  pixelSource: r.pixel_source === "held" ? "held" : "assigned",
  heldBitmap: r.held_bitmap,
  createdAt: r.created_at,
  ticketId: r.ticket_inscription_id ?? null,
  clubHair: r.club_hair === "marauders" || r.club_hair === "emporium" ? r.club_hair : null,
  clubProof: r.club_proof ?? null,
});

async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
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
}

export const listLaunchSeatsFn = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await publicClient();
  const { data, error } = await sb
    .from("launch_seats")
    .select("seat_number,address,pixel_id,pixel_source,held_bitmap,created_at,ticket_inscription_id,club_hair,club_proof")
    .order("seat_number")
    .limit(1000);
  if (error) return { seats: [] as LaunchSeat[], error: "Seats unavailable" };
  const seats = (data as Row[]).map(toSeat);
  const tamers = new Set<string>(); const builders = new Set<string>();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const addrs = seats.map((s) => s.address);
    for (let i = 0; i < addrs.length; i += 100) {
      const chunk = addrs.slice(i, i + 100);
      const [g, f] = await Promise.all([
        supabaseAdmin.from("bitmon_guardians").select("summoned_by_address").in("summoned_by_address", chunk),
        supabaseAdmin.from("forge_modules").select("author_address").in("author_address", chunk),
      ]);
      g.data?.forEach((r) => tamers.add(r.summoned_by_address));
      f.data?.forEach((r) => builders.add(r.author_address));
    }
  } catch { /* gear is cosmetic; seats still load */ }
  const { seatGear } = await import("@/lib/launch-seats");
  for (const s of seats) s.gear = seatGear(s.seat, s.heldBitmap, tamers.has(s.address), builders.has(s.address));
  try {
    const { wornFrom } = await import("@/lib/launch-seats");
    const { data: wear } = await sb.from("launch_seat_wear").select("address,slot,item,created_at").order("created_at", { ascending: false }).limit(5000);
    const by = new Map<string, { slot: string; item: string }[]>();
    for (const w of wear ?? []) { const k = w.address.toLowerCase(); by.set(k, [...(by.get(k) ?? []), w]); }
    for (const s of seats) { const rows = by.get(s.address.toLowerCase()) ?? []; const w = wornFrom(rows); s.hat = w.hat; s.food = w.food; s.owned = rows.map((r) => r.item); }
  } catch { /* wardrobe is cosmetic */ }
  return { seats, error: null as string | null };
});

/** Seats a wallet after verifying its signed message; scans the wallet for a held Pixel or BITMAP. */
export const claimLaunchSeatFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ address: addressSchema, issuedAt: z.string().max(40), signature: z.string().min(8).max(2000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { seatMessage, SEAT_MESSAGE_TTL_MS } = await import("@/lib/launch-seats");
    const issued = Date.parse(data.issuedAt);
    if (!Number.isFinite(issued) || Math.abs(Date.now() - issued) > SEAT_MESSAGE_TTL_MS) {
      return { ok: false as const, error: "Signature expired — try again" };
    }
    const { Verifier } = await import("bip322-js");
    let valid = false;
    try { valid = Verifier.verifySignature(data.address, seatMessage(data.address, data.issuedAt), data.signature); } catch { valid = false; }
    if (!valid) return { ok: false as const, error: "Signature does not match this address" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let scanned: { id: string; bitmapHeight: number | null }[] | null = null;
    try {
      const { fetchWallet } = await import("@/lib/wallet.server");
      const snap = await fetchWallet(data.address);
      scanned = snap.utxos.flatMap((u) => u.inscriptions);
    } catch { /* scan unavailable: keep the current avatar */ }
    const { seatVerifiedAddress, refreshClubHair } = await import("@/lib/launch-seats.server");
    const res = await seatVerifiedAddress(supabaseAdmin, data.address, scanned);
    if (res.ok) await refreshClubHair(supabaseAdmin, res.seat.seat, data.address);
    return res;
  });

/** Backstage door: proves the signer holds a seated wallet. Nothing is written. */
export const enterLoungeFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ address: addressSchema, issuedAt: z.string().max(40), signature: z.string().min(8).max(2000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { loungeMessage, SEAT_MESSAGE_TTL_MS } = await import("@/lib/launch-seats");
    const issued = Date.parse(data.issuedAt);
    if (!Number.isFinite(issued) || Math.abs(Date.now() - issued) > SEAT_MESSAGE_TTL_MS) return { ok: false as const, error: "Signature expired — try again" };
    const { Verifier } = await import("bip322-js");
    let valid = false;
    try { valid = Verifier.verifySignature(data.address, loungeMessage(data.address, data.issuedAt), data.signature); } catch { valid = false; }
    if (!valid) return { ok: false as const, error: "Signature does not match this address" };
    const sb = await publicClient();
    const { data: row } = await sb.from("launch_seats").select("seat_number,address,pixel_id,pixel_source,held_bitmap,created_at,ticket_inscription_id").ilike("address", data.address).maybeSingle();
    if (!row) return { ok: false as const, error: "NO_SEAT" };
    return { ok: true as const, seat: toSeat(row as Row) };
  });

/** dev9's backchannel: verified on the server for a fresh signature from a Founders Row seat (1–100). */
export const openBackchannelFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ address: addressSchema, issuedAt: z.string().max(40), signature: z.string().min(8).max(2000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { backchannelMessage, SEAT_MESSAGE_TTL_MS, FOUNDERS_ROW } = await import("@/lib/launch-seats");
    const issued = Date.parse(data.issuedAt);
    if (!Number.isFinite(issued) || Math.abs(Date.now() - issued) > SEAT_MESSAGE_TTL_MS) return { ok: false as const, error: "Signature expired — try again" };
    const { Verifier } = await import("bip322-js");
    let valid = false;
    try { valid = Verifier.verifySignature(data.address, backchannelMessage(data.address, data.issuedAt), data.signature); } catch { valid = false; }
    if (!valid) return { ok: false as const, error: "Signature does not match this address" };
    const sb = await publicClient();
    const { data: row } = await sb.from("launch_seats").select("seat_number").ilike("address", data.address).maybeSingle();
    if (!row) return { ok: false as const, error: "NO_SEAT" };
    if ((row as { seat_number: number }).seat_number > FOUNDERS_ROW) return { ok: false as const, error: "NOT_FOUNDER" };
    const { BACKCHANNEL_LOG } = await import("@/lib/dev9-backchannel.server");
    return { ok: true as const, seat: (row as { seat_number: number }).seat_number, log: BACKCHANNEL_LOG };
  });

/** Buys a hat or snack for a seated Bitmapper with BIT from a wallet the signed-in player verified. */
export const buyWearFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ address: addressSchema, item: z.string().max(30) }).parse(d))
  .handler(async ({ data, context }) => {
    const { wearById } = await import("@/lib/launch-seats");
    const item = wearById(data.item);
    if (!item) return { ok: false as const, error: "Unknown item" };
    const { assertControls, bitBalance, spendBit } = await import("@/lib/coins.server");
    try { await assertControls(context.supabase, context.userId, data.address); }
    catch { return { ok: false as const, error: "Verify this wallet on your wallet page first" }; }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: seat } = await supabaseAdmin.from("launch_seats").select("seat_number").ilike("address", data.address).maybeSingle();
    if (!seat) return { ok: false as const, error: "Take a seat first" };
    const { data: had } = await supabaseAdmin.from("launch_seat_wear").select("id").eq("address", data.address).eq("item", item.id).maybeSingle();
    if (had) return { ok: false as const, error: "You already own this" };
    if ((await bitBalance(data.address)) < item.price) return { ok: false as const, error: `Needs ${item.price} BIT` };
    try { await spendBit({ address: data.address, amount: item.price, reason: "grandstand_wear", ref: `wear:${data.address}:${item.id}` }); }
    catch { return { ok: false as const, error: "Payment failed — check your BIT balance" }; }
    const { error } = await supabaseAdmin.from("launch_seat_wear").insert({ address: data.address, slot: item.slot, item: item.id, price_bit: item.price });
    if (error) return { ok: false as const, error: "Paid, but could not save — contact us" };
    return { ok: true as const, error: null };
  });

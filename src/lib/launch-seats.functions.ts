import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { LaunchSeat } from "@/lib/launch-seats";

const addressSchema = z
  .string()
  .trim()
  .regex(/^(bc1[a-z0-9]{8,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/, "Not a valid Bitcoin address");

type Row = { seat_number: number; address: string; pixel_id: string; pixel_source: string; held_bitmap: number | null; created_at: string };
const toSeat = (r: Row): LaunchSeat => ({
  seat: r.seat_number,
  address: r.address,
  pixelId: r.pixel_id,
  pixelSource: r.pixel_source === "held" ? "held" : "assigned",
  heldBitmap: r.held_bitmap,
  createdAt: r.created_at,
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
    .select("seat_number,address,pixel_id,pixel_source,held_bitmap,created_at")
    .order("seat_number")
    .limit(1000);
  if (error) return { seats: [] as LaunchSeat[], error: "Seats unavailable" };
  return { seats: (data as Row[]).map(toSeat), error: null as string | null };
});

/** Seats a wallet after verifying its signed message; scans the wallet for a held Pixel or BITMAP. */
export const claimLaunchSeatFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ address: addressSchema, issuedAt: z.string().max(40), signature: z.string().min(8).max(2000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { seatMessage, SEAT_MESSAGE_TTL_MS, assignedPixel, LAUNCH_CAPACITY } = await import("@/lib/launch-seats");
    const issued = Date.parse(data.issuedAt);
    if (!Number.isFinite(issued) || Math.abs(Date.now() - issued) > SEAT_MESSAGE_TTL_MS) {
      return { ok: false as const, error: "Signature expired — try again" };
    }
    const { Verifier } = await import("bip322-js");
    let valid = false;
    try { valid = Verifier.verifySignature(data.address, seatMessage(data.address, data.issuedAt), data.signature); } catch { valid = false; }
    if (!valid) return { ok: false as const, error: "Signature does not match this address" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const existing = await supabaseAdmin.from("launch_seats").select("*").ilike("address", data.address).maybeSingle();
    if (existing.data) return { ok: true as const, seat: toSeat(existing.data as Row), already: true };
    const { count } = await supabaseAdmin.from("launch_seats").select("seat_number", { count: "exact", head: true });
    if ((count ?? 0) >= LAUNCH_CAPACITY) return { ok: false as const, error: "The grandstand is full" };

    let pixelId = assignedPixel(data.address);
    let pixelSource = "assigned";
    let heldBitmap: number | null = null;
    try {
      const { fetchWallet } = await import("@/lib/wallet.server");
      const { PIXELS } = await import("@/lib/bitmap-pixels-catalog");
      const pixelIds = new Set(PIXELS.map((p) => p.id));
      const snap = await fetchWallet(data.address);
      for (const u of snap.utxos) for (const i of u.inscriptions) {
        if (pixelSource === "assigned" && pixelIds.has(i.id)) { pixelId = i.id; pixelSource = "held"; }
        if (heldBitmap === null && i.bitmapHeight !== null) heldBitmap = i.bitmapHeight;
      }
    } catch { /* scan unavailable: keep the assigned Pixel */ }

    const ins = await supabaseAdmin
      .from("launch_seats")
      .insert({ address: data.address, pixel_id: pixelId, pixel_source: pixelSource, held_bitmap: heldBitmap })
      .select("*")
      .single();
    if (ins.error) return { ok: false as const, error: "Could not take a seat — try again" };
    return { ok: true as const, seat: toSeat(ins.data as Row), already: false };
  });

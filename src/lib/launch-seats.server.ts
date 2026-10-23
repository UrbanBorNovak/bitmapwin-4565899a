import type { SupabaseClient } from "@supabase/supabase-js";
import { LAUNCH_CAPACITY, refreshedAvatar, seatAvatarFrom, type LaunchSeat } from "@/lib/launch-seats";

type Row = { seat_number: number; address: string; pixel_id: string; pixel_source: string; held_bitmap: number | null; created_at: string };
export const toSeat = (r: Row): LaunchSeat => ({
  seat: r.seat_number,
  address: r.address,
  pixelId: r.pixel_id,
  pixelSource: r.pixel_source === "held" ? "held" : "assigned",
  heldBitmap: r.held_bitmap,
  createdAt: r.created_at,
});

type Scan = { id: string; bitmapHeight: number | null }[] | null;

/** Seats a verified address, or refreshes a reserved seat's avatar/flag from a wallet scan (null = scan failed). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seatVerifiedAddress(admin: SupabaseClient<any>, address: string, scan: Scan) {
  const existing = await admin.from("launch_seats").select("*").ilike("address", address).maybeSingle();
  if (existing.data) {
    const row = existing.data as Row;
    const cur = toSeat(row);
    const next = refreshedAvatar(cur, address, scan);
    if (next.pixelId === cur.pixelId && next.pixelSource === cur.pixelSource && next.heldBitmap === cur.heldBitmap) {
      return { ok: true as const, seat: cur, already: true };
    }
    const upd = await admin
      .from("launch_seats")
      .update({ pixel_id: next.pixelId, pixel_source: next.pixelSource, held_bitmap: next.heldBitmap })
      .eq("seat_number", row.seat_number)
      .select("*")
      .single();
    return { ok: true as const, seat: upd.error ? cur : toSeat(upd.data as Row), already: true };
  }
  const { count } = await admin.from("launch_seats").select("seat_number", { count: "exact", head: true });
  if ((count ?? 0) >= LAUNCH_CAPACITY) return { ok: false as const, error: "The grandstand is full" };
  const { pixelId, pixelSource, heldBitmap } = seatAvatarFrom(address, scan ?? []);
  const ins = await admin
    .from("launch_seats")
    .insert({ address, pixel_id: pixelId, pixel_source: pixelSource, held_bitmap: heldBitmap })
    .select("*")
    .single();
  if (ins.error) return { ok: false as const, error: "Could not take a seat — try again" };
  return { ok: true as const, seat: toSeat(ins.data as Row), already: false };
}

import { FOUNDERS_ROW, LAUNCH_CAPACITY, nextTier } from "@/lib/launch-seats";

/** dev9's Bat-computer mirror of the Launch Grandstand: live count, next tier and newest seats. */
export function grandstandFeed<T extends { seat: number }>(seats: T[], latest = 5) {
  const count = seats.length;
  const tier = nextTier(count);
  return {
    count,
    capacity: LAUNCH_CAPACITY,
    tier: tier ? { name: tier.name, left: tier.seats - count } : null,
    latest: seats.slice().sort((a, b) => b.seat - a.seat).slice(0, latest),
  };
}

/** Founders Row keycard: only seats 1–100, proven by a fresh lounge signature. */
export function foundersKeycard(seat: { seat: number } | null) {
  if (!seat || seat.seat > FOUNDERS_ROW) return null;
  return { code: `FR-${String(seat.seat).padStart(3, "0")}`, seat: seat.seat };
}

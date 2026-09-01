import { useQuery } from "@tanstack/react-query";
import { bitmapEventsQuery } from "@/lib/coins";
import { CoinEventCard } from "@/components/coins/CoinEventCard";

/**
 * Live raffles/events attached to a bitmap, rendered inside the build itself so
 * visitors can see the countdown and buy tickets without leaving the build.
 */
export function BuildRaffles({ height }: { height: number }) {
  const events = useQuery(bitmapEventsQuery(height));
  const live = (events.data ?? []).filter(
    (e) => e.status === "open" && (e.endsAt === null || new Date(e.endsAt).getTime() > Date.now()),
  );

  if (live.length === 0) return null;

  return (
    <div className="space-y-3 pt-2">
      <p className="label">LIVE RAFFLES & EVENTS</p>
      {live.map((event) => (
        <CoinEventCard key={event.id} event={event} />
      ))}
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listLaunchSeatsFn } from "@/lib/launch-seats.functions";
import { FOUNDERS_ROW } from "@/lib/launch-seats";
import { PixelFace } from "@/components/game/PixelFace";
import { ShareSeatButton } from "@/components/launch/ShareSeatButton";

/** Shows a connected wallet its Launch Grandstand seat, or invites it to take one. */
export function MySeatCard({ address }: { address: string }) {
  const q = useQuery({ queryKey: ["launch-seats"], queryFn: () => listLaunchSeatsFn(), staleTime: 15_000 });
  if (!q.data) return null;
  const a = address.toLowerCase();
  const seat = q.data.seats.find((s) => s.address.toLowerCase() === a);
  if (!seat) {
    return (
      <section className="glass-panel mt-6 flex flex-wrap items-center justify-between gap-3 rounded border border-border p-4">
        <div className="font-mono text-xs">
          <div className="text-bitcoin">LAUNCH GRANDSTAND · NO SEAT YET</div>
          <div className="mt-1 text-muted-foreground">Your wallet holds land on Bitcoin. Take your seat in the Grandstand — one signature, no fee.</div>
        </div>
        <Link to="/launch" className="btn-term">[ CLAIM MY SEAT → ]</Link>
      </section>
    );
  }
  return (
    <section className="glass-panel mt-6 flex flex-wrap items-center gap-4 rounded border border-bitcoin/50 p-4">
      <PixelFace inscriptionId={seat.pixelId} label="Your Grandstand avatar" className="h-16 w-16" />
      <div className="min-w-0 flex-1 font-mono text-xs">
        <div className="text-bitcoin">LAUNCH GRANDSTAND · SEAT #{seat.seat} RESERVED</div>
        <div className="mt-1 text-muted-foreground">
          {seat.seat <= FOUNDERS_ROW ? "Founders Row · " : ""}
          {seat.heldBitmap !== null ? `Holding ${seat.heldBitmap}.bitmap · ` : ""}
          {seat.pixelSource === "held" ? "Wearing your own Pixel" : "Assigned Pixel"}
          {seat.ticketId ? " · ★ VIP GOLD RING ACTIVE" : ""}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Link to="/launch" search={{ seat: seat.seat }} className="btn-term">[ JUMP TO MY SEAT → ]</Link>
        </div>
        <div className="max-w-xs"><ShareSeatButton seat={seat} own /></div>
      </div>
    </section>
  );
}

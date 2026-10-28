import type { LaunchSeat } from "@/lib/launch-seats";

/** Pre-written X post for a seat. VIP seats get the gold-pass wording. */
export function seatShareText(seat: LaunchSeat, own: boolean): string {
  const who = own ? "my" : "this";
  if (seat.ticketId) {
    return `${own ? "Minted my" : "Seat #" + seat.seat + " minted a"} gold VIP pass${own ? ` for seat #${seat.seat}` : ""} in the BITMAPWIN Grandstand — inscribed on Bitcoin ★ Gold ring activated 🟧 Check your wallet: https://bitmapwin.app/launch`;
  }
  const land = seat.heldBitmap !== null ? ` (holding ${seat.heldBitmap}.bitmap)` : "";
  const near = seat.seat > 1 ? ` Sitting next to #${seat.seat - 1} and #${seat.seat + 1}.` : "";
  return `Found ${who} seat #${seat.seat}${land} in the BITMAPWIN Grandstand with ${own ? "my" : "an"} on-chain Pixel!${near} 🟧 Check your wallet: https://bitmapwin.app/launch`;
}

export function ShareSeatButton({ seat, own, className = "" }: { seat: LaunchSeat; own: boolean; className?: string }) {
  const href = `https://x.com/intent/tweet?text=${encodeURIComponent(seatShareText(seat, own))}`;
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className={`mt-2 block rounded border border-bitcoin bg-bitcoin px-2 py-1 text-center font-mono text-[11px] font-bold text-primary-foreground hover:opacity-90 ${className}`}>
      [ 𝕏 {own ? (seat.ticketId ? "SHARE MY VIP PASS" : "SHARE MY SEAT") : "SHARE THIS SEAT"} ]
    </a>
  );
}

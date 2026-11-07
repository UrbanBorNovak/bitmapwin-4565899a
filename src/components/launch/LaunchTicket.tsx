import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { ShadowInscriber } from "@/components/territory/ShadowInscriber";
import { DONATION_ADDRESS } from "@/lib/donations";
import { recordLaunchTicketFn } from "@/lib/sponsor-slots.functions";
import { TICKET_SATS, launchTicketSvg, seatTier } from "@/lib/sponsor-slots";
import type { LaunchSeat } from "@/lib/launch-seats";

/** Opt-in on-chain ticket for a claimed seat. The seat itself stays free. */
export function LaunchTicket({ seat }: { seat: LaunchSeat }) {
  const record = useServerFn(recordLaunchTicketFn);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const save = async (txid: string) => {
    setPending(txid); setMsg("Recording your ticket…");
    const r = await record({ data: { address: seat.address, revealTxid: txid } });
    if (!r.ok) { setMsg(r.error); return; }
    setPending(null); setMsg("Ticket inscribed"); void qc.invalidateQueries({ queryKey: ["launch-seats"] });
  };

  if (seat.ticketId) {
    return <a href={`https://ordinals.com/inscription/${seat.ticketId}`} target="_blank" rel="noreferrer" className="mt-2 block font-mono text-[10px] text-bitcoin hover:underline">★ VIP TICKET INSCRIBED →</a>;
  }
  const svg = launchTicketSvg({ seat: seat.seat, address: seat.address, pixelId: seat.pixelId, tier: seatTier(seat.seat), seatedAt: seat.createdAt });
  return (
    <div className="mt-2 font-mono text-[10px]">
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-bitcoin hover:underline">Inscribe my seat ticket ({TICKET_SATS.toLocaleString("en-US")} sats + network fee) →</button>
      ) : (
        <div className="mt-2 space-y-2">
          <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} alt={`Seat #${seat.seat} ticket`} className="w-full rounded border border-border" />
          <ShadowInscriber
            slug={`launch-ticket-${seat.seat}`}
            height={seat.seat}
            index={0}
            digest={`launch-ticket:${seat.seat}:${seat.address}`}
            artifactSvg={svg}
            artifactLabel={`LAUNCH TICKET · SEAT #${seat.seat}`}
            actionLabel="INSCRIBE TICKET ON BITCOIN"
            description="A proof-of-attendance ticket inscribed to your seat's wallet. It includes a 5,000-sat BITMAPWIN fee."
            allowUpload={false}
            receiveAddress={seat.address}
            artifactVariants={[{ key: "ticket", label: "TICKET", contentType: "image/svg+xml", source: svg, tribute: { address: DONATION_ADDRESS, sats: TICKET_SATS },
              metadata: { app: "bitmapwin", kind: "launch-ticket", seat: seat.seat, tier: seatTier(seat.seat) } }]}
            onRevealed={(txid) => save(txid).catch((e) => setMsg((e as Error).message))}
          />
        </div>
      )}
      {pending && <button onClick={() => save(pending)} className="mt-1 text-signal hover:underline">Retry recording</button>}
      {msg && <p className="mt-1 text-signal">{msg}</p>}
    </div>
  );
}

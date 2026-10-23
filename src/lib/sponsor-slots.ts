/**
 * Paid screen slots (Bit-Café TV, Launch Jumbotron) and the opt-in Launch
 * ticket inscription. Pure rules shared by browser and server.
 */
export type SponsorSlot = "cafe" | "launch" | "all";
export type SponsorScreen = "cafe" | "launch";

export const SPONSOR_SLOTS: Record<SponsorSlot, { label: string; sats: number; screens: SponsorScreen[] }> = {
  cafe: { label: "BIT-CAFÉ TV", sats: 10_000, screens: ["cafe"] },
  launch: { label: "LAUNCH JUMBOTRON", sats: 25_000, screens: ["launch"] },
  all: { label: "ALL SCREENS", sats: 35_000, screens: ["cafe", "launch"] },
};
export const SPONSOR_HOURS = 24;
/** Opt-in launch ticket inscription: site fee paid inside the reveal. */
export const TICKET_SATS = 5_000;

export const INSCRIPTION_ID = /^[0-9a-f]{64}i\d{1,4}$/;

/** Accepts an inscription id or an https image link; anything else is refused. */
export function parseSponsorMedia(raw: string): { kind: "inscription" | "image"; media: string } | null {
  const v = raw.trim();
  if (INSCRIPTION_ID.test(v.toLowerCase())) return { kind: "inscription", media: v.toLowerCase() };
  try {
    const u = new URL(v);
    if (u.protocol === "https:" && v.length <= 400) return { kind: "image", media: u.toString() };
  } catch { /* not a url */ }
  return null;
}

export function sponsorMessage(txid: string): string {
  return `BITMAPWIN sponsor slot\ntx: ${txid.toLowerCase()}`;
}

/** Whether a booked slot shows on a screen at a given time. */
export function slotLive(s: { slot: SponsorSlot; startsAt: string; endsAt: string }, screen: SponsorScreen, now: number): boolean {
  return SPONSOR_SLOTS[s.slot].screens.includes(screen) && Date.parse(s.startsAt) <= now && now < Date.parse(s.endsAt);
}

/** The ticket artifact: a small self-contained SVG boarding pass. */
export function launchTicketSvg(t: { seat: number; address: string; pixelId: string; tier: string; seatedAt: string }): string {
  const short = `${t.address.slice(0, 10)}…${t.address.slice(-6)}`;
  const date = t.seatedAt.slice(0, 10);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 260" font-family="monospace"><rect width="600" height="260" fill="#06090d"/><rect x="8" y="8" width="584" height="244" fill="none" stroke="#f7931a" stroke-width="3"/><line x1="430" y1="8" x2="430" y2="252" stroke="#f7931a" stroke-dasharray="6 6"/><text x="28" y="48" fill="#7fe7ff" font-size="16">BITMAPWIN · LAUNCH GRANDSTAND</text><text x="28" y="120" fill="#f7931a" font-size="56">SEAT #${t.seat}</text><text x="28" y="156" fill="#ffffff" font-size="18">${t.tier}</text><text x="28" y="196" fill="#9aa4ad" font-size="14">${short}</text><text x="28" y="226" fill="#9aa4ad" font-size="12">SEATED ${date} · PIXEL ${t.pixelId.slice(0, 12)}…</text><image href="/content/${t.pixelId}" x="450" y="60" width="124" height="124" style="image-rendering:pixelated"/><text x="452" y="216" fill="#7fe7ff" font-size="12">ADMIT ONE</text></svg>`;
}

export function seatTier(seat: number): string {
  return seat <= 100 ? "FOUNDERS ROW" : seat <= 500 ? "FULL HOUSE" : "IGNITION";
}

type Out = { scriptpubkey_address?: string; value: number };
/** A reveal counts as this seat's ticket when output 0 lands at the seat and it pays the ticket fee. */
export function ticketRevealOk(vout: Out[], seatAddress: string, treasury: string): boolean {
  if ((vout[0]?.scriptpubkey_address ?? "").toLowerCase() !== seatAddress.toLowerCase()) return false;
  const paid = vout.filter((o) => (o.scriptpubkey_address ?? "").toLowerCase() === treasury.toLowerCase()).reduce((n, o) => n + o.value, 0);
  return paid >= TICKET_SATS;
}

/** A sponsor payment counts when it pays the slot price to the treasury from the signing address. */
export function sponsorPaymentOk(tx: { vin: { prevout?: { scriptpubkey_address?: string | null } | null }[]; vout: Out[] }, slot: SponsorSlot, payer: string, treasury: string): boolean {
  const paid = tx.vout.filter((o) => (o.scriptpubkey_address ?? "").toLowerCase() === treasury.toLowerCase()).reduce((n, o) => n + o.value, 0);
  const fromPayer = tx.vin.some((v) => (v.prevout?.scriptpubkey_address ?? "").toLowerCase() === payer.toLowerCase());
  return paid >= SPONSOR_SLOTS[slot].sats && fromPayer;
}

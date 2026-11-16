import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { btcpayEnabledFn, checkLightningSponsorFn, createLightningSponsorFn } from "@/lib/sponsor-slots.functions";
import { SPONSOR_SLOTS, type SponsorSlot } from "@/lib/sponsor-slots";

type Inv = { invoiceId: string; checkoutLink: string; bolt11: string | null };

/** Instant Lightning booking via BTCPay. Hidden unless the site has Lightning checkout configured. */
export function LightningSponsorPay({ slot, title, handle, media, valid, onBooked }: {
  slot: SponsorSlot; title: string; handle: string; media: string; valid: boolean; onBooked: (endsAt: string) => void;
}) {
  const enabledFn = useServerFn(btcpayEnabledFn);
  const create = useServerFn(createLightningSponsorFn);
  const check = useServerFn(checkLightningSponsorFn);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["btcpay-enabled"], queryFn: () => enabledFn(), staleTime: 300_000 });
  const [inv, setInv] = useState<Inv | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!inv?.bolt11) { setQr(null); return; }
    void QRCode.toDataURL(`lightning:${inv.bolt11}`, { margin: 1, width: 220 }).then(setQr);
  }, [inv]);

  useEffect(() => {
    if (!inv) return;
    let stop = false;
    const tick = async () => {
      const r = await check({ data: { invoiceId: inv.invoiceId } }).catch(() => null);
      if (stop) return;
      if (r?.ok && r.endsAt) { setInv(null); onBooked(r.endsAt); void qc.invalidateQueries({ queryKey: ["sponsor-slides"] }); return; }
      if (r && (r.status === "Expired" || r.status === "Invalid")) { setMsg("Invoice expired — create a new one"); setInv(null); return; }
      setTimeout(tick, 3000);
    };
    const t = setTimeout(tick, 3000);
    return () => { stop = true; clearTimeout(t); };
  }, [inv, check, onBooked, qc]);

  if (!data?.enabled) return null;

  const start = async () => {
    setMsg(null); setBusy(true);
    try {
      const r = await create({ data: { slot, title, handle, media } });
      if (!r.ok) { setMsg(r.error); return; }
      setInv({ invoiceId: r.invoiceId, checkoutLink: r.checkoutLink, bolt11: r.bolt11 });
      const w = (window as unknown as { webln?: { enable(): Promise<void>; sendPayment(b: string): Promise<unknown> } }).webln;
      if (w && r.bolt11) { try { await w.enable(); await w.sendPayment(r.bolt11); } catch { /* user can scan instead */ } }
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-2">
      {!inv ? (
        <button disabled={!valid || busy} onClick={start} className="btn-term w-full px-3 py-2 disabled:opacity-50">
          {busy ? "CREATING INVOICE…" : `⚡ PAY ${SPONSOR_SLOTS[slot].sats.toLocaleString("en-US")} SATS WITH LIGHTNING · INSTANT`}
        </button>
      ) : (
        <div className="rounded border border-signal/40 p-3 text-center">
          <p className="text-signal">SCAN WITH ANY LIGHTNING WALLET · WAITING FOR PAYMENT…</p>
          {qr && <img src={qr} alt="Lightning invoice QR" className="mx-auto mt-2 rounded" width={220} height={220} />}
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {inv.bolt11 && <button className="btn-term px-2 py-1" onClick={() => void navigator.clipboard.writeText(inv.bolt11!)}>COPY INVOICE</button>}
            <a className="btn-term px-2 py-1" href={inv.checkoutLink} target="_blank" rel="noreferrer">OPEN CHECKOUT</a>
            <button className="btn-term px-2 py-1" onClick={() => setInv(null)}>CANCEL</button>
          </div>
          <p className="mt-2 text-muted-foreground">Your slide goes live as soon as the payment settles. Invoice expires in 15 minutes.</p>
        </div>
      )}
      {msg && <p className="mt-2 text-signal">{msg}</p>}
    </div>
  );
}

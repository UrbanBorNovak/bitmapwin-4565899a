import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { sendBitcoinFromWallet, signMessageWithWallet, type ConnectedWallet } from "@/lib/browser-wallet";
import { DONATION_ADDRESS } from "@/lib/donations";
import { bookSponsorSlotFn } from "@/lib/sponsor-slots.functions";
import { SPONSOR_HOURS, SPONSOR_SLOTS, parseSponsorMedia, sponsorMessage, type SponsorSlot } from "@/lib/sponsor-slots";

/** Book a 24h slide on the Bit-Café TV and/or the Launch Jumbotron, paid in sats. */
export function SponsorBooking({ wallet }: { wallet: ConnectedWallet | null }) {
  const book = useServerFn(bookSponsorSlotFn);
  const qc = useQueryClient();
  const [slot, setSlot] = useState<SponsorSlot>("cafe");
  const [title, setTitle] = useState("");
  const [handle, setHandle] = useState("");
  const [media, setMedia] = useState("");
  const [txid, setTxid] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const valid = title.trim().length >= 2 && !!parseSponsorMedia(media);
  const payer = wallet?.paymentAddress ?? wallet?.ordinalsAddress ?? "";

  const confirm = async (id: string) => {
    if (!wallet) return;
    setBusy("SIGN TO CONFIRM YOUR BOOKING…");
    const signature = await signMessageWithWallet(wallet.provider, payer, sponsorMessage(id));
    setBusy("CHECKING THE PAYMENT…");
    const r = await book({ data: { slot, title, handle, media, payer, txid: id, signature } });
    if (!r.ok) { setMsg(r.error); return; }
    setMsg(`Booked — live until ${new Date(r.endsAt).toLocaleString()}`);
    setTxid(null); setTitle(""); setHandle(""); setMedia("");
    void qc.invalidateQueries({ queryKey: ["sponsor-slides"] });
  };

  const run = async (fn: () => Promise<void>) => {
    setMsg(null);
    try { await fn(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <section id="sponsor" className="glass-panel mt-6 rounded border border-border p-4 font-mono text-xs">
      <p className="text-signal">SPONSOR A SCREEN · {SPONSOR_HOURS}H BROADCAST</p>
      <p className="mt-1 text-muted-foreground">Your inscription or image plays in the Bit-Café TV commercial breaks and/or on the Launch stage screen. Paid in sats straight to the BITMAPWIN address.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {(Object.keys(SPONSOR_SLOTS) as SponsorSlot[]).map((k) => (
          <button key={k} onClick={() => setSlot(k)} className={`rounded border p-2 text-left ${slot === k ? "border-bitcoin text-bitcoin" : "border-border"}`}>
            <div>{SPONSOR_SLOTS[k].label}</div>
            <div className="text-muted-foreground">{SPONSOR_SLOTS[k].sats.toLocaleString("en-US")} sats</div>
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="Title" className="rounded border border-border bg-background px-2 py-2" />
        <input value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={30} placeholder="@handle (optional)" className="rounded border border-border bg-background px-2 py-2" />
        <input value={media} onChange={(e) => setMedia(e.target.value)} placeholder="Inscription id or https image link" className="rounded border border-border bg-background px-2 py-2" />
      </div>
      {!wallet ? (
        <p className="mt-3 text-muted-foreground">Connect a wallet above to book.</p>
      ) : txid ? (
        <button disabled={!!busy} onClick={() => run(() => confirm(txid))} className="btn-term mt-3 w-full px-3 py-2">RETRY CONFIRMATION</button>
      ) : (
        <button disabled={!valid || !!busy} className="mt-3 w-full rounded bg-bitcoin px-3 py-2 font-bold text-primary-foreground disabled:opacity-50"
          onClick={() => run(async () => {
            setBusy("WAITING FOR PAYMENT…");
            const id = await sendBitcoinFromWallet(wallet.provider, DONATION_ADDRESS, SPONSOR_SLOTS[slot].sats);
            setTxid(id);
            await confirm(id);
          })}>
          {busy ?? `PAY ${SPONSOR_SLOTS[slot].sats.toLocaleString("en-US")} SATS & BOOK`}
        </button>
      )}
      {msg && <p className="mt-2 text-signal">{msg}</p>}
    </section>
  );
}

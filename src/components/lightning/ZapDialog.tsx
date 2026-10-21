import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TIP_PRESETS, fetchInvoice, payWithNwc, payWithWebln, saveNwc, savedNwc, webln } from "@/lib/lightning/lnurl";
import { playSfx } from "@/lib/retro-sfx";

type Props = { open: boolean; onOpenChange: (o: boolean) => void; to: string; address: string; comment: string; onPaid?: (sats: number) => void };

/** Tip any Lightning Address straight from the visitor's wallet. BITMAPWIN never holds the sats. */
export function ZapDialog({ open, onOpenChange, to, address, comment, onPaid }: Props) {
  const [sats, setSats] = useState<number>(21);
  const [pr, setPr] = useState("");
  const [qr, setQr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [nwc, setNwc] = useState("");
  const [hasWebln, setHasWebln] = useState(false);
  useEffect(() => { if (open) { setNwc(savedNwc()); setHasWebln(!!webln()); setPr(""); setQr(""); setMsg(""); } }, [open]);

  const paid = (via: string) => { playSfx("dance"); setMsg(`⚡ PAID ${sats} SATS VIA ${via}`); onPaid?.(sats); };

  async function zap() {
    if (!address) { setMsg("THIS TIP JAR HAS NO LIGHTNING ADDRESS YET"); return; }
    setBusy(true); setMsg("ASKING THE RECEIVER'S WALLET FOR AN INVOICE…");
    try {
      const inv = await fetchInvoice(address, sats, comment);
      setPr(inv);
      if (hasWebln) { setMsg("CONFIRM IN YOUR WALLET…"); try { await payWithWebln(inv); return paid("WEBLN"); } catch { /* fall through */ } }
      if (nwc) { setMsg("SENDING THROUGH YOUR WALLET CONNECTION…"); try { await payWithNwc(nwc, inv); return paid("NWC"); } catch (e) { setMsg(`${(e as Error).message} — SCAN THE QR INSTEAD`); } }
      setQr(await QRCode.toDataURL(`lightning:${inv}`, { margin: 1, width: 240 }));
      if (!nwc) setMsg("SCAN WITH ANY LIGHTNING WALLET");
    } catch (e) { playSfx("deny"); setMsg((e as Error).message || "COULD NOT REACH THE RECEIVER"); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="font-mono sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wide">⚡ TIP {to}</DialogTitle>
          <DialogDescription className="text-[11px]">Sats go straight from your wallet to {address || "the receiver"}. BITMAPWIN never holds them.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {TIP_PRESETS.map((s) => (
            <button key={s} onClick={() => setSats(s)} className={`rounded border px-3 py-1.5 text-[12px] ${sats === s ? "border-primary bg-primary/15 text-primary" : "border-border hover:border-signal"}`}>{s} SATS</button>
          ))}
          <input type="number" min={1} value={sats} onChange={(e) => setSats(Number(e.target.value))} className="w-24 rounded border border-border bg-background px-2 py-1 text-[12px]" aria-label="Custom sats" />
        </div>
        <button disabled={busy} onClick={zap} className="rounded border border-primary bg-primary/15 px-3 py-2 text-[13px] tracking-widest text-primary disabled:opacity-50">
          {busy ? "WORKING…" : `[ ZAP ${sats} SATS ]`}
        </button>
        <div className="min-h-[1rem] text-[11px] text-signal">{msg}</div>
        {qr ? (
          <div className="flex flex-col items-center gap-2">
            <img src={qr} alt="Lightning invoice QR" className="rounded bg-foreground p-1" />
            <a href={`lightning:${pr}`} className="text-[11px] text-primary underline">OPEN IN WALLET</a>
            <button onClick={() => navigator.clipboard.writeText(pr)} className="text-[11px] text-muted-foreground hover:text-foreground">COPY INVOICE</button>
          </div>
        ) : null}
        <details className="text-[11px] text-muted-foreground">
          <summary className="cursor-pointer">{hasWebln ? "● BROWSER WALLET FOUND" : "○ NO BROWSER WALLET"} · {nwc ? "● WALLET CONNECTED" : "CONNECT A WALLET (NWC)"}</summary>
          <input value={nwc} onChange={(e) => setNwc(e.target.value)} placeholder="nostr+walletconnect://…" className="mt-2 w-full rounded border border-border bg-background px-2 py-1" />
          <button onClick={() => { saveNwc(nwc); setMsg(nwc ? "WALLET CONNECTION SAVED ON THIS DEVICE" : "WALLET CONNECTION REMOVED"); }} className="mt-1 text-primary">[ SAVE ON THIS DEVICE ]</button>
        </details>
      </DialogContent>
    </Dialog>
  );
}

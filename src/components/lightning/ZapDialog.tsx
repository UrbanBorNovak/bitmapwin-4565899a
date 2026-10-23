import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TIP_PRESETS, fetchInvoice, payWithNwc, payWithWebln, saveNwc, savedNwc, webln } from "@/lib/lightning/lnurl";
import { playSfx } from "@/lib/retro-sfx";
import { bip21 } from "@/lib/bitmon";

type Props = {
  open: boolean; onOpenChange: (o: boolean) => void; to: string; address: string; comment: string;
  onPaid?: (sats: number, name: string) => void;
  /** Starting amount and preset list (defaults to the small Lightning presets). */
  defaultSats?: number; presets?: readonly number[];
  /** When set, an ON-CHAIN tab shows a BIP-21 QR to this Bitcoin address. */
  onchainAddress?: string;
  /** Show a "name on screen" field. */
  askName?: boolean;
};

/** Tip any Lightning Address straight from the visitor's wallet. BITMAPWIN never holds the sats. */
export function ZapDialog({ open, onOpenChange, to, address, comment, onPaid, defaultSats = 21, presets = TIP_PRESETS, onchainAddress, askName }: Props) {
  const [sats, setSats] = useState<number>(defaultSats);
  const [name, setName] = useState("");
  const [rail, setRail] = useState<"ln" | "chain">("ln");
  const [pr, setPr] = useState("");
  const [qr, setQr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [nwc, setNwc] = useState("");
  const [hasWebln, setHasWebln] = useState(false);
  useEffect(() => { if (open) { setNwc(savedNwc()); setHasWebln(!!webln()); setPr(""); setQr(""); setMsg(""); setSats(defaultSats); setRail("ln"); } }, [open, defaultSats]);

  const paid = (via: string) => { playSfx("dance"); setMsg(`⚡ PAID ${sats} SATS VIA ${via}`); onPaid?.(sats, name); };
  const note = name.trim() ? `${comment} · from ${name.trim().slice(0, 24)}` : comment;

  async function zap() {
    if (!address) { setMsg("THIS TIP JAR HAS NO LIGHTNING ADDRESS YET"); return; }
    setBusy(true); setMsg("ASKING THE RECEIVER'S WALLET FOR AN INVOICE…");
    try {
      const inv = await fetchInvoice(address, sats, note);
      setPr(inv);
      if (hasWebln) { setMsg("CONFIRM IN YOUR WALLET…"); try { await payWithWebln(inv); return paid("WEBLN"); } catch { /* fall through */ } }
      if (nwc) { setMsg("SENDING THROUGH YOUR WALLET CONNECTION…"); try { await payWithNwc(nwc, inv); return paid("NWC"); } catch (e) { setMsg(`${(e as Error).message} — SCAN THE QR INSTEAD`); } }
      setQr(await QRCode.toDataURL(`lightning:${inv}`, { margin: 1, width: 240 }));
      if (!nwc) setMsg("SCAN WITH ANY LIGHTNING WALLET");
    } catch (e) { playSfx("deny"); setMsg((e as Error).message || "COULD NOT REACH THE RECEIVER"); }
    finally { setBusy(false); }
  }

  async function chain() {
    if (!onchainAddress) return;
    const uri = bip21(onchainAddress, sats, `Tip · ${to}`);
    setPr(uri); setQr(await QRCode.toDataURL(uri, { margin: 1, width: 240 }));
    setMsg("SCAN WITH ANY BITCOIN WALLET, THEN PRESS I'VE SENT IT");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="font-mono sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wide">⚡ TIP {to}</DialogTitle>
          <DialogDescription className="text-[11px]">Sats go straight from your wallet to {rail === "chain" ? onchainAddress : address || "the receiver"}. BITMAPWIN never holds them.</DialogDescription>
        </DialogHeader>
        {onchainAddress ? (
          <div className="flex gap-2 text-[11px]">
            {([["ln", "⚡ LIGHTNING"], ["chain", "₿ ON-CHAIN"]] as const).map(([r, l]) => (
              <button key={r} onClick={() => { setRail(r); setPr(""); setQr(""); setMsg(""); }} className={`rounded border px-2 py-1 ${rail === r ? "border-signal text-signal" : "border-border"}`}>{l}</button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {presets.map((s) => (
            <button key={s} onClick={() => setSats(s)} className={`rounded border px-3 py-1.5 text-[12px] ${sats === s ? "border-primary bg-primary/15 text-primary" : "border-border hover:border-signal"}`}>{s.toLocaleString("en-US")} SATS</button>
          ))}
          <input type="number" min={1} value={sats} onChange={(e) => setSats(Number(e.target.value))} className="w-24 rounded border border-border bg-background px-2 py-1 text-[12px]" aria-label="Custom sats" />
        </div>
        {askName ? (
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Name on screen (blank = Anonymous Bitmapper)" className="rounded border border-border bg-background px-2 py-1 text-[12px]" aria-label="Name on screen" />
        ) : null}
        {rail === "ln" ? (
          <button disabled={busy} onClick={zap} className="rounded border border-primary bg-primary/15 px-3 py-2 text-[13px] tracking-widest text-primary disabled:opacity-50">
            {busy ? "WORKING…" : `[ ZAP ${sats.toLocaleString("en-US")} SATS ]`}
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={chain} className="flex-1 rounded border border-primary bg-primary/15 px-3 py-2 text-[13px] text-primary">[ SHOW QR ]</button>
            {qr ? <button onClick={() => paid("ON-CHAIN")} className="flex-1 rounded border border-signal px-3 py-2 text-[13px] text-signal">[ I'VE SENT IT ]</button> : null}
          </div>
        )}
        <div className="min-h-[1rem] text-[11px] text-signal">{msg}</div>
        {qr ? (
          <div className="flex flex-col items-center gap-2">
            <img src={qr} alt={rail === "ln" ? "Lightning invoice QR" : "Bitcoin payment QR"} className="rounded bg-foreground p-1" />
            <a href={rail === "ln" ? `lightning:${pr}` : pr} className="text-[11px] text-primary underline">OPEN IN WALLET</a>
            <button onClick={() => navigator.clipboard.writeText(pr)} className="text-[11px] text-muted-foreground hover:text-foreground">COPY</button>
          </div>
        ) : null}
        {rail === "ln" ? (
          <details className="text-[11px] text-muted-foreground">
            <summary className="cursor-pointer">{hasWebln ? "● BROWSER WALLET FOUND" : "○ NO BROWSER WALLET"} · {nwc ? "● WALLET CONNECTED" : "CONNECT A WALLET (NWC)"}</summary>
            <input value={nwc} onChange={(e) => setNwc(e.target.value)} placeholder="nostr+walletconnect://…" className="mt-2 w-full rounded border border-border bg-background px-2 py-1" />
            <button onClick={() => { saveNwc(nwc); setMsg(nwc ? "WALLET CONNECTION SAVED ON THIS DEVICE" : "WALLET CONNECTION REMOVED"); }} className="mt-1 text-primary">[ SAVE ON THIS DEVICE ]</button>
          </details>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShopListButton } from "@/components/builds/ShopListButton";
import { formatSats } from "@/lib/trades";
import { MARKETPLACE_FEE_PERCENT } from "@/lib/marketplace-fee";

/** Listing form for one owned piece. Signing is only offered after the holder confirms the price. */
export function ListPieceDialog({
  item, onClose, preview,
}: {
  item: { id: string; label: string } | null;
  onClose: () => void;
  preview?: React.ReactNode;
}) {
  const [price, setPrice] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const sats = Number(price);
  const valid = Number.isInteger(sats) && sats >= 546;
  const close = () => { setPrice(""); setConfirmed(false); onClose(); };

  return (
    <Dialog open={!!item} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="display">LIST FOR SALE</DialogTitle>
          <DialogDescription className="label">{item?.label}</DialogDescription>
        </DialogHeader>
        {preview && <div className="mx-auto w-40">{preview}</div>}
        <div className="label truncate text-muted-foreground" data-no-translate>{item?.id}</div>
        <label className="label" htmlFor="list-price">ASKING PRICE (SATS)</label>
        <input id="list-price" inputMode="numeric" value={price} placeholder="e.g. 250000"
          onChange={(e) => { setPrice(e.target.value.replace(/\D/g, "")); setConfirmed(false); }}
          className="w-full border border-border bg-background px-2 py-2 font-mono text-sm" />
        {price && !valid && <p className="label text-destructive">MINIMUM 546 SATS</p>}
        {valid && (
          <label className="flex items-start gap-2 font-mono text-xs">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
            <span>I CONFIRM LISTING THIS PIECE FOR {formatSats(sats)}. I RECEIVE THE FULL PRICE; THE BUYER PAYS THE {MARKETPLACE_FEE_PERCENT}% FEE. MY WALLET WILL ASK ME TO SIGN.</span>
          </label>
        )}
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="btn-term-ghost" onClick={close}>CANCEL</button>
          {valid && confirmed && item
            ? <ShopListButton inscriptionId={item.id} priceSats={sats} alreadyListed={false} />
            : <span className="label text-muted-foreground">SET A PRICE AND CONFIRM TO SIGN</span>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

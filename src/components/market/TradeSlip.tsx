import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, X } from "lucide-react";
import { BuyButton } from "@/components/BuyButton";
import { formatSats } from "@/lib/trades";
import { MARKETPLACE_FEE_PERCENT } from "@/lib/marketplace-fee";
import { cart, cartTotal, useCart, type CartItem } from "@/lib/sweep-cart";

/** Live network fee rates (display only — the server quotes the real rate per purchase). */
function useFees() {
  return useQuery({
    queryKey: ["mempool", "fees"],
    queryFn: async () => {
      const r = await fetch("https://mempool.space/api/v1/fees/recommended");
      if (!r.ok) throw new Error("fees");
      return (await r.json()) as { fastestFee: number; halfHourFee: number; economyFee: number };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function CartToggle({ item, className = "" }: { item: CartItem; className?: string }) {
  const items = useCart();
  const on = items.some((i) => i.offerId === item.offerId);
  return (
    <button type="button" onClick={() => cart.toggle(item)} aria-pressed={on}
      className={`border px-1.5 py-0.5 font-mono text-[10px] ${on ? "border-bitcoin bg-bitcoin/10 text-bitcoin" : "border-border text-muted-foreground hover:border-signal hover:text-signal"} ${className}`}>
      {on ? "IN SLIP" : "+ SLIP"}
    </button>
  );
}

/** Docked trade slip: a basket of open asks, bought one wallet signature at a time. */
export function TradeSlip() {
  const items = useCart();
  const fees = useFees();
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;
  const total = cartTotal(items);
  const mkt = Math.round((total * MARKETPLACE_FEE_PERCENT) / 100);

  return (
    <aside className="fixed bottom-4 right-4 z-40 w-[min(360px,calc(100vw-2rem))] border border-bitcoin/60 bg-card/95 shadow-lg backdrop-blur-md" aria-label="Trade slip" data-no-translate>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between border-b border-border px-3 py-2 font-mono text-[11px]">
        <span className="flex items-center gap-2 text-bitcoin"><ShoppingCart className="size-3.5" /> TRADE SLIP · {items.length}</span>
        <span className="text-foreground">{formatSats(total)} {open ? "▾" : "▴"}</span>
      </button>
      {open && (
        <div className="p-3">
          <ol className="max-h-64 space-y-1 overflow-y-auto">
            {items.map((i) => (
              <li key={i.offerId} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 font-mono text-[11px]">
                <Link to="/bitmap/$block" params={{ block: String(i.height) }} className="hover:text-signal">{i.height}.BITMAP</Link>
                <span className="text-bitcoin">{formatSats(i.priceSats)}</span>
                <BuyButton offerId={i.offerId} priceSats={i.priceSats} inscriptionId={i.inscriptionId} height={i.height} className="btn-term whitespace-nowrap !px-2 !py-0.5 text-[10px]" />
                <button type="button" onClick={() => cart.remove(i.offerId)} aria-label={`Remove ${i.height}`} className="text-muted-foreground hover:text-destructive"><X className="size-3.5" /></button>
              </li>
            ))}
          </ol>
          <dl className="mt-3 space-y-0.5 border-t border-border pt-2 font-mono text-[10px]">
            <div className="flex justify-between"><dt className="text-muted-foreground">ASKS</dt><dd>{total.toLocaleString("en-US")} SATS</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">MARKET FEE ({MARKETPLACE_FEE_PERCENT}%)</dt><dd>≈ {mkt.toLocaleString("en-US")} SATS</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">NETWORK NOW</dt>
              <dd className="text-signal">{fees.data ? `${fees.data.fastestFee} / ${fees.data.halfHourFee} / ${fees.data.economyFee} SAT/VB` : fees.isError ? "UNAVAILABLE" : "…"}</dd></div>
          </dl>
          <p className="mt-2 font-mono text-[9px] leading-relaxed text-muted-foreground">
            FAST / 30 MIN / ECONOMY. EACH BUY IS ITS OWN PSBT SIGNED IN YOUR WALLET; THE EXACT MINER FEE IS QUOTED BEFORE YOU SIGN. SOLD ASKS FAIL SAFELY.
          </p>
          <button type="button" onClick={cart.clear} className="btn-term-ghost mt-2 w-full !py-1 text-[10px]">CLEAR SLIP</button>
        </div>
      )}
    </aside>
  );
}

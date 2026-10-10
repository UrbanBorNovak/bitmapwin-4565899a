import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { transferStatusFn } from "@/lib/transfer-status.functions";

export type TrackedPurchase = { txid: string; buyerAddress: string; inscriptionId?: string; height?: number };

/** Live post-purchase panel: mempool → confirmed → BITMAP at the buyer's address. */
export function TransferTracker({ purchase, onClose }: { purchase: TrackedPurchase | null; onClose: () => void }) {
  const status = useQuery({
    queryKey: ["transfer-status", purchase?.txid],
    enabled: !!purchase,
    queryFn: () =>
      transferStatusFn({
        data: {
          txid: purchase!.txid,
          buyerAddress: purchase!.buyerAddress,
          ...(purchase!.inscriptionId ? { inscriptionId: purchase!.inscriptionId } : {}),
        },
      }),
    refetchInterval: (q) => (q.state.data?.landed && q.state.data.confirmed ? false : 20_000),
  });
  const s = status.data;
  const steps = [
    { label: "BROADCAST", done: true },
    { label: "SEEN IN MEMPOOL", done: !!s?.seen },
    { label: s?.blockHeight ? `CONFIRMED · BLOCK #${s.blockHeight}` : "CONFIRMED IN A BLOCK", done: !!s?.confirmed },
    { label: "BITMAP AT YOUR ADDRESS", done: !!s?.landed },
  ];
  return (
    <Dialog open={!!purchase} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">{purchase?.height !== undefined ? `${purchase.height}.BITMAP` : "BITMAP"} TRANSFER</DialogTitle>
          <DialogDescription className="font-mono text-xs">Checked live on Bitcoin every 20 seconds.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-2 font-mono text-xs">
          {steps.map((st, i) => {
            const active = !st.done && steps.slice(0, i).every((p) => p.done);
            return (
              <li key={st.label} className={`flex items-center gap-2 border px-3 py-2 ${st.done ? "border-signal/50 text-signal" : active ? "border-bitcoin/60 text-bitcoin" : "border-border text-muted-foreground"}`}>
                <span aria-hidden>{st.done ? "✓" : active ? "●" : "○"}</span>
                {st.label}
                {active && <span className="blink">_</span>}
              </li>
            );
          })}
        </ol>
        {purchase && (
          <a href={`https://mempool.space/tx/${purchase.txid}`} target="_blank" rel="noreferrer" className="btn-term-ghost mt-2 w-full" data-no-translate>
            VIEW TX {purchase.txid.slice(0, 10)}… ↗
          </a>
        )}
        {s?.owner && !s.landed && s.confirmed && (
          <p className="font-mono text-[10px] text-muted-foreground">Indexer still shows the old holder — it usually catches up within a few minutes.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* App-wide tracker state, so the dialog survives the Buy button unmounting once the listing closes. */
let current: TrackedPurchase | null = null;
const subs = new Set<() => void>();
export function trackPurchase(p: TrackedPurchase | null) {
  current = p;
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

/** Mounted once at the app root. */
export function TransferTrackerHost() {
  const p = useSyncExternalStore(subscribe, () => current, () => null);
  return <TransferTracker purchase={p} onClose={() => trackPurchase(null)} />;
}

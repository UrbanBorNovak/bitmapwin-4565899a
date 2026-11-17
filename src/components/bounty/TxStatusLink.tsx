import { useEffect, useRef, useState } from "react";
import { EXPLORER_TX } from "@/lib/stacks-pilot";
import type { ErrorMap, TxOutcome } from "@/lib/stacks-tx-outcome";

/** Explorer link for a wallet-signed testnet transaction that follows it until it confirms or fails. */
export function TxStatusLink({ txid, label, onSettled, errors, className = "" }: { txid: string; label: string; onSettled?: (o: TxOutcome) => void; errors?: ErrorMap; className?: string }) {
  const [o, setO] = useState<TxOutcome>({ state: "pending", reason: null });
  const settled = useRef(onSettled);
  settled.current = onSettled;
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const { txOutcome } = await import("@/lib/stacks-tx-outcome");
        const next = await txOutcome(txid, errors);
        if (stop) return;
        setO(next);
        if (next.state !== "pending") { settled.current?.(next); return; }
      } catch { /* the explorer can blink; keep polling */ }
      if (!stop) timer = setTimeout(tick, 5000);
    };
    void tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [txid]); // eslint-disable-line react-hooks/exhaustive-deps
  const tone = o.state === "success" ? "text-signal" : o.state === "failed" ? "text-destructive" : "text-muted-foreground";
  const state = o.state === "success" ? "CONFIRMED" : o.state === "failed" ? "FAILED" : "WAITING FOR TESTNET BLOCK…";
  return (
    <span className={`block ${className}`}>
      <a className="text-signal hover:underline" href={EXPLORER_TX(txid)} target="_blank" rel="noreferrer">{label} · {txid.slice(0, 6)}…{txid.slice(-4)}</a>
      <span className={`ml-2 ${tone}`}>{state}</span>
      {o.reason && <span className="block text-destructive">{o.reason}</span>}
    </span>
  );
}

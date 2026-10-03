/**
 * Batch summon: opens one invoice per BITMAP (each keeps its own unique
 * amount so the chain match stays exact) and lets the holder pay them all in
 * a single Bitcoin transaction with one output per invoice.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { checkSummonOrderFn, createSummonOrderFn } from "@/lib/bitmon.functions";
import { GUARDIAN_PRICE_SATS } from "@/lib/bitmon";

type Order = { id: string; height: number; payTo: string; amountSats: number; status: string; txid: string | null };
type Row = { height: number; order: Order | null; denied: string | null };

const MAX = 20;

function parse(text: string): number[] {
  const out = new Set<number>();
  for (const part of text.split(/[\s,]+/)) {
    const r = /^(\d+)-(\d+)$/.exec(part);
    if (r) {
      const a = Number(r[1]), b = Number(r[2]);
      for (let h = Math.min(a, b); h <= Math.max(a, b) && out.size < MAX; h++) out.add(h);
    } else if (/^\d+$/.test(part)) out.add(Number(part));
    if (out.size >= MAX) break;
  }
  return [...out];
}

const TONE: Record<string, string> = { pending: "text-muted-foreground", seen: "text-signal", settled: "text-bitcoin", taken: "text-destructive", expired: "text-destructive" };
const LABEL: Record<string, string> = { pending: "AWAITING PAYMENT", seen: "IN MEMPOOL", settled: "AWAKE", taken: "TAKEN BY ANOTHER", expired: "EXPIRED" };

export function BatchSummon() {
  const create = useServerFn(createSummonOrderFn);
  const check = useServerFn(checkSummonOrderFn);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session))); }, []);

  const open = async () => {
    const heights = parse(text);
    if (!heights.length) return;
    setBusy(true);
    const next: Row[] = [];
    for (const height of heights) {
      try {
        const r = await create({ data: { height } });
        next.push({ height, order: r.order as Order | null, denied: r.denied });
      } catch {
        next.push({ height, order: null, denied: "COULD NOT OPEN AN INVOICE — TRY AGAIN" });
      }
      setRows([...next]);
    }
    setBusy(false);
  };

  const live = rows.filter((r) => r.order && (r.order.status === "pending" || r.order.status === "seen"));
  useEffect(() => {
    if (!live.length) return;
    const t = setInterval(async () => {
      const updated = await Promise.all(rows.map(async (r) => {
        if (!r.order || !["pending", "seen"].includes(r.order.status)) return r;
        try {
          const res = await check({ data: { orderId: r.order.id } });
          if (res.awakened) { qc.invalidateQueries({ queryKey: ["guardians"] }); qc.invalidateQueries({ queryKey: ["guardian", r.height] }); }
          return res.order ? { ...r, order: res.order as Order } : r;
        } catch { return r; }
      }));
      setRows(updated);
    }, 15_000);
    return () => clearInterval(t);
  }, [rows, live.length, check, qc]);

  const payable = rows.filter((r) => r.order?.status === "pending");
  const total = payable.reduce((s, r) => s + (r.order?.amountSats ?? 0), 0);
  const done = rows.filter((r) => r.order?.status === "settled").length;
  const copy = () => navigator.clipboard?.writeText(payable.map((r) => `${r.order!.payTo},${(r.order!.amountSats / 1e8).toFixed(8)}`).join("\n"));

  return (
    <section className="panel mt-6 space-y-3 rounded-md border border-border p-4">
      <p className="label text-signal">BATCH SUMMON · UP TO {MAX} BITMAPS</p>
      <h2 className="display text-2xl">SUMMON MANY. <span className="text-bitcoin">PAY ONCE.</span></h2>
      <p className="max-w-2xl text-sm text-muted-foreground">
        List the BITMAPs you hold. Each gets its own exact invoice amount; send them all as outputs of one Bitcoin transaction (most wallets have "add recipient"), or pay them one by one. Each Guardian wakes on its own once its output confirms.
      </p>
      {signedIn === false ? (
        <Link to="/auth" className="btn-term inline-block">SIGN IN TO BATCH SUMMON</Link>
      ) : (
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void open(); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="800541, 800542, 840000-840004" aria-label="BITMAP list" className="min-w-0 flex-1 rounded-sm border border-border bg-background px-3 py-2 font-mono text-sm" />
          <button type="submit" disabled={busy || !parse(text).length} className="btn-term disabled:opacity-50">
            {busy ? "OPENING…" : `◆ OPEN ${parse(text).length || ""} INVOICES`}
          </button>
        </form>
      )}

      {rows.length ? (
        <>
          <div className="h-1.5 w-full overflow-hidden rounded-sm bg-border">
            <div className="h-full bg-bitcoin transition-all" style={{ width: `${(done / rows.length) * 100}%` }} />
          </div>
          <p className="font-mono text-[10px] text-muted-foreground">{done} / {rows.length} AWAKE · CHECKS EVERY 15S</p>
          <table className="w-full font-mono text-xs">
            <thead><tr className="text-left text-muted-foreground"><th className="py-1">BITMAP</th><th>SEND EXACTLY</th><th>STATUS</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.height} className="border-t border-border">
                  <td className="py-1.5">{r.height}.BITMAP</td>
                  <td>{r.order ? `${r.order.amountSats.toLocaleString()} SATS` : "—"}</td>
                  <td className={r.order ? TONE[r.order.status] : "text-destructive"}>{r.order ? LABEL[r.order.status] ?? r.order.status : r.denied}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {payable.length ? (
            <div className="space-y-2 border border-bitcoin/50 p-3">
              <p className="font-mono text-[10px] text-muted-foreground">PAY TO (EVERY OUTPUT)</p>
              <p className="break-all font-mono text-xs text-bitcoin">{payable[0]!.order!.payTo}</p>
              <p className="font-mono text-xs">TOTAL {total.toLocaleString()} SATS · {payable.length} OUTPUTS + NETWORK FEE</p>
              <p className="font-mono text-[10px] text-muted-foreground">KEEP EVERY OUTPUT SEPARATE — ONE SUMMED OUTPUT CAN'T BE MATCHED TO ITS BITMAPS.</p>
              <button type="button" onClick={copy} className="btn-term-ghost">COPY AS ADDRESS,AMOUNT LIST</button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="font-mono text-[10px] text-muted-foreground">BASE PRICE {GUARDIAN_PRICE_SATS.toLocaleString()} SATS + A SMALL ID AMOUNT PER BITMAP. ONLY BITMAPS IN YOUR VERIFIED WALLET ARE ACCEPTED.</p>
      )}
    </section>
  );
}

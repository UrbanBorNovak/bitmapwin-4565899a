import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { btcPriceQuery, usdFromSats } from "@/lib/btc-price";
import { computeEv, evVerdict } from "@/lib/listing-ev";

const fmtBtc = (s: number) => (s / 1e8).toFixed(8).replace(/0+$/, "").replace(/\.$/, "");

/** EV− / EV / EV+ buttons from confirmed on-chain sales; clicking fills the ask. */
export function EvPricePicker({
  height,
  priceSats,
  onPick,
}: {
  height: number | null;
  priceSats: number | null;
  onPick: (sats: number) => void;
}) {
  const sales = useQuery({
    queryKey: ["ev-sales"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("bitmap_height, price_sats")
        .gt("price_sats", 0)
        .order("block_height", { ascending: false, nullsFirst: false })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });
  const btc = useQuery(btcPriceQuery());
  const ev = sales.data ? computeEv(height, sales.data) : null;

  if (sales.isLoading) return <p className="mt-2 font-mono text-[10px] text-muted-foreground">&gt; READING ON-CHAIN SALES…</p>;
  if (!ev) return null;

  const bands = [
    { key: "EV−", sats: ev.low, hint: "QUICK SELL" },
    { key: "EV", sats: ev.mid, hint: "FAIR VALUE" },
    { key: "EV+", sats: ev.high, hint: "PREMIUM" },
  ];

  return (
    <div className="mt-3 border border-border p-2">
      <p className="label">PRICE GUIDE · {ev.scope} · {ev.sampleSize} CONFIRMED</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {bands.map((b) => {
          const usd = usdFromSats(b.sats, btc.data?.usd);
          const active = priceSats === b.sats;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => onPick(b.sats)}
              className={`${active ? "btn-term" : "btn-term-ghost"} !px-2 !py-2 text-left`}
            >
              <span className="block font-mono text-[11px] text-bitcoin">{b.key}</span>
              <span className="block font-mono text-[11px]">{fmtBtc(b.sats)} BTC</span>
              <span className="block font-mono text-[9px] text-muted-foreground">
                {b.sats.toLocaleString("en-US")} SATS{usd ? ` ≈ ${usd}` : ""}
              </span>
              <span className="block font-mono text-[9px] text-signal">{b.hint}</span>
            </button>
          );
        })}
      </div>
      {priceSats !== null && (
        <p className="mt-2 font-mono text-[10px] text-signal">&gt; YOUR ASK: {evVerdict(priceSats, ev)}</p>
      )}
    </div>
  );
}

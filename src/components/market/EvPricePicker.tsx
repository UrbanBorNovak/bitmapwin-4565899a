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
        .select("bitmap_height, price_sats, block_time")
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
  if (sales.isError) {
    return (
      <div className="mt-3 border border-border p-2">
        <p className="label">PRICE GUIDE · UNAVAILABLE</p>
        <p className="mt-1 font-mono text-[10px] text-bitcoin">
          ⚠ INSUFFICIENT DATA: CONFIRMED SALES COULDN&apos;T BE READ RIGHT NOW, SO EV−, EV AND EV+ ARE HIDDEN.
        </p>
        <p className="mt-1 font-mono text-[9px] text-muted-foreground">
          &gt; SET YOUR OWN ASK BELOW. TRY AGAIN LATER FOR A PRICE GUIDE.
        </p>
      </div>
    );
  }
  if (!ev) {
    return (
      <div className="mt-3 border border-border p-2">
        <p className="label">PRICE GUIDE · NO DATA</p>
        <p className="mt-1 font-mono text-[10px] text-bitcoin">
          ⚠ INSUFFICIENT DATA: NO CONFIRMED SALES TO PRICE AGAINST, SO EV−, EV AND EV+ ARE HIDDEN.
        </p>
        <p className="mt-1 font-mono text-[9px] text-muted-foreground">
          &gt; SET YOUR OWN ASK BELOW. WITHOUT CONFIRMED SALES THERE IS NO FAIR-VALUE GUIDE OR ASK LABEL.
        </p>
      </div>
    );
  }

  const bands = [
    { key: "EV−", sats: ev.low, hint: "FASTER SALE (NOT GUARANTEED)" },
    { key: "EV", sats: ev.mid, hint: "FAIR VALUE" },
    { key: "EV+", sats: ev.high, hint: "PREMIUM" },
  ];

  const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "?");
  return (
    <div className="mt-3 border border-border p-2">
      <p className="label">PRICE GUIDE · {ev.scope}</p>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
        &gt; BASED ON {ev.sampleSize} COMPARABLE CONFIRMED SALE{ev.sampleSize === 1 ? "" : "S"}
        {ev.from ? ` · ${day(ev.from)} → ${day(ev.to)}` : ""}
      </p>
      {ev.fallback && (
        <p className="mt-1 font-mono text-[10px] text-bitcoin">
          ⚠ BROAD-MARKET FALLBACK: TOO FEW SALES IN THIS HEIGHT RANGE, SO ALL BITMAP SALES ARE USED.
        </p>
      )}
      {ev.lowConfidence && (
        <p className="mt-1 font-mono text-[10px] text-bitcoin">
          ⚠ LOW CONFIDENCE: FEWER THAN 8 COMPARABLE SALES. TREAT THESE PRICES AS A ROUGH GUIDE.
        </p>
      )}
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
      <p className="mt-1 font-mono text-[9px] text-muted-foreground">
        &gt; GUIDE ONLY, FROM PAST SALES. EV− IS PRICED TO SELL FASTER, BUT NO SALE OR TIMING IS GUARANTEED.
      </p>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { formatSats } from "@/lib/trades";
import { timeAgo } from "@/lib/bitmap";

type Trade = {
  txid: string;
  price_sats: number;
  bitmap_height: number;
  block_height: number | null;
  block_time?: string | null;
  created_at?: string | null;
};

type Item = { key: string; kind: "SALE" | "INHABITED"; height: number; text: string; href?: string };

/** Scrolling tape of real on-chain events: confirmed sales + inscribed Guardians. */
export function LiveMarketTicker({
  trades,
  inhabited,
  syncedAt,
}: {
  trades: Trade[];
  inhabited: Map<number, string> | undefined;
  syncedAt: number;
}) {
  const items: Item[] = [];
  for (const t of trades.filter((t) => t.price_sats > 0).slice(0, 20)) {
    const when = t.block_time ?? t.created_at;
    items.push({
      key: `s-${t.txid}`,
      kind: "SALE",
      height: t.bitmap_height,
      text: `${formatSats(t.price_sats)}${when ? ` · ${timeAgo(when)}` : ""}`,
      href: `https://mempool.space/tx/${t.txid}`,
    });
  }
  for (const [h, id] of inhabited ?? []) {
    items.push({ key: `i-${h}`, kind: "INHABITED", height: h, text: "GUARDIAN ON-CHAIN", href: `https://ordinals.com/inscription/${id}` });
  }
  const secs = syncedAt ? Math.max(0, Math.round((Date.now() - syncedAt) / 1000)) : null;

  return (
    <div className="mt-6 flex min-w-0 max-w-full items-stretch overflow-hidden border border-border bg-card" data-no-translate>
      <div className="flex shrink-0 items-center gap-2 border-r border-border px-3 font-mono text-[10px] text-signal">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-signal" />
        </span>
        LIVE{secs !== null ? ` · ${secs}S` : ""}
      </div>
      <div className="group relative min-w-0 flex-1 overflow-hidden py-2">
        {items.length === 0 ? (
          <span className="px-4 font-mono text-[10px] text-muted-foreground">READING CHAIN…</span>
        ) : (
          <div className="market-ticker flex w-max gap-8 whitespace-nowrap group-hover:[animation-play-state:paused]">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex gap-8" aria-hidden={dup === 1}>
                {items.map((it) => (
                  <span key={`${dup}-${it.key}`} className="flex items-center gap-2 font-mono text-[11px]">
                    <span className={it.kind === "SALE" ? "text-bitcoin" : "text-signal"}>
                      {it.kind === "SALE" ? "▲ SOLD" : "◆ INHABITED"}
                    </span>
                    <Link to="/bitmap/$block" params={{ block: String(it.height) }} className="font-bold text-foreground hover:text-bitcoin">
                      {it.height}.BITMAP
                    </Link>
                    {it.href ? (
                      <a href={it.href} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-signal">{it.text}</a>
                    ) : (
                      <span className="text-muted-foreground">{it.text}</span>
                    )}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

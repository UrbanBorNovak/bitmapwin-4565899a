import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { tickerQuery, type TickerItem } from "@/lib/ticker-feed";

const TONE: Record<TickerItem["tone"], string> = {
  bitcoin: "text-bitcoin",
  signal: "text-signal",
  plain: "text-foreground",
};

/** THE FLOOR IS MOVING — a slim live ribbon of real network activity. */
export function SiteTickerTape() {
  const feed = useQuery(tickerQuery());
  const items = feed.data ?? [];

  return (
    <div data-no-translate data-nosnippet className="ticker-tape relative flex items-stretch overflow-hidden border-b border-border bg-background">
      <span className="label z-10 flex shrink-0 items-center gap-1.5 border-r border-border bg-surface px-2 text-[0.5rem] text-signal sm:px-3">
        <span className="size-1.5 shrink-0 bg-signal lc-blink" aria-hidden />
        <span className="hidden sm:inline">THE FLOOR IS MOVING</span>
        <span className="sm:hidden">LIVE</span>
      </span>
      <div className="min-w-0 flex-1 overflow-hidden py-1">
        {items.length ? (
          <div className="ticker-track flex w-max items-center gap-6">
            {[0, 1].map((pass) => (
              <div key={pass} className="flex items-center gap-6" aria-hidden={pass === 1}>
                {items.map((item) => (
                  <TickerLine key={`${pass}:${item.id}`} item={item} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="px-3 font-mono text-[10px] text-muted-foreground">
            &gt; {feed.isLoading ? "READING THE NETWORK_" : "NO NETWORK ACTIVITY RECORDED YET_"}
          </p>
        )}
      </div>
    </div>
  );
}

function TickerLine({ item }: { item: TickerItem }) {
  const body = (
    <span className="flex items-center gap-2 whitespace-nowrap font-mono text-[10px]">
      <span className={`label text-[0.5rem] ${TONE[item.tone]}`}>{item.tag}</span>
      <span className="text-muted-foreground">{item.text}</span>
    </span>
  );
  if (item.height == null) return body;
  return (
    <Link to="/bitmap/$block" params={{ block: String(item.height) }} className="hover:text-foreground">
      {body}
    </Link>
  );
}

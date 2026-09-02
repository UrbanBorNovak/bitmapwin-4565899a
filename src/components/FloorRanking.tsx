import { Link } from "@tanstack/react-router";
import { BuyButton } from "@/components/BuyButton";
import { clubOf } from "@/lib/clubs";
import { formatSats } from "@/lib/trades";
import type { RegistryParcel } from "@/lib/registry";

/**
 * Floor price ranking: the cheapest open PSBT asks, ordered from lowest price
 * up. Every row is a real signed seller offer from the offer book.
 */
export function FloorRanking({
  parcels,
  limit = 10,
  title = "FLOOR RANKING",
  subtitle = "CHEAPEST BITMAPS OPEN FOR PURCHASE",
  pending = false,
  showClub = true,
}: {
  parcels: RegistryParcel[];
  limit?: number;
  title?: string;
  subtitle?: string;
  pending?: boolean;
  showClub?: boolean;
}) {
  const ranked = parcels
    .filter((p) => p.listedSats !== null && p.listedSats > 0)
    .sort((a, b) => (a.listedSats as number) - (b.listedSats as number))
    .slice(0, limit);

  const floor = ranked.length ? (ranked[0]?.listedSats as number) : null;

  return (
    <section className="border border-border bg-card">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border p-4">
        <div>
          <h2 className="border-l-2 border-primary pl-3 font-mono text-sm font-bold text-foreground">
            {title}
          </h2>
          <p className="label mt-2 pl-[14px]">{subtitle}</p>
        </div>
        <span className="label">FLOOR {floor ? formatSats(floor) : "—"}</span>
      </header>

      {pending ? (
        <p className="p-6 font-mono text-xs text-muted-foreground">
          &gt; READING OPEN ASKS<span className="blink">_</span>
        </p>
      ) : ranked.length === 0 ? (
        <p className="p-6 font-mono text-xs text-muted-foreground">
          &gt; NO OPEN ASKS RIGHT NOW<span className="blink">_</span>
        </p>
      ) : (
        <ol className="divide-y divide-border">
          {ranked.map((p, i) => {
            const price = p.listedSats as number;
            const over = floor ? Math.round(((price - floor) / floor) * 100) : 0;
            return (
              <li
                key={p.inscriptionId}
                className="flex flex-wrap items-center gap-3 p-3 transition-colors hover:bg-muted/40"
              >
                <span className="label w-8 shrink-0 text-primary">
                  #{String(i + 1).padStart(2, "0")}
                </span>
                <Link
                  to="/bitmap/$block"
                  params={{ block: String(p.bitmapHeight) }}
                  className="font-mono text-xs font-bold text-foreground underline-offset-4 hover:underline"
                >
                  {p.bitmapHeight.toLocaleString("en-US")}.BITMAP
                </Link>
                {showClub && <span className="label">{clubOf(p.bitmapHeight).short}</span>}
                <span className="label ml-auto">
                  {i === 0 ? "FLOOR" : `+${over}% OVER FLOOR`}
                </span>
                <span className="font-mono text-xs font-bold text-foreground">
                  {formatSats(price)}
                </span>
                {p.listedOfferId && <BuyButton offerId={p.listedOfferId} priceSats={price} />}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

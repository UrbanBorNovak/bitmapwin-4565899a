import { Link } from "@tanstack/react-router";
const STEPS = [
  {
    n: "01",
    title: "INSCRIPTION",
    body: "Someone inscribes the text <block>.bitmap on Bitcoin. The first valid inscription for a block is the only real claim.",
  },
  {
    n: "02",
    title: "OWNERSHIP",
    body: "That inscription lives on a satoshi. Whoever controls the output holding it owns the bitmap — we resolve the holder from the chain.",
  },
  {
    n: "03",
    title: "LISTING",
    body: "The holder signs a partial Bitcoin transaction with their asking price. No custody, no escrow — the signature is the listing.",
  },
  {
    n: "04",
    title: "BIDS",
    body: "Buyers place signed offers. The holder can accept one, which locks the seller side of the trade at that price.",
  },
  {
    n: "05",
    title: "SETTLEMENT",
    body: "The buyer funds and broadcasts the transaction. The inscription moves, the sats arrive, and the sale is recorded from the block.",
  },
] as const;

/** Plain-language lifecycle of a bitmap trade, for first-time visitors. */
export function HowItWorks() {
  return (
    <section className="mx-auto max-w-[1600px] px-4 pt-10 md:px-8 md:pt-16">
      <div className="border border-border-strong">
        <header className="flex flex-col gap-2 border-b border-border p-5 sm:flex-row sm:items-end sm:justify-between md:p-6">
          <div>
            <div className="label text-bitcoin">NEW HERE? START WITH THIS</div>
            <h2 className="display mt-2 text-2xl md:text-3xl">HOW A BITMAP TRADE WORKS</h2>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <p className="max-w-md font-mono text-[11px] leading-relaxed text-muted-foreground">
              &gt; FIVE STEPS, ALL ON BITCOIN. NOTHING IS HELD BY US AT ANY POINT.
            </p>
            <Link to="/land-101" className="label border border-border px-3 py-2">
              [ BITCOIN LAND 101 ]
            </Link>
          </div>
        </header>


        <ol className="grid md:grid-cols-5">
          {STEPS.map((step, i) => (
            <li
              key={step.n}
              className={`relative border-b border-border p-5 md:border-b-0 md:p-6 ${i > 0 ? "md:border-l md:border-border" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span className="label text-bitcoin">{step.n}</span>
                {i < STEPS.length - 1 && (
                  <span className="h-px flex-1 bg-border md:block" aria-hidden="true" />
                )}
                <span className="label text-bitcoin md:hidden" aria-hidden="true">
                  ↓
                </span>
              </div>
              <div className="display mt-4 text-base">{step.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

import { useState } from "react";
import { Link } from "@tanstack/react-router";

const WORLD_STEPS = [
  {
    n: "01",
    title: "SEE REAL PRICES",
    tag: "READ FROM BITCOIN",
    body: "Every confirmed BITMAP sale, traced from the Bitcoin transaction that paid the seller.",
    to: "/history",
    cta: "SALES HISTORY",
  },
  {
    n: "02",
    title: "WALK THE LAND",
    tag: "NO WALLET NEEDED",
    body: "Every block is a place in the Oasis. Walk it in 3D in your browser.",
    to: "/oasis",
    cta: "ENTER OASIS",
  },
  {
    n: "03",
    title: "BUILD AND INSCRIBE",
    tag: "LAND FORGE",
    body: "Build with voxels on your BITMAP, then inscribe the build on Bitcoin.",
    to: "/forge",
    cta: "OPEN LAND FORGE",
  },
  {
    n: "04",
    title: "MEET ITS GUARDIAN",
    tag: "ONE PER BLOCK",
    body: "Each block grows one Guardian from its own data. Preview any block for free.",
    to: "/guardians",
    cta: "SEE GUARDIANS",
  },
  {
    n: "05",
    title: "TRADE WITHOUT CUSTODY",
    tag: "YOUR WALLET SIGNS",
    body: "List or buy with your own wallet. The BITMAP and the sats move in one transaction.",
    to: "/marketplace",
    cta: "OPEN MARKETPLACE",
  },
] as const;

const TRADE_STEPS = [
  { n: "01", title: "INSCRIPTION", body: "Someone inscribes the text <block>.bitmap on Bitcoin. The first valid inscription for a block is the only real claim." },
  { n: "02", title: "OWNERSHIP", body: "That inscription lives on a satoshi. Whoever controls the output holding it owns the bitmap — we resolve the holder from the chain." },
  { n: "03", title: "LISTING", body: "The holder signs a partial Bitcoin transaction with their asking price. No custody, no escrow — the signature is the listing." },
  { n: "04", title: "BIDS", body: "Buyers place signed offers. The holder can accept one, which locks the seller side of the trade at that price." },
  { n: "05", title: "SETTLEMENT", body: "The buyer funds and broadcasts the transaction. The inscription moves, the sats arrive, and the sale is recorded from the block." },
] as const;

type Mode = "world" | "trade";

/** Plain-language world life-cycle (default) plus the trade settlement flow. */
export function HowItWorks() {
  const [mode, setMode] = useState<Mode>("world");
  const steps = mode === "world" ? WORLD_STEPS : TRADE_STEPS;

  return (
    <section className="mx-auto max-w-[1600px] px-3 pt-6 md:px-8 md:pt-16">
      <div className="@container border border-border-strong">
        <header className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-end sm:justify-between md:p-6">
          <div>
            <div className="label text-bitcoin">NEW HERE? START WITH THIS</div>
            <h2 className="display mt-2 text-2xl md:text-3xl">
              {mode === "world" ? "HOW BITMAPWIN WORKS" : "HOW A BITMAP TRADE WORKS"}
            </h2>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div role="tablist" className="flex flex-wrap gap-0 border border-border">
              {(
                [
                  ["world", "01 // WORLD LIFE-CYCLE"],
                  ["trade", "02 // TRADE SETTLEMENT"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={`label px-3 py-2 transition-colors ${
                    mode === m ? "bg-bitcoin/15 text-bitcoin" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  [ {label} ]
                </button>
              ))}
            </div>
            <Link to="/land-101" className="label border border-border px-3 py-2">
              [ BITCOIN LAND 101 ]
            </Link>
          </div>
        </header>

        <ol className="grid gap-px bg-border @2xl:grid-cols-2 @6xl:grid-cols-5">
          {steps.map((step, i) => (
            <li
              key={step.n}
              className="group relative flex flex-col bg-background p-4 transition-colors hover:bg-muted/20 @2xl:p-6 @2xl:last:col-span-2 @6xl:last:col-span-1"
            >
              <div className="flex items-center gap-2">
                <span className="label text-bitcoin">{step.n}</span>
                {i < steps.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden="true" />}
                <span className="label text-bitcoin @2xl:hidden" aria-hidden="true">↓</span>
              </div>
              {"tag" in step && (
                <div className="label mt-3 md:mt-4 w-fit border border-signal/40 px-2 py-0.5 text-signal">{step.tag}</div>
              )}
              <div className="display mt-2 md:mt-3 text-base">{step.title}</div>
              <p className="mt-2 flex-1 text-sm leading-normal text-muted-foreground md:leading-relaxed">{step.body}</p>
              {"to" in step && (
                <Link to={step.to} className="label mt-3 md:mt-4 text-bitcoin opacity-80 transition-opacity group-hover:opacity-100">
                  {step.cta} →
                </Link>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

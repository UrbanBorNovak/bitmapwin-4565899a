import { useState } from "react";
import { Link } from "@tanstack/react-router";

const WORLD_STEPS = [
  {
    n: "01",
    title: "BLOCK INTO LAND",
    tag: "L1 PROVENANCE",
    body: "A Bitcoin block is inscribed once as <height>.bitmap — permanent, scarce territory you can verify on-chain.",
    to: "/registry",
    cta: "EXPLORE REGISTRY",
  },
  {
    n: "02",
    title: "STEP INTO THE WORLD",
    tag: "THE OASIS ATLAS",
    body: "The Oasis turns 900k+ blocks into one continuous 3D atlas you can walk, explore and return to.",
    to: "/oasis",
    cta: "ENTER OASIS",
  },
  {
    n: "03",
    title: "FORGE & ARCHITECTURE",
    tag: "3D BLOCKS ON BITCOIN",
    body: "Build voxel structures in Land Forge, saved in a lightweight Bitcoin voxel format (4 bytes per block) and permanently etched onto the BITMAP's own sat.",
    to: "/forge",
    cta: "OPEN LAND FORGE",
  },
  {
    n: "04",
    title: "GUARDIANS & BLOCK MATTER",
    tag: "BLOCK DNA",
    body: "Immutable block facts — height, fees, tx count — become the DNA and elemental matter of each Guardian.",
    to: "/codex/morphs",
    cta: "INSPECT CODEX",
  },
  {
    n: "05",
    title: "SOVEREIGN UTILITY",
    tag: "ZERO CUSTODY",
    body: "Trade with wallet-signed PSBTs, earn BIT through attention, and hold experimental Shadow keycards and relics.",
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
      <div className="border border-border-strong">
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

        <ol className="grid md:grid-cols-5">
          {steps.map((step, i) => (
            <li
              key={step.n}
              className={`group relative flex flex-col border-b border-border p-4 md:p-6 transition-colors hover:bg-muted/20 md:border-b-0 ${i > 0 ? "md:border-l md:border-border" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span className="label text-bitcoin">{step.n}</span>
                {i < steps.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden="true" />}
                <span className="label text-bitcoin md:hidden" aria-hidden="true">↓</span>
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

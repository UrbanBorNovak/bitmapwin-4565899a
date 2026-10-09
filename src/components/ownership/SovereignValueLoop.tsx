import { Link } from "@tanstack/react-router";

const FLOW = [
  { k: "BITCOIN", v: "Block data · transactions · satpoints" },
  { k: "BITMAP LAND", v: "The canonical sovereign anchor" },
  { k: "GUARDIANS + EXTENDERS", v: "Block-derived life · hosted worlds" },
  { k: "OASIS VISITS", v: "Exploration · raids · encounters" },
  { k: "ACCRETION", v: "Host & Earn · Fiefdoms · Spoils · Epochs" },
  { k: "BITMAP HOLDER", v: "All value flows back to the land" },
];

const PILLARS = [
  {
    id: "I",
    title: "INHABITATION OVER EXTRACTION",
    body: "A Guardian is not a random PFP. Its form and combat traits are derived from the exact block of its BITMAP, and raid spoils settle into that BITMAP's territory register — enriching the home land.",
  },
  {
    id: "II",
    title: "CUSTODY EPOCHS",
    body: "The longer a BITMAP stays unmoved, the higher its Holder Epoch. Any on-chain move of the inscription resets the clock. Higher epochs raise the daily visitor dividend and the Extender build height.",
  },
  {
    id: "III",
    title: "HOST & EARN + DISTRICT FIEFDOMS",
    body: "Holders host Extenders with one toggle. Visitor BIT splits between builder and holder, and in subdivided blocks a share flows pro-rata to verified on-chain parcel holders.",
  },
  {
    id: "IV",
    title: "PHYSICAL FOOTPRINT",
    body: "Visitors may build from their own blocks, but the BITMAP holder can demolish anything on their ground. Raids and visits are written into the land's public chronicle.",
  },
];

const CLUBS = ["PATOSHI BLOCKS", "SUB-10K", "PRISTINE PUNK SHAPES", "HALVINGS & PALINDROMES"];

export function SovereignValueLoop() {
  return (
    <section className="mt-14">
      <div className="label text-bitcoin">MANIFESTO · ECONOMICS</div>
      <h2 className="display mt-3 text-2xl md:text-4xl">THE SOVEREIGN VALUE LOOP</h2>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        Elsewhere, every new collection drains value from the original asset. Here it runs the other way:
        everything built on top must tie back to a block, pay the landholder, or leave its mark on the land.
      </p>

      <ol className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {FLOW.map((f, i) => (
          <li key={f.k} className="bg-background p-5">
            <div className="label text-signal">{String(i + 1).padStart(2, "0")} →</div>
            <div className="display mt-2 text-lg">{f.k}</div>
            <div className="mt-1 text-xs text-muted-foreground">{f.v}</div>
          </li>
        ))}
      </ol>

      <div className="mt-10 grid gap-px border border-border bg-border md:grid-cols-2">
        {PILLARS.map((p) => (
          <div key={p.id} className="bg-background p-6">
            <div className="label text-bitcoin">PILLAR {p.id}</div>
            <h3 className="display mt-3 text-xl">{p.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 border border-border p-6">
        <h3 className="display text-xl">WHY UNCAPPED ACCRETES</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          A fixed 10,000 cap exists because ungrounded assets have nothing else to be scarce about. BITMAP grows
          with Bitcoin — a new block every ~10 minutes — and scarcity comes from history itself. Every new block
          makes the early eras rarer, while giving newcomers an affordable place to start their own epoch.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {CLUBS.map((c) => (
            <span key={c} className="label border border-border px-2 py-1 text-signal">{c}</span>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/my-land" className="btn-term">[ CHECK MY EPOCH ]</Link>
          <Link to="/collections" className="btn-term-ghost">[ EXPLORE CLUBS ]</Link>
          <Link to="/guardians-guide" className="btn-term-ghost">[ GUARDIANS ]</Link>
        </div>
      </div>
    </section>
  );
}

import { GuideTrail } from "@/components/GuideTrail";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FirstTenMinutes } from "@/components/FirstTenMinutes";
import { ChainStackInfographic } from "@/components/docs/ChainStackInfographic";

export const Route = createFileRoute("/land-101")({
  head: () => ({
    meta: [
      { title: "Bitcoin Land 101 — How Bitmaps Work" },
      {
        name: "description",
        content:
          "Learn what an inscription is, how the first-is-first rule decides a valid Bitmap, and how inscriptions, bitmaps and listings differ.",
      },
      { property: "og:title", content: "Bitcoin Land 101 — How Bitmaps Work" },
      {
        property: "og:description",
        content:
          "An animated primer on Bitcoin inscriptions, the first-is-first rule and what you actually own when you buy a Bitmap.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Land101,
});

/** Reveals children with a subtle rise once scrolled into view (respects reduced motion). */
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setShown(false);
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setShown(true);
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${
        shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      } motion-reduce:translate-y-0 motion-reduce:opacity-100`}
    >
      {children}
    </div>
  );
}

function Chapter({
  n,
  kicker,
  title,
  children,
  diagram,
}: {
  n: string;
  kicker: string;
  title: string;
  children: React.ReactNode;
  diagram: React.ReactNode;
}) {
  return (
    <Reveal>
      <section className="border border-border-strong bg-background">
        <header className="flex items-end justify-between gap-3 border-b border-border p-5 md:p-6">
          <div>
            <div className="label text-bitcoin">
              {n} · {kicker}
            </div>
            <h2 className="display mt-2 text-xl md:text-2xl">{title}</h2>
          </div>
        </header>
        <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:p-6">
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
          <div className="border border-border bg-card p-4">{diagram}</div>
        </div>
      </section>
    </Reveal>
  );
}

/* ---------------------------- animated diagrams --------------------------- */

/** A satoshi carrying text data into a block. */
function InscriptionDiagram() {
  return (
    <svg viewBox="0 0 320 160" className="w-full" role="img" aria-label="A satoshi carrying text data">
      <rect x="0.5" y="0.5" width="319" height="159" fill="none" stroke="currentColor" strokeOpacity="0.12" />
      <g className="text-muted-foreground">
        <text x="12" y="22" className="fill-current font-mono text-[9px]">
          TX WITNESS
        </text>
      </g>
      <rect x="10" y="30" width="130" height="46" fill="none" stroke="currentColor" strokeOpacity="0.35" />
      <text x="20" y="58" className="fill-bitcoin font-mono text-[11px]">
        840000.bitmap
      </text>
      <g style={{ animation: "land101-carry 4.2s linear infinite" }}>
        <rect x="150" y="44" width="18" height="18" className="fill-bitcoin" />
      </g>
      <rect x="240" y="26" width="70" height="108" fill="none" stroke="currentColor" strokeOpacity="0.35" />
      <text x="248" y="20" className="fill-current font-mono text-[9px] text-muted-foreground">
        BLOCK
      </text>
      {Array.from({ length: 12 }).map((_, i) => (
        <rect
          key={i}
          x={248 + (i % 4) * 16}
          y={34 + Math.floor(i / 4) * 16}
          width="12"
          height="12"
          className="fill-current text-muted-foreground"
          opacity={0.18 + (i % 5) * 0.12}
        />
      ))}
      <text x="10" y="150" className="fill-current font-mono text-[9px] text-muted-foreground">
        &gt; DATA RIDES A SAT INTO A BLOCK — PERMANENT
      </text>
    </svg>
  );
}

/** Three competing claims on a timeline; only the earliest is valid. */
function FirstIsFirstDiagram() {
  const claims = [
    { t: "10:02", label: "VALID", ok: true },
    { t: "10:41", label: "INVALID", ok: false },
    { t: "14:07", label: "INVALID", ok: false },
  ];
  return (
    <div className="space-y-3">
      <div className="relative h-px bg-border">
        <div
          className="absolute inset-y-0 left-0 bg-bitcoin"
          style={{ animation: "land101-sweep 5s ease-in-out infinite" }}
        />
      </div>
      <ol className="space-y-2">
        {claims.map((claim, i) => (
          <li
            key={claim.t}
            className="flex items-center justify-between gap-3 border border-border px-3 py-2"
            style={{ animation: `land101-pulse 5s ease-in-out ${i * 0.6}s infinite` }}
          >
            <span className="font-mono text-[11px] text-muted-foreground">
              {claim.t} · 840000.bitmap
            </span>
            <span
              className={`label ${claim.ok ? "text-bitcoin" : "text-muted-foreground line-through"}`}
            >
              {claim.label}
            </span>
          </li>
        ))}
      </ol>
      <p className="font-mono text-[10px] text-muted-foreground">
        &gt; FIRST INSCRIPTION FOR A BLOCK WINS. EVERY LATER CLAIM IS A DUPLICATE.
      </p>
    </div>
  );
}

/** Inscription vs bitmap vs listing, as three stacked layers. */
function LayersDiagram() {
  const layers = [
    { label: "INSCRIPTION", body: "the data on a sat" },
    { label: "BITMAP", body: "the valid claim on a block" },
    { label: "LISTING", body: "a signed offer to sell it" },
  ];
  return (
    <ul className="space-y-2">
      {layers.map((layer, i) => (
        <li
          key={layer.label}
          className="border border-border px-3 py-3"
          style={{
            marginLeft: `${i * 12}px`,
            animation: `land101-float 6s ease-in-out ${i * 0.4}s infinite`,
          }}
        >
          <div className="label text-foreground">{layer.label}</div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">{layer.body}</div>
        </li>
      ))}
    </ul>
  );
}

/** Parcels subdividing a bitmap. */
function ParcelDiagram() {
  return (
    <div className="grid grid-cols-6 gap-1" aria-hidden="true">
      {Array.from({ length: 36 }).map((_, i) => (
        <div
          key={i}
          className="aspect-square border border-border"
          style={{
            animation: `land101-fill 6s ease-in-out ${(i % 12) * 0.18}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function Land101() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-8 md:py-16">
      <Reveal>
        <header className="border border-border-strong bg-background p-6 md:p-10">
          <div className="label text-bitcoin">EDUCATION</div>
          <h1 className="display mt-3 text-3xl md:text-5xl">BITCOIN LAND 101</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            Before you buy digital land, understand exactly what it is. No hype — just how
            inscriptions, the first-is-first rule and listings actually work on Bitcoin.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/marketplace" className="label border border-border-strong px-4 py-3">
              [ BROWSE THE MARKET ]
            </Link>
            <Link to="/builds" className="label border border-border px-4 py-3">
              [ SEE WHAT PEOPLE BUILD ]
            </Link>
          </div>
        </header>
      </Reveal>

      <div className="mt-6 space-y-6">
        <Reveal>
          <ChainStackInfographic />
        </Reveal>
        <FirstTenMinutes />
        <Chapter
          n="01"
          kicker="THE RAW MATERIAL"
          title="WHAT IS AN INSCRIPTION?"
          diagram={<InscriptionDiagram />}
        >
          <p>
            An inscription is arbitrary data written into the witness of a Bitcoin transaction and
            attached to one specific satoshi. Once mined it cannot be edited or deleted.
          </p>
          <p>
            A Bitmap inscription is deliberately boring: it is a plain text file containing something
            like <span className="font-mono text-foreground">840000.bitmap</span>. The value is not
            the file — it is the fact that it was the first one.
          </p>
          <p>
            Because the data rides a sat, ownership follows that sat. Whoever controls the output
            holding it controls the inscription.
          </p>
        </Chapter>

        <Chapter
          n="02"
          kicker="THE ONLY RULE THAT MATTERS"
          title="HOW FIRST-IS-FIRST WORKS"
          diagram={<FirstIsFirstDiagram />}
        >
          <p>
            Bitcoin does not know what a Bitmap is. Bitmap theory is a convention layered on top:
            for each block height, the earliest inscription whose text is{" "}
            <span className="font-mono text-foreground">&lt;height&gt;.bitmap</span> is the valid
            claim on that block.
          </p>
          <p>
            Anyone can inscribe the same text later. Those inscriptions exist forever, but they are
            duplicates with no claim — this site marks them as invalid and shows how many were made.
          </p>
          <p>
            Child claims follow the same rule:{" "}
            <span className="font-mono text-foreground">&lt;index&gt;.&lt;height&gt;.bitmap</span>{" "}
            and the number of valid parcels can never exceed the transaction count of that block.
          </p>
        </Chapter>

        <Chapter
          n="03"
          kicker="DON'T CONFUSE THESE"
          title="INSCRIPTION VS BITMAP VS LISTING"
          diagram={<LayersDiagram />}
        >
          <p>
            <span className="text-foreground">Inscription</span> — the on-chain artifact. It always
            exists, valid or not.
          </p>
          <p>
            <span className="text-foreground">Bitmap</span> — the accepted claim on a block, derived
            by applying first-is-first across every inscription. This is the asset.
          </p>
          <p>
            <span className="text-foreground">Listing</span> — not on-chain property at all. It is a
            partially signed Bitcoin transaction from the holder, offering the inscription at a
            price. No custody, no escrow: the signature is the listing, and it settles only when a
            buyer funds and broadcasts it.
          </p>
        </Chapter>

        <Chapter
          n="04"
          kicker="WHY IT IS CALLED LAND"
          title="BLOCKS, PARCELS AND BUILDING"
          diagram={<ParcelDiagram />}
        >
          <p>
            Each block becomes a plot whose interior is drawn from its real transactions — the
            mosaic you see on every bitmap page is packed from actual transaction sizes, so no two
            look alike.
          </p>
          <p>
            A bitmap can be subdivided into parcels, one per transaction in that block, each its own
            child claim with its own owner.
          </p>
          <p>
            Holders can build on their land — info pages, galleries, shops and 3D worlds — or lease
            it out to builders instead of selling.
          </p>
        </Chapter>

        <Reveal>
          <section className="border border-border-strong bg-background p-6 md:p-10">
            <h2 className="display text-2xl md:text-3xl">READY TO LOOK AROUND?</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Every price on this site comes from a confirmed Bitcoin transaction. Start with the
              market, or open a single bitmap and read its provenance.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link to="/marketplace" className="label border border-border-strong px-4 py-3">
                [ OPEN MARKETPLACE ]
              </Link>
              <Link
                to="/bitmap/$block"
                params={{ block: "840000" }}
                className="label border border-border px-4 py-3"
              >
                [ VIEW 840000.BITMAP ]
              </Link>
            </div>
          </section>
        </Reveal>
      </div>
      <GuideTrail current="/land-101" />
    </div>
  );
}

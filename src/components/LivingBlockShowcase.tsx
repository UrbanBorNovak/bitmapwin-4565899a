import { lazy, Suspense, useState } from "react";
import { Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { esploraFetch } from "@/lib/bitmon";
import { guardianDnaQuery } from "@/lib/bitmon-queries";
import { forgeBuiltQuery } from "@/lib/forge";

const ComicGuardian3D = lazy(() => import("@/components/ComicGuardian3D"));

/** Two real blocks that both carry a verified Land Forge build. */
const BLOCKS = [
  { height: 819245, tag: "BUSY BLOCK", note: "Thousands of transactions, so the land is split into many small pieces." },
  { height: 208, tag: "2009 BLOCK", note: "One transaction only, so one piece covers the whole land." },
] as const;

const factsQuery = (height: number) =>
  queryOptions({
    queryKey: ["living-block-facts", height],
    queryFn: async () => {
      const hash = (await (await esploraFetch(`/block-height/${height}`)).text()).trim();
      const b = (await (await esploraFetch(`/block/${hash}`)).json()) as { tx_count: number; timestamp: number };
      return { hash, txCount: b.tx_count, timestamp: b.timestamp };
    },
    staleTime: Infinity,
    retry: 1,
  });

export function LivingBlockShowcase() {
  const [pick, setPick] = useState(0);
  const blk = BLOCKS[pick] ?? BLOCKS[0];
  const h = blk.height;
  const facts = useQuery(factsQuery(h));
  const dna = useQuery({ ...guardianDnaQuery(h), staleTime: Infinity });
  const built = useQuery(forgeBuiltQuery(h));
  const f = facts.data;

  return (
    <section className="mx-auto max-w-[1600px] px-3 pt-6 md:px-5 md:pt-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="label text-signal">SEE A LIVING BLOCK</div>
          <h2 className="display mt-2 text-2xl md:text-3xl">ONE BITCOIN BLOCK, FOUR LAYERS OF PROOF</h2>
        </div>
        <div className="flex gap-2" role="tablist" aria-label="Choose a block">
          {BLOCKS.map((b, i) => (
            <button key={b.height} role="tab" aria-selected={i === pick} onClick={() => setPick(i)}
              className={i === pick ? "btn-term" : "btn-term-ghost"}>
              #{b.height.toLocaleString("en-US")}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid border border-border md:mt-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative h-[300px] border-b border-border bg-background sm:h-[380px] lg:h-[460px] lg:border-b-0 lg:border-r">
          <ClientOnly fallback={null}>
            <Suspense fallback={null}>
              <ComicGuardian3D key={h} height={h} guardian />
            </Suspense>
          </ClientOnly>
          <div className="pointer-events-none absolute left-3 top-3 label text-bitcoin">{h}.BITMAP · {blk.tag}</div>
          <div className="pointer-events-none absolute bottom-3 left-3 label text-muted-foreground">DRAG TO TURN</div>
        </div>

        <div className="grid divide-y divide-border">
          <Layer n="01" title="THE BLOCK" tone="text-signal">
            <Row k="Height" v={h.toLocaleString("en-US")} />
            <Row k="Transactions" v={f ? f.txCount.toLocaleString("en-US") : "…"} />
            <Row k="Mined" v={f ? new Date(f.timestamp * 1000).toISOString().slice(0, 10) : "…"} />
            <Row k="Hash" v={f ? `${f.hash.slice(0, 10)}…${f.hash.slice(-6)}` : "…"} />
            <p className="mt-1.5 text-sm leading-normal text-muted-foreground md:leading-relaxed">{blk.note}</p>
          </Layer>
          <Layer n="02" title="THE BUILD" tone="text-bitcoin">
            <p className="text-sm leading-normal text-muted-foreground md:leading-relaxed">
              {built.data ? "This 3D build is written onto Bitcoin itself, on this BITMAP. Anyone can rebuild it from the chain." : "Checking Bitcoin for this BITMAP's build…"}
            </p>
            {built.data && <Row k="Inscription" v={`${built.data.inscriptionId.slice(0, 10)}…`} />}
          </Layer>
          <Layer n="03" title="THE GUARDIAN" tone="text-signal">
            <p className="text-sm leading-normal text-muted-foreground md:leading-relaxed">
              Its shape and colours come from this block's hash, so every visitor sees the same creature.
            </p>
            {dna.data && <Row k="Species" v={`${dna.data.species} · ${dna.data.rarity}`} />}
          </Layer>
          <Layer n="04" title="THE MAKERS" tone="text-bitcoin">
            <p className="text-sm leading-normal text-muted-foreground md:leading-relaxed">
              When a build reuses community pieces, their makers are paid in Bitcoin inside the same transaction that writes the build.
            </p>
          </Layer>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link to="/oasis" search={{ height: h }} className="btn-term">[ WALK THIS BLOCK IN THE OASIS ]</Link>
        <Link to="/bitmap/$block" params={{ block: String(h) }} className="btn-term-ghost">[ SEE ITS FULL RECORD ]</Link>
        <Link to="/forge" className="btn-term-ghost">[ BUILD YOUR OWN ]</Link>
      </div>
    </section>
  );
}

function Layer({ n, title, tone, children }: { n: string; title: string; tone: string; children: React.ReactNode }) {
  return (
    <div className="bg-background p-3 md:p-4">
      <div className={`label ${tone}`}>{n} // {title}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 font-mono text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-foreground" data-no-translate>{v}</span>
    </div>
  );
}

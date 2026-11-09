import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo, useState } from "react";
import { z } from "zod";
import { layoutFromSizeClasses } from "@/lib/bitmap-layout";
import { gradeSlab } from "@/lib/land-slab";

const LandSlab3D = lazy(() => import("@/components/slab/LandSlab3D").then((m) => ({ default: m.LandSlab3D })));

export const Route = createFileRoute("/slab")({
  validateSearch: z.object({ b: z.number().int().min(0).optional() }),
  component: SlabPage,
  head: () => ({
    meta: [
      { title: "Land Slabs · Graded BITMAPs in 3D | BitmapWIN" },
      { name: "description", content: "Encapsulate any BITMAP in a 3D acrylic slab, graded from its own block facts: vintage, centering, work and scarcity." },
      { property: "og:title", content: "Land Slabs · Graded BITMAPs in 3D" },
      { property: "og:description", content: "PSA-style 3D slabs for BITMAP land, graded only from block facts anyone can re-check." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

async function fetchBlock(height: number) {
  const r = await fetch(`/api/public/blocks/${height}`);
  if (r.status === 204) return null;
  if (!r.ok) throw new Error(`block ${r.status}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  return {
    classes: Array.from(bytes),
    hash: r.headers.get("x-block-hash"),
    txCount: Number(r.headers.get("x-tx-count") ?? bytes.length) || bytes.length,
  };
}

function SlabPage() {
  const { b } = Route.useSearch();
  const navigate = Route.useNavigate();
  const height = b ?? 715093;
  const [input, setInput] = useState(String(height));
  const [flipped, setFlipped] = useState(false);
  const block = useQuery({ queryKey: ["slab-block", height], queryFn: () => fetchBlock(height), staleTime: Infinity, retry: 1 });

  const data = useMemo(() => {
    if (!block.data || block.data.classes.length === 0) return null;
    const layout = layoutFromSizeClasses(block.data.classes);
    const grade = gradeSlab({ height, txCount: block.data.txCount, hash: block.data.hash, layoutWidth: layout.width, layoutHeight: layout.height });
    return { layout, grade, hash: block.data.hash };
  }, [block.data, height]);

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(input.replace(/\D/g, ""));
    if (Number.isInteger(n) && n >= 0) { setFlipped(false); navigate({ search: { b: n } }); }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">BW-SLAB-1 · LAND SLABS</p>
        <h1 className="font-display text-3xl font-bold md:text-4xl">Graded BITMAP land, in 3D</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Every slab holds the real transaction layout of its block. The grade comes only from block facts anyone can re-check.
        </p>
      </header>

      <form onSubmit={go} className="mb-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          inputMode="numeric"
          aria-label="BITMAP number"
          className="w-48 rounded-md border border-border bg-background px-3 py-2 font-mono"
        />
        <button className="rounded-md bg-primary px-4 py-2 font-mono text-sm text-primary-foreground">SLAB IT</button>
        <button type="button" onClick={() => setFlipped((f) => !f)} className="rounded-md border border-border px-4 py-2 font-mono text-sm">
          {flipped ? "SHOW FRONT" : "FLIP SLAB"}
        </button>
      </form>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="aspect-[4/5] w-full overflow-hidden rounded-xl border border-border bg-card md:aspect-auto md:h-[640px]">
          {block.isPending ? (
            <Status text={`LOADING BLOCK ${height.toLocaleString("en-US")}…`} />
          ) : block.isError ? (
            <Status text="COULD NOT LOAD THIS BLOCK · TRY AGAIN" />
          ) : !data ? (
            <Status text="NO BLOCK DATA FOR THIS HEIGHT YET" />
          ) : (
            <ClientOnly fallback={<Status text="PREPARING SLAB…" />}>
              <Suspense fallback={<Status text="PREPARING SLAB…" />}>
                <LandSlab3D height={height} layout={data.layout} grade={data.grade} flipped={flipped} hash={data.hash} />
              </Suspense>
            </ClientOnly>
          )}
        </div>

        <aside className="space-y-4">
          {data && (
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-xs text-muted-foreground">{data.grade.cert}</span>
                <span className="font-display text-3xl font-bold text-primary">{data.grade.name} {data.grade.grade}</span>
              </div>
              <ul className="mt-3 space-y-2">
                {data.grade.subs.map((s) => (
                  <li key={s.key} className="flex justify-between font-mono text-sm">
                    <span>{s.label} <span className="text-muted-foreground">· {s.why}</span></span>
                    <span>{s.score}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-foreground">How the grade works</h2>
            <p>Vintage from block height, centering from how square the land packs, work from the block hash, scarcity from the transaction count.</p>
            <p className="mt-2">The overall grade is the average, capped two points above the weakest score. It is a BitmapWIN rubric, not ownership or an on-chain property.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}

function Status({ text }: { text: string }) {
  return <div className="flex h-full min-h-64 items-center justify-center font-mono text-xs uppercase tracking-widest text-muted-foreground">{text}</div>;
}

import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo, useState } from "react";
import { z } from "zod";
import { layoutFromSizeClasses } from "@/lib/bitmap-layout";
import { gradeSlab } from "@/lib/land-slab";
import { fetchBlock } from "@/lib/slab-block";
import { GradeQueue } from "@/components/slab/GradeQueue";
import { slabInscriptionsFn } from "@/lib/slab-inscriptions.functions";

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

function SlabPage() {
  const { b } = Route.useSearch();
  const navigate = Route.useNavigate();
  const height = b ?? 715093;
  const [input, setInput] = useState(String(height));
  const [flipped, setFlipped] = useState(false);
  const block = useQuery({ queryKey: ["slab-block", height], queryFn: () => fetchBlock(height), staleTime: Infinity, retry: 1 });

  const [picked, setPicked] = useState<number | null>(null);
  const hash = block.data?.hash ?? null;
  const ins = useQuery({
    queryKey: ["slab-ins", height, hash],
    queryFn: () => slabInscriptionsFn({ data: { height, hash: hash! } }),
    enabled: !!hash && /^[0-9a-f]{64}$/.test(hash),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const insItems = ins.data && "items" in ins.data ? ins.data.items : [];
  const pickedIns = picked == null ? null : insItems.find((x) => x.tx === picked) ?? null;

  const data = useMemo(() => {
    if (!block.data || block.data.classes.length === 0) return null;
    const layout = layoutFromSizeClasses(block.data.classes);
    const grade = gradeSlab({ height, txCount: block.data.txCount, hash: block.data.hash, layoutWidth: layout.width, layoutHeight: layout.height, parcelSizes: layout.parcels.map((p) => p.size) });
    return { layout, grade, hash: block.data.hash };
  }, [block.data, height]);

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(input.replace(/\D/g, ""));
    if (Number.isInteger(n) && n >= 0) { setFlipped(false); setPicked(null); navigate({ search: { b: n } }); }
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
                <LandSlab3D height={height} layout={data.layout} grade={data.grade} flipped={flipped} hash={data.hash} inscriptions={insItems} selected={picked} onPick={setPicked} />
              </Suspense>
            </ClientOnly>
          )}
        </div>

        <aside className="space-y-4">
          <ClientOnly fallback={null}><GradeQueue /></ClientOnly>
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
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 font-mono text-xs uppercase tracking-widest">Inscribed in this land</h2>
            {ins.isPending && hash ? (
              <p className="font-mono text-xs text-muted-foreground">READING ORDINALS…</p>
            ) : ins.data && "error" in ins.data ? (
              <p className="font-mono text-xs text-muted-foreground">INSCRIPTION LIST UNAVAILABLE · TRY AGAIN LATER</p>
            ) : insItems.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">NO INSCRIPTIONS WERE REVEALED IN THIS BLOCK</p>
            ) : (
              <>
                <p className="font-mono text-xs text-muted-foreground">
                  {insItems.length.toLocaleString("en-US")} lit parcels
                  {ins.data && "more" in ins.data && ins.data.more ? ` · first ${insItems.length.toLocaleString("en-US")} of ${ins.data.total.toLocaleString("en-US")}+ shown` : ""} · tap a lit parcel
                </p>
                {ins.data && "source" in ins.data && ins.data.source === "tag" && (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">ORDINALS.COM UNREACHABLE · PARCELS MARKED FROM MEMPOOL.SPACE ENVELOPE TAGS (MAY INCLUDE RUNE COMMITS)</p>
                )}
                {pickedIns ? (
                  <div className="mt-3 space-y-2">
                    {pickedIns.id && <InsPreview id={pickedIns.id} type={pickedIns.type} />}
                    <div className="font-mono text-xs">
                      <div>PARCEL {pickedIns.tx.toLocaleString("en-US")}.{height}</div>
                      <div className="text-muted-foreground">{pickedIns.number != null ? `#${pickedIns.number.toLocaleString("en-US")} · ` : ""}{pickedIns.type === "envelope" ? "inscription envelope seen" : pickedIns.type}</div>
                      <a className="text-accent underline" href={pickedIns.id ? `https://ordinals.com/inscription/${pickedIns.id}` : `https://ordinals.com/tx/${pickedIns.txid}`} target="_blank" rel="noreferrer">VIEW ON ORDINALS.COM</a>
                    </div>
                  </div>
                ) : (
                  <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto font-mono text-xs">
                    {insItems.slice(0, 40).map((x) => (
                      <li key={x.txid + (x.id ?? "")}>
                        <button type="button" onClick={() => setPicked(x.tx)} className="flex w-full justify-between hover:text-primary">
                          <span>PARCEL {x.tx}</span><span className="text-muted-foreground">{x.type === "envelope" ? "envelope" : x.type}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {pickedIns && <button type="button" onClick={() => setPicked(null)} className="mt-2 font-mono text-xs text-muted-foreground underline">BACK TO LIST</button>}
              </>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Parcel = position of the reveal transaction in the block. Read live from ordinals.com; it shows what was inscribed, not who holds it now.</p>
          </section>
          <section className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-foreground">How the grade works</h2>
            <p>Vintage from block height, centering from how much of the square the parcels fill, hash from how rare the block hash's digit pattern is, scarcity from the transaction count.</p>
            <p className="mt-2">The overall grade is the rounded average, capped four points above the weakest score. It is a BitmapWIN rubric, not ownership or an on-chain property.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}

function Status({ text }: { text: string }) {
  return <div className="flex h-full min-h-64 items-center justify-center font-mono text-xs uppercase tracking-widest text-muted-foreground">{text}</div>;
}

function InsPreview({ id, type }: { id: string; type: string }) {
  const src = `https://ordinals.com/content/${id}`;
  if (type.startsWith("image/")) return <img src={src} alt="Inscription" className="aspect-square w-full rounded-md border border-border bg-background object-contain [image-rendering:pixelated]" />;
  if (type.includes("html") || type.startsWith("text/") || type.includes("json") || type.includes("svg"))
    return <iframe src={`https://ordinals.com/preview/${id}`} title="Inscription" sandbox="allow-scripts" className="aspect-square w-full rounded-md border border-border bg-background" />;
  return <div className="flex aspect-square w-full items-center justify-center rounded-md border border-border font-mono text-xs text-muted-foreground">{type}</div>;
}

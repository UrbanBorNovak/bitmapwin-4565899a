import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { REGISTRY_CATEGORIES, REGISTRY_MODELS, stridesFor, type ModelCategory } from "@/lib/model-registry";
import { verifyRegistryModelFn } from "@/lib/model-registry.functions";

const ModelPreview = lazy(() => import("@/components/registry/ModelPreview"));

export const Route = createFileRoute("/registry")({
  component: RegistryPage,
  head: () => ({
    meta: [
      { title: "Model Registry — On-chain 3D models for BITMAP land" },
      { name: "description", content: "Every 3D model builders and agents may place on BITMAP land, checked live against its Bitcoin inscription." },
      { property: "og:title", content: "Model Registry — On-chain 3D models for BITMAP land" },
      { property: "og:description", content: "Inscribed GLB vehicles, pets and gear, verified live from ordinals.com." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Check = Awaited<ReturnType<typeof verifyRegistryModelFn>>;

function RegistryPage() {
  const [cat, setCat] = useState<ModelCategory | "ALL">("ALL");
  const [open, setOpen] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, Check | "pending">>({});
  const verify = useServerFn(verifyRegistryModelFn);
  const list = REGISTRY_MODELS.filter((m) => cat === "ALL" || m.category === cat);

  const run = async (id: string) => {
    setChecks((c) => ({ ...c, [id]: "pending" }));
    const r = await verify({ data: { inscription: id } }).catch(() => ({ ok: false as const, error: "CHECK FAILED" }));
    setChecks((c) => ({ ...c, [id]: r }));
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <p className="font-mono text-xs tracking-widest text-signal">ON-CHAIN GLB</p>
      <h1 className="mt-2 font-display text-4xl font-bold">MODEL REGISTRY</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        The only 3D models builders and agents may place on BITMAP land. Each one is an inscription; verify reads its bytes live from ordinals.com (GLB 2.0, ≤2 MB, ≤100k triangles, all textures embedded).
      </p>
      <div className="mt-6 flex flex-wrap gap-2 font-mono text-xs">
        {(["ALL", ...REGISTRY_CATEGORIES] as const).map((c) => (
          <button key={c} onClick={() => setCat(c)}
            className={`rounded border px-3 py-1.5 ${cat === c ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
            {c}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((m) => {
          const c = checks[m.inscription];
          return (
            <article key={m.inscription} className="rounded-lg border border-border bg-card/60 p-4 backdrop-blur">
              <div className="aspect-square overflow-hidden rounded border border-border bg-background">
                {open === m.inscription ? (
                  <ClientOnly fallback={null}>
                    <Suspense fallback={<p className="p-4 font-mono text-xs text-muted-foreground">LOADING MODEL…</p>}>
                      <ModelPreview inscription={m.inscription} />
                    </Suspense>
                  </ClientOnly>
                ) : (
                  <button onClick={() => setOpen(m.inscription)} className="flex h-full w-full items-center justify-center font-mono text-xs text-signal">
                    ▶ VIEW 3D
                  </button>
                )}
              </div>
              <p className="mt-3 font-mono text-[10px] text-muted-foreground">{m.category} · ~{stridesFor(m.fit)} STRIDES</p>
              <h2 className="font-display text-lg font-semibold">{m.label}</h2>
              <a href={`https://ordinals.com/inscription/${m.inscription}`} target="_blank" rel="noreferrer"
                className="block truncate font-mono text-[10px] text-signal hover:underline" data-no-translate>{m.inscription}</a>
              <div className="mt-3 font-mono text-xs">
                {!c && <button onClick={() => run(m.inscription)} className="rounded border border-primary px-3 py-1 text-primary">VERIFY ON-CHAIN</button>}
                {c === "pending" && <span className="text-muted-foreground">READING INSCRIPTION…</span>}
                {c && c !== "pending" && (c.ok ? (
                  <span className="text-signal">✓ {c.contentType} · {(c.bodyBytes / 1024).toFixed(0)} KB · {c.triangleCount.toLocaleString()} TRIS · {c.animationCount} ANIM</span>
                ) : (
                  <span className="text-destructive">✕ {c.error}</span>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}

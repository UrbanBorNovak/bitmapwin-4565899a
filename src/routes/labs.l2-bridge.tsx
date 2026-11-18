import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { readPackage, swapTargetFor, type Ue2Package } from "@/lib/l2/ue2-package";
import type { BridgeActor } from "@/components/l2/L2BridgeScene";

const L2BridgeScene = lazy(() => import("@/components/l2/L2BridgeScene"));

export const Route = createFileRoute("/labs/l2-bridge")({
  head: () => {
    const title = "L2 Bridge Studio — Swap Lineage II Actors for Bitcoin Models";
    const description = "Open your own Lineage II client packages locally and preview their actors replaced by on-chain BITMAP Guardians. Nothing is uploaded.";
    return {
      meta: [
        { title }, { name: "description", content: description },
        { property: "og:title", content: title }, { property: "og:description", content: description },
        { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: L2Bridge,
});

const EXT = /\.(usx|ukx|utx|unr|u)$/i;
interface Loaded { file: string; pkg?: Ue2Package; error?: string }

function L2Bridge() {
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [height, setHeight] = useState(521066);
  const [busy, setBusy] = useState(false);

  async function ingest(files: File[]) {
    setBusy(true);
    const out: Loaded[] = [];
    for (const f of files.filter((x) => EXT.test(x.name)).slice(0, 200)) {
      try { out.push({ file: f.name, pkg: readPackage(new Uint8Array(await f.arrayBuffer()), f.name) }); }
      catch (e) { out.push({ file: f.name, error: e instanceof Error ? e.message : String(e) }); }
    }
    setLoaded(out); setActive(out.findIndex((l) => l.pkg)); setBusy(false);
  }

  const pkg = active != null && active >= 0 ? loaded[active]?.pkg : undefined;
  const actors: BridgeActor[] = useMemo(
    () => (pkg?.exports ?? []).map((e) => ({ key: `${e.index}`, name: e.name, target: swapTargetFor(e.className) })),
    [pkg],
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs tracking-widest text-primary">LABS · EXPERIMENTAL</p>
        <h1 className="font-display text-3xl">L2 Bridge Studio</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Pick files from your own Lineage II client. They are read in this browser only — nothing is uploaded or stored.
          Character models become BITMAP Guardians and static props become Living Slab stand-ins.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card/60 backdrop-blur p-4 flex flex-wrap items-end gap-4">
        <label className="text-sm space-y-1">
          <span className="block font-mono text-xs text-muted-foreground">CLIENT FILES (.usx .ukx .utx .unr)</span>
          <input type="file" multiple accept=".usx,.ukx,.utx,.unr,.u" disabled={busy}
            onChange={(e) => void ingest([...(e.target.files ?? [])])} className="text-sm" />
        </label>
        <label className="text-sm space-y-1">
          <span className="block font-mono text-xs text-muted-foreground">GUARDIAN BLOCK</span>
          <input type="number" min={0} value={height} onChange={(e) => setHeight(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            className="w-32 rounded border border-border bg-background px-2 py-1 font-mono" />
        </label>
        {busy ? <span className="font-mono text-xs text-accent">READING…</span> : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-lg border border-border bg-card/60 p-3 max-h-[560px] overflow-auto space-y-1">
          {loaded.length === 0 ? <p className="text-sm text-muted-foreground">No files yet. Pick some from your Lineage II folder (e.g. StaticMeshes, Animations).</p> : null}
          {loaded.map((l, i) => (
            <button key={l.file + i} onClick={() => l.pkg && setActive(i)}
              className={`w-full text-left rounded px-2 py-1 font-mono text-xs ${i === active ? "bg-primary/15 text-primary" : "hover:bg-muted"}`}>
              <div className="truncate">{l.file}</div>
              <div className="text-muted-foreground">
                {l.pkg ? `${l.pkg.envelope} · v${l.pkg.version} · ${l.pkg.exports.length.toLocaleString("en-US")} objects` : l.error}
              </div>
            </button>
          ))}
        </aside>

        <section className="space-y-3">
          <div className="h-[460px] rounded-lg border border-border overflow-hidden">
            <ClientOnly fallback={<div className="h-full" />}>
              <Suspense fallback={<div className="h-full" />}><L2BridgeScene actors={actors} guardianHeight={height} /></Suspense>
            </ClientOnly>
          </div>
          {pkg ? (
            <div className="rounded-lg border border-border bg-card/60 p-3 max-h-56 overflow-auto">
              <table className="w-full font-mono text-xs">
                <thead className="text-muted-foreground"><tr><th className="text-left">OBJECT</th><th className="text-left">CLASS</th><th className="text-left">SWAP</th><th className="text-right">BYTES</th></tr></thead>
                <tbody>
                  {pkg.exports.slice(0, 300).map((e) => (
                    <tr key={e.index}><td>{e.name}</td><td>{e.className}</td>
                      <td className={swapTargetFor(e.className) === "keep" ? "text-muted-foreground" : "text-accent"}>{swapTargetFor(e.className)}</td>
                      <td className="text-right">{e.size.toLocaleString("en-US")}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Reads plain Unreal 2 packages and the Lineage2Ver111/121 formats. Newer encrypted files (Ver41x) are listed as unsupported.
            Mesh geometry from the files is not drawn yet — only the object list, with the first 12 actors shown as Bitcoin models.
          </p>
        </section>
      </div>
    </main>
  );
}

import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { readPackage, swapTargetFor, detectEnvelope, envelopeHelp, categoryFor, summarize, CATEGORY_NOTE, type AssetCategory, type Ue2Package } from "@/lib/l2/ue2-package";
import { decodeStaticMesh } from "@/lib/l2/ue2-staticmesh";
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
interface Loaded { file: string; pkg?: Ue2Package; error?: string; badge?: string; help?: string }

function L2Bridge() {
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [height, setHeight] = useState(521066);
  const [busy, setBusy] = useState(false);

  async function ingest(files: File[]) {
    setBusy(true);
    const out: Loaded[] = [];
    for (const f of files.filter((x) => EXT.test(x.name)).slice(0, 200)) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const env = detectEnvelope(bytes);
      if (env.kind === "unsupported") { out.push({ file: f.name, badge: env.label.replace("Lineage2", "").toUpperCase(), help: envelopeHelp(env.label), error: "unsupported envelope" }); continue; }
      try { out.push({ file: f.name, pkg: readPackage(bytes, f.name) }); }
      catch (e) { out.push({ file: f.name, badge: "PARSE ERROR", error: e instanceof Error ? e.message : String(e) }); }
    }
    setLoaded(out); setActive(out.findIndex((l) => l.pkg)); setBusy(false);
  }

  const [filter, setFilter] = useState<"all" | "3d" | "unsupported">("all");
  const skipped = loaded.filter((l) => !l.pkg);
  const pkg = active != null && active >= 0 ? loaded[active]?.pkg : undefined;
  const actors: BridgeActor[] = useMemo(
    () => (pkg?.exports ?? []).map((e) => ({ key: `${e.index}`, name: e.name, target: swapTargetFor(e.className) })),
    [pkg],
  );

  const [meshIdx, setMeshIdx] = useState<number | null>(null);
  const firstMesh = pkg?.exports.find((e) => e.className === "StaticMesh")?.index ?? null;
  const pick = meshIdx != null && pkg?.exports[meshIdx]?.className === "StaticMesh" ? meshIdx : firstMesh;
  const decoded = useMemo(() => {
    if (!pkg || pick == null) return null;
    try { return { mesh: decodeStaticMesh(pkg, pick) }; } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  }, [pkg, pick]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs tracking-widest text-primary">LABS · EXPERIMENTAL</p>
        <h1 className="font-display text-3xl">L2 Bridge Studio</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Pick files from your own Lineage II client. They are read in this browser only — nothing is uploaded or stored.
          Static props (StaticMesh) are drawn with their real geometry. Character models are still shown as BITMAP Guardians.
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
                {l.pkg ? `${l.pkg.envelope} · v${l.pkg.version} · ${l.pkg.exports.length.toLocaleString("en-US")} objects` : null}
              </div>
              {!l.pkg ? <div className="text-destructive"><span className="rounded border border-destructive/50 px-1">{l.badge}</span> {l.help ?? l.error}</div> : null}
            </button>
          ))}
        </aside>

        <section className="space-y-3">
          <div className="h-[460px] rounded-lg border border-border overflow-hidden">
            <ClientOnly fallback={<div className="h-full" />}>
              <Suspense fallback={<div className="h-full" />}><L2BridgeScene actors={actors} guardianHeight={height} mesh={decoded && "mesh" in decoded ? decoded.mesh : null} /></Suspense>
            </ClientOnly>
          </div>
          {decoded ? (
            <div className={`rounded-lg border bg-card/60 p-3 font-mono text-xs ${"mesh" in decoded ? "border-accent/50" : "border-destructive/40 text-destructive"}`}>
              {"mesh" in decoded && decoded.mesh
                ? `REAL MESH · ${decoded.mesh.name} · ${decoded.mesh.vertexCount.toLocaleString("en-US")} vertices · ${decoded.mesh.triangleCount.toLocaleString("en-US")} triangles · ${decoded.mesh.sections.toLocaleString("en-US")} sections${decoded.mesh.uvs ? " · UVs" : ""} (untextured)`
                : `MESH NOT DECODED · ${pkg?.exports[pick!]?.name}: ${"error" in decoded ? decoded.error : ""}`}
            </div>
          ) : null}
          {skipped.length ? (
            <div className="rounded-lg border border-destructive/40 bg-card/60 p-3 font-mono text-xs">
              UNSUPPORTED FILES: {skipped.length.toLocaleString("en-US")} of {loaded.length.toLocaleString("en-US")} — see the red notes in the file list.
            </div>
          ) : null}
          {pkg ? (() => { const s = summarize(pkg); return (
            <div className="rounded-lg border border-border bg-card/60 p-3 font-mono text-xs flex flex-wrap gap-2">
              {(Object.keys(s) as AssetCategory[]).filter((k) => s[k]).map((k) => (
                <span key={k} title={CATEGORY_NOTE[k]} className={`rounded border px-2 py-0.5 ${k === "character" || k === "prop" ? "border-accent/50 text-accent" : "border-border text-muted-foreground"}`}>
                  {k.toUpperCase()} {s[k].toLocaleString("en-US")}{k === "character" || k === "prop" ? "" : " · unsupported"}
                </span>))}
              <span className="ml-auto flex gap-1">
                {(["all", "3d", "unsupported"] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={`rounded px-2 ${filter === f ? "bg-primary/15 text-primary" : "hover:bg-muted"}`}>{f.toUpperCase()}</button>))}
              </span>
            </div>); })() : null}
          {pkg ? (
            <div className="rounded-lg border border-border bg-card/60 p-3 max-h-56 overflow-auto">
              <table className="w-full font-mono text-xs">
                <thead className="text-muted-foreground"><tr><th className="text-left">OBJECT</th><th className="text-left">CLASS</th><th className="text-left">SWAP</th><th className="text-left">STATUS</th><th className="text-right">BYTES</th></tr></thead>
                <tbody>
                  {pkg.exports.filter((e) => filter === "all" || (filter === "3d") === (swapTargetFor(e.className) !== "keep")).slice(0, 300).map((e) => (
                    <tr key={e.index} onClick={() => e.className === "StaticMesh" && setMeshIdx(e.index)} className={e.className === "StaticMesh" ? `cursor-pointer hover:bg-muted ${e.index === pick ? "text-primary" : ""}` : ""}><td>{e.name}</td><td>{e.className}</td>
                      <td className={swapTargetFor(e.className) === "keep" ? "text-muted-foreground" : "text-accent"}>{swapTargetFor(e.className)}</td><td className="text-muted-foreground">{CATEGORY_NOTE[categoryFor(e.className)]}</td>
                      <td className="text-right">{e.size.toLocaleString("en-US")}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Reads plain Unreal 2 packages and the Lineage2Ver111/121 formats. Encrypted files (Ver2xx Blowfish, Ver41x RSA) are listed as unsupported with how to decrypt them locally.
            StaticMesh geometry is decoded and drawn without textures; click a StaticMesh row to view it. Skeletal characters are not decoded yet and appear as Guardians.
          </p>
        </section>
      </div>
    </main>
  );
}

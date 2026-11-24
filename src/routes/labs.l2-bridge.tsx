import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { indexEntries, fromFileList, fromDirectoryHandle, missingUtx, type FolderEntry } from "@/lib/l2/game-folder";
import { readPackage, swapTargetFor, detectEnvelope, envelopeHelp, categoryFor, summarize, CATEGORY_NOTE, type AssetCategory, type Ue2Package } from "@/lib/l2/ue2-package";
import { decodeStaticMesh } from "@/lib/l2/ue2-staticmesh";
import { decodeSkeletalMesh, SKELETAL_CLASSES } from "@/lib/l2/ue2-skeletal";
import { decodeTexture, resolveMaterial, type DecodedTexture, type MaterialResult } from "@/lib/l2/ue2-texture";
import type { BridgeActor } from "@/components/l2/L2BridgeScene";

import L2LoginPanel from "@/components/l2/L2LoginPanel";
import L2PlayHub from "@/components/l2/L2PlayHub";
import L2AccountRegistration from "@/components/l2/L2AccountRegistration";
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
  const [folder, setFolder] = useState<{ name: string; index: Map<string, FolderEntry> } | null>(null);
  const [folderQuery, setFolderQuery] = useState("");
  const tried = useRef(new Set<string>());

  function applyFolder(name: string, entries: FolderEntry[]) {
    tried.current.clear();
    setFolder({ name, index: indexEntries(entries) });
  }
  async function openFolder() {
    const w = window as unknown as { showDirectoryPicker?: () => Promise<Parameters<typeof fromDirectoryHandle>[0]> };
    if (!w.showDirectoryPicker) { document.getElementById("l2-folder-fallback")?.click(); return; }
    try { setBusy(true); const h = await w.showDirectoryPicker(); applyFolder(h.name, await fromDirectoryHandle(h)); }
    catch { /* picker cancelled */ } finally { setBusy(false); }
  }
  async function openEntries(list: FolderEntry[]) { await ingest(await Promise.all(list.map((e) => e.open()))); }

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
    setLoaded((prev) => {
      const keep = prev.filter((p) => !out.some((o) => o.file === p.file));
      const next = [...keep, ...out];
      const firstNew = next.findIndex((l) => l.pkg && out.some((o) => o.file === l.file) && l.pkg.exports.some((e) => e.className === "StaticMesh"));
      setActive((a) => (firstNew >= 0 ? firstNew : a != null && a >= 0 ? a : next.findIndex((l) => l.pkg)));
      return next;
    });
    setBusy(false);
  }

  const [filter, setFilter] = useState<"all" | "3d" | "unsupported">("all");
  const skipped = loaded.filter((l) => !l.pkg);
  const pkg = active != null && active >= 0 ? loaded[active]?.pkg : undefined;
  const actors: BridgeActor[] = useMemo(
    () => (pkg?.exports ?? []).map((e) => ({ key: `${e.index}`, name: e.name, target: swapTargetFor(e.className) })),
    [pkg],
  );

  const [meshIdx, setMeshIdx] = useState<number | null>(null);
  const viewable = (c: string) => c === "StaticMesh" || SKELETAL_CLASSES.test(c) || c === "Texture";
  const firstMesh = pkg?.exports.find((e) => e.className === "StaticMesh" || SKELETAL_CLASSES.test(e.className))?.index
    ?? pkg?.exports.find((e) => e.className === "Texture")?.index ?? null;
  const pick = meshIdx != null && pkg?.exports[meshIdx] && viewable(pkg.exports[meshIdx]!.className) ? meshIdx : firstMesh;
  const pickClass = pick != null ? pkg?.exports[pick]?.className ?? "" : "";
  const isTexture = pickClass === "Texture";
  const isSkeletal = SKELETAL_CLASSES.test(pickClass);
  const decoded = useMemo(() => {
    if (!pkg || pick == null || isTexture) return null;
    try { return { mesh: isSkeletal ? decodeSkeletalMesh(pkg, pick) : decodeStaticMesh(pkg, pick) }; } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  }, [pkg, pick, isTexture, isSkeletal]);
  const shownTexture = useMemo(() => {
    if (!pkg || pick == null || !isTexture) return null;
    try { return { tex: decodeTexture(pkg, pick) }; } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  }, [pkg, pick, isTexture]);
  const allPkgs = useMemo(() => loaded.flatMap((l) => (l.pkg ? [l.pkg] : [])), [loaded]);
  const shownMesh = decoded && "mesh" in decoded ? decoded.mesh ?? null : null;
  const matResults: MaterialResult[] = useMemo(() => {
    if (!pkg || !shownMesh) return [];
    return shownMesh.materials.map((ref, i) => {
      const issue = shownMesh.materialIssues?.[i];
      return issue ? { ok: false as const, reason: issue, via: [] } : resolveMaterial(allPkgs, pkg, ref);
    });
  }, [shownMesh, pkg, allPkgs]);
  // Every Texture object in the loaded files, for picking a skin by hand when a material can't be matched.
  const textureChoices = useMemo(() => {
    const out: { key: string; label: string; name: string; p: Ue2Package; idx: number }[] = [];
    loaded.forEach((l, pi) => l.pkg?.exports.forEach((e, ei) => { if (e.className === "Texture" && out.length < 3000) out.push({ key: `${pi}:${ei}`, label: `${e.name} · ${l.file}`, name: e.name.toLowerCase(), p: l.pkg!, idx: ei }); }));
    const stem = (shownMesh?.name ?? "").toLowerCase().split(/[_.]/)[0] ?? "";
    return stem.length >= 3 ? [...out.filter((c) => c.name.startsWith(stem)), ...out.filter((c) => !c.name.startsWith(stem))] : out;
  }, [loaded, shownMesh]);
  const meshKey = `${active}:${pick}`;
  const [manual, setManual] = useState<{ key: string; map: Record<number, string> }>({ key: "", map: {} });
  const picks = manual.key === meshKey ? manual.map : {};
  const manualTex = useMemo(() => {
    const out: Record<number, { tex?: DecodedTexture; error?: string; name: string }> = {};
    for (const [g, k] of Object.entries(picks)) {
      const c = textureChoices.find((x) => x.key === k); if (!c) continue;
      try { out[Number(g)] = { tex: decodeTexture(c.p, c.idx), name: c.label }; } catch (e) { out[Number(g)] = { error: e instanceof Error ? e.message : String(e), name: c.label }; }
    }
    return out;
  }, [picks, textureChoices]);
  const textures = useMemo(() => matResults.map((m, i) => manualTex[i]?.tex ?? (m.ok ? m.texture : null)), [matResults, manualTex]);
  // With a game folder open, fetch the texture packages a model asks for automatically.
  useEffect(() => {
    if (!folder || busy) return;
    const want = [...new Set(matResults.flatMap((m) => (!m.ok ? [missingUtx(m.reason)] : [])).filter((x): x is string => !!x && !tried.current.has(x)))];
    const found = want.flatMap((k) => { tried.current.add(k); const e = folder.index.get(k); return e ? [e] : []; });
    if (found.length) void openEntries(found);
  }, [matResults, folder, busy]);
  const folderHits = useMemo(() => {
    if (!folder) return [];
    const q = folderQuery.trim().toLowerCase();
    return [...folder.index.values()].filter((e) => !q || e.path.toLowerCase().includes(q)).slice(0, 80);
  }, [folder, folderQuery]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs tracking-widest text-primary">LABS · EXPERIMENTAL</p>
        <h1 className="font-display text-3xl">L2 Bridge Studio</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Pick files from your own Lineage II client. They are read in this browser only — nothing is uploaded or stored.
          Static props (StaticMesh) are drawn with their real geometry. Characters from .ukx files are drawn in their rest pose with textures from any .utx files you add, and textures can be viewed on their own.
        </p>
      </header>

      <ClientOnly fallback={null}><L2PlayHub /></ClientOnly>
      <ClientOnly fallback={null}><L2AccountRegistration /></ClientOnly>

      <section className="rounded-lg border border-border bg-card/60 backdrop-blur p-4 flex flex-wrap items-end gap-4">
        <label className="text-sm space-y-1">
          <span className="block font-mono text-xs text-muted-foreground">CLIENT FILES (.usx .ukx .utx .unr) · add .utx files to texture props and characters</span>
          <input type="file" multiple title="Pick the .usx props together with their .utx texture files" accept=".usx,.ukx,.utx,.unr,.u" disabled={busy}
            onChange={(e) => void ingest([...(e.target.files ?? [])])} className="text-sm" />
        </label>
        <div className="text-sm space-y-1">
          <span className="block font-mono text-xs text-muted-foreground">OR THE WHOLE GAME FOLDER · read on demand, never uploaded</span>
          <button onClick={() => void openFolder()} disabled={busy} className="rounded border border-primary px-3 py-1 font-mono text-xs text-primary hover:bg-primary/10">OPEN GAME FOLDER</button>
          <input id="l2-folder-fallback" type="file" className="hidden" {...{ webkitdirectory: "", directory: "" }}
            onChange={(e) => { const fs = [...(e.target.files ?? [])]; if (fs.length) applyFolder(fs[0]!.webkitRelativePath.split("/")[0] ?? "folder", fromFileList(fs)); }} />
        </div>
        <label className="text-sm space-y-1">
          <span className="block font-mono text-xs text-muted-foreground">GUARDIAN BLOCK</span>
          <input type="number" min={0} value={height} onChange={(e) => setHeight(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            className="w-32 rounded border border-border bg-background px-2 py-1 font-mono" />
        </label>
        {loaded.length ? <button onClick={() => { setLoaded([]); setActive(null); setMeshIdx(null); }} className="rounded border border-border px-2 py-1 font-mono text-xs hover:bg-muted">CLEAR FILES</button> : null}
        {busy ? <span className="font-mono text-xs text-accent">READING…</span> : null}
      </section>

      {folder ? (
        <section className="rounded-lg border border-border bg-card/60 p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
            <span className="text-accent">FOLDER · {folder.name} · {folder.index.size.toLocaleString("en-US")} packages indexed</span>
            <input value={folderQuery} onChange={(e) => setFolderQuery(e.target.value)} placeholder="Search e.g. LineageNPCs, StaticMeshes/" className="flex-1 min-w-48 rounded border border-border bg-background px-2 py-1" />
            <button onClick={() => { setFolder(null); tried.current.clear(); }} className="rounded border border-border px-2 py-1 hover:bg-muted">CLOSE FOLDER</button>
          </div>
          <p className="text-xs text-muted-foreground">Click a package to open it. Textures a model needs are loaded from this folder automatically.</p>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4 max-h-48 overflow-auto">
            {folderHits.map((e) => (
              <button key={e.path} onClick={() => void openEntries([e])} disabled={busy} className="truncate rounded px-2 py-1 text-left font-mono text-xs hover:bg-muted" title={e.path}>
                {e.path.split("/").slice(-2).join("/")} <span className="text-muted-foreground">· {(e.size / 1048576).toLocaleString("en-US", { maximumFractionDigits: 1 })} MB</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <ClientOnly fallback={null}><L2LoginPanel folder={folder?.index ?? null} /></ClientOnly>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-lg border border-border bg-card/60 p-3 max-h-[560px] overflow-auto space-y-1">
          {loaded.length === 0 ? <p className="text-sm text-muted-foreground">No files yet. Pick some from your Lineage II folder (e.g. StaticMeshes, Animations).</p> : null}
          {loaded.map((l, i) => (
            <button key={l.file + i} onClick={() => { if (l.pkg) { setActive(i); setMeshIdx(null); } }}
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
              <Suspense fallback={<div className="h-full" />}><L2BridgeScene actors={actors} guardianHeight={height} mesh={decoded && "mesh" in decoded ? decoded.mesh : null} textures={textures} texture={shownTexture && "tex" in shownTexture ? shownTexture.tex : null} /></Suspense>
            </ClientOnly>
          </div>
          {shownTexture ? (
            <div className={`rounded-lg border bg-card/60 p-3 font-mono text-xs ${"tex" in shownTexture ? "border-accent/50 text-accent" : "border-destructive/40 text-destructive"}`}>
              {"tex" in shownTexture && shownTexture.tex
                ? `REAL TEXTURE · ${shownTexture.tex.name} · ${shownTexture.tex.format} ${shownTexture.tex.width}×${shownTexture.tex.height}${shownTexture.tex.hasAlpha ? " · alpha" : ""}`
                : `TEXTURE NOT DECODED · ${pkg?.exports[pick!]?.name}: ${"error" in shownTexture ? shownTexture.error : ""}`}
            </div>
          ) : null}
          {decoded ? (
            <div className={`rounded-lg border bg-card/60 p-3 font-mono text-xs ${"mesh" in decoded ? "border-accent/50" : "border-destructive/40 text-destructive"}`}>
              {"mesh" in decoded && decoded.mesh
                ? `${isSkeletal ? "REAL CHARACTER (REST POSE)" : "REAL MESH"} · ${decoded.mesh.name} · ${decoded.mesh.vertexCount.toLocaleString("en-US")} vertices · ${decoded.mesh.triangleCount.toLocaleString("en-US")} triangles · ${decoded.mesh.sections.toLocaleString("en-US")} sections${decoded.mesh.uvs ? " · UVs" : ""} `
                : `MESH NOT DECODED · ${pkg?.exports[pick!]?.name}: ${"error" in decoded ? decoded.error : ""}`}
              {"mesh" in decoded && decoded.mesh ? (
                <div className="mt-2 space-y-0.5">
                  {isSkeletal ? <div className="text-muted-foreground">Drawn in its rest pose; bones and animation are not read yet. Materials: {decoded.mesh.materialSource}.</div> : null}
                  {!isSkeletal && matResults.length === 0 ? <div className="text-muted-foreground">MATERIALS · none listed in this mesh — drawn untextured</div> : null}
                  {matResults.map((m, i) => {
                    const slot = decoded.mesh!.slots?.[i];
                    const hand = manualTex[i];
                    return (
                      <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={hand?.tex || (!hand && m.ok) ? "text-accent" : "text-muted-foreground"}>
                          {`SECTION ${i}${slot != null && slot !== i ? ` (slot ${slot})` : ""} · `}
                          {hand ? (hand.tex ? `${hand.tex.name} · picked by hand` : `picked texture not decoded — ${hand.error}`)
                            : m.ok ? `${m.texture.name} · ${m.texture.format} ${m.texture.width}×${m.texture.height}${m.texture.hasAlpha ? " · alpha" : ""}` : `untextured — ${m.reason}`}
                          {!hand && m.via.length > 1 ? <span className="text-muted-foreground">{` (${m.via.join(" → ")})`}</span> : null}
                        </span>
                        {textureChoices.length && (!m.ok || hand) ? (
                          <select aria-label={`Texture for section ${i}`} value={picks[i] ?? ""}
                            onChange={(e) => { const v = e.target.value; setManual({ key: meshKey, map: Object.fromEntries(Object.entries({ ...picks, [i]: v }).filter(([, x]) => x)) }); }}
                            className="max-w-xs rounded border border-border bg-background px-1 py-0.5 font-mono text-xs text-foreground">
                            <option value="">{hand ? "use the model's own material" : "pick a loaded texture…"}</option>
                            {textureChoices.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                          </select>) : null}
                      </div>);
                  })}
                  {matResults.some((m) => !m.ok) && !textureChoices.length ? <div className="text-muted-foreground">No textures loaded yet — add the matching .utx files to texture this model.</div> : null}
                  {!decoded.mesh.uvs && matResults.some((m) => m.ok) ? <div className="text-destructive">This mesh has no UVs, so textures cannot be placed.</div> : null}
                </div>) : null}
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
                  {k.toUpperCase()} {s[k].toLocaleString("en-US")}{k === "character" || k === "prop" ? "" : k === "texture" ? " · used by models" : " · unsupported"}
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
                    <tr key={e.index} onClick={() => viewable(e.className) && setMeshIdx(e.index)} className={viewable(e.className) ? `cursor-pointer hover:bg-muted ${e.index === pick ? "text-primary" : ""}` : ""}><td>{e.name}</td><td>{e.className}</td>
                      <td className={swapTargetFor(e.className) === "keep" ? "text-muted-foreground" : "text-accent"}>{swapTargetFor(e.className)}</td><td className="text-muted-foreground">{CATEGORY_NOTE[categoryFor(e.className)]}</td>
                      <td className="text-right">{e.size.toLocaleString("en-US")}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Reads plain Unreal 2 packages and the Lineage2Ver111/121 formats. Encrypted files (Ver2xx Blowfish, Ver41x RSA) are listed as unsupported with how to decrypt them locally.
            StaticMesh geometry is decoded and drawn with its textures (DXT1/3/5, RGBA8, RGB8, L8 and paletted P8) found in any loaded file, following Shader, FinalBlend, Combiner and TexModifier materials; click a StaticMesh, SkeletalMesh or Texture row to view it. Lighting effects, scrolling and blending are not reproduced. Characters (.ukx SkeletalMesh) are drawn in their rest pose without animation, textured from their own material list; when a section's material can't be matched the reason is shown and you can pick a loaded texture for it by hand.
          </p>
        </section>
      </div>
    </main>
  );
}


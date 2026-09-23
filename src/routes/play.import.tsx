import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PlayNav } from "@/components/play/PlayNav";
import { Button } from "@/components/ui/button";
import { getParentImageChildrenFn } from "@/lib/game/parentExtenders.functions";
import { inscriptionContentUrl, normalizeInscriptionInput, ordinalsPreviewUrl } from "@/lib/game/pfpExtenders";
import { addCustomPfpExtenders, updatePlayVisuals, usePlayProfile } from "@/lib/game/worldState";
import type { CardVisualExtender } from "@/lib/game/types";

export const Route = createFileRoute("/play/import")({
  head: () => ({
    meta: [
      { title: "Import Inscription Children — BITMAPWIN // PLAY" },
      { name: "description", content: "Paste an Ordinals parent inscription and split its image and HTML children into your living card background pool." },
      { property: "og:title", content: "Import Inscription Children — BITMAPWIN // PLAY" },
      { property: "og:description", content: "Turn any Ordinals parent inscription's children into card art for BitmapWin PLAY." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlayImport,
});

type Child = { inscriptionId: string; contentType: string };

function PlayImport() {
  const profile = usePlayProfile();
  const scan = useServerFn(getParentImageChildrenFn);
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ parent: string; checked: number; children: Child[]; truncated: boolean } | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  async function read() {
    const parent = normalizeInscriptionInput(input);
    if (!parent) return setError("PASTE A VALID INSCRIPTION ID OR ORDINALS URL");
    setError(null);
    setAdded(null);
    setResult(null);
    setBusy(true);
    try {
      const r = await scan({ data: { parentInscriptionId: parent, limit: 250 } });
      setResult({ parent, checked: r.checkedChildren, children: r.imageChildren, truncated: r.truncated });
    } catch {
      setError("CHILDREN COULD NOT BE READ RIGHT NOW");
    } finally {
      setBusy(false);
    }
  }

  function addToPool() {
    if (!result || result.children.length === 0) return;
    const collection = (name.trim() || `POOL ${result.parent.slice(0, 8)}`).toUpperCase().slice(0, 42);
    const count = result.children.length;
    const items: CardVisualExtender[] = result.children.map((c, i) => {
      const html = c.contentType.startsWith("text/html");
      return {
        id: `custom-${c.inscriptionId}`,
        name: `${collection.slice(0, 30)} #${i + 1}`,
        collection,
        source: html ? "ordinals-html" : "ordinals-image",
        inscriptionId: c.inscriptionId,
        enabled: true,
        builtIn: false,
        addedAt: Date.now(),
        bitmap: null,
        parentInscriptionId: result.parent,
        contentType: c.contentType,
        childIndex: i + 1,
        childCount: count,
      };
    });
    addCustomPfpExtenders(items, items[0]?.id ?? null);
    updatePlayVisuals({ pfpExtendersEnabled: true, selectedPfpCollection: collection });
    setAdded(collection);
  }

  const htmlCount = result?.children.filter((c) => c.contentType.startsWith("text/html")).length ?? 0;

  return (
    <main className="play-district mx-auto max-w-[1200px] overflow-x-hidden px-4 py-8 md:px-8">
      <PlayNav />
      <header className="mt-6">
        <p className="label text-bitcoin">BITMAPWIN // PLAY</p>
        <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">IMPORT INSCRIPTION</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Paste a parent inscription. Every image and HTML child is split into its own card background, and each card gets a different one from the pool. Art only — stats and rules stay the same.
        </p>
      </header>

      <section className="mt-6 grid gap-3 border border-border bg-card p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-end">
        <label className="grid gap-1">
          <span className="label">PARENT INSCRIPTION ID OR URL</span>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="…i0 or https://ordinals.com/inscription/…" className="h-10 min-w-0 border border-border bg-background px-3 font-mono text-xs" />
        </label>
        <label className="grid gap-1">
          <span className="label">POOL NAME (OPTIONAL)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={42} className="h-10 min-w-0 border border-border bg-background px-3 font-mono text-xs" />
        </label>
        <Button type="button" variant="terminal" disabled={busy} onClick={read}>{busy ? "READING CHILDREN…" : "READ CHILDREN"}</Button>
        {error && <p className="label text-destructive md:col-span-3">{error}</p>}
      </section>

      {result && (
        <section className="mt-6 border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="label">
              {result.children.length} USABLE · {htmlCount} HTML · {result.checked} CHILDREN CHECKED{result.truncated ? " · FIRST 250 SHOWN" : ""}
            </p>
            {result.children.length > 0 && !added && (
              <Button type="button" variant="terminal" disabled={!profile} onClick={addToPool}>ADD {result.children.length} TO CARD POOL</Button>
            )}
          </div>
          {added && (
            <p className="label mt-3 text-bitcoin">
              {added} IS NOW YOUR ACTIVE POOL · <Link to="/play/cards" className="underline">SEE YOUR CARDS</Link> · <Link to="/play/extenders" className="underline">MANAGE POOLS</Link>
            </p>
          )}
          {result.children.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">This inscription has no image or HTML children.</p>
          ) : (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-8">
              {result.children.slice(0, 48).map((c, i) => (
                <div key={c.inscriptionId} className="relative aspect-square overflow-hidden border border-border bg-background">
                  {c.contentType.startsWith("text/html") ? (
                    <iframe src={ordinalsPreviewUrl(c.inscriptionId)} title={`Child ${i + 1}`} sandbox="allow-scripts" loading="lazy" className="pointer-events-none h-full w-full border-0" />
                  ) : (
                    <img src={inscriptionContentUrl(c.inscriptionId)} alt={`Child ${i + 1}`} loading="lazy" className="h-full w-full object-cover [image-rendering:pixelated]" />
                  )}
                  <span className="absolute left-1 top-1 bg-background/80 px-1 font-mono text-[9px]">#{i + 1}</span>
                </div>
              ))}
            </div>
          )}
          {result.children.length > 48 && <p className="label mt-2">+{result.children.length - 48} MORE</p>}
        </section>
      )}
    </main>
  );
}

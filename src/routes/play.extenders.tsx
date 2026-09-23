import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { LivingCard } from "@/components/play/LivingCard";
import { PlayNav } from "@/components/play/PlayNav";
import { Button } from "@/components/ui/button";
import {
  allPfpExtenders,
  inscriptionContentUrl,
  normalizeInscriptionInput,
  ordinalsPreviewUrl,
} from "@/lib/game/pfpExtenders";
import { getParentImageChildrenFn } from "@/lib/game/parentExtenders.functions";
import {
  addCustomPfpExtenders,
  addCustomPfpExtender,
  removeCustomPfpExtender,
  updatePlayVisuals,
  usePlayProfile,
} from "@/lib/game/worldState";
import type { CardVisualExtender } from "@/lib/game/types";
import { Link } from "@tanstack/react-router";
import { ORD_TORCHES_PARENT, ORD_TORCHES_POOL, ORD_TORCHES_SUPPLY, useOrdTorches } from "@/lib/game/ordTorches";

export const Route = createFileRoute("/play/extenders")({
  head: () => ({
    meta: [
      { title: "PFP Extenders — BITMAPWIN // PLAY" },
      { name: "description", content: "Optional Ordinals HTML and child-image PFP extenders for living card art inside BitmapWin PLAY." },
      { property: "og:title", content: "Ordinals PFP Extenders — BITMAPWIN // PLAY" },
      { property: "og:description", content: "Extend living cards with safe HTML previews or parent inscription child images while keeping BITMAP state intact." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlayExtenders,
});

function PlayExtenders() {
  const profile = usePlayProfile();
  const scanParent = useServerFn(getParentImageChildrenFn);
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [parentInput, setParentInput] = useState("");
  const [bitmapInput, setBitmapInput] = useState("715093");
  const [error, setError] = useState<string | null>(null);
  const [parentError, setParentError] = useState<string | null>(null);
  const [parentStatus, setParentStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const extenders = useMemo(() => allPfpExtenders(profile?.visuals), [profile?.visuals]);
  const selected = extenders.find((extender) => extender.id === profile?.visuals.selectedPfpExtenderId) ?? extenders[0] ?? null;
  const previewCard = profile?.order.map((id) => profile.cards[id]).find(Boolean) ?? null;
  const enabled = profile?.visuals.pfpExtendersEnabled === true;
  const selectedCollection = profile?.visuals.selectedPfpCollection ?? selected?.collection ?? null;
  const torches = useOrdTorches();
  const [torchPage, setTorchPage] = useState(0);
  const pools = useMemo(() => {
    const map = new Map<string, CardVisualExtender[]>();
    for (const e of extenders) map.set(e.collection, [...(map.get(e.collection) ?? []), e]);
    return [...map.entries()];
  }, [extenders]);

  function addExtender() {
    const inscriptionId = normalizeInscriptionInput(input);
    if (!inscriptionId) {
      setError("PASTE A VALID ORDINALS INSCRIPTION ID OR URL");
      return;
    }
    setError(null);
    addCustomPfpExtender({
      id: `custom-${inscriptionId}`,
      name: (name.trim() || "CUSTOM HTML PFP").toUpperCase().slice(0, 42),
      collection: "CUSTOM ORDINALS PFP",
      source: "ordinals-html",
      inscriptionId,
      enabled: true,
      builtIn: false,
      addedAt: Date.now(),
    });
    setInput("");
    setName("");
  }

  async function importParentChildren() {
    const typedParent = normalizeInscriptionInput(parentInput);
    const bitmap = Number(bitmapInput);
    if (parentInput.trim() && !typedParent) {
      setParentError("PASTE A VALID PARENT INSCRIPTION ID OR URL");
      return;
    }
    if (!Number.isInteger(bitmap) || bitmap < 0 || bitmap > 999_999) {
      setParentError("ENTER A VALID BITMAP HEIGHT");
      return;
    }
    setParentError(null);
    setParentStatus("READING CHILD INSCRIPTIONS…");
    setImporting(true);
    try {
      const result = await scanParent({ data: typedParent ? { parentInscriptionId: typedParent, limit: 250 } : { bitmap, limit: 250 } });
      const parentInscriptionId = result.parentInscriptionId;
      if (!parentInscriptionId) {
        setParentStatus(`${bitmap}.BITMAP INSCRIPTION NOT FOUND`);
        return;
      }
      if (result.imageChildren.length === 0) {
        setParentStatus(`NO IMAGE OR HTML CHILDREN FOUND · ${result.checkedChildren} CHILDREN CHECKED`);
        return;
      }
      const count = result.imageChildren.length;
      const imported: CardVisualExtender[] = result.imageChildren.map((child, index) => ({
        id: `parent-${bitmap}-${parentInscriptionId}-${child.inscriptionId}`,
        name: `${child.contentType.startsWith("text/html") ? "CHILD HTML" : "CHILD IMAGE"} ${index + 1}`,
        collection: `${bitmap}.BITMAP CHILDREN`,
        source: child.contentType.startsWith("text/html") ? "ordinals-html" : "ordinals-image",
        inscriptionId: child.inscriptionId,
        enabled: true,
        builtIn: false,
        addedAt: Date.now(),
        bitmap,
        parentInscriptionId,
        contentType: child.contentType,
        childIndex: index + 1,
        childCount: count,
      }));
      addCustomPfpExtenders(imported, imported[0]?.id ?? null);
      setParentStatus(`IMPORTED ${count} IMAGE/HTML CHILDREN FOR ${bitmap}.BITMAP`);
      setParentInput("");
    } catch {
      setParentError("CHILD INSCRIPTIONS COULD NOT BE READ RIGHT NOW");
      setParentStatus(null);
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="play-district mx-auto max-w-[1200px] overflow-x-hidden px-4 py-8 md:px-8">
      <PlayNav />
      <header className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="label text-signal">OPTIONAL VISUAL EXTENDERS</p>
          <h1 className="display mt-2 text-3xl md:text-5xl">ORDINALS PFP EXTENDERS</h1>
          <p className="mt-3 max-w-2xl font-mono text-xs leading-relaxed text-muted-foreground">
            Load popular PFP inscriptions as HTML card art, or import image children from a parent inscription. The extender changes only the image layer; BITMAP state, traits, history and match rules stay untouched.
          </p>
        </div>
        <Button
          type="button"
          variant={enabled ? "terminal" : "terminalGhost"}
          className="min-h-11"
          disabled={!profile}
          onClick={() => updatePlayVisuals({ pfpExtendersEnabled: !enabled })}
        >
          {enabled ? "PFP EXTENDERS ON" : "PFP EXTENDERS OFF"}
        </Button>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] [&>*]:min-w-0">
        <section className="grid content-start gap-4">
          <article className="border border-bitcoin bg-card p-3">
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="label text-bitcoin">ORD TORCHES · ON-CHAIN POOL</h2>
                <span className="label text-muted-foreground">{torches ? torches.list.length : "…"} / {ORD_TORCHES_SUPPLY} FOUND ACROSS THE MAP</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant={enabled && selectedCollection === ORD_TORCHES_POOL ? "terminal" : "terminalGhost"}
                disabled={!profile || !torches?.list.length}
                onClick={() => updatePlayVisuals({ pfpExtendersEnabled: true, selectedPfpCollection: ORD_TORCHES_POOL })}
              >
                {enabled && selectedCollection === ORD_TORCHES_POOL ? "POOL ACTIVE" : "USE POOL"}
              </Button>
            </header>
            <p className="mb-3 break-all font-mono text-[10px] text-muted-foreground">PARENT <span data-no-translate>{ORD_TORCHES_PARENT}</span> · ACTIVATE THE POOL TO DISTRIBUTE A DIFFERENT TORCH ACROSS EACH CARD</p>
            {!torches ? <p className="font-mono text-xs text-muted-foreground">&gt; READING 3000 CHILDREN…</p> : (
              <>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {torches.list.slice(torchPage * 24, torchPage * 24 + 24).map((t) => (
                    <div key={t.inscriptionId} className="relative aspect-square border border-border bg-background">
                      <iframe src={ordinalsPreviewUrl(t.inscriptionId)} title={`Ord Torch #${t.index + 1}`} loading="lazy" sandbox="allow-scripts" scrolling="no" className="pointer-events-none h-full w-full border-0" />
                      <Link to="/bitmap/$block" params={{ block: String(t.bitmap) }} className="absolute inset-0" aria-label={`Torch ${t.index + 1} at ${t.bitmap}.bitmap`} />
                      <span className="label pointer-events-none absolute bottom-0 left-0 bg-background/85 px-1 text-[9px]" data-no-translate>#{t.index + 1} · {t.bitmap}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Button type="button" variant="terminalGhost" disabled={torchPage === 0} onClick={() => setTorchPage((p) => p - 1)}>PREV</Button>
                  <span className="label text-muted-foreground">PAGE {torchPage + 1} / {Math.max(1, Math.ceil(torches.list.length / 24))}</span>
                  <Button type="button" variant="terminalGhost" disabled={(torchPage + 1) * 24 >= torches.list.length} onClick={() => setTorchPage((p) => p + 1)}>NEXT</Button>
                </div>
              </>
            )}
          </article>
          {pools.map(([collection, items]) => (
            <article key={collection} className="border border-border bg-card p-3">
              <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="label text-bitcoin">{collection}</h2>
                  <span className="label text-muted-foreground">{items.length} BACKGROUNDS · {items.filter((i) => i.source === "ordinals-html").length} HTML</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={enabled && selectedCollection === collection ? "terminal" : "terminalGhost"}
                  disabled={!profile}
                  onClick={() => updatePlayVisuals({ pfpExtendersEnabled: true, selectedPfpCollection: collection, selectedPfpExtenderId: items[0]?.id ?? null })}
                >
                  {enabled && selectedCollection === collection ? "POOL ACTIVE" : "USE POOL"}
                </Button>
              </header>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {items.map((extender) => {
                  const active = enabled && selectedCollection === collection;
                  return (
                    <div key={extender.id} className={`group relative aspect-square border bg-background ${active ? "border-bitcoin" : "border-border"}`}>
                      {extender.source === "ordinals-image" ? (
                        <img src={inscriptionContentUrl(extender.inscriptionId)} alt={extender.name} loading="lazy" className="h-full w-full object-cover [image-rendering:pixelated]" />
                      ) : (
                        <iframe src={ordinalsPreviewUrl(extender.inscriptionId)} title={extender.name} loading="lazy" sandbox="allow-scripts" scrolling="no" className="pointer-events-none h-full w-full border-0" />
                      )}
                      <span className="label pointer-events-none absolute bottom-0 left-0 bg-background/85 px-1 text-[9px]">{extender.source === "ordinals-html" ? "HTML" : "IMG"}{active ? " · POOL" : ""}</span>
                      {!extender.builtIn && (
                        <button type="button" aria-label={`Remove ${extender.name}`} disabled={!profile} onClick={() => removeCustomPfpExtender(extender.id)} className="label absolute right-0 top-0 hidden bg-background/90 px-1.5 group-hover:block">×</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </section>

        <aside className="grid content-start gap-4">
          <section className="border border-border bg-card p-4">
            <h2 className="label text-bitcoin">LIVE CARD PREVIEW</h2>
            <div className="mt-4 grid justify-items-center">
              {previewCard ? <LivingCard card={previewCard} size="lg" /> : <p className="font-mono text-xs text-muted-foreground">&gt; SHUFFLING CARDS…</p>}
            </div>
            <p className="mt-3 font-mono text-[10px] text-muted-foreground">
              {enabled && selected ? `${selected.name} is active. The card keeps its BITMAP pattern overlay.` : "Enable a PFP extender to replace the central card image layer."}
            </p>
          </section>

          <section className="border border-border bg-card p-4">
            <h2 className="label text-bitcoin">IMPORT PARENT CHILDREN</h2>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              Paste a parent inscription. Every real image child found becomes an optional extender for one BITMAP.
            </p>
            <div className="mt-3 grid gap-2">
              <label className="grid gap-1">
                <span className="label">BITMAP</span>
                <input value={bitmapInput} onChange={(event) => setBitmapInput(event.target.value)} inputMode="numeric" className="h-10 border border-border bg-background px-3 font-mono text-xs" placeholder="715093" data-no-translate />
              </label>
              <label className="grid gap-1">
                <span className="label">PARENT INSCRIPTION</span>
                <input value={parentInput} onChange={(event) => setParentInput(event.target.value)} className="h-10 border border-border bg-background px-3 font-mono text-xs" placeholder="EMPTY = USE THE BITMAP INSCRIPTION" data-no-translate />
              </label>
              {parentError && <p className="font-mono text-[10px] text-destructive">{parentError}</p>}
              {parentStatus && <p className="font-mono text-[10px] text-muted-foreground">{parentStatus}</p>}
              <Button type="button" variant="terminal" disabled={!profile || importing} onClick={importParentChildren}>{importing ? "READING CHILDREN…" : "IMPORT ALL IMAGE + HTML CHILDREN"}</Button>
            </div>
          </section>

          <section className="border border-border bg-card p-4">
            <h2 className="label text-signal">ADD HTML INSCRIPTION</h2>
            <div className="mt-3 grid gap-2">
              <label className="grid gap-1">
                <span className="label">DISPLAY NAME</span>
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={42} className="h-10 border border-border bg-background px-3 font-mono text-xs" placeholder="WEIRDOS / CUSTOM PFP" />
              </label>
              <label className="grid gap-1">
                <span className="label">INSCRIPTION URL OR ID</span>
                <input value={input} onChange={(event) => setInput(event.target.value)} className="h-10 border border-border bg-background px-3 font-mono text-xs" placeholder="EMPTY = USE THE BITMAP INSCRIPTION" data-no-translate />
              </label>
              {error && <p className="font-mono text-[10px] text-destructive">{error}</p>}
              <Button type="button" variant="terminal" disabled={!profile} onClick={addExtender}>ADD PFP EXTENDER</Button>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

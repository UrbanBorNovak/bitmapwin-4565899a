import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { ORD_TORCHES_PARENT, ORD_TORCHES_POOL, useOrdTorches } from "@/lib/game/ordTorches";
import { PUPPETS_PARENT, PUPPETS_POOL, usePuppets } from "@/lib/game/puppets";
import { JIGGLYPUFF_IDS, JIGGLYPUFF_POOL, useJigglypuff } from "@/lib/game/jigglypuff";
import { OFFICIAL_TRAITS_POOL, traitExtenderPoolQuery } from "@/lib/trait-collections";

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
  const puppets = usePuppets();
  const [puppetPage, setPuppetPage] = useState(0);
  const jigglypuff = useJigglypuff();
  const [jigPage, setJigPage] = useState(0);
  const traits = useQuery(traitExtenderPoolQuery());
  const [traitPage, setTraitPage] = useState(0);
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
                <h2 className="label text-bitcoin">OFFICIAL TRAITS · INDEXED BITMAP POOL</h2>
                <Link to="/traits" className="label hover:text-foreground">VIEW TRAIT INDEX · TRADE →</Link>
                <span className="label block text-muted-foreground">{traits.data?.length ?? "…"} GENUINE INDEXED INSCRIPTIONS</span>
              </div>
              <Button type="button" size="sm" variant={enabled && selectedCollection === OFFICIAL_TRAITS_POOL ? "terminal" : "terminalGhost"} disabled={!profile || !traits.data?.length} onClick={() => updatePlayVisuals({ pfpExtendersEnabled: true, selectedPfpCollection: OFFICIAL_TRAITS_POOL })}>
                {enabled && selectedCollection === OFFICIAL_TRAITS_POOL ? "POOL ACTIVE" : "USE POOL"}
              </Button>
            </header>
            <p className="mb-3 font-mono text-[10px] text-muted-foreground">REAL VALID BITMAP CLAIMS MATCHED BY HEIGHT-PROVABLE BLOCKTRIBUTES · DETERMINISTICALLY DISTRIBUTED ACROSS LIVING CARDS</p>
            {traits.isPending ? <p className="font-mono text-xs text-muted-foreground">&gt; READING TRAIT INDEX…</p> : (
              <>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {(traits.data ?? []).slice(traitPage * 24, traitPage * 24 + 24).map((item) => (
                    <div key={item.inscriptionId} className="relative aspect-square border border-border bg-background p-1">
                      <div className="flex h-full items-center justify-center font-mono text-xs text-bitcoin">{item.bitmapHeight}.BITMAP</div>
                      <Link to="/bitmap/$block" params={{ block: String(item.bitmapHeight) }} className="absolute inset-0" aria-label={`Trait bitmap ${item.bitmapHeight}`} />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Button type="button" variant="terminalGhost" disabled={traitPage === 0} onClick={() => setTraitPage((p) => p - 1)}>PREV</Button>
                  <span className="label text-muted-foreground">PAGE {traitPage + 1} / {Math.max(1, Math.ceil((traits.data?.length ?? 0) / 24))}</span>
                  <Button type="button" variant="terminalGhost" disabled={(traitPage + 1) * 24 >= (traits.data?.length ?? 0)} onClick={() => setTraitPage((p) => p + 1)}>NEXT</Button>
                </div>
              </>
            )}
          </article>
          <article className="border border-bitcoin bg-card p-3">
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="label text-bitcoin">FREE ROSS · ON-CHAIN POOL</h2>
                <span className="label text-muted-foreground">{torches ? torches.list.length : "…"} FOUND ACROSS THE MAP</span>
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
            <p className="mb-3 break-all font-mono text-[10px] text-muted-foreground">PARENT <span data-no-translate>{ORD_TORCHES_PARENT}</span> · ACTIVATE THE POOL TO DISTRIBUTE A DIFFERENT FREE ROSS ACROSS EACH CARD</p>
            {!torches ? <p className="font-mono text-xs text-muted-foreground">&gt; READING ALL CHILDREN…</p> : (
              <>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {torches.list.slice(torchPage * 24, torchPage * 24 + 24).map((t) => (
                    <div key={t.inscriptionId} className="relative aspect-square border border-border bg-background">
                      <iframe src={ordinalsPreviewUrl(t.inscriptionId)} title={`Free Ross #${t.index + 1}`} loading="lazy" sandbox="allow-scripts allow-same-origin" scrolling="no" className="pointer-events-none h-full w-full border-0" />
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
          <article className="border border-bitcoin bg-card p-3">
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="label text-bitcoin">BITMAP EMPORIUM · 717328.BITMAP CHILDREN</h2>
                <span className="label text-muted-foreground">{puppets ? puppets.list.length : "…"} FOUND ACROSS THE MAP</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant={enabled && selectedCollection === PUPPETS_POOL ? "terminal" : "terminalGhost"}
                disabled={!profile || !puppets?.list.length}
                onClick={() => updatePlayVisuals({ pfpExtendersEnabled: true, selectedPfpCollection: PUPPETS_POOL })}
              >
                {enabled && selectedCollection === PUPPETS_POOL ? "POOL ACTIVE" : "USE POOL"}
              </Button>
            </header>
            <p className="mb-3 break-all font-mono text-[10px] text-muted-foreground">PARENT <span data-no-translate>{PUPPETS_PARENT}</span> · ACTIVATE THE POOL TO DISTRIBUTE A DIFFERENT EMPORIUM PIECE ACROSS EACH CARD</p>
            {!puppets ? <p className="font-mono text-xs text-muted-foreground">&gt; READING CHILDREN…</p> : (
              <>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {puppets.list.slice(puppetPage * 24, puppetPage * 24 + 24).map((p) => (
                    <div key={p.inscriptionId} className="relative aspect-square border border-border bg-background">
                      <img src={inscriptionContentUrl(p.inscriptionId)} alt={`Bitmap Emporium #${p.index + 1}`} loading="lazy" className="h-full w-full object-cover [image-rendering:pixelated]" />
                      <Link to="/bitmap/$block" params={{ block: String(p.bitmap) }} className="absolute inset-0" aria-label={`Emporium ${p.index + 1} at ${p.bitmap}.bitmap`} />
                      <span className="label pointer-events-none absolute bottom-0 left-0 bg-background/85 px-1 text-[9px]" data-no-translate>#{p.index + 1} · {p.bitmap}</span>
                    </div>
                  ))}
                </div>
                {puppets.list.length > 24 && (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Button type="button" variant="terminalGhost" disabled={puppetPage === 0} onClick={() => setPuppetPage((p) => p - 1)}>PREV</Button>
                    <span className="label text-muted-foreground">PAGE {puppetPage + 1} / {Math.max(1, Math.ceil(puppets.list.length / 24))}</span>
                    <Button type="button" variant="terminalGhost" disabled={(puppetPage + 1) * 24 >= puppets.list.length} onClick={() => setPuppetPage((p) => p + 1)}>NEXT</Button>
                  </div>
                )}
              </>
            )}
          </article>
          <article className="border border-bitcoin bg-card p-3">
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="label text-bitcoin">JIGGLYPUFF · HARDCODED POOL</h2>
                <Link to="/collections/jigglypuff" className="label hover:text-foreground">VIEW COLLECTION · TRADE →</Link>
                <span className="label text-muted-foreground">{jigglypuff.list.length} INSCRIPTIONS · HOLDERS GET MEMBER STATUS</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant={enabled && selectedCollection === JIGGLYPUFF_POOL ? "terminal" : "terminalGhost"}
                disabled={!profile}
                onClick={() => updatePlayVisuals({ pfpExtendersEnabled: true, selectedPfpCollection: JIGGLYPUFF_POOL })}
              >
                {enabled && selectedCollection === JIGGLYPUFF_POOL ? "POOL ACTIVE" : "USE POOL"}
              </Button>
            </header>
            <p className="mb-3 font-mono text-[10px] text-muted-foreground">
              A FIXED LIST OF {JIGGLYPUFF_IDS.length} INSCRIPTIONS SHIPPED WITH THE APP · ACTIVATE THE POOL TO DISTRIBUTE ONE ACROSS EACH CARD
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {jigglypuff.list.slice(jigPage * 24, jigPage * 24 + 24).map((j) => (
                <div key={j.inscriptionId} className="relative aspect-square border border-border bg-background">
                  <img src={inscriptionContentUrl(j.inscriptionId)} alt={`Jigglypuff #${j.index + 1}`} loading="lazy" className="h-full w-full object-cover [image-rendering:pixelated]" />
                  <Link to="/bitmap/$block" params={{ block: String(j.bitmap) }} className="absolute inset-0" aria-label={`Jigglypuff ${j.index + 1} at ${j.bitmap}.bitmap`} />
                  <span className="label pointer-events-none absolute bottom-0 left-0 bg-background/85 px-1 text-[9px]" data-no-translate>#{j.index + 1} · {j.bitmap}</span>
                </div>
              ))}
            </div>
            {jigglypuff.list.length > 24 && (
              <div className="mt-3 flex items-center justify-between gap-2">
                <Button type="button" variant="terminalGhost" disabled={jigPage === 0} onClick={() => setJigPage((p) => p - 1)}>PREV</Button>
                <span className="label text-muted-foreground">PAGE {jigPage + 1} / {Math.max(1, Math.ceil(jigglypuff.list.length / 24))}</span>
                <Button type="button" variant="terminalGhost" disabled={(jigPage + 1) * 24 >= jigglypuff.list.length} onClick={() => setJigPage((p) => p + 1)}>NEXT</Button>
              </div>
            )}
          </article>
          {pools.map(([collection, items]) => (
            <ExtenderPool key={collection} collection={collection} items={items} enabled={enabled} selectedCollection={selectedCollection} profileReady={Boolean(profile)} />
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
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={42} className="h-10 border border-border bg-background px-3 font-mono text-xs" placeholder="CUSTOM PFP NAME" />
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

function ExtenderPool({ collection, items, enabled, selectedCollection, profileReady }: {
  collection: string;
  items: CardVisualExtender[];
  enabled: boolean;
  selectedCollection: string | null;
  profileReady: boolean;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / 24));
  const safePage = Math.min(page, pageCount - 1);
  const active = enabled && selectedCollection === collection;
  return (
    <article className="border border-border bg-card p-3">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="label text-bitcoin">{collection}</h2>
          <span className="label text-muted-foreground">{items.length} BACKGROUNDS · {items.filter((item) => item.source === "ordinals-html").length} HTML</span>
        </div>
        <Button type="button" size="sm" variant={active ? "terminal" : "terminalGhost"} disabled={!profileReady} onClick={() => updatePlayVisuals({ pfpExtendersEnabled: true, selectedPfpCollection: collection, selectedPfpExtenderId: items[0]?.id ?? null })}>
          {active ? "POOL ACTIVE" : "USE POOL"}
        </Button>
      </header>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {items.slice(safePage * 24, safePage * 24 + 24).map((extender) => (
          <div key={extender.id} className={`group relative aspect-square border bg-background ${active ? "border-bitcoin" : "border-border"}`}>
            {extender.source === "ordinals-image" ? (
              <img src={inscriptionContentUrl(extender.inscriptionId)} alt={extender.name} loading="lazy" className="h-full w-full object-cover [image-rendering:pixelated]" />
            ) : (
              <iframe src={ordinalsPreviewUrl(extender.inscriptionId)} title={extender.name} loading="lazy" sandbox="allow-scripts allow-same-origin" scrolling="no" className="pointer-events-none h-full w-full border-0" />
            )}
            <span className="label pointer-events-none absolute bottom-0 left-0 bg-background/85 px-1 text-[9px]">{extender.source === "ordinals-html" ? "HTML" : "IMG"}{active ? " · POOL" : ""}</span>
            {!extender.builtIn && (
              <button type="button" aria-label={`Remove ${extender.name}`} disabled={!profileReady} onClick={() => removeCustomPfpExtender(extender.id)} className="label absolute right-0 top-0 hidden bg-background/90 px-1.5 group-hover:block">×</button>
            )}
          </div>
        ))}
      </div>
      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <Button type="button" variant="terminalGhost" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>PREV</Button>
          <span className="label text-muted-foreground">PAGE {safePage + 1} / {pageCount}</span>
          <Button type="button" variant="terminalGhost" disabled={safePage + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>NEXT</Button>
        </div>
      )}
    </article>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LivingCard } from "@/components/play/LivingCard";
import { PlayNav } from "@/components/play/PlayNav";
import { Button } from "@/components/ui/button";
import {
  allPfpExtenders,
  normalizeInscriptionInput,
  ordinalsPreviewUrl,
} from "@/lib/game/pfpExtenders";
import {
  addCustomPfpExtender,
  removeCustomPfpExtender,
  updatePlayVisuals,
  usePlayProfile,
} from "@/lib/game/worldState";

export const Route = createFileRoute("/play/extenders")({
  head: () => ({
    meta: [
      { title: "PFP Extenders — BITMAPWIN // PLAY" },
      { name: "description", content: "Optional Ordinals HTML PFP extenders for living card art inside BitmapWin PLAY." },
      { property: "og:title", content: "Ordinals PFP Extenders — BITMAPWIN // PLAY" },
      { property: "og:description", content: "Extend living cards with safe HTML inscription previews while keeping BITMAP state intact." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlayExtenders,
});

function PlayExtenders() {
  const profile = usePlayProfile();
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const extenders = useMemo(() => allPfpExtenders(profile?.visuals), [profile?.visuals]);
  const selected = extenders.find((extender) => extender.id === profile?.visuals.selectedPfpExtenderId) ?? extenders[0] ?? null;
  const previewCard = profile?.order.map((id) => profile.cards[id]).find(Boolean) ?? null;
  const enabled = profile?.visuals.pfpExtendersEnabled === true;

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

  return (
    <main className="play-district mx-auto max-w-[1200px] overflow-x-hidden px-4 py-8 md:px-8">
      <PlayNav />
      <header className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="label text-signal">OPTIONAL VISUAL EXTENDERS</p>
          <h1 className="display mt-2 text-3xl md:text-5xl">ORDINALS PFP HTML</h1>
          <p className="mt-3 max-w-2xl font-mono text-xs leading-relaxed text-muted-foreground">
            Load popular PFP inscriptions as HTML card art. The extender changes only the image layer; BITMAP state, traits, history and match rules stay untouched.
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
        <section className="grid gap-3">
          {extenders.map((extender) => {
            const active = enabled && selected?.id === extender.id;
            return (
              <article key={extender.id} className={`border bg-card ${active ? "border-bitcoin" : "border-border"}`}>
                <div className="grid gap-px bg-border md:grid-cols-[13rem_minmax(0,1fr)]">
                  <div className="pfp-extender-preview relative aspect-square bg-background">
                    <iframe
                      src={ordinalsPreviewUrl(extender.inscriptionId)}
                      title={`${extender.name} preview`}
                      loading="lazy"
                      sandbox="allow-scripts"
                      scrolling="no"
                      className="h-full w-full border-0"
                    />
                  </div>
                  <div className="bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="label text-bitcoin">{extender.collection}</p>
                        <h2 className="display mt-1 text-xl">{extender.name}</h2>
                      </div>
                      <span className="label border border-border px-2 py-1">{extender.builtIn ? "BUILT IN" : "CUSTOM"}</span>
                    </div>
                    <dl className="mt-4 grid gap-2 font-mono text-[10px] sm:grid-cols-2">
                      <div className="border border-border px-2 py-1.5"><dt className="text-muted-foreground">SOURCE</dt><dd>ORDINALS HTML</dd></div>
                      <div className="border border-border px-2 py-1.5"><dt className="text-muted-foreground">INSCRIPTION</dt><dd className="truncate" data-no-translate>{extender.inscriptionId}</dd></div>
                    </dl>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" variant={active ? "terminal" : "terminalGhost"} disabled={!profile} onClick={() => updatePlayVisuals({ pfpExtendersEnabled: true, selectedPfpExtenderId: extender.id })}>
                        {active ? "ACTIVE ON CARDS" : "USE ON CARDS"}
                      </Button>
                      {!extender.builtIn && (
                          <Button type="button" variant="terminalGhost" disabled={!profile} onClick={() => removeCustomPfpExtender(extender.id)}>
                          REMOVE
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
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
            <h2 className="label text-signal">ADD HTML INSCRIPTION</h2>
            <div className="mt-3 grid gap-2">
              <label className="grid gap-1">
                <span className="label">DISPLAY NAME</span>
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={42} className="h-10 border border-border bg-background px-3 font-mono text-xs" placeholder="WEIRDOS / CUSTOM PFP" />
              </label>
              <label className="grid gap-1">
                <span className="label">INSCRIPTION URL OR ID</span>
                <input value={input} onChange={(event) => setInput(event.target.value)} className="h-10 border border-border bg-background px-3 font-mono text-xs" placeholder="https://ordinals.com/inscription/..." data-no-translate />
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

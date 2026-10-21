import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RELIC_KINDS, RELIC_LABEL, relicMasterHtml, relicMetadata, verifyRelic, type RelicKind } from "@/lib/marauder-relics";

const TITLE = "Marauder Relics — dev9's BITMAP Collection";
const DESC = "Lean on-chain voxel relics: one master viewer, each relic a child of its BITMAP, derived only from the block height.";

export const Route = createFileRoute("/collections/relics")({
  head: () => ({ meta: [
    { title: TITLE }, { name: "description", content: DESC },
    { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Relics,
});

function Relics() {
  const [kind, setKind] = useState<RelicKind>("keycard");
  const [hText, setHText] = useState("840000");
  const height = Number(hText);
  const valid = Number.isInteger(height) && height >= 0;
  const meta = useMemo(() => (valid ? relicMetadata(kind, height) : null), [kind, height, valid]);
  const html = useMemo(() => (meta ? relicMasterHtml(meta) : ""), [meta]);
  const check = meta ? verifyRelic(meta) : null;
  const json = meta ? JSON.stringify(meta) : "";

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 font-sans">
      <p className="font-mono text-xs text-accent">COLLECTION · UNDER BITMAP</p>
      <h1 className="font-display text-4xl text-primary">MARAUDER RELICS</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">dev9's rules: one master viewer inscribed once, every relic inscribes no code, names its BITMAP as parent, and carries only its voxels. The relic is worked out from the block height, so anyone can check it.</p>

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-md border border-border bg-card">
          {meta ? <iframe title="Relic preview" srcDoc={html} sandbox="allow-scripts" className="aspect-square w-full border-0" />
            : <div className="grid aspect-square place-items-center font-mono text-sm text-muted-foreground">ENTER A BLOCK HEIGHT</div>}
        </div>
        <div className="space-y-4 font-mono text-xs">
          <label className="block">BITMAP HEIGHT
            <input value={hText} onChange={(e) => setHText(e.target.value.replace(/\D/g, ""))} inputMode="numeric"
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            {RELIC_KINDS.map((k) => (
              <button key={k} onClick={() => setKind(k)}
                className={`rounded border px-2 py-2 ${k === kind ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{RELIC_LABEL[k]}</button>
            ))}
          </div>
          {meta && <>
            <p className="text-accent">{check?.ok ? "✓ MATCHES THE BLOCK" : "✗ DOES NOT MATCH"} · {meta.v.split(";").length} VOXELS · 1 DRAW</p>
            <div>
              <p className="text-muted-foreground">RELIC DATA (TAG 5) · {json.length} BYTES</p>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-background p-2 text-[10px]">{json}</pre>
            </div>
            <p className="text-muted-foreground">PARENT: {height}.bitmap · VIEWER: master (not yet inscribed)</p>
          </>}
        </div>
      </div>
    </main>
  );
}

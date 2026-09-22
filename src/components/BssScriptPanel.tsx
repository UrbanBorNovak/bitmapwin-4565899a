/**
 * BSS panel for the land page: what the on-chain scene of this BITMAP contains.
 */

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Map } from "lucide-react";
import { bssSceneQuery } from "@/lib/bss";
import { atlasPlace } from "@/lib/atlas-places";
import { Button } from "@/components/ui/button";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-card px-4 py-3">
      <p className="label text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-mono text-sm text-foreground">{value}</p>
    </div>
  );
}

export function BssScriptPanel({ height }: { height: number }) {
  const query = useQuery(bssSceneQuery(height));
  const load = query.data;
  const district = atlasPlace(height);

  return (
    <section aria-label="Bitmap Sunset Script" className="border border-border bg-background">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="label text-foreground">ON-CHAIN SCENE · BSS</h2>
        <p className="label text-muted-foreground">BITMAP SUNSET SCRIPT</p>
      </header>

      {query.isPending ? (
        <p className="px-4 py-4 font-mono text-sm text-muted-foreground">
          READING THIS BITMAP'S SCRIPT FROM THE CHAIN…
        </p>
      ) : !load || load.status === "none" ? (
        <p className="px-4 py-4 font-mono text-sm text-muted-foreground">
          {load?.reason?.toUpperCase() ?? "NO SCENE INSCRIBED ON THIS BITMAP YET"}
        </p>
      ) : load.status === "error" ? (
        <div className="px-4 py-4">
          <p className="font-mono text-sm text-signal">CANNOT DECODE · {load.reason.toUpperCase()}</p>
          {load.source ? (
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{load.source}</p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
            <Row label="BSS VERSION" value={load.scene.versionLabel} />
            <Row label="OBJECTS" value={String(load.scene.objects.length)} />
            <Row label="RESOURCES" value={String(load.scene.resources.length)} />
            <Row
              label="VALIDATION"
              value={
                load.scene.ok
                  ? `VALID · ${load.scene.consumed}/${load.scene.declaredSize} BYTES`
                  : "FAILED CHECKS"
              }
            />
          </div>
          <div className="bg-card px-4 py-3">
            <p className="label text-muted-foreground">BMP SOURCE</p>
            <a
              className="mt-1 block truncate font-mono text-xs text-bitcoin hover:underline"
              href={`https://ordinals.com/inscription/${load.scene.source}`}
              target="_blank"
              rel="noreferrer"
            >
              {load.scene.source}
            </a>
            {load.scene.blockTarget !== null ? (
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                SCRIPT TARGET · {load.scene.blockTarget}.BITMAP
              </p>
            ) : null}
          </div>
          {load.scene.diagnostics.length > 0 ? (
            <ul className="space-y-1">
              {load.scene.diagnostics.map((note) => (
                <li key={note} className="font-mono text-xs text-signal">
                  {note.toUpperCase()}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="font-mono text-xs text-muted-foreground">
            THE SCENE IS READ AS DATA AND DRAWN IN THE OASIS ON THIS LAND — NOTHING ON CHAIN IS EXECUTED.
          </p>
          <Button asChild variant="terminalGhost" size="sm">
            <Link to="/map/district/$slug" params={{ slug: district.slug }}>
              <Map /> {district.name} CHAPTER
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}

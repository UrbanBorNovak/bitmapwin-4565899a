import { useState } from "react";
import { ExternalLink, Maximize2, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WORLD_ENGINE_LABEL, worldContentUrl, worldInscriptionUrl, type WorldEngine } from "@/lib/inscribed-world";

/**
 * Runs an inscribed HTML world straight from ordinals.com inside a sandboxed
 * frame (scripts only — no access to this site, wallet or storage). Starts on
 * click so a page with several worlds never boots several engines at once.
 */
export function InscribedWorldRunner({
  id,
  engine,
  title,
  description,
  backgroundId,
  height = 480,
}: {
  id: string;
  engine: WorldEngine;
  title: string | null;
  description?: string | null;
  backgroundId?: string | null;
  height?: number;
}) {
  const [running, setRunning] = useState(false);
  const src = worldContentUrl(id);
  return (
    <div className="border border-border bg-card/60 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-2">
        <div className="min-w-0">
          <div className="label text-signal">{WORLD_ENGINE_LABEL[engine]} · ON-CHAIN WORLD</div>
          <div className="truncate font-display text-sm">{title || "UNTITLED WORLD"}</div>
        </div>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant={running ? "outline" : "default"} onClick={() => setRunning((r) => !r)}>
            {running ? <><Square /> STOP</> : <><Play /> RUN WORLD</>}
          </Button>
          <Button asChild size="icon" variant="ghost" aria-label="Open full screen">
            <a href={src} target="_blank" rel="noreferrer"><Maximize2 /></a>
          </Button>
          <Button asChild size="icon" variant="ghost" aria-label="View inscription on ordinals.com">
            <a href={worldInscriptionUrl(id)} target="_blank" rel="noreferrer"><ExternalLink /></a>
          </Button>
        </div>
      </div>
      <div className="relative bg-background" style={{ height }}>
        {running ? (
          <iframe
            title={title || "Inscribed world"}
            src={src}
            sandbox="allow-scripts allow-pointer-lock"
            allow="fullscreen; gamepad"
            className="h-full w-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setRunning(true)}
            className="group flex h-full w-full flex-col items-center justify-center gap-3 bg-cover bg-center"
            style={backgroundId ? { backgroundImage: `url(${worldContentUrl(backgroundId)})` } : undefined}
          >
            <span className="flex items-center gap-2 border border-border bg-background/80 px-4 py-2 font-mono text-xs backdrop-blur-md group-hover:border-bitcoin">
              <Play className="size-4" /> CLICK TO LOAD WORLD
            </span>
            {description ? <span className="max-w-md bg-background/70 px-2 font-mono text-[11px] text-muted-foreground">{description}</span> : null}
          </button>
        )}
      </div>
      <div className="border-t border-border px-2 py-1 font-mono text-[10px] text-muted-foreground" data-no-translate>{id}</div>
    </div>
  );
}

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

/**
 * TERRITORY SHARE CARD — the 5-second social object of the build loop.
 *
 * Renders a terminal provenance card for one BITMAP and its creation, plus
 * one-tap share, copy and image-export actions. Text is composed from real
 * passed-in territory facts; nothing here invents data.
 */

export type TerritoryShareCardProps = {
  height: number;
  /** Name of the creation standing on the land, when one exists. */
  title?: string | null;
  /** Short capability tags, e.g. ["TAVERN", "QUEST HUB"]. */
  tags?: string[];
  /** Place name from the atlas, when known. */
  placeName?: string | null;
  /** Verified trait labels derived from the block height (chain math only). */
  traits?: string[];
  /** Live preview of the BITMAP (e.g. its block mosaic). */
  preview?: ReactNode;
  /** Transaction count from block records, when known. */
  txCount?: number | null;
  className?: string;
};

function canonicalOrigin(): string {
  if (typeof window === "undefined") return "https://bitmapwin.app";
  const { origin } = window.location;
  return origin.includes("localhost") || origin.includes("lovable.app")
    ? "https://bitmapwin.app"
    : origin;
}

export function TerritoryShareCard({
  height,
  title = null,
  tags = [],
  placeName = null,
  traits = [],
  preview = null,
  txCount = null,
  className = "",
}: TerritoryShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [busy, setBusy] = useState(false);

  const url = `${canonicalOrigin()}/bitmap/${height}`;
  const headline = title?.trim() || placeName?.trim() || `${height}.BITMAP`;
  const tagLine = useMemo(
    () => tags.filter(Boolean).map((t) => t.toUpperCase()).slice(0, 4).join(" // "),
    [tags],
  );

  const traitLine = traits.slice(0, 3).join(" · ");
  const postText = title
    ? `I just built ${headline} on BITMAP #${height} in BitmapWin. Enter the Oasis:`
    : `${height}.bitmap${traitLine ? ` — ${traitLine}` : ""}. Bitcoin land you can walk into:`;

  const share = useCallback(() => {
    const intent = `https://x.com/intent/post?text=${encodeURIComponent(`${postText} `)}&url=${encodeURIComponent(url)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
  }, [postText, url]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast("LINK COPIED", { description: url });
    } catch {
      toast("COULD NOT COPY", { description: url });
    }
  }, [postText, url]);

  const exportImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    try {
      const W = 1200;
      const H = 630;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const ink = "#0a0a0b";
      const orange = "#f7931a";
      const paper = "#f4f4f2";
      const dim = "#8a8a86";

      ctx.fillStyle = ink;
      ctx.fillRect(0, 0, W, H);

      // hairline frame
      ctx.strokeStyle = "#2a2a2c";
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 40, W - 80, H - 80);

      // dotted instrument grid
      ctx.fillStyle = "#17171a";
      for (let x = 60; x < W - 60; x += 24) {
        for (let y = 60; y < H - 60; y += 24) ctx.fillRect(x, y, 2, 2);
      }

      ctx.fillStyle = orange;
      ctx.fillRect(72, 82, 14, 14);
      ctx.font = "700 20px 'JetBrains Mono', monospace";
      ctx.fillText("BITMAPWIN // TERRITORY PROVENANCE", 100, 96);

      ctx.fillStyle = dim;
      ctx.font = "700 22px 'JetBrains Mono', monospace";
      ctx.fillText(`BITMAP #${height}`, 72, 190);

      ctx.fillStyle = paper;
      ctx.font = "700 76px 'Space Grotesk', Arial, sans-serif";
      const name = headline.toUpperCase().slice(0, 26);
      ctx.fillText(name, 72, 280);

      if (tagLine) {
        ctx.fillStyle = orange;
        ctx.font = "700 22px 'JetBrains Mono', monospace";
        ctx.fillText(tagLine.slice(0, 60), 72, 336);
      }

      if (placeName && headline !== placeName) {
        ctx.fillStyle = dim;
        ctx.font = "400 22px 'DM Sans', Arial, sans-serif";
        ctx.fillText(placeName.toUpperCase().slice(0, 48), 72, 384);
      }


      if (traits.length) {
        ctx.fillStyle = paper;
        ctx.font = "700 20px 'JetBrains Mono', monospace";
        ctx.fillText(`VERIFIED: ${traits.slice(0, 5).join(" · ")}`.toUpperCase().slice(0, 80), 72, 430);
      }
      if (txCount != null) {
        ctx.fillStyle = dim;
        ctx.font = "700 18px 'JetBrains Mono', monospace";
        ctx.fillText(`${txCount.toLocaleString("en-US")} TX`, W - 220, 190);
      }

      ctx.strokeStyle = "#2a2a2c";
      ctx.beginPath();
      ctx.moveTo(72, 470);
      ctx.lineTo(W - 72, 470);
      ctx.stroke();

      ctx.fillStyle = paper;
      ctx.font = "700 26px 'JetBrains Mono', monospace";
      ctx.fillText("ENTER THE OASIS →", 72, 522);
      ctx.fillStyle = dim;
      ctx.font = "400 20px 'DM Sans', Arial, sans-serif";
      ctx.fillText("BUILT ON BITCOIN · BITMAPWIN.APP", 72, 558);

      const link = document.createElement("a");
      link.download = `bitmapwin-${height}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast("CARD EXPORTED", { description: `bitmapwin-${height}.png` });
    } finally {
      setBusy(false);
    }
  }, [headline, height, placeName, tagLine, traits, txCount]);

  return (
    <div className={`border border-border-strong bg-surface ${className}`}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <span className="size-2 bg-bitcoin" aria-hidden="true" />
        <span className="label text-bitcoin">TERRITORY PROVENANCE · SHARE CARD</span>
      </div>

      <div className={`relative overflow-hidden p-5 ${preview ? "grid gap-5 sm:grid-cols-[160px_minmax(0,1fr)]" : ""}`}>
        <div className="pointer-events-none absolute inset-0 dot-bg" />
        {preview ? <div className="relative w-full max-w-[160px]">{preview}</div> : null}
        <div className="relative">
          <div className="label text-muted-foreground" data-no-translate>
            BITMAP #{height}
          </div>
          <div className="display mt-2 text-2xl leading-none md:text-4xl">{headline.toUpperCase()}</div>
          {tagLine ? (
            <div className="mt-3 font-mono text-[11px] font-bold text-bitcoin" data-no-translate>
              {tagLine}
            </div>
          ) : null}
          {traits.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5" data-no-translate>
              {traits.map((t) => (
                <span key={t} className="border border-signal/40 px-1.5 py-0.5 font-mono text-[10px] font-bold text-signal">
                  ✓ {t.toUpperCase()}
                </span>
              ))}
            </div>
          ) : null}
          {txCount != null ? (
            <div className="mt-2 font-mono text-[10px] text-muted-foreground" data-no-translate>{txCount.toLocaleString("en-US")} TX</div>
          ) : null}
          {placeName && headline !== placeName ? (
            <div className="mt-2 font-mono text-[10px] text-muted-foreground">{placeName.toUpperCase()}</div>
          ) : null}

          <div className="mt-5 border-t border-border pt-3 font-mono text-[10px] text-muted-foreground">
            BUILT ON BITCOIN · ENTER THE OASIS → <span data-no-translate>{url.replace("https://", "")}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border p-3">
        <button type="button" className="btn-term" onClick={share}>
          [ SHARE TO X ]
        </button>
        <button type="button" className="btn-term-ghost" onClick={() => void copy()}>
          [ COPY LINK ]
        </button>
        <button type="button" className="btn-term-ghost" disabled={busy} onClick={exportImage}>
          {busy ? "[ EXPORTING… ]" : "[ EXPORT CARD ]"}
        </button>
      </div>
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
    </div>
  );
}

import { useEffect, useState } from "react";
import { GENESIS_BROADCASTER as G } from "@/lib/genesis-broadcaster";

/** Flat 2D cinema player for Dabber's stream — clickable controls, unlike the 3D stage screen. */
export function StreamTheaterButton() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  return (
    <>
      <button className="glass-panel rounded border border-primary px-2 py-1 text-primary" onClick={() => setOpen(true)}>
        [🔊 LISTEN TO DABBER]
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="glass-panel w-full max-w-4xl rounded border border-border p-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between font-mono text-xs">
              <span className="text-accent">● LIVE · 145159.BITMAP.STREAM</span>
              <div className="flex gap-2">
                <a href={G.channelUrl} target="_blank" rel="noreferrer" className="rounded border border-border px-2 py-1">[OPEN CHANNEL ↗]</a>
                <button className="rounded border border-border px-2 py-1" onClick={() => setOpen(false)}>[X]</button>
              </div>
            </div>
            <div className="relative aspect-video w-full overflow-hidden rounded border border-border">
              <iframe src={G.embedUrl} title="Elevated Dabber live on bitmap.stream" className="absolute inset-0 h-full w-full" style={{ border: 0 }} allow="autoplay; fullscreen" allowFullScreen />
            </div>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">Browsers start the stream muted — tap the speaker icon in the player to hear sound.</p>
          </div>
        </div>
      )}
    </>
  );
}

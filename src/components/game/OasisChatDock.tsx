import { useEffect, useState } from "react";
import { MapChat } from "@/components/MapChat";
import type { MapCursor } from "@/lib/map-presence";

/** World chat for the Oasis. Enter opens, Esc closes; typing never moves the player. */
export function OasisChatDock({ cursors }: { cursors: MapCursor[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "Enter" && !open) { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div
      className="pointer-events-auto absolute bottom-24 left-3 z-40 w-[min(22rem,80vw)]"
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") setOpen(false); }}
      onKeyUp={(e) => e.stopPropagation()}
    >
      {open ? (
        <div className="border border-border bg-background/85 backdrop-blur">
          <div className="flex items-center justify-between border-b border-border px-2 py-1 font-mono text-[9px] tracking-[0.2em] text-signal">
            <span>WORLD CHAT</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-bitcoin">ESC ✕</button>
          </div>
          <MapChat cursors={cursors} className="max-h-72" />
        </div>
      ) : (
        <button onClick={() => setOpen(true)}
          className="border border-border bg-background/80 px-2 py-1 font-mono text-[9px] tracking-[0.2em] text-muted-foreground backdrop-blur hover:border-signal hover:text-signal">
          💬 CHAT · ENTER
        </button>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { MapChat } from "@/components/MapChat";
import { BitchatChannel } from "@/components/game/BitchatChannel";
import type { MapCursor } from "@/lib/map-presence";

/** World chat for the Oasis. Enter opens, Esc closes; typing never moves the player. */
export function OasisChatDock({ cursors }: { cursors: MapCursor[] }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"world" | "bitchat">("world");
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
      className="pointer-events-auto fixed bottom-24 right-3 z-40 w-[min(22rem,86vw)]"
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") setOpen(false); }}
      onKeyUp={(e) => e.stopPropagation()}
    >
      {open ? (
        <div className="border border-border bg-background/85 backdrop-blur">
          <div className="flex items-center justify-between gap-2 border-b border-border p-1.5 font-mono text-[11px] tracking-[0.15em]">
            <span className="flex gap-1" role="tablist">
              {(["world", "bitchat"] as const).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                  className={`border px-2.5 py-1 ${tab === t ? "border-signal bg-signal/10 text-signal" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  {t === "world" ? "WORLD" : "BITCHAT"}
                </button>
              ))}
            </span>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="px-2 py-1 text-muted-foreground hover:text-bitcoin">✕</button>
          </div>
          {tab === "world" ? <MapChat cursors={cursors} className="max-h-72" /> : <div className="max-h-[55vh] overflow-y-auto"><BitchatChannel /></div>}
        </div>
      ) : (
        <button onClick={() => setOpen(true)}
          className="border border-border bg-background/80 px-2 py-1 font-mono text-[9px] tracking-[0.2em] text-muted-foreground backdrop-blur hover:border-signal hover:text-signal">
          💬 CHAT · BITCHAT
        </button>
      )}
    </div>
  );
}

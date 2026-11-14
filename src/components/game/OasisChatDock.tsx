import { useEffect, useState } from "react";
import { MapChat } from "@/components/MapChat";
import { BitchatChannel } from "@/components/game/BitchatChannel";
import { OasisRadio } from "@/components/game/OasisRadio";
import type { MapCursor } from "@/lib/map-presence";

/**
 * World chat + BitChat for the Oasis. Enter opens, Esc closes; typing never moves the player.
 * Desktop: bottom-right above the nav dock. Phones / narrow windows: pinned under the top bar on
 * the right, and the open panel stops above the touch pads and bottom toolbar
 * (--oasis-touch-reserve) so it never covers the Oasis controls or its own message box.
 */
export function OasisChatDock({ cursors, compact = false }: { cursors: MapCursor[]; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"world" | "radio" | "bitchat">("world");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "Enter" && !open) { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const top = "top-[4.25rem] max-h-[calc(100%-4.75rem-var(--oasis-touch-reserve,15rem))]";
  const place = compact
    ? `right-2 ${open ? "left-2" : ""} ${top}`
    : `right-2 ${open ? "left-2 md:left-auto" : ""} ${top} md:top-auto md:bottom-24 md:right-3 md:max-h-[min(30rem,calc(100%-8rem))]`;
  const width = open ? (compact ? "" : "md:w-[22rem]") : "";

  const openTab = (t: "world" | "radio" | "bitchat") => { setTab(t); setOpen(true); };

  return (
    <div
      className={`pointer-events-auto absolute z-[96] flex flex-col ${place} ${width}`}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") setOpen(false); }}
      onKeyUp={(e) => e.stopPropagation()}
    >
      {open ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-border bg-background/90 backdrop-blur">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-1.5 font-mono text-[11px] tracking-[0.15em]">
            <span className="flex gap-1" role="tablist">
              {(["world", "radio", "bitchat"] as const).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                  className={`border px-2.5 py-1 ${tab === t ? "border-signal bg-signal/10 text-signal" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  {t === "world" ? "WORLD" : t === "radio" ? "📻 RADIO" : "BITCHAT"}
                </button>
              ))}
            </span>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="px-2 py-1 text-muted-foreground hover:text-bitcoin">✕</button>
          </div>
          {tab === "world" ? (
            <MapChat cursors={cursors} className="min-h-0 flex-1 border-0" listClassName="min-h-12 max-h-72" />
          ) : tab === "radio" ? (
            <OasisRadio />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto"><BitchatChannel /></div>
          )}
        </div>
      ) : (
        <div className="flex justify-end gap-1.5">
          <button onClick={() => openTab("world")}
            className="border border-border bg-background/80 px-2.5 py-1.5 font-mono text-[10px] tracking-[0.2em] text-muted-foreground backdrop-blur hover:border-signal hover:text-signal">
            💬 CHAT
          </button>
          <button onClick={() => openTab("radio")}
            className="border border-bitcoin/60 bg-background/80 px-2.5 py-1.5 font-mono text-[10px] tracking-[0.2em] text-bitcoin backdrop-blur hover:bg-bitcoin/10">
            📻 RADIO
          </button>
          <button onClick={() => openTab("bitchat")}
            className="border border-signal/60 bg-background/80 px-2.5 py-1.5 font-mono text-[10px] tracking-[0.2em] text-signal backdrop-blur hover:bg-signal/10">
            ⚡ BITCHAT
          </button>
        </div>
      )}
    </div>
  );
}

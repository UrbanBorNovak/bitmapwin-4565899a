import { useEffect, useState } from "react";
import { isTouchDevice } from "@/lib/touch-input";

const SEEN_KEY = "bitmapwin:oasis-controls-hint-seen";
const SHOW_MS = 6000;
const MOVE_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

/** First-visit control cue over the Oasis; fades after a few seconds or on first move. */
export function OasisControlsHint({ forceOpen, onClosed }: { forceOpen?: number; onClosed?: () => void }) {
  const [open, setOpen] = useState(false);
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    setTouch(isTouchDevice());
    if (!window.localStorage.getItem(SEEN_KEY)) setOpen(true);
  }, []);
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      window.localStorage.setItem(SEEN_KEY, "1");
      setOpen(false);
      onClosed?.();
    };
    const t = window.setTimeout(close, SHOW_MS);
    const onKey = (e: KeyboardEvent) => { if (MOVE_KEYS.has(e.code)) close(); };
    // Give the tap that opened the world a moment before touches count as movement.
    const arm = window.setTimeout(() => window.addEventListener("touchstart", close, { passive: true }), 800);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(arm);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", close);
    };
  }, [open, onClosed]);

  if (!open) return null;
  const rows: [string, string][] = touch
    ? [["LEFT THUMB", "Drag the stick to walk · push past the rim to sprint"], ["RIGHT SIDE", "Swipe to look around"], ["BUTTONS", "Jump and act on the right"], ["TAP", "Tap a BITMAP to inspect it"]]
    : [["W A S D", "Walk · arrow keys work too"], ["SHIFT · SPACE", "Sprint · jump"], ["MOUSE", "Drag to look · scroll to zoom"], ["CLICK", "Click a BITMAP to inspect it · ` hides the HUD"]];

  return (
    <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-3 bottom-28 z-[90] flex justify-center md:bottom-24">
      <div className="hud-panel pointer-events-auto w-full max-w-md overflow-hidden font-mono text-[11px]">
        <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-1.5">
          <span className="label text-signal">FIRST STEPS · CONTROLS</span>
          <button type="button" onClick={() => { window.localStorage.setItem(SEEN_KEY, "1"); setOpen(false); onClosed?.(); }} className="label text-bitcoin hover:text-foreground">GOT IT</button>
        </div>
        <ul className="space-y-1 px-3 py-2">
          {rows.map(([k, v]) => (
            <li key={k} className="grid grid-cols-[7.5rem_1fr] gap-2 leading-normal">
              <span className="text-bitcoin" data-no-translate>{k}</span>
              <span className="text-muted-foreground">{v}</span>
            </li>
          ))}
          <li className="pt-1 leading-normal text-foreground">Quests and the Biternam hub start at 0.BITMAP — follow the markers.</li>
        </ul>
        <div className="h-px bg-signal origin-left" style={{ animation: `oasis-hint-bar ${SHOW_MS}ms linear forwards` }} />
        <style>{`@keyframes oasis-hint-bar{from{transform:scaleX(1)}to{transform:scaleX(0)}}`}</style>
      </div>
    </div>
  );
}

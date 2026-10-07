import { useEffect, useRef, useState } from "react";
import { touchPad } from "@/lib/touch-input";

/**
 * Play controls for the in-post (X / Twitter) embed. Iframes there can't lock
 * the mouse and X keeps keyboard focus until the card is clicked, so:
 * - any click focuses the frame so WASD / arrows / space reach the world;
 * - click-drag anywhere turns the camera (writes the shared look delta);
 * - an on-screen pad walks with mouse or thumb.
 */
export function EmbedPlayControls() {
  const [hint, setHint] = useState(true);
  const [foe, setFoe] = useState({ inRange: false, ready: true });
  const [full, setFull] = useState(false);
  const [first, setFirst] = useState(false);
  useEffect(() => {
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    const onCam = (e: Event) => setFirst((e as CustomEvent<string>).detail === "first");
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("oasis:camera", onCam);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("oasis:camera", onCam);
    };
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    const t = window.setTimeout(() => setHint(false), 6000);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    const on = (e: Event) => setFoe((e as CustomEvent<{ inRange: boolean; ready: boolean }>).detail);
    window.addEventListener("oasis:foe", on);
    return () => window.removeEventListener("oasis:foe", on);
  }, []);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const isUi = (t: EventTarget | null) =>
      t instanceof HTMLElement && Boolean(t.closest("a,button,input,textarea,[data-embed-pad]"));
    const down = (e: PointerEvent) => {
      window.focus();
      setHint(false);
      if (isUi(e.target)) return;
      drag.current = { x: e.clientX, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      touchPad.lookX += e.clientX - d.x;
      touchPad.lookY += e.clientY - d.y;
      drag.current = { x: e.clientX, y: e.clientY };
    };
    const up = () => {
      drag.current = null;
    };
    const key = () => setHint(false);
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", key);
    };
  }, []);

  const hold = (forward: number, turn: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      touchPad.forward = forward;
      touchPad.turn = turn;
      touchPad.active = true;
    },
    onPointerUp: () => {
      touchPad.forward = 0;
      touchPad.turn = 0;
      touchPad.active = false;
    },
    onPointerCancel: () => {
      touchPad.forward = 0;
      touchPad.turn = 0;
      touchPad.active = false;
    },
  });
  const btn =
    "hud-panel grid size-10 touch-none select-none place-items-center font-mono text-sm text-signal active:text-bitcoin";

  return (
    <>
      {hint ? (
        <div className="pointer-events-none absolute inset-x-0 top-14 z-[90] flex justify-center">
          <span className="hud-panel px-2 py-1 font-mono text-[9px] text-bitcoin">
            CLICK TO PLAY · WASD · DRAG LOOK · F1–F8 SKILLS
          </span>
        </div>
      ) : null}
      <div
        data-embed-pad
        className={`absolute bottom-3 left-3 z-[90] grid grid-cols-3 gap-1 ${foe.inRange ? "" : ""}`}
        aria-label="Movement pad"
      >
        <span />
        <button type="button" aria-label="Walk forward" className={btn} {...hold(1, 0)}>▲</button>
        <span />
        <button type="button" aria-label="Turn left" className={btn} {...hold(0, 1)}>◀</button>
        <button type="button" aria-label="Walk back" className={btn} {...hold(-1, 0)}>▼</button>
        <button type="button" aria-label="Turn right" className={btn} {...hold(0, -1)}>▶</button>
      </div>
      <div data-embed-pad className="absolute right-3 top-12 z-[90] flex gap-1">
        <button type="button" onClick={toggleFull} aria-label="Toggle fullscreen" title="Fullscreen (F8)"
          className="hud-panel grid size-7 place-items-center font-mono text-xs text-signal hover:text-bitcoin">
          {full ? "✕" : "⛶"}
        </button>
        <button type="button" onClick={() => window.dispatchEvent(new Event("oasis:camera-toggle"))} aria-label="Swap view" title="Swap view (F7)"
          className={`hud-panel grid size-7 place-items-center font-mono text-xs ${first ? "text-bitcoin" : "text-signal"} hover:text-bitcoin`}>
          👁
        </button>
      </div>
    </>
  );
}

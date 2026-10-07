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
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-[90] flex justify-center">
          <span className="hud-panel px-3 py-1.5 font-mono text-[11px] text-bitcoin">
            CLICK TO PLAY · WASD MOVE · DRAG LOOK · F ATTACK · SPACE JUMP
          </span>
        </div>
      ) : null}
      <div
        data-embed-pad
        className="absolute bottom-3 left-3 z-[90] grid grid-cols-3 gap-1"
        aria-label="Movement pad"
      >
        <span />
        <button type="button" aria-label="Walk forward" className={btn} {...hold(1, 0)}>▲</button>
        <span />
        <button type="button" aria-label="Turn left" className={btn} {...hold(0, 1)}>◀</button>
        <button type="button" aria-label="Walk back" className={btn} {...hold(-1, 0)}>▼</button>
        <button type="button" aria-label="Turn right" className={btn} {...hold(0, -1)}>▶</button>
      </div>
      <div data-embed-pad className="absolute right-3 top-12 z-[90] flex flex-col items-end gap-1">
        <button type="button" onClick={toggleFull} aria-label="Toggle fullscreen"
          className="hud-panel px-2 py-1 font-mono text-[10px] text-signal hover:text-bitcoin">
          {full ? "✕ EXIT FULL" : "⛶ FULLSCREEN"}
        </button>
        <button type="button" onClick={() => window.dispatchEvent(new Event("oasis:camera-toggle"))} aria-label="Swap view"
          className="hud-panel px-2 py-1 font-mono text-[10px] text-signal hover:text-bitcoin">
          {first ? "⟲ 3RD PERSON" : "👁 1ST PERSON"}
        </button>
      </div>
      <button
        type="button"
        data-embed-pad
        aria-label="Attack"
        className={`hud-panel absolute bottom-16 right-3 z-[90] h-12 touch-none px-4 font-mono text-xs ${foe.inRange ? "text-bitcoin animate-pulse" : "text-signal"} ${foe.ready ? "" : "opacity-50"}`}
        onPointerDown={(e) => {
          e.preventDefault();
          window.dispatchEvent(new Event("oasis:attack"));
        }}
      >
        ⚔ ATTACK
      </button>
      <button
        type="button"
        data-embed-pad
        aria-label="Jump"
        className="hud-panel absolute bottom-3 right-3 z-[90] h-10 touch-none px-4 font-mono text-xs text-bitcoin"
        onPointerDown={(e) => {
          e.preventDefault();
          touchPad.jump = true;
        }}
      >
        JUMP
      </button>
    </>
  );
}

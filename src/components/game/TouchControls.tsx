import { useCallback, useEffect, useRef, useState } from "react";

import { resetTouchPad, touchPad } from "@/lib/touch-input";
import { cn } from "@/lib/utils";

/**
 * TOUCH CONTROLS — thumb pads for walking the Oasis on a phone.
 *
 * Left pad is a stick: push to walk, sweep to turn, hold past the rim to
 * sprint. Right half of the screen is a look pad: drag to turn the head. The
 * buttons on the right cover the actions a keyboard would: jump, fire, and
 * climb / sink when a flying ride is under you.
 */
export default function TouchControls({
  flying = false,
  shooter = false,
  paused = false,
  driving = false,
  rideLabel,
  onExitRide,
  onJumpLabel,
}: {
  flying?: boolean;
  shooter?: boolean;
  /** hide the pads while a panel is open, so nothing sits under the menu */
  paused?: boolean;
  /** aboard a ride: pedals replace the walking throttle */
  driving?: boolean;
  rideLabel?: string;
  onExitRide?: () => void;
  onJumpLabel?: string;
}) {
  const stick = useRef<HTMLDivElement | null>(null);
  const stickId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [sprinting, setSprinting] = useState(false);

  // Aboard a ride the stick is a steering wheel: the pedals carry the throttle,
  // so a thumb never has to hold forward and steer with the same push.
  const drivingRef = useRef(driving);
  drivingRef.current = driving;

  useEffect(() => () => resetTouchPad(), []);

  // A panel opening hides the pads, so drop whatever was held down.
  useEffect(() => {
    if (paused) {
      resetTouchPad();
      setKnob({ x: 0, y: 0 });
      setSprinting(false);
    }
  }, [paused]);

  // Stepping out of a ride clears the pedals, so nothing stays held down.
  useEffect(() => {
    touchPad.throttle = 0;
    touchPad.boost = false;
  }, [driving]);

  const readStick = useCallback((clientX: number, clientY: number) => {
    const box = stick.current?.getBoundingClientRect();
    if (!box) return;
    const radius = box.width / 2;
    let dx = clientX - (box.left + radius);
    let dy = clientY - (box.top + radius);
    const length = Math.hypot(dx, dy);
    const sprint = length > radius * 1.02;
    const clamped = Math.min(length, radius);
    if (length > 0) {
      dx = (dx / length) * clamped;
      dy = (dy / length) * clamped;
    }
    setKnob({ x: dx, y: dy });
    setSprinting(sprint);
    const nx = dx / radius;
    const ny = dy / radius;
    const dead = (value: number) => (Math.abs(value) < 0.16 ? 0 : value);
    const wheel = drivingRef.current;
    // Steering wants the full sweep of the stick; walking keeps its deadzone.
    touchPad.forward = wheel ? 0 : -dead(ny);
    touchPad.turn = wheel ? -(Math.abs(nx) < 0.08 ? 0 : nx) : -dead(nx);
    touchPad.sprint = wheel ? touchPad.boost : sprint;
    touchPad.active = true;
  }, []);

  const releaseStick = useCallback(() => {
    stickId.current = null;
    setKnob({ x: 0, y: 0 });
    setSprinting(false);
    touchPad.forward = 0;
    touchPad.turn = 0;
    touchPad.sprint = drivingRef.current ? touchPad.boost : false;
    touchPad.active = drivingRef.current ? touchPad.throttle !== 0 : false;
  }, []);

  // FIRE / STRIKE reuses the canvas mouse path, so every weapon behaves the
  // same on a phone as it does under a mouse.
  const canvasButton = useCallback((down: boolean) => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    canvas.dispatchEvent(
      new PointerEvent(down ? "pointerdown" : "pointerup", {
        button: 0,
        buttons: down ? 1 : 0,
        bubbles: true,
      }),
    );
    if (!down) window.dispatchEvent(new PointerEvent("pointerup", { button: 0, buttons: 0 }));
  }, []);

  if (paused) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 select-none">
      {/* look pad: the right side of the screen, clear of the on-screen buttons
          so the menu, map, chat and belt stay tappable */}
      <div
        className="pointer-events-auto absolute right-0 top-[4.5rem] bottom-[17rem] w-1/2"
        style={{ touchAction: "none" }}
        onPointerDown={(event) => {
          if (lookId.current !== null) return;
          lookId.current = event.pointerId;
          lookLast.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerMove={(event) => {
          if (lookId.current !== event.pointerId) return;
          touchPad.lookX += event.clientX - lookLast.current.x;
          touchPad.lookY += event.clientY - lookLast.current.y;
          lookLast.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          if (lookId.current === event.pointerId) lookId.current = null;
        }}
        onPointerCancel={() => {
          lookId.current = null;
        }}
      />

      {/* left stick */}
      <div
        ref={stick}
        className="pointer-events-auto absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-5 grid h-32 w-32 place-items-center rounded-full border border-primary/40 bg-background/35 backdrop-blur-[2px]"
        style={{ touchAction: "none" }}
        onPointerDown={(event) => {
          if (stickId.current !== null) return;
          stickId.current = event.pointerId;
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            /* synthetic or already-released pointers have nothing to capture */
          }
          readStick(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (stickId.current !== event.pointerId) return;
          readStick(event.clientX, event.clientY);
        }}
        onPointerUp={releaseStick}
        onPointerCancel={releaseStick}
      >
        <div
          className={cn(
            "h-12 w-12 rounded-full border transition-colors",
            sprinting ? "border-primary bg-primary/40" : "border-primary/60 bg-primary/15",
          )}
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        />
        <span className="absolute -top-5 left-1 font-mono text-[10px] tracking-widest text-muted-foreground">
          {driving ? "STEER" : sprinting ? "SPRINT" : "MOVE"}
        </span>
      </div>

      {/* action buttons */}
      <div className="pointer-events-auto absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 flex flex-col items-end gap-2">
        {onExitRide ? (
          <button
            type="button"
            className={cn(
              "rounded-sm border px-2 py-1 font-mono text-[10px] tracking-widest active:scale-95",
              driving
                ? "border-border bg-background/55 text-muted-foreground"
                : "border-primary/60 bg-primary/15 text-primary",
            )}
            style={{ touchAction: "none" }}
            onPointerDown={(event) => {
              event.preventDefault();
              touchPad.throttle = 0;
              touchPad.boost = false;
              onExitRide();
            }}
          >
            {driving ? `EXIT ${rideLabel ?? "RIDE"}` : `RIDE ${rideLabel ?? ""}`.trim()}
          </button>
        ) : null}
        {flying ? (
          <div className="flex gap-2">
            <PadButton
              label="DOWN"
              onDown={() => {
                touchPad.fly = -1;
              }}
              onUp={() => {
                touchPad.fly = 0;
              }}
            />
            <PadButton
              label="UP"
              onDown={() => {
                touchPad.fly = 1;
              }}
              onUp={() => {
                touchPad.fly = 0;
              }}
            />
          </div>
        ) : null}
        {driving ? (
          <div className="flex items-center gap-2">
            <PadButton
              label="REV"
              onDown={() => {
                touchPad.throttle = -1;
                touchPad.active = true;
              }}
              onUp={() => {
                touchPad.throttle = 0;
              }}
            />
            <PadButton
              label="BOOST"
              onDown={() => {
                touchPad.boost = true;
                touchPad.sprint = true;
              }}
              onUp={() => {
                touchPad.boost = false;
                touchPad.sprint = false;
              }}
            />
            <PadButton
              label="GAS"
              strong
              onDown={() => {
                touchPad.throttle = 1;
                touchPad.active = true;
              }}
              onUp={() => {
                touchPad.throttle = 0;
              }}
            />
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <PadButton
            label={onJumpLabel ?? "JUMP"}
            onDown={() => {
              touchPad.jump = true;
            }}
          />
          {shooter ? (
            <PadButton
              label="FIRE"
              strong
              onDown={() => canvasButton(true)}
              onUp={() => canvasButton(false)}
            />
          ) : (
            <PadButton
              label="HIT"
              strong
              onDown={() => canvasButton(true)}
              onUp={() => canvasButton(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PadButton({
  label,
  onDown,
  onUp,
  strong = false,
}: {
  label: string;
  onDown: () => void;
  onUp?: () => void;
  strong?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "grid place-items-center rounded-full border font-mono text-[10px] tracking-widest active:scale-95",
        strong
          ? "h-20 w-20 border-primary bg-primary/25 text-primary"
          : "h-16 w-16 border-primary/50 bg-background/40 text-muted-foreground",
      )}
      style={{ touchAction: "none" }}
      onPointerDown={(event) => {
        event.preventDefault();
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* synthetic or already-released pointers have nothing to capture */
        }
        onDown();
      }}
      onPointerUp={() => onUp?.()}
      onPointerCancel={() => onUp?.()}
    >
      {label}
    </button>
  );
}

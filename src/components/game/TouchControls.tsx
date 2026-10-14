import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Crosshair, Gauge, LogOut, MoveUp, Play, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { resetTouchPad, stickIntent, touchPad } from "@/lib/touch-input";
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
  const [autoRun, setAutoRun] = useState(false);
  const autoRunRef = useRef(false);

  // Aboard a ride the stick is a steering wheel: the pedals carry the throttle,
  // so a thumb never has to hold forward and steer with the same push.
  const drivingRef = useRef(driving);
  drivingRef.current = driving;

  const stopAll = useCallback(() => {
    const canvas = stick.current?.closest(".oasis-storybook")?.querySelector("canvas");
    canvas?.dispatchEvent(new PointerEvent("pointerup", { button: 0, buttons: 0, bubbles: true }));
    window.dispatchEvent(new PointerEvent("pointerup", { button: 0, buttons: 0 }));
    resetTouchPad();
    stickId.current = null;
    lookId.current = null;
    autoRunRef.current = false;
    setAutoRun(false);
    setKnob({ x: 0, y: 0 });
    setSprinting(false);
  }, []);

  useEffect(() => {
    const stopOnHidden = () => {
      if (document.visibilityState === "hidden") stopAll();
    };
    window.addEventListener("blur", stopAll);
    document.addEventListener("visibilitychange", stopOnHidden);
    return () => {
      window.removeEventListener("blur", stopAll);
      document.removeEventListener("visibilitychange", stopOnHidden);
      resetTouchPad();
    };
  }, [stopAll]);

  // A panel opening hides the pads, so drop whatever was held down.
  useEffect(() => {
    if (paused) {
      stopAll();
    }
  }, [paused, stopAll]);

  // Stepping out of a ride clears the pedals, so nothing stays held down.
  useEffect(() => {
    stopAll();
  }, [driving, stopAll]);

  const readStick = useCallback((clientX: number, clientY: number) => {
    const box = stick.current?.getBoundingClientRect();
    if (!box) return;
    const radius = box.width / 2;
    let dx = clientX - (box.left + radius);
    let dy = clientY - (box.top + radius);
    const length = Math.hypot(dx, dy);
    const sprint = !drivingRef.current && length > radius * 0.78 && dy < -radius * 0.28;
    const clamped = Math.min(length, radius * 0.62);
    if (length > 0) {
      dx = (dx / length) * clamped;
      dy = (dy / length) * clamped;
    }
    setKnob({ x: dx, y: dy });
    setSprinting(sprint);
    const intent = stickIntent(dx / (radius * 0.62), dy / (radius * 0.62));
    const wheel = drivingRef.current;
    if (!wheel && autoRunRef.current) {
      autoRunRef.current = false;
      setAutoRun(false);
    }
    // Steering wants the full sweep of the stick; walking keeps its deadzone.
    touchPad.forward = wheel ? 0 : intent.forward;
    touchPad.turn = intent.turn;
    touchPad.sprint = wheel ? touchPad.boost : sprint;
    touchPad.active = true;
  }, []);

  const releaseStick = useCallback(() => {
    stickId.current = null;
    setKnob({ x: 0, y: 0 });
    setSprinting(false);
    touchPad.forward = autoRunRef.current ? 1 : 0;
    touchPad.turn = 0;
    touchPad.sprint = drivingRef.current ? touchPad.boost : false;
    touchPad.active = drivingRef.current ? touchPad.throttle !== 0 : autoRunRef.current;
  }, []);

  const toggleAutoRun = useCallback(() => {
    const next = !autoRunRef.current;
    autoRunRef.current = next;
    setAutoRun(next);
    touchPad.forward = next ? 1 : 0;
    touchPad.turn = 0;
    touchPad.sprint = false;
    touchPad.active = next;
    setKnob({ x: 0, y: next ? -35 : 0 });
    setSprinting(false);
  }, []);

  // FIRE / STRIKE reuses the canvas mouse path, so every weapon behaves the
  // same on a phone as it does under a mouse.
  const canvasButton = useCallback((down: boolean) => {
    const canvas = stick.current?.closest(".oasis-storybook")?.querySelector("canvas");
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
    <div className="oasis-touch-controls pointer-events-none absolute inset-0 z-40 select-none overscroll-none" data-no-translate>
      {/* look pad: the right side of the screen, clear of the on-screen buttons
          so the menu, map, chat and belt stay tappable */}
      <div
        aria-label="Camera look area"
        className="oasis-look-pad pointer-events-auto absolute right-0 w-[62%] touch-none"
        style={{ touchAction: "none" }}
        onPointerDown={(event) => {
          if (lookId.current !== null) return;
          lookId.current = event.pointerId;
          lookLast.current = { x: event.clientX, y: event.clientY };
          try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* released pointer */ }
        }}
        onPointerMove={(event) => {
          if (lookId.current !== event.pointerId) return;
          touchPad.lookX += Math.max(-48, Math.min(48, event.clientX - lookLast.current.x));
          touchPad.lookY += Math.max(-48, Math.min(48, event.clientY - lookLast.current.y));
          lookLast.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          if (lookId.current === event.pointerId) lookId.current = null;
        }}
        onLostPointerCapture={() => {
          lookId.current = null;
        }}
        onPointerCancel={() => {
          lookId.current = null;
        }}
      />

      {/* left stick */}
      <div
        ref={stick}
        aria-label="Movement joystick"
        className="oasis-stick pointer-events-auto absolute grid place-items-center rounded-full border border-primary/45 bg-background/45 shadow-[inset_0_0_0_1px_var(--color-background)] backdrop-blur-sm touch-none"
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
        onLostPointerCapture={releaseStick}
      >
        <span className="absolute top-3 font-mono text-[9px] text-muted-foreground">▲</span>
        <span className="absolute bottom-3 font-mono text-[9px] text-muted-foreground">▼</span>
        <span className="absolute left-3 font-mono text-[9px] text-muted-foreground">◀</span>
        <span className="absolute right-3 font-mono text-[9px] text-muted-foreground">▶</span>
        <div
          className={cn(
            "grid size-14 place-items-center rounded-full border shadow-[0_0_18px_color-mix(in_oklab,var(--color-primary)_22%,transparent)] transition-colors landscape:size-12",
            sprinting || autoRun ? "border-primary bg-primary/40 text-primary" : "border-primary/70 bg-background/75 text-muted-foreground",
          )}
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        >
          <Gauge className="size-5" aria-hidden="true" />
        </div>
        <span className="absolute -top-6 left-0 font-mono text-[10px] tracking-widest text-foreground">
          {driving ? "STEER" : sprinting ? "SPRINT" : autoRun ? "AUTO-RUN" : "MOVE"}
        </span>
      </div>

      {/* action buttons */}
      <div className={cn("oasis-touch-actions pointer-events-auto absolute grid grid-cols-2 items-center justify-items-end gap-2", driving && "oasis-driving-actions", flying && "oasis-flying-actions")}>
        {!driving ? (
          <Button
            type="button"
            variant="terminalGhost"
            size="sm"
            aria-pressed={autoRun}
            aria-label={autoRun ? "Stop auto-run" : "Start auto-run"}
            className={cn(
              "h-11 w-full border bg-background/60 px-2 text-[10px] backdrop-blur-sm active:scale-95",
              autoRun && "border-primary bg-primary/20 text-primary",
            )}
            style={{ touchAction: "none" }}
            onPointerDown={(event) => {
              event.preventDefault();
              toggleAutoRun();
            }}
          >
            {autoRun ? <Square /> : <Play />}
            {autoRun ? "STOP" : "AUTO"}
          </Button>
        ) : null}
        {onExitRide ? (
          <Button
            type="button"
            variant="terminalGhost"
            size="sm"
            aria-label={driving ? `Exit ${rideLabel ?? "ride"}` : `Ride ${rideLabel ?? ""}`.trim()}
            className={cn(
              "h-11 w-full min-w-0 border bg-background/60 px-2 text-[10px] backdrop-blur-sm active:scale-95",
              driving
                ? "border-border text-muted-foreground"
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
            <LogOut />
            <span className="truncate">{driving ? "EXIT" : "RIDE"}</span>
          </Button>
        ) : null}
        {flying ? (
          <div className="col-span-2 flex w-full justify-end gap-2">
            <PadButton
              label="DOWN"
              icon={<ArrowDown />}
              onDown={() => {
                touchPad.fly = -1;
              }}
              onUp={() => {
                touchPad.fly = 0;
              }}
            />
            <PadButton
              label="UP"
              icon={<ArrowUp />}
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
          <div className="col-span-2 flex w-full items-center justify-end gap-2">
            <PadButton
              label="REV"
              icon={<ArrowDown />}
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
              icon={<Gauge />}
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
              icon={<ArrowUp />}
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
        <div className="col-span-2 flex w-full items-center justify-end gap-2">
          <PadButton
            label={onJumpLabel ?? "JUMP"}
            icon={<MoveUp />}
            onDown={() => {
              touchPad.jump = true;
            }}
          />
          {shooter ? (
            <PadButton
              label="FIRE"
              icon={<Crosshair />}
              strong
              onDown={() => canvasButton(true)}
              onUp={() => canvasButton(false)}
            />
          ) : (
            <PadButton
              label="HIT"
              icon={<Crosshair />}
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
  icon,
  onDown,
  onUp,
  strong = false,
}: {
  label: string;
  icon: React.ReactNode;
  onDown: () => void;
  onUp?: () => void;
  strong?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="terminalGhost"
      aria-label={label}
      className={cn(
        "flex rounded-full border bg-background/55 p-0 font-mono text-[9px] tracking-widest shadow-[0_0_18px_color-mix(in_oklab,var(--color-background)_70%,transparent)] backdrop-blur-sm active:scale-95",
        strong
          ? "oasis-pad-button size-14 flex-col gap-0.5 border-primary bg-primary/25 text-primary [&_svg]:size-5"
          : "oasis-pad-button size-14 flex-col gap-0.5 border-primary/50 text-muted-foreground [&_svg]:size-5",
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
      onPointerUp={(event) => {
        onUp?.();
        event.currentTarget.blur();
      }}
      onPointerCancel={(event) => {
        onUp?.();
        event.currentTarget.blur();
      }}
      onLostPointerCapture={() => onUp?.()}
    >
      {icon}
      <span>{label}</span>
    </Button>
  );
}

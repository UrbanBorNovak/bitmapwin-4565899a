import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const NOTE_W = 252;

/** Small "?" that reveals a plain-English note on hover, keyboard focus or tap. */
export function InfoTip({ text, label = "What does this mean?" }: { text: string; label?: string }) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [box, setBox] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const open = pinned || hovered;

  const hold = () => {
    if (timer.current) clearTimeout(timer.current);
    setHovered(true);
  };
  // Small grace period so the pointer can cross the gap between "?" and the note.
  const drop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHovered(false), 160);
  };

  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // The site sets a CSS zoom on <html>, so rects report scaled pixels while the
    // window size and a body-level fixed element use real ones.
    const zoom = el.offsetWidth ? r.width / el.offsetWidth || 1 : 1;
    const left0 = r.left / zoom;
    const below0 = r.bottom / zoom;
    const above0 = r.top / zoom;
    const width = Math.min(NOTE_W, window.innerWidth - 16);
    const left = Math.min(Math.max(8, left0), window.innerWidth - width - 8);
    const room = window.innerHeight - below0;
    const up = room < 140 && above0 > room;
    setBox({ left, top: up ? above0 - 6 : below0 + 6, width, up });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setPinned(false);
      setHovered(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex align-middle" onMouseEnter={hold} onMouseLeave={drop}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={id}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPinned((p) => !p);
        }}
        // Keyboard users get the note on Tab; mouse focus must not fight the click toggle.
        onFocus={(e) => {
          if (e.currentTarget.matches(":focus-visible")) setPinned(true);
        }}
        onBlur={() => setPinned(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setPinned(false);
            setHovered(false);
          }
        }}
        className="ml-1 inline-flex size-5 items-center justify-center rounded-full border border-border font-mono text-[10px] leading-none text-muted-foreground hover:text-signal focus-visible:text-signal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
      >
        ?
      </button>
      {open && box
        ? createPortal(
            <span
              id={id}
              role="tooltip"
              onMouseEnter={hold}
              onMouseLeave={drop}
              style={{ left: box.left, top: box.top, width: box.width, transform: box.up ? "translateY(-100%)" : undefined }}
              className="hud-panel fixed z-[80] p-2 text-left font-sans text-xs normal-case leading-normal tracking-normal text-foreground"
            >
              {text}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

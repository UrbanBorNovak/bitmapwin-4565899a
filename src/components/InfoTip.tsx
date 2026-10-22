import { useEffect, useId, useRef, useState } from "react";

const NOTE_W = 252;

/** Small "?" that reveals a plain-English note on hover, keyboard focus or tap. */
export function InfoTip({ text, label = "What does this mean?" }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  // Small grace period so the pointer can cross the gap between "?" and the note.
  const hideSoon = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 160);
  };

  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(NOTE_W, window.innerWidth - 16);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const below = window.innerHeight - r.bottom;
    const up = below < 140 && r.top > below;
    setBox({ left, top: up ? r.top - 6 : r.bottom + 6, width, up });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <span ref={ref} className="group relative inline-flex align-middle" onMouseEnter={show} onMouseLeave={hideSoon}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={id}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="ml-1 inline-flex size-5 items-center justify-center rounded-full border border-border font-mono text-[10px] leading-none text-muted-foreground hover:text-signal focus-visible:text-signal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
      >
        ?
      </button>
      {open && box ? (
        <span
          id={id}
          role="tooltip"
          style={{ left: box.left, top: box.top, width: box.width, transform: box.up ? "translateY(-100%)" : undefined }}
          className="hud-panel fixed z-[80] p-2 text-left font-sans text-xs normal-case leading-normal tracking-normal text-foreground"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}

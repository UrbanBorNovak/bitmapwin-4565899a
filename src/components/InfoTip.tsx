import { useId, useState } from "react";

/** Small "?" that reveals a plain-English note on hover, keyboard focus or tap. */
export function InfoTip({ text, label = "What does this mean?" }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={id}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        className="ml-1 inline-flex size-5 items-center justify-center rounded-full border border-border font-mono text-[10px] leading-none text-muted-foreground hover:text-signal focus-visible:text-signal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
      >
        ?
      </button>
      <span
        id={id}
        role="tooltip"
        className={`hud-panel absolute left-0 top-full z-50 mt-1 w-56 p-2 text-left font-sans text-xs normal-case leading-normal tracking-normal text-foreground ${open ? "block" : "hidden"} group-hover:block group-focus-within:block`}
      >
        {text}
      </span>
    </span>
  );
}

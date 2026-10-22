import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const SEEN_KEY = "bitmapwin.guides.read";

// Mobile names stay short so a step never wraps; full titles show from sm up.
const STEPS = [
  {
    to: "/land-101",
    label: "LAND 101",
    short: "LAND 101",
    note: "What a BITMAP is",
  },
  {
    to: "/guardians-guide",
    label: "GUARDIANS GUIDE",
    short: "GUARDIANS",
    note: "How a block becomes a Guardian",
  },
  {
    to: "/play-guide",
    label: "PLAYER GUIDE",
    short: "PLAYER",
    note: "Controls and what to do",
  },
  { to: "/oasis", label: "ENTER THE OASIS", short: "OASIS", note: "Walk the world" },
] as const;

/** Step title: compact on phones, full from sm up. */
function StepName({ step }: { step: (typeof STEPS)[number] }) {
  return (
    <>
      <span className="sm:hidden">{step.short}</span>
      <span className="hidden sm:inline">{step.label}</span>
    </>
  );
}

type Current = "/land-101" | "/guardians-guide" | "/play-guide";

/** Reading flow across the three guides, ending in the Oasis. */
export function GuideTrail({ current }: { current: Current }) {
  const idx = STEPS.findIndex((s) => s.to === current);
  // Guides count as read only once actually opened on this device.
  const [seen, setSeen] = useState<string[]>([]);
  useEffect(() => {
    let list: string[] = [];
    try { list = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]"); } catch { list = []; }
    if (!Array.isArray(list)) list = [];
    if (!list.includes(current)) list = [...list, current];
    try { window.localStorage.setItem(SEEN_KEY, JSON.stringify(list)); } catch { /* storage blocked */ }
    setSeen(list);
  }, [current]);
  const next = STEPS[idx + 1] ?? STEPS[3];
  const prev = idx > 0 ? STEPS[idx - 1] : undefined;
  return (
    <nav aria-label="Guide reading order" className="mt-10 border border-border bg-surface p-3 md:mt-12 md:p-5">
      <div className="label text-signal">GUIDE {idx + 1} OF 3 · READING ORDER</div>
      <ol className="mt-2.5 grid gap-px bg-border sm:mt-3 sm:grid-cols-4">
        {STEPS.map((s, i) => {
          const state = i === idx ? "here" : seen.includes(s.to) ? "done" : "next";
          return (
            <li key={s.to} className="bg-background">
              <Link
                to={s.to}
                aria-current={state === "here" ? "page" : undefined}
                className={`block h-full border-l-2 px-2.5 py-1.5 sm:px-3 sm:py-2 ${
                  state === "here"
                    ? "border-bitcoin bg-bitcoin/10"
                    : state === "done"
                      ? "border-signal/40 hover:bg-surface"
                      : "border-transparent hover:bg-surface"
                }`}
              >
                <div className="flex flex-wrap items-center gap-1">
                  <span className="label text-[0.55rem] text-muted-foreground">
                    {i < 3 ? `STEP ${i + 1}` : "FINISH"}
                  </span>
                  {state === "here" && (
                    <span className="label bg-bitcoin px-1 py-0.5 text-[0.55rem] text-bitcoin-foreground">
                      YOU ARE HERE
                    </span>
                  )}
                  {state === "done" && (
                    <span className="label border border-signal/60 px-1 py-0.5 text-[0.55rem] text-signal">
                      READ
                    </span>
                  )}
                </div>
                <div className={`label mt-1 ${state === "here" ? "text-bitcoin" : "text-foreground"}`}>
                  {s.label}
                </div>
                <div className={`mt-0.5 text-xs text-muted-foreground ${state === "here" ? "" : "hidden sm:block"}`}>
                  {s.note}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:items-center">
        <Link
          to={next.to}
          className="btn-term w-full !min-h-12 !text-[0.75rem] sm:w-auto sm:!min-h-0 sm:!text-[0.6875rem]"
        >
          NEXT: {next.label} →
        </Link>
        {prev && (
          <Link to={prev.to} className="btn-term-ghost w-full sm:w-auto">
            ← BACK: {prev.label}
          </Link>
        )}
      </div>
    </nav>
  );
}

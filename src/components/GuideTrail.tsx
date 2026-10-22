import { Link } from "@tanstack/react-router";

const STEPS = [
  { to: "/land-101", label: "LAND 101", note: "What a BITMAP is" },
  { to: "/guardians-guide", label: "GUARDIANS GUIDE", note: "How a block becomes a Guardian" },
  { to: "/play-guide", label: "PLAYER GUIDE", note: "Controls and what to do" },
  { to: "/oasis", label: "ENTER THE OASIS", note: "Walk the world" },
] as const;

type Current = "/land-101" | "/guardians-guide" | "/play-guide";

/** Reading flow across the three guides, ending in the Oasis. */
export function GuideTrail({ current }: { current: Current }) {
  const idx = STEPS.findIndex((s) => s.to === current);
  const next = STEPS[idx + 1];
  return (
    <nav aria-label="Guide reading order" className="mt-12 border border-border bg-surface p-4 md:p-5">
      <div className="label text-signal">GUIDE {idx + 1} OF 3 · READING ORDER</div>
      <ol className="mt-3 grid gap-px bg-border sm:grid-cols-4">
        {STEPS.map((s, i) => {
          const state = i < idx ? "done" : i === idx ? "here" : "next";
          return (
            <li key={s.to} className="bg-background">
              <Link
                to={s.to}
                aria-current={state === "here" ? "page" : undefined}
                className={`block h-full border-l-2 px-3 py-2 ${state === "here" ? "border-bitcoin" : "border-transparent hover:bg-surface"}`}
              >
                <div className={`label text-[0.55rem] ${state === "here" ? "text-bitcoin" : "text-muted-foreground"}`}>
                  {i < 3 ? `STEP ${i + 1}` : "FINISH"}{state === "done" ? " · READ" : state === "here" ? " · YOU ARE HERE" : ""}
                </div>
                <div className="label mt-1 text-foreground">{s.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{s.note}</div>
              </Link>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link to={next.to} className="btn-term">NEXT: {next.label} →</Link>
        {idx > 0 && (
          <Link to={STEPS[idx - 1].to} className="btn-term-ghost">← BACK: {STEPS[idx - 1].label}</Link>
        )}
      </div>
    </nav>
  );
}

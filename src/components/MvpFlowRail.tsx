import { Link } from "@tanstack/react-router";

type Step = "map" | "extend" | "deploy";

const STEPS: { id: Step; n: string; label: string; note: string }[] = [
  { id: "map", n: "01", label: "MAP", note: "Pick a BITMAP" },
  { id: "extend", n: "02", label: "EXTEND", note: "Give it software" },
  { id: "deploy", n: "03", label: "DEPLOY", note: "Run it on the land" },
];

/**
 * The primary MVP loop: MAP → EXTEND → DEPLOY.
 * Shown on every screen that belongs to the loop so the path is never lost.
 */
export function MvpFlowRail({ active, height }: { active: Step; height?: number }) {
  const search = Number.isFinite(height) ? { height: height as number } : {};

  return (
    <nav
      aria-label="Build flow"
      data-tour="flow-rail"
      className="terminal-panel flex flex-wrap items-stretch gap-px overflow-hidden font-mono text-[10px]"
    >
      {STEPS.map((step, index) => {
        const isActive = step.id === active;
        const body = (
          <>
            <span className="label text-bitcoin" data-no-translate>
              {step.n}
            </span>
            <span className="display text-sm">{step.label}</span>
            <span className="hidden text-muted-foreground sm:inline">{step.note}</span>
          </>
        );
        const className = `flex flex-1 items-center gap-2 px-3 py-2.5 transition-colors ${
          isActive ? "bg-bitcoin/10 text-foreground" : "text-muted-foreground hover:text-foreground"
        }`;

        return (
          <div key={step.id} className="flex min-w-[150px] flex-1 items-center">
            {index > 0 && (
              <span aria-hidden="true" className="px-1 text-border">
                →
              </span>
            )}
            {isActive ? (
              <div className={className} aria-current="step">
                {body}
              </div>
            ) : step.id === "map" ? (
              <Link to="/map" search={search} className={className}>
                {body}
              </Link>
            ) : step.id === "extend" ? (
              <Link to="/extend" search={search} className={className}>
                {body}
              </Link>
            ) : (
              <Link to="/create" search={search} className={className}>
                {body}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}

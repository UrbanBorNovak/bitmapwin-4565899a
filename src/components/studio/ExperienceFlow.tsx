import { Link } from "@tanstack/react-router";

export type FlowStep = "describe" | "edit" | "publish" | "deploy";

/** One step bar shared by every page of the make-an-experience journey. Pages keep their own addresses. */
export function ExperienceFlow({ current }: { current: FlowStep }) {
  const cls = (s: FlowStep) =>
    `flex-1 min-w-[140px] border px-3 py-2 font-mono text-[10px] transition-colors ${
      current === s ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground hover:text-foreground"
    }`;
  return (
    <nav aria-label="Make an experience" className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Link to="/make" className="label text-signal hover:text-foreground">MAKE AN EXPERIENCE /</Link>
        <div className="flex gap-3 font-mono text-[10px] text-muted-foreground">
          <Link to="/sdk" className="hover:text-foreground">SDK GUIDE</Link>
          <Link to="/sdk-playground" className="hover:text-foreground">PLAYGROUND</Link>
        </div>
      </div>
      <ol className="flex flex-wrap gap-2">
        <li className="contents"><Link to="/create" className={cls("describe")}>1 · DESCRIBE</Link></li>
        <li className="contents"><Link to="/studio" search={{ tool: "extenders" }} className={cls("edit")}>2 · EDIT & TEST</Link></li>
        <li className="contents"><Link to="/studio" search={{ tool: "extenders" }} className={cls("publish")}>3 · PUBLISH</Link></li>
        <li className="contents"><Link to="/extend" className={cls("deploy")}>4 · DEPLOY</Link></li>
      </ol>
    </nav>
  );
}

import { Link } from "@tanstack/react-router";
import { Compass, Footprints, Hammer, History, Map, Medal, Radio, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
// Each stage of the core loop is tagged with the pillar it belongs to:
// WORLD · LAND · EXPERIENCES · IDENTITY · CREATION.
const STAGES = [
  ["discover", "DISCOVER", "/explore", "WORLD", Compass],
  ["explore", "EXPLORE", "/map", "WORLD", Map],
  ["participate", "PARTICIPATE", "/map", "LAND", Footprints],
  ["provenance", "PROVENANCE", "/stream", "IDENTITY", History],
  ["stamp", "STAMP", "/passport", "IDENTITY", Medal],
  ["unlock", "UNLOCK", "/passport", "IDENTITY", Unlock],
  ["build", "BUILD", "/map", "CREATION", Hammer],
  ["return", "RETURN", "/stream", "WORLD", Radio],
] as const;
export function LoopNavigator({ active, compact = false }: { active: typeof STAGES[number][0]; compact?: boolean }) {
  return <nav aria-label="BitmapWin world loop" className={cn("border-y border-border bg-surface/60", compact ? "py-2" : "py-3")}>
    <div className="flex snap-x gap-1 overflow-x-auto px-1">
      {STAGES.map(([id, label, to, pillar, Icon], index) => <Link key={id} to={to} className={cn("flex min-w-fit snap-start items-center gap-1.5 border px-2 py-1.5 font-mono text-[9px]", id === active ? "border-bitcoin bg-bitcoin/10 text-bitcoin" : "border-border text-muted-foreground hover:text-foreground")}>
        <Icon className="size-3" /><span>{String(index + 1).padStart(2, "0")} · {label}</span><span className={cn("label text-[8px]", id === active ? "text-bitcoin/80" : "opacity-60")}>{pillar}</span>
      </Link>)}
    </div>
  </nav>;
}

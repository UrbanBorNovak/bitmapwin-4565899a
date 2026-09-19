import { Link } from "@tanstack/react-router";
import { Award, ExternalLink } from "lucide-react";
import type { PassportStamp } from "@/lib/passport";
export function StampCard({ stamp }: { stamp: PassportStamp }) {
  return <article className="border border-border bg-surface p-4">
    <div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center border border-bitcoin text-bitcoin"><Award className="size-5" /></div>
      <div className="min-w-0"><h3 className="display text-sm text-bitcoin">{stamp.name}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{stamp.description}</p></div></div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 font-mono text-[9px] text-muted-foreground">
      <span>APP RECORD · RULE V{stamp.ruleVersion} · {new Date(stamp.earnedAt).toLocaleDateString()}</span>
      {stamp.bitmapHeight !== null ? <Link to="/bitmap/$block" params={{ block: String(stamp.bitmapHeight) }} className="inline-flex items-center gap-1 text-foreground hover:text-bitcoin">EVIDENCE <ExternalLink className="size-3" /></Link> : null}
    </div>
  </article>;
}

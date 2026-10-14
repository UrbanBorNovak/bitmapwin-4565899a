import { Link } from "@tanstack/react-router";
import { Award, ExternalLink } from "lucide-react";
import type { PassportStamp } from "@/lib/passport";
export function StampCard({ stamp }: { stamp: PassportStamp }) {
  return <article className="passport-panel passport-reveal p-4">
    <div className="flex items-start gap-3"><div className="passport-stamp-seal grid size-11 shrink-0 place-items-center text-[var(--passport-gold)]"><Award className="size-5" /></div>
      <div className="min-w-0"><p className="passport-kicker text-[7px]">VERIFIED STAMP</p><h3 className="mt-1 font-mono text-sm font-bold text-[var(--passport-gold)]">{stamp.name}</h3><p className="mt-1 text-xs leading-relaxed text-[var(--passport-muted)]">{stamp.description}</p></div></div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--passport-line)] pt-3 font-mono text-[9px] text-[var(--passport-muted)]">
      <span>APP RECORD · RULE V{stamp.ruleVersion} · {new Date(stamp.earnedAt).toLocaleDateString()}</span>
      {stamp.bitmapHeight !== null ? <Link to="/bitmap/$block" params={{ block: String(stamp.bitmapHeight) }} className="inline-flex items-center gap-1 text-foreground hover:text-bitcoin">EVIDENCE <ExternalLink className="size-3" /></Link> : null}
      {stamp.inscriptionId ? <a href={`https://ordinals.com/inscription/${stamp.inscriptionId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-bitcoin hover:underline" data-no-translate>INSCRIPTION {stamp.inscriptionId.slice(0, 8)}… <ExternalLink className="size-3" /></a> : null}
    </div>
  </article>;
}

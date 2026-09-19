import { Link } from "@tanstack/react-router";
import { Blocks, Link2, UserRound } from "lucide-react";
import { eventHref, type ProvenanceEvent } from "@/lib/passport";
import { shortenAddress } from "@/lib/registry";
export function StreamEventRow({ event }: { event: ProvenanceEvent }) {
  const Icon = event.proofLevel === "CHAIN" ? Link2 : event.proofLevel === "WORLD" ? Blocks : UserRound;
  return <Link to={eventHref(event)} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-border px-3 py-4 hover:bg-surface sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-4">
    <div className="grid size-9 place-items-center border border-border text-bitcoin"><Icon className="size-4" /></div>
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="display text-sm">{event.title}</span><span className="label border border-border px-1.5 py-0.5 text-[8px]">{event.proofLevel}</span></div>
      <p className="mt-1 break-words font-mono text-[10px] text-muted-foreground">{event.summary}</p><p className="mt-1 font-mono text-[9px] text-muted-foreground">{event.actorWallet ? shortenAddress(event.actorWallet) : "VERIFIED ACCOUNT"}</p></div>
    <time className="col-start-2 font-mono text-[9px] text-muted-foreground sm:col-start-3">{new Date(event.occurredAt).toLocaleDateString()}</time>
  </Link>;
}

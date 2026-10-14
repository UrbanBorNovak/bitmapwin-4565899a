import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildIssue, fetchComicBlocks, seedFrom, type ComicIssue, type ComicPanel } from "@/lib/block-comic";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/** Halftone panel art: deterministic shapes per panel kind, Ben-Day dots over ink. */
function PanelArt({ panel, kind, hash }: { panel: ComicPanel; kind: number; hash: string }) {
  const r = useMemo(() => seedFrom(hash, panel.seed), [hash, panel.seed]);
  const id = `ht-${panel.seed}`;
  const shapes = useMemo(() => {
    const out: JSX.Element[] = [];
    if (kind === 0) {
      for (let i = 0; i < 7; i++) {
        const x = 8 + i * 14, h = 30 + r() * 50;
        out.push(<rect key={i} x={x} y={100 - h} width={10} height={h} className="fill-foreground" opacity={0.85} />);
      }
    } else if (kind === 1) {
      for (let i = 0; i < 40; i++) out.push(<rect key={i} x={r() * 96} y={r() * 96} width={3 + r() * 6} height={3 + r() * 6} className={i % 5 ? "fill-foreground" : "fill-bitcoin"} />);
    } else if (kind === 2) {
      for (let i = 0; i < 9; i++) out.push(<rect key={i} x={20 + (i % 3) * 20} y={30 + Math.floor(i / 3) * 20} width={19} height={19} className={r() > 0.6 ? "fill-bitcoin" : "fill-foreground"} opacity={0.5 + r() * 0.5} />);
      out.push(<circle key="g" cx={50} cy={20} r={9} className="fill-signal" />);
    } else {
      out.push(<rect key="s" x={25} y={15} width={50} height={40} className="fill-foreground" />);
      out.push(<rect key="b" x={15} y={70} width={70} height={14} className="fill-bitcoin" />);
    }
    return out;
  }, [kind, r]);
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <defs>
        <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform={`rotate(${15 + kind * 30})`}>
          <circle cx="2" cy="2" r={0.6 + kind * 0.25} className="fill-bitcoin" />
        </pattern>
      </defs>
      <rect width="100" height="100" className="fill-background" />
      <rect width="100" height="100" fill={`url(#${id})`} opacity="0.55" />
      {[...Array(10)].map((_, i) => <line key={i} x1="50" y1="50" x2={50 + 80 * Math.cos(i * 0.63)} y2={50 + 80 * Math.sin(i * 0.63)} className="stroke-foreground" strokeWidth="0.3" opacity="0.3" />)}
      {shapes}
    </svg>
  );
}

function Strip({ issue, large }: { issue: ComicIssue; large?: boolean }) {
  return (
    <div className={`grid gap-1 ${large ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2"}`}>
      {issue.panels.map((p, i) => (
        <figure key={i} className="relative aspect-square overflow-hidden border-2 border-foreground bg-background">
          <PanelArt panel={p} kind={i} hash={issue.hash} />
          <span className="absolute left-1 top-1 bg-foreground px-1 font-mono text-[8px] font-bold text-background">{p.kicker}</span>
          <span className={`display absolute right-1 top-5 -rotate-6 text-bitcoin ${large ? "text-2xl" : "text-xs"}`}>{p.sfx}</span>
          <figcaption className={`absolute inset-x-1 bottom-1 border border-foreground bg-background p-1 font-mono leading-tight ${large ? "text-xs" : "text-[8px]"}`}>{p.caption}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function BlockChronicles() {
  const { data, isError } = useQuery({ queryKey: ["block-comic"], queryFn: fetchComicBlocks, refetchInterval: 60_000, staleTime: 30_000 });
  const issues = useMemo(() => (data ?? []).map(buildIssue), [data]);
  const [open, setOpen] = useState<number | null>(null);
  const current = open != null ? issues[open] : null;

  return (
    <section className="mx-auto max-w-[1600px] px-3 pt-6 md:px-5">
      <div className="border border-border bg-background p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="label text-bitcoin">THE BLOCK CHRONICLES // ONE ISSUE PER BLOCK</div>
            <p className="mt-1 text-sm text-muted-foreground">Every new Bitcoin block prints a comic, drawn from that block's real data.</p>
          </div>
          {isError && <span className="font-mono text-[10px] text-muted-foreground">BLOCK FEED OFFLINE — RETRYING</span>}
        </div>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
          {issues.length === 0 && !isError && <div className="font-mono text-xs text-muted-foreground">PRINTING LATEST ISSUES…</div>}
          {issues.map((iss, i) => (
            <button key={iss.hash} type="button" onClick={() => setOpen(i)} className="w-56 shrink-0 border border-border p-2 text-left hover:border-bitcoin">
              <div className="flex justify-between font-mono text-[10px]">
                <span className="text-bitcoin">ISSUE #{iss.height}</span>
                {i === 0 && <span className="text-signal">● NEW</span>}
              </div>
              <div className="display mb-2 truncate text-sm">{iss.title}</div>
              <Strip issue={iss} />
            </button>
          ))}
        </div>
      </div>
      <Dialog open={current != null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          {current && (
            <>
              <DialogTitle className="display">ISSUE #{current.height} — {current.title}</DialogTitle>
              <Strip issue={current} large />
              <div className="flex items-center justify-between gap-2">
                <button type="button" className="btn-term-ghost" disabled={open === issues.length - 1} onClick={() => setOpen((o) => (o ?? 0) + 1)}>← OLDER</button>
                <a href={`https://mempool.space/block/${current.hash}`} target="_blank" rel="noreferrer" className="font-mono text-[10px] text-signal">VERIFY BLOCK ↗</a>
                <button type="button" className="btn-term-ghost" disabled={open === 0} onClick={() => setOpen((o) => (o ?? 1) - 1)}>NEWER →</button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

import type React from "react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildIssue, fetchComicBlocks, seedFrom, type ComicIssue, type ComicPanel } from "@/lib/block-comic";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { GuardianPortrait } from "@/components/bitmon/GuardianPortrait";

/** Isometric voxel land for a block: deterministic towers from the block hash. */
function VoxelLand({ hash, salt, className = "" }: { hash: string; salt: number; className?: string }) {
  const cubes = useMemo(() => {
    const r = seedFrom(hash, salt);
    const out: React.ReactElement[] = [];
    const N = 5;
    for (let gx = 0; gx < N; gx++)
      for (let gy = 0; gy < N; gy++) {
        const h = 1 + Math.floor(r() * r() * 4);
        const tone = r() > 0.78 ? "bitcoin" : r() > 0.85 ? "signal" : "foreground";
        for (let z = 0; z < h; z++) {
          const x = 50 + (gx - gy) * 8;
          const y = 52 + (gx + gy) * 4 - z * 8;
          const top = z === h - 1;
          out.push(
            <g key={`${gx}-${gy}-${z}`}>
              <polygon points={`${x},${y} ${x + 8},${y + 4} ${x},${y + 8} ${x - 8},${y + 4}`} className={top ? `fill-${tone}` : "fill-muted"} opacity={top ? 1 : 0.6} />
              <polygon points={`${x - 8},${y + 4} ${x},${y + 8} ${x},${y + 16} ${x - 8},${y + 12}`} className={`fill-${tone}`} opacity={0.55} />
              <polygon points={`${x},${y + 8} ${x + 8},${y + 4} ${x + 8},${y + 12} ${x},${y + 16}`} className={`fill-${tone}`} opacity={0.3} />
            </g>,
          );
        }
      }
    return out;
  }, [hash, salt]);
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {cubes}
    </svg>
  );
}

function Halftone({ seed, kind }: { seed: number; kind: number }) {
  const id = `ht-${seed}-${kind}`;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform={`rotate(${15 + kind * 30})`}>
          <circle cx="2" cy="2" r={0.6 + kind * 0.2} className="fill-bitcoin" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill={`url(#${id})`} opacity="0.35" />
      {[...Array(10)].map((_, i) => (
        <line key={i} x1="50" y1="50" x2={50 + 80 * Math.cos(i * 0.63)} y2={50 + 80 * Math.sin(i * 0.63)} className="stroke-foreground" strokeWidth="0.3" opacity="0.25" />
      ))}
    </svg>
  );
}

function PanelArt({ panel, kind, issue }: { panel: ComicPanel; kind: number; issue: ComicIssue }) {
  const shapes = useMemo(() => {
    const r = seedFrom(issue.hash, panel.seed);
    const out: React.ReactElement[] = [];
    if (kind === 0) for (let i = 0; i < 7; i++) { const h = 30 + r() * 50; out.push(<rect key={i} x={8 + i * 14} y={100 - h} width={10} height={h} className="fill-foreground" opacity={0.85} />); }
    if (kind === 1) for (let i = 0; i < 40; i++) out.push(<rect key={i} x={r() * 96} y={r() * 96} width={3 + r() * 6} height={3 + r() * 6} className={i % 5 ? "fill-foreground" : "fill-bitcoin"} />);
    if (kind === 3) { out.push(<rect key="s" x={25} y={15} width={50} height={40} className="fill-foreground" />); out.push(<rect key="b" x={15} y={70} width={70} height={14} className="fill-bitcoin" />); }
    return out;
  }, [issue.hash, panel.seed, kind]);
  return (
    <div className="absolute inset-0 bg-background">
      <Halftone seed={panel.seed} kind={kind} />
      {kind === 2 ? (
        <>
          <VoxelLand hash={issue.hash} salt={panel.seed} className="absolute inset-0 h-full w-full" />
          <div className="absolute left-1/2 top-[8%] -translate-x-1/2">
            <GuardianPortrait height={issue.height} size={64} />
          </div>
        </>
      ) : (
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">{shapes}</svg>
      )}
    </div>
  );
}

function Strip({ issue }: { issue: ComicIssue }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
      {issue.panels.map((p, i) => (
        <figure key={i} className="relative aspect-square overflow-hidden border-2 border-foreground">
          <PanelArt panel={p} kind={i} issue={issue} />
          <span className="absolute left-1 top-1 bg-foreground px-1 font-mono text-[9px] font-bold text-background">{p.kicker}</span>
          <span className="display absolute right-2 top-6 -rotate-6 text-2xl text-bitcoin">{p.sfx}</span>
          <figcaption className="absolute inset-x-1 bottom-1 border border-foreground bg-background p-1 font-mono text-xs leading-tight">{p.caption}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Comic cover tile — the mempool "block cube" of the Chronicles. */
function Cover({ issue, isNew, onOpen }: { issue: ComicIssue; isNew: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="chronicle-in relative h-[132px] w-[118px] shrink-0 overflow-hidden border-2 border-foreground bg-background text-left hover:border-bitcoin"
    >
      <Halftone seed={issue.height} kind={issue.height % 4} />
      <VoxelLand hash={issue.hash} salt={issue.height} className="absolute inset-x-0 bottom-0 h-[86px] w-full" />
      <div className="absolute right-0 top-4">
        <GuardianPortrait height={issue.height} size={40} />
      </div>
      <div className="absolute inset-x-0 top-0 flex justify-between bg-foreground px-1 font-mono text-[9px] font-bold text-background">
        <span>#{issue.height}</span>
        {isNew && <span className="text-bitcoin">NEW</span>}
      </div>
      <div className="display absolute left-1 top-4 w-[70px] text-[10px] leading-tight text-bitcoin">{issue.title}</div>
      <div className="absolute inset-x-0 bottom-0 border-t border-foreground bg-background/90 px-1 font-mono text-[8px] leading-tight">
        {issue.block.txCount.toLocaleString("en-US")} TX · {issue.block.medianFee != null ? `${issue.block.medianFee.toFixed(1)} S/VB` : "—"}
        <div className="truncate text-muted-foreground">{(issue.block.pool ?? "UNKNOWN").toUpperCase()}</div>
      </div>
    </button>
  );
}

/** THE BLOCK CHRONICLES — top-of-page banner: one comic issue per mined block, newest on the left. */
export function BlockChronicles() {
  const { data, isError } = useQuery({ queryKey: ["block-comic"], queryFn: fetchComicBlocks, refetchInterval: 30_000, staleTime: 20_000 });
  const issues = useMemo(() => (data ?? []).map(buildIssue), [data]);
  const [open, setOpen] = useState<number | null>(null);
  const current = open != null ? issues[open] : null;
  const next = issues[0] ? issues[0].height + 1 : null;

  return (
    <section className="border-b border-border bg-card" data-no-translate>
      <div className="mx-auto flex max-w-[1600px] items-stretch gap-3 overflow-x-auto px-3 py-3 md:px-5">
        <div className="flex shrink-0 flex-col justify-between">
          <div className="label text-bitcoin">THE BLOCK<br />CHRONICLES</div>
          <div className="font-mono text-[9px] text-muted-foreground">{isError ? "FEED OFFLINE" : "ONE ISSUE / BLOCK"}</div>
        </div>
        {next != null && (
          <div className="flex h-[132px] w-[118px] shrink-0 flex-col items-center justify-center border-2 border-dashed border-signal p-2 text-center">
            <span className="size-2 animate-pulse bg-signal" aria-hidden="true" />
            <div className="mt-2 font-mono text-[10px] text-signal">ISSUE #{next}</div>
            <div className="mt-1 font-mono text-[9px] text-muted-foreground">INKING IN THE MEMPOOL…</div>
          </div>
        )}
        <div className="w-px shrink-0 border-l border-dashed border-border" aria-hidden="true" />
        {issues.length === 0 && !isError && <div className="self-center font-mono text-xs text-muted-foreground">PRINTING LATEST ISSUES…</div>}
        {issues.map((iss, i) => (
          <Cover key={iss.hash} issue={iss} isNew={i === 0} onOpen={() => setOpen(i)} />
        ))}
      </div>
      <Dialog open={current != null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          {current && (
            <>
              <DialogTitle className="display">ISSUE #{current.height} — {current.title}</DialogTitle>
              <Strip issue={current} />
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

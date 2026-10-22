import type React from "react";
import { lazy, Suspense, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { inhabitedQuery } from "@/lib/inhabited.functions";
const ComicGuardian3D = lazy(() => import("@/components/ComicGuardian3D"));

function Guardian3D({ height, guardian }: { height: number; guardian: boolean }) {
  return (
    <ClientOnly fallback={null}>
      <Suspense fallback={null}>
        <ComicGuardian3D height={height} guardian={guardian} />
      </Suspense>
    </ClientOnly>
  );
}
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { blockSizeMapQuery } from "@/lib/block-bytes";
import { parcelRects } from "@/lib/forge-parcels";
import { buildIssue, fetchComicBlocks, fetchComicBlocksAt, seedFrom, type ComicIssue, type ComicPanel } from "@/lib/block-comic";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { GuardianPortrait } from "@/components/bitmon/GuardianPortrait";

/** The BITMAP as it stands in the Oasis: its real transaction parcels on an isometric tile. */
function VoxelLand({ height, className = "" }: { hash?: string; salt?: number; height: number; className?: string }) {
  const { data } = useQuery({ ...blockSizeMapQuery(height), staleTime: Infinity });
  const paths = useMemo(() => {
    const rects = parcelRects(data?.classes, 64);
    // iso projection of tile cell (x,z) in 0..64 → svg
    const P = (x: number, z: number) => `${(50 + (x - z) * 0.72).toFixed(1)},${(46 + (x + z) * 0.36).toFixed(1)}`;
    let big = "", mid = "", small = "";
    for (const r of rects) {
      const i = Math.min(0.25, (r.x1 - r.x0) * 0.08);
      const d = `M${P(r.x0 + i, r.z0 + i)}L${P(r.x1 - i, r.z0 + i)}L${P(r.x1 - i, r.z1 - i)}L${P(r.x0 + i, r.z1 - i)}Z`;
      if (r.size >= 4) big += d; else if (r.size >= 2) mid += d; else small += d;
    }
    return { big, mid, small, tile: `M${P(0, 0)}L${P(64, 0)}L${P(64, 64)}L${P(0, 64)}Z`, side: `M${P(0, 64)}L${P(64, 64)}L${P(64, 0)}L${P(64, 0).split(",")[0]},${(46 + 64 * 0.36 + 6).toFixed(1)}L${P(64, 64).split(",")[0]},${(46 + 128 * 0.36 + 6).toFixed(1)}L${P(0, 64).split(",")[0]},${(46 + 64 * 0.36 + 6).toFixed(1)}Z` };
  }, [data]);
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d={paths.side} className="fill-muted" opacity={0.8} />
      <path d={paths.tile} className="fill-background stroke-signal" strokeWidth={0.4} />
      <path d={paths.small} className="fill-signal" opacity={0.35} />
      <path d={paths.mid} className="fill-bitcoin" opacity={0.6} />
      <path d={paths.big} className="fill-bitcoin" />
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

function PanelArt({ panel, kind, issue, inscribed, built }: { panel: ComicPanel; kind: number; issue: ComicIssue; inscribed: string | null; built: boolean }) {
  const shapes = useMemo(() => {
    const r = seedFrom(issue.hash, panel.seed);
    const out: React.ReactElement[] = [];
    const b = issue.block;
    const v = Math.floor(r() * 3); // archetype variant, from the block hash
    const F = "fill-foreground", O = "fill-bitcoin", S = "stroke-foreground";
    if (kind === 0) {
      if (v === 0) { // ASIC rack: rows of rigs with spinning fans
        for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) { const X = 8 + x * 30, Y = 10 + y * 20; out.push(<rect key={`r${x}${y}`} x={X} y={Y} width={26} height={16} className={F} />, <circle key={`f${x}${y}`} cx={X + 8} cy={Y + 8} r={5} className="fill-background" />, <line key={`b${x}${y}`} x1={X + 4} y1={Y + 8 + (r() - 0.5) * 6} x2={X + 12} y2={Y + 8 - (r() - 0.5) * 6} className={S} strokeWidth={1} />, <rect key={`l${x}${y}`} x={X + 18} y={Y + 5} width={4} height={2} className={r() > 0.4 ? O : "fill-signal"} />); }
      } else if (v === 1) { // the miner descends a shaft on a cable
        const d = 30 + r() * 30;
        out.push(<line key="c" x1={50} y1={0} x2={50} y2={d} className={S} strokeWidth={0.8} />, <rect key="h" x={42} y={d} width={16} height={22} className={F} />, <circle key="hd" cx={50} cy={d - 4} r={6} className={F} />, <rect key="lamp" x={47} y={d - 9} width={6} height={3} className={O} />, <polygon key="beam" points={`50,${d - 8} 20,100 80,100`} className={O} opacity={0.25} />);
        for (let i = 0; i < 6; i++) out.push(<rect key={`w${i}`} x={i % 2 ? 2 : 88} y={i * 17} width={10} height={14} className={F} opacity={0.6} />);
      } else { // nonce spiral: hash-search rings
        for (let i = 0; i < 8; i++) out.push(<circle key={i} cx={50} cy={46} r={6 + i * 5} fill="none" className={i === 7 ? "stroke-bitcoin" : S} strokeWidth={i === 7 ? 2 : 0.6} strokeDasharray={`${2 + r() * 6} ${2 + r() * 4}`} />);
        out.push(<circle key="core" cx={50} cy={46} r={4} className={O} />);
      }
    }
    if (kind === 1) {
      const n = Math.min(60, Math.max(8, Math.round(b.txCount / 80)));
      const hot = Math.min(1, (b.medianFee ?? 1) / 30);
      if (v === 0) { // mempool pyramid: tx count fills the block
        let k = 0; for (let row = 0; row < 8 && k < n; row++) for (let c = 0; c <= row && k < n; c++, k++) out.push(<rect key={k} x={50 - row * 5.5 + c * 11} y={12 + row * 10} width={10} height={9} className={r() < hot ? O : F} />);
      } else if (v === 1) { // fee pipes: thicker = higher fee
        for (let i = 0; i < 5; i++) { const w = 3 + r() * 6 * (0.4 + hot); const y = 14 + i * 16; out.push(<rect key={`p${i}`} x={0} y={y} width={100} height={w} className={i % 2 ? F : O} opacity={0.85} />); for (let j = 0; j < 4; j++) out.push(<rect key={`q${i}${j}`} x={r() * 90} y={y - 2} width={6} height={w + 4} className="fill-background stroke-foreground" strokeWidth={0.5} />); }
      } else { // the queue: txs crowding through a gate
        out.push(<rect key="g1" x={44} y={0} width={4} height={40} className={F} />, <rect key="g2" x={44} y={60} width={4} height={40} className={F} />);
        for (let i = 0; i < n; i++) { const left = i < n * 0.8; out.push(<rect key={i} x={left ? r() * 40 : 52 + r() * 44} y={left ? 10 + r() * 80 : 42 + r() * 16} width={3 + r() * 4} height={3 + r() * 4} className={left ? F : O} />); }
      }
    }
    if (kind === 3) {
      const hex = issue.hash.replace(/^0+/, "").slice(0, 16).toUpperCase();
      if (v === 0) { // wax seal with the block hash around it
        out.push(<circle key="s" cx={50} cy={45} r={28} className={O} />, <circle key="i" cx={50} cy={45} r={20} fill="none" className="stroke-background" strokeWidth={1.5} />, <text key="h" x={50} y={50} textAnchor="middle" className="fill-background font-mono" fontSize={12} fontWeight={700}>{issue.height % 1000}</text>, <text key="x" x={50} y={88} textAnchor="middle" className="fill-foreground font-mono" fontSize={5}>{hex}</text>);
      } else if (v === 1) { // chain links: this block snaps onto the previous ones
        for (let i = 0; i < 4; i++) out.push(<rect key={i} x={6 + i * 23} y={34} width={19} height={19} className={i === 3 ? O : F} />, i < 3 ? <rect key={`l${i}`} x={24 + i * 23} y={42} width={6} height={3} className={F} /> : <g key="n" />);
        out.push(<text key="x" x={50} y={72} textAnchor="middle" className="fill-foreground font-mono" fontSize={5}>{hex}</text>);
      } else { // the vault door slams shut
        out.push(<rect key="d" x={18} y={12} width={64} height={64} className={F} />, <circle key="w" cx={50} cy={44} r={18} fill="none" className="stroke-background" strokeWidth={3} />);
        for (let i = 0; i < 6; i++) { const a = i * 1.047 + r(); out.push(<line key={i} x1={50} y1={44} x2={50 + 18 * Math.cos(a)} y2={44 + 18 * Math.sin(a)} className="stroke-background" strokeWidth={2} />); }
        out.push(<rect key="b" x={10} y={80} width={80} height={6} className={O} />);
      }
    }
    return out;
  }, [issue.hash, panel.seed, kind]);
  return (
    <div className="absolute inset-0 bg-background">
      <Halftone seed={panel.seed} kind={kind} />
      {kind === 2 ? (
        <>
          {built || inscribed ? (
            <div className="absolute inset-x-0 top-6 bottom-12"><Guardian3D height={issue.height} guardian={!!inscribed} /></div>
          ) : (<>
            <VoxelLand height={issue.height} className="absolute inset-0 h-full w-full" />
            <div className="absolute left-1/2 top-[8%] -translate-x-1/2 opacity-40 grayscale">
              <GuardianPortrait height={issue.height} size={64} />
            </div>
          </>)}
        </>
      ) : (
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">{shapes}</svg>
      )}
    </div>
  );
}

function Strip({ issue, inscribed, built }: { issue: ComicIssue; inscribed: string | null; built: boolean }) {
  return (
    <div className="border-4 border-foreground bg-background p-1">
      <div className="mb-1 flex items-center justify-between gap-2 border-2 border-foreground bg-bitcoin px-2 py-1 text-background">
        <span className="font-mono text-[10px] font-bold">NO. {issue.height} · 546 SATS</span>
        <span className="display truncate text-sm">{issue.era}</span>
        <span className="border border-background px-1 font-mono text-[8px] font-bold leading-tight">APPROVED BY<br />THE TIMECHAIN</span>
      </div>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {issue.panels.map((p, i) => (
          <figure key={i} className="relative aspect-square overflow-hidden border-2 border-foreground">
            <PanelArt panel={p} kind={i} issue={issue} inscribed={inscribed} built={built} />
            <span className="absolute left-1 top-1 bg-foreground px-1 font-mono text-[9px] font-bold text-background">{p.kicker}</span>
            <span className="display absolute right-2 top-6 -rotate-6 text-2xl text-bitcoin">{p.sfx}</span>
            {i === 2 && inscribed && (
              <div className="absolute left-3 top-8 max-w-[60%] rounded-2xl border-2 border-foreground bg-foreground px-2 py-1 font-mono text-[10px] font-bold leading-tight text-background">
                “{issue.cry}”
              </div>
            )}
            <figcaption className="absolute inset-x-1 bottom-1 border-2 border-foreground bg-bitcoin p-1 font-mono text-[10px] font-bold leading-tight text-background">
              {i === 2 ? (inscribed ? `${p.caption} ITS GUARDIAN OPENS ITS EYES — SENTINEL OF THIS TERRITORY.` : `${p.caption} BUT THE THRONE SITS VACANT. THE LAND SLEEPS UNTIL A SUMMONER SPEAKS ITS NAME.`) : p.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

/** Comic cover tile — the mempool "block cube" of the Chronicles. */
function Cover({ issue, isNew, onOpen, inscribed, built }: { issue: ComicIssue; isNew: boolean; onOpen: () => void; inscribed: string | null; built: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="chronicle-in group relative h-[200px] min-w-0 overflow-hidden sm:min-w-[150px] sm:flex-1 border border-border-strong bg-background text-left shadow-[inset_0_1px_0_color-mix(in_oklab,var(--foreground)_10%,transparent)] transition-all duration-300 hover:-translate-y-0.5 hover:border-bitcoin hover:shadow-[0_8px_24px_-12px_var(--bitcoin)]"
    >
      <Halftone seed={issue.height} kind={issue.height % 4} />
      {built || inscribed ? (
        <div className="absolute inset-x-0 top-[34px] bottom-[34px] transition-transform duration-500 group-hover:scale-105"><Guardian3D height={issue.height} guardian={!!inscribed} /></div>
      ) : (<>
        <VoxelLand height={issue.height} className="absolute inset-x-0 bottom-2 h-[130px] w-full transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute right-1 top-7 opacity-40 grayscale"><GuardianPortrait height={issue.height} size={48} /></div>
      </>)}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-border-strong bg-background/85 px-2 py-1 font-mono text-[10px] font-bold backdrop-blur-sm">
        <span className="text-foreground">#{issue.height}</span>
        {isNew && <span className="flex items-center gap-1 text-bitcoin"><span className="size-1.5 animate-pulse bg-bitcoin" />NEW</span>}
      </div>
      <div className="display absolute left-2 top-7 w-[70%] text-sm leading-tight text-bitcoin drop-shadow-[0_1px_0_var(--background)]">{issue.title}</div>
      <div className="absolute inset-x-0 bottom-0 border-t border-border-strong bg-background/90 px-2 py-1 font-mono text-[9px] leading-tight backdrop-blur-sm">
        <span className="text-signal">{issue.block.txCount.toLocaleString("en-US")} TX</span> · {issue.block.medianFee != null ? `${issue.block.medianFee.toFixed(1)} S/VB` : "—"}
        <div className="truncate text-muted-foreground">{(issue.block.pool ?? "UNKNOWN").toUpperCase()}</div>
      </div>
    </button>
  );
}

/** THE BLOCK CHRONICLES — top-of-page banner: one comic issue per mined block, newest on the left. */
export function BlockChronicles() {
  const { data, isError: liveError } = useQuery({ queryKey: ["block-comic"], queryFn: fetchComicBlocks, refetchInterval: 30_000, staleTime: 20_000 });
  const { data: inhabited } = useQuery(inhabitedQuery());
  const live = useMemo(() => (data ?? []).map(buildIssue), [data]);
  // Every BITMAP with an inscribed Guardian child gets its own issue too (newest children first).
  const liveHeights = useMemo(() => new Set(live.map((i) => i.height)), [live]);
  const { data: builtList } = useQuery({
    queryKey: ["block-comic-built"],
    queryFn: async () => ((await supabase.from("bitmap_forge_builds").select("bitmap_height").order("verified_at", { ascending: false }).limit(12)).data ?? []).map((r) => r.bitmap_height as number),
    staleTime: 10 * 60_000,
  });
  const builtSet = useMemo(() => new Set(builtList ?? []), [builtList]);
  // Recently verified Forge builds first (newest update first), then inscribed Guardian lands.
  const guardianHeights = useMemo(
    () => [...new Set([...(builtList ?? []), ...[...(inhabited ?? new Map<number, string>()).keys()].reverse()])].slice(0, 24),
    [inhabited, builtList],
  );
  // Every built or inhabited BITMAP gets its issue, built from its real block.
  const { data: gBlocks, isError: gError } = useQuery({
    queryKey: ["block-comic-guardians", guardianHeights],
    queryFn: () => fetchComicBlocksAt(guardianHeights),
    enabled: guardianHeights.length > 0,
    staleTime: Infinity,
    retry: 4,
    retryDelay: (n) => Math.min(30_000, 2_000 * 2 ** n),
  });
  const guardianIssues = useMemo(() => {
    const byH = new Map((gBlocks ?? []).map((b) => [b.height, b]));
    return guardianHeights.map((h) => byH.get(h)).filter((b): b is NonNullable<typeof b> => b != null).map(buildIssue);
  }, [gBlocks, guardianHeights]);
  // Until Guardian issues arrive (or if they can't load), show the latest mined blocks instead of an empty strip.
  const issues = guardianIssues.length > 0 ? guardianIssues : live;
  const isError = liveError && (gError || guardianIssues.length === 0);
  const insOf = (h: number) => inhabited?.get(h) ?? null;
  const [open, setOpen] = useState<number | null>(null);
  // Only ISSUES_PER_PAGE covers at a time; older issues sit on the next page.
  const ISSUES_PER_PAGE = 5;
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(issues.length / ISSUES_PER_PAGE));
  const cur = Math.min(page, pages - 1);
  const shown = issues.slice(cur * ISSUES_PER_PAGE, cur * ISSUES_PER_PAGE + ISSUES_PER_PAGE);
  const current = open != null ? issues[open] : null;
  const next = live[0] ? live[0].height + 1 : null;

  return (
    <section className="border-b border-border bg-card" data-no-translate>
      <div className="mx-auto max-w-[1600px] px-3 pt-3 md:px-5 md:pt-5">
      <div className="grid grid-cols-2 gap-2 border border-border-strong sm:flex sm:items-stretch sm:gap-3 sm:overflow-x-auto bg-background/60 p-3 backdrop-blur-sm">
        <div className="col-span-2 flex flex-row items-end justify-between gap-2 border-b border-border pb-2 sm:w-[130px] sm:shrink-0 sm:flex-col sm:items-stretch sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3">
          <div>
            <div className="label flex items-center gap-2 text-bitcoin"><span className="size-2 bg-bitcoin" />CHRONICLES</div>
            <div className="display mt-2 text-xl leading-none">THE<br className="hidden sm:block" /> BLOCK<br className="hidden sm:block" /> <span className="text-bitcoin">COMICS</span></div>
          </div>
          <div className="font-mono text-[9px] text-muted-foreground">{isError ? "FEED OFFLINE" : "ONE ISSUE / BLOCK"}</div>
        </div>
        {next != null && (
          <div className="flex h-[200px] min-w-0 flex-col items-center justify-center border border-dashed sm:w-[150px] sm:shrink-0 border-signal bg-signal/5 p-3 text-center">
            <span className="size-3 animate-pulse bg-signal shadow-[0_0_12px_var(--signal)]" aria-hidden="true" />
            <div className="mt-3 font-mono text-xs font-bold text-signal">ISSUE #{next}</div>
            <div className="mt-1 font-mono text-[9px] text-muted-foreground">INKING IN THE MEMPOOL…</div>
          </div>
        )}
        {issues.length === 0 && !isError && <div className="self-center font-mono text-xs text-muted-foreground">PRINTING LATEST ISSUES…</div>}
        {issues.length === 0 && isError && <div className="self-center font-mono text-xs text-muted-foreground">BLOCK FEED BUSY — RETRYING AUTOMATICALLY…</div>}
        {shown.map((iss, i) => {
          const at = cur * ISSUES_PER_PAGE + i;
          return (
            <Cover key={iss.hash} issue={iss} isNew={at === 0} inscribed={insOf(iss.height)} built={builtSet.has(iss.height)} onOpen={() => setOpen(at)} />
          );
        })}
        {issues.length > ISSUES_PER_PAGE && (
          <div className="col-span-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-t border-border pt-2 sm:flex sm:h-[200px] sm:w-[70px] sm:shrink-0 sm:flex-col sm:gap-2 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
            <button
              type="button"
              aria-label="Newer issues"
              className="min-h-[44px] w-full min-w-0 truncate border border-border bg-background px-3 py-2 font-mono text-xs font-bold uppercase text-muted-foreground hover:border-bitcoin hover:text-foreground disabled:opacity-30 sm:min-h-0 sm:w-auto sm:px-2 sm:py-1.5 sm:text-[9px]"
              disabled={cur === 0}
              onClick={() => setPage(Math.max(0, cur - 1))}
            >
              NEWER ↑
            </button>
            <span className="font-mono text-xs font-bold text-muted-foreground sm:text-[9px]">{cur + 1}/{pages}</span>
            <button
              type="button"
              aria-label="Older issues"
              className="min-h-[44px] w-full min-w-0 truncate border border-border bg-background px-3 py-2 font-mono text-xs font-bold uppercase text-muted-foreground hover:border-bitcoin hover:text-foreground disabled:opacity-30 sm:min-h-0 sm:w-auto sm:px-2 sm:py-1.5 sm:text-[9px]"
              disabled={cur >= pages - 1}
              onClick={() => setPage(Math.min(pages - 1, cur + 1))}
            >
              OLDER ↓
            </button>
          </div>
        )}
      </div>
      </div>
      <Dialog open={current != null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          {current && (
            <>
              <DialogTitle className="display">ISSUE #{current.height} — {current.title}</DialogTitle>
              <Strip issue={current} inscribed={insOf(current.height)} built={builtSet.has(current.height)} />
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

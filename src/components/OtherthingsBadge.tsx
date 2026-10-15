/** Umbrella collection mark: every Guardian, BITMAP, build and pet belongs to THE OTHERTHINGS. */
export function OtherthingsBadge({ child }: { child?: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
      <span aria-hidden>◈</span>
      <span>The Otherthings</span>
      {child && <span className="text-muted-foreground">· {child}</span>}
    </div>
  );
}

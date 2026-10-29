/** Live progress for one slice scan: bar, keys done, speed and time left. */
export function ScanProgress({ done, size, rate }: { done: number; size: number; rate: number }) {
  if (!size) return null;
  const pct = Math.min(100, (done / size) * 100);
  const left = rate > 0 ? Math.max(0, (size - done) / rate) : null;
  const eta = left == null ? "estimating…" : left >= 60 ? `~${Math.ceil(left / 60)} min left` : `~${Math.ceil(left)} s left`;
  return (
    <div className="mt-2 w-full font-mono text-[11px]" data-no-translate>
      <div className="h-2 w-full overflow-hidden rounded border border-border bg-background">
        <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-muted-foreground">
        <span className="text-accent">{pct.toFixed(1)}%</span> · {(done / 1e6).toFixed(2)}M / {(size / 1e6).toFixed(1)}M keys · {(rate / 1000).toFixed(1)}k/s · {eta}
      </p>
    </div>
  );
}

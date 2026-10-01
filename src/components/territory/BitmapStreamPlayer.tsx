// Live channel for a BITMAP, served by bitmap.stream (Elevated Dabber).
// Every block can own a channel at https://<height>.bitmap.stream; we only embed it.
export function BitmapStreamPlayer({ height }: { height: number }) {
  const channel = `https://${height}.bitmap.stream`;
  return (
    <section className="border border-border bg-card" aria-labelledby={`bitmap-stream-${height}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 id={`bitmap-stream-${height}`} className="label text-signal">● {height}.BITMAP · LIVE CHANNEL</h2>
        <a href={channel} target="_blank" rel="noopener noreferrer" className="label text-muted-foreground hover:text-bitcoin">
          [ OPEN ON BITMAP.STREAM ↗ ]
        </a>
      </header>
      <div className="relative aspect-video w-full bg-background">
        <iframe
          src={`${channel}/player-embed`}
          title={`${height}.bitmap live channel`}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
      <p className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
        &gt; Channels run through bitmap.stream. If this block has no channel yet, the holder can open one at{" "}
        <a href="https://bitmap.stream" target="_blank" rel="noopener noreferrer" className="text-bitcoin hover:underline">bitmap.stream</a>.
      </p>
    </section>
  );
}

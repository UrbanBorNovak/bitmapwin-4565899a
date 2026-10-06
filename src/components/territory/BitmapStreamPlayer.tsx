// Live channel for a BITMAP. Embeds bitmap.stream when the channel exists;
// otherwise shows a compact status line so it never eats screen space.
import { useQuery } from "@tanstack/react-query";
import { probeBitmapStream } from "@/lib/bitmap-stream.functions";

export function BitmapStreamPlayer({ height }: { height: number }) {
  const channel = `https://${height}.bitmap.stream`;
  const probe = useQuery({
    queryKey: ["bitmap-stream-probe", height],
    queryFn: () => probeBitmapStream({ data: { height } }),
    staleTime: 5 * 60_000,
    retry: 0,
  });

  return (
    <section className="border border-border bg-card" aria-labelledby={`bitmap-stream-${height}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 id={`bitmap-stream-${height}`} className="label text-signal">● {height}.BITMAP · LIVE CHANNEL</h2>
        {probe.data?.exists && (
          <a href={channel} target="_blank" rel="noopener noreferrer" className="label text-muted-foreground hover:text-bitcoin">
            [ OPEN ON BITMAP.STREAM ↗ ]
          </a>
        )}
      </header>
      {probe.isPending ? (
        <div className="px-4 py-2 font-mono text-[11px] text-muted-foreground">
          &gt; CHECKING CHANNEL…
        </div>
      ) : probe.data?.exists ? (
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
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-background px-4 py-2 font-mono text-[11px]">
          <span className="text-muted-foreground">&gt; NO LIVE CHANNEL FOR {height}.BITMAP.</span>
          <a
            href="https://bitmap.stream"
            target="_blank"
            rel="noopener noreferrer"
            className="label text-muted-foreground hover:text-bitcoin"
          >
            [ START ONE AT BITMAP.STREAM ↗ ]
          </a>
        </div>
      )}
    </section>
  );
}

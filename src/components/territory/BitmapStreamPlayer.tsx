// Live channel for a BITMAP. Prefers a native WebRTC broadcast from the Oasis;
// falls back to bitmap.stream; otherwise a compact one-line status.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { probeBitmapStream } from "@/lib/bitmap-stream.functions";
import { useBitmapLiveStream } from "@/lib/webrtc-broadcast";

function LiveVideo({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  useEffect(() => {
    if (ref.current) { ref.current.srcObject = stream; void ref.current.play().catch(() => {}); }
  }, [stream]);
  return (
    <div className="relative aspect-video w-full bg-background">
      <video ref={ref} autoPlay playsInline muted={muted} className="absolute inset-0 h-full w-full object-contain" />
      <button type="button" onClick={() => setMuted((m) => !m)} className="absolute bottom-2 right-2 border border-border bg-card px-2 py-1 font-mono text-[10px] hover:border-bitcoin">
        {muted ? "UNMUTE" : "MUTE"}
      </button>
    </div>
  );
}

export function BitmapStreamPlayer({ height }: { height: number }) {
  const channel = `https://${height}.bitmap.stream`;
  const [client, setClient] = useState(false);
  useEffect(() => setClient(true), []);
  const rtc = useBitmapLiveStream(client ? height : -1);
  const probe = useQuery({
    queryKey: ["bitmap-stream-probe", height],
    queryFn: () => probeBitmapStream({ data: { height } }),
    staleTime: 5 * 60_000,
    retry: 0,
  });
  const oasisLive = client && rtc.live;

  return (
    <section className="self-start border border-border bg-card" aria-labelledby={`bitmap-stream-${height}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 id={`bitmap-stream-${height}`} className={`label ${oasisLive ? "text-bitcoin" : "text-signal"}`}>
          ● {height}.BITMAP · {oasisLive ? "LIVE FROM THE OASIS" : "LIVE CHANNEL"}
        </h2>
        {!oasisLive && probe.data?.exists && (
          <a href={channel} target="_blank" rel="noopener noreferrer" className="label text-muted-foreground hover:text-bitcoin">
            [ OPEN ON BITMAP.STREAM ↗ ]
          </a>
        )}
      </header>
      {oasisLive ? (
        rtc.stream ? <LiveVideo stream={rtc.stream} /> : (
          <div className="px-4 py-2 font-mono text-[11px] text-signal">&gt; CONNECTING TO BROADCASTER…</div>
        )
      ) : probe.isPending ? (
        <div className="px-4 py-2 font-mono text-[11px] text-muted-foreground">&gt; CHECKING CHANNEL…</div>
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
          <Link to="/oasis" search={{ height }} className="label text-muted-foreground hover:text-bitcoin">
            [ GO LIVE FROM THE OASIS → ]
          </Link>
        </div>
      )}
    </section>
  );
}

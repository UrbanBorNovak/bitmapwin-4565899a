// Live channel for a BITMAP. Embeds bitmap.stream when the channel exists;
import { GoLiveKick } from "./GoLiveKick";
// otherwise offers a Kick player and the Kick broadcast pipeline.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { probeBitmapStream } from "@/lib/bitmap-stream.functions";

const KICK_KEY = (h: number) => `bitmapwin:kick-channel:${h}`;
const RTMP = "rtmp://live.kick.com/app/";

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
        <div className="flex aspect-video items-center justify-center bg-background font-mono text-[11px] text-muted-foreground">
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
        <KickPipeline height={height} />
      )}
    </section>
  );
}

function KickPipeline({ height }: { height: number }) {
  const [input, setInput] = useState("");
  const [kick, setKick] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(KICK_KEY(height)),
  );
  const [copied, setCopied] = useState(false);

  const save = () => {
    const slug = input.trim().toLowerCase().replace(/^.*kick\.com\//, "").replace(/[^a-z0-9_-]/g, "");
    if (!slug) return;
    localStorage.setItem(KICK_KEY(height), slug);
    setKick(slug);
  };

  if (kick) {
    return (
      <div>
        <div className="relative aspect-video w-full bg-background">
          <iframe
            src={`https://player.kick.com/${kick}`}
            title={`${kick} on Kick`}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 font-mono text-[11px] text-muted-foreground">
          <span>&gt; KICK · {kick}</span>
          <button
            type="button"
            className="label hover:text-bitcoin"
            onClick={() => {
              localStorage.removeItem(KICK_KEY(height));
              setKick(null);
            }}
          >
            [ CHANGE CHANNEL ]
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 bg-background p-5 font-mono text-[12px]">
      <p className="text-muted-foreground">
        &gt; NO BITMAP.STREAM CHANNEL FOR {height}.BITMAP YET. STREAM IT OVER KICK INSTEAD.
      </p>

      <div>
        <p className="label text-bitcoin">01 · WATCH A KICK CHANNEL HERE</p>
        <div className="mt-2 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="kick channel name or link"
            className="min-w-0 flex-1 border border-border bg-card px-3 py-2 text-foreground outline-none focus:border-signal"
          />
          <button type="button" onClick={save} className="btn-term px-4">
            [ PLAY ]
          </button>
        </div>
      </div>

      <GoLiveKick label={`${height}.bitmap`} />

      <p className="text-muted-foreground">
        &gt; Prefer a native channel? Holders can open one at{" "}
        <a href="https://bitmap.stream" target="_blank" rel="noopener noreferrer" className="text-bitcoin hover:underline">
          bitmap.stream
        </a>
        .
      </p>
    </div>
  );
}

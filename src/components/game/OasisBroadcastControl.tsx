// Go live from the Oasis: streams the 3D world view to <height>.BITMAP's live channel.
import { useEffect, useRef, useState } from "react";
import { Radio, Square } from "lucide-react";
import { startBroadcast } from "@/lib/webrtc-broadcast";

export function OasisBroadcastControl({ defaultHeight }: { defaultHeight?: number }) {
  const [height, setHeight] = useState(String(defaultHeight ?? 0));
  const [mic, setMic] = useState(false);
  const [live, setLive] = useState<number | null>(null);
  const [viewers, setViewers] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopRef.current?.(), []);

  const stop = () => { stopRef.current?.(); stopRef.current = null; setLive(null); setViewers(0); };

  const go = async () => {
    setError(null);
    const h = Number(height);
    if (!Number.isInteger(h) || h < 0 || h >= 1_000_000) return setError("ENTER A VALID BITMAP HEIGHT.");
    const canvas = document.querySelector<HTMLCanvasElement>('[data-tour="map-world"] canvas');
    if (!canvas || typeof canvas.captureStream !== "function") return setError("THE 3D WORLD IS NOT READY YET.");
    const stream = canvas.captureStream(30);
    const tracks: MediaStreamTrack[] = [];
    if (mic) {
      try {
        const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
        audio.getAudioTracks().forEach((t) => { stream.addTrack(t); tracks.push(t); });
      } catch { setError("MICROPHONE BLOCKED — STREAMING VIDEO ONLY."); }
    }
    const end = startBroadcast(h, stream, setViewers);
    stopRef.current = () => { end(); stream.getTracks().forEach((t) => t.stop()); tracks.forEach((t) => t.stop()); };
    setLive(h);
  };

  return (
    <section className="mt-3 flex flex-wrap items-center gap-3 border border-border bg-card px-4 py-3 font-mono text-xs" aria-label="Broadcast">
      <Radio className={`size-4 ${live !== null ? "animate-pulse text-bitcoin" : "text-signal"}`} aria-hidden="true" />
      {live === null ? (
        <>
          <span className="label text-signal">GO LIVE ON A BITMAP</span>
          <input
            value={height}
            onChange={(e) => setHeight(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            aria-label="BITMAP height"
            className="w-28 border border-border bg-background px-2 py-1 text-foreground"
          />
          <span className="text-muted-foreground">.BITMAP</span>
          <label className="flex items-center gap-1 text-muted-foreground">
            <input type="checkbox" checked={mic} onChange={(e) => setMic(e.target.checked)} /> MIC
          </label>
          <button type="button" onClick={go} className="ml-auto border border-bitcoin px-3 py-1 text-bitcoin hover:bg-bitcoin/10">
            ● START BROADCAST
          </button>
        </>
      ) : (
        <>
          <span className="label text-bitcoin">ON AIR · {live.toLocaleString("en-US")}.BITMAP</span>
          <span className="text-muted-foreground">{viewers} WATCHING</span>
          <a href={`/bitmap/${live}`} target="_blank" rel="noopener noreferrer" className="text-signal hover:text-bitcoin">OPEN CHANNEL ↗</a>
          <button type="button" onClick={stop} className="ml-auto flex items-center gap-1 border border-border px-3 py-1 hover:border-bitcoin">
            <Square className="size-3" /> END
          </button>
        </>
      )}
      {error && <p className="w-full text-bitcoin">&gt; {error}</p>}
    </section>
  );
}

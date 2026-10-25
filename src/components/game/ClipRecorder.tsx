import { useEffect, useRef, useState } from "react";
import { Video, Square, X, Download } from "lucide-react";

/**
 * Engine clip recorder: records the largest live 3D canvas on the page
 * (canvas.captureStream + MediaRecorder) into a WebM/MP4 clip, fully in-browser.
 * Optional 9:16 reel mode centre-crops through an offscreen 2D canvas.
 */
type Mode = "8" | "15" | "30";
const FPS = 30;

function pickMime(): string {
  const types = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  for (const t of types) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  return "";
}

function findCanvas(): HTMLCanvasElement | null {
  let best: HTMLCanvasElement | null = null;
  let area = 0;
  document.querySelectorAll("canvas").forEach((c) => {
    const a = c.clientWidth * c.clientHeight;
    if (a > area) { area = a; best = c; }
  });
  return best;
}

export function ClipRecorder({ label = "bitmapwin", floating = false }: { label?: string; floating?: boolean }) {
  const [open, setOpen] = useState(false);
  const [secs, setSecs] = useState<Mode>("8");
  const [vertical, setVertical] = useState(false);
  const [rec, setRec] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState<{ url: string; ext: string } | null>(null);
  const [err, setErr] = useState("");
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => () => { stopRef.current(); }, []);
  useEffect(() => () => { if (clip) URL.revokeObjectURL(clip.url); }, [clip]);

  const start = () => {
    setErr("");
    const src = findCanvas();
    const mime = pickMime();
    if (!src || !mime || !src.captureStream) { setErr("Recording isn't supported in this browser."); return; }
    let stream: MediaStream;
    let raf = 0;
    if (vertical) {
      const h = Math.min(src.height, 1920);
      const w = Math.round((h * 9) / 16);
      const out = document.createElement("canvas");
      out.width = w; out.height = h;
      const g = out.getContext("2d")!;
      const draw = () => {
        const sh = src.height, sw = Math.min(src.width, Math.round((sh * 9) / 16));
        g.drawImage(src, (src.width - sw) / 2, 0, sw, sh, 0, 0, w, h);
        raf = requestAnimationFrame(draw);
      };
      draw();
      stream = out.captureStream(FPS);
    } else {
      stream = src.captureStream(FPS);
    }
    const chunks: Blob[] = [];
    const mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const t0 = performance.now();
    const tick = setInterval(() => {
      const s = (performance.now() - t0) / 1000;
      setElapsed(s);
      if (s >= Number(secs)) stop();
    }, 100);
    const stop = () => {
      clearInterval(tick);
      cancelAnimationFrame(raf);
      if (mr.state !== "inactive") mr.stop();
      stopRef.current = () => {};
    };
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      setRec(false);
      const blob = new Blob(chunks, { type: mime.split(";")[0] });
      if (!blob.size) { setErr("Nothing was captured — try again."); return; }
      setClip({ url: URL.createObjectURL(blob), ext: mime.includes("mp4") ? "mp4" : "webm" });
    };
    stopRef.current = stop;
    setClip(null); setElapsed(0); setRec(true); setOpen(false);
    mr.start(250);
  };

  const shareText = encodeURIComponent(`Live from the BITMAPWIN engine 🟧 every block here comes from Bitcoin. Step in: bitmapwin.app/${label === "launch" ? "launch" : "oasis"}`);

  return (
    <div className={floating ? "fixed bottom-4 right-4 z-50" : "relative"}>
      {rec ? (
        <button type="button" onClick={() => stopRef.current()} className="hud-panel hud-keep flex h-11 items-center gap-2 rounded px-3 font-mono text-xs text-destructive" aria-label="Stop recording">
          <span className="size-2 animate-pulse rounded-full bg-destructive" /> REC {elapsed.toFixed(1)}s / {secs}s <Square className="size-3" />
        </button>
      ) : (
        <button type="button" onClick={() => setOpen((v) => !v)} className={`hud-panel hud-keep grid size-11 place-items-center ${open ? "text-bitcoin" : "text-signal"} hover:text-bitcoin`} aria-label="Record clip" title="Record clip">
          <Video className="size-4" />
        </button>
      )}

      {open && !rec && (
        <div className={`hud-panel absolute z-50 w-60 rounded border border-border bg-card p-3 font-mono text-xs ${floating ? "bottom-14 right-0" : "right-0 top-12"}`}>
          <div className="mb-2 text-bitcoin">REC CLIP</div>
          <div className="mb-2 flex gap-1">
            {(["8", "15", "30"] as Mode[]).map((m) => (
              <button key={m} type="button" onClick={() => setSecs(m)} className={`flex-1 rounded border px-2 py-1 ${secs === m ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground"}`}>{m}s</button>
            ))}
          </div>
          <div className="mb-3 flex gap-1">
            <button type="button" onClick={() => setVertical(false)} className={`flex-1 rounded border px-2 py-1 ${!vertical ? "border-signal text-signal" : "border-border text-muted-foreground"}`}>16:9</button>
            <button type="button" onClick={() => setVertical(true)} className={`flex-1 rounded border px-2 py-1 ${vertical ? "border-signal text-signal" : "border-border text-muted-foreground"}`}>9:16 REEL</button>
          </div>
          <button type="button" onClick={start} className="w-full rounded bg-bitcoin px-3 py-2 font-bold text-primary-foreground">● START</button>
          {err && <p className="mt-2 text-destructive">{err}</p>}
        </div>
      )}

      {clip && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-background/80 p-4 backdrop-blur-sm" onClick={() => setClip(null)}>
          <div className="hud-panel w-full max-w-lg rounded border border-border bg-card p-4 font-mono text-xs" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-bitcoin">CLIP READY</span>
              <button type="button" onClick={() => setClip(null)} aria-label="Close"><X className="size-4" /></button>
            </div>
            <video src={clip.url} controls autoPlay loop muted playsInline className="max-h-[60vh] w-full rounded bg-background" />
            <div className="mt-3 flex gap-2">
              <a href={clip.url} download={`${label}-clip.${clip.ext}`} className="flex flex-1 items-center justify-center gap-1 rounded bg-bitcoin px-3 py-2 font-bold text-primary-foreground"><Download className="size-3" /> DOWNLOAD .{clip.ext.toUpperCase()}</a>
              <a href={`https://x.com/intent/tweet?text=${shareText}`} target="_blank" rel="noreferrer" className="flex-1 rounded border border-border px-3 py-2 text-center text-signal">𝕏 SHARE</a>
            </div>
            <p className="mt-2 text-muted-foreground">Download first, then attach the clip to your post.</p>
          </div>
        </div>
      )}
    </div>
  );
}

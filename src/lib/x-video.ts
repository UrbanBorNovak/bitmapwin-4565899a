// X-ready video export: H.264 MP4 at fixed even sizes (1280×720 or 720×1280), 30 fps.
// Uses WebCodecs + mp4-muxer when available; falls back to MediaRecorder MP4.

export const X_SIZES = { "16:9": [1280, 720], "9:16": [720, 1280] } as const;
export const X_FPS = 30;
export const X_MAX_SECONDS = 140; // X limit for standard accounts

export interface XRecorder { addFrame(canvas: HTMLCanvasElement, tSeconds: number): void; finish(): Promise<Blob>; kind: "mp4" | "webm"; }

export function canEncodeMp4() {
  return typeof window !== "undefined" && "VideoEncoder" in window && "VideoFrame" in window;
}

export async function createXRecorder(canvas: HTMLCanvasElement): Promise<XRecorder> {
  const { width, height } = canvas;
  if (canEncodeMp4()) {
    let codec = "";
    for (const c of ["avc1.4d0028", "avc1.640028", "avc1.42002a", "avc1.42001f"]) {
      const ok = await VideoEncoder.isConfigSupported({ codec: c, width, height, bitrate: 6_000_000, framerate: X_FPS }).catch(() => null);
      if (ok?.supported) { codec = c; break; }
    }
    if (codec) {
      const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
      const target = new ArrayBufferTarget();
      const muxer = new Muxer({ target, video: { codec: "avc", width, height, frameRate: X_FPS }, fastStart: "in-memory" });
      let err: unknown = null;
      const enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m ?? undefined), error: (e) => { err = e; } });
      enc.configure({ codec, width, height, bitrate: 6_000_000, framerate: X_FPS, avc: { format: "avc" } });
      let n = 0;
      return {
        kind: "mp4",
        addFrame(c, t) {
          // Emit constant-rate frames up to time t so the file is true 30 fps CFR.
          while (n / X_FPS <= t) {
            const f = new VideoFrame(c, { timestamp: Math.round((n * 1e6) / X_FPS), duration: Math.round(1e6 / X_FPS) });
            enc.encode(f, { keyFrame: n % (X_FPS * 2) === 0 });
            f.close();
            n++;
          }
        },
        async finish() {
          await enc.flush(); enc.close();
          if (err) throw err;
          muxer.finalize();
          return new Blob([target.buffer], { type: "video/mp4" });
        },
      };
    }
  }
  const type = ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  const rec = new MediaRecorder(canvas.captureStream(X_FPS), type ? { mimeType: type, videoBitsPerSecond: 6_000_000 } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start(500);
  return {
    kind: type.includes("mp4") ? "mp4" : "webm",
    addFrame() {},
    finish: () => new Promise((res) => { rec.onstop = () => res(new Blob(chunks, { type: type || "video/webm" })); rec.stop(); }),
  };
}

export function xIntentUrl(title: string) {
  const text = `${title} — a Toon Studio episode on real BITMAP land 🟧\n\n#Bitmap #Ordinals #Bitcoin`;
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent("https://bitmapwin.app/toon")}`;
}

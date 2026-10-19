// X-ready video export: H.264 MP4 at fixed even sizes (1280×720 or 720×1280), 30 fps.
// Uses WebCodecs + mp4-muxer when available; falls back to MediaRecorder MP4.

export const X_SIZES = { "16:9": [1280, 720], "9:16": [720, 1280] } as const;
export const X_FPS = 30;
export const X_MAX_SECONDS = 140; // X limit for standard accounts

export interface XRecorder { addFrame(canvas: HTMLCanvasElement, tSeconds: number): void; finish(): Promise<Blob>; kind: "mp4" | "webm"; }

export function canEncodeMp4() {
  return typeof window !== "undefined" && "VideoEncoder" in window && "VideoFrame" in window;
}

/** True only when this browser can really save an X-ready H.264 MP4 at the given size (same checks the recorder uses). */
export async function probeMp4(width = 1280, height = 720): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (canEncodeMp4()) {
    for (const c of ["avc1.4d0028", "avc1.640028", "avc1.42002a", "avc1.42001f"]) {
      const ok = await VideoEncoder.isConfigSupported({ codec: c, width, height, bitrate: 6_000_000, framerate: 30 }).catch(() => null);
      if (ok?.supported) return true;
    }
  }
  return typeof MediaRecorder !== "undefined" && ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1"].some((m) => MediaRecorder.isTypeSupported(m));
}

import { playSoundtrack, sharedCtx } from "@/lib/toon-audio";

async function aacSupported(sr: number) {
  if (typeof AudioEncoder === "undefined") return false;
  const ok = await AudioEncoder.isConfigSupported({ codec: "mp4a.40.2", sampleRate: sr, numberOfChannels: 2, bitrate: 128_000 }).catch(() => null);
  return !!ok?.supported;
}

/** `hasAudio` on the result tells the caller whether the soundtrack made it into the file. */
export async function createXRecorder(canvas: HTMLCanvasElement, audio?: AudioBuffer | null): Promise<XRecorder & { hasAudio: boolean }> {
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
      const withAudio = !!audio && (await aacSupported(audio.sampleRate));
      const muxer = new Muxer({ target, video: { codec: "avc", width, height, frameRate: X_FPS },
        ...(withAudio && audio ? { audio: { codec: "aac" as const, numberOfChannels: 2, sampleRate: audio.sampleRate } } : {}), fastStart: "in-memory" });
      let err: unknown = null;
      const enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m ?? undefined), error: (e) => { err = e; } });
      enc.configure({ codec, width, height, bitrate: 6_000_000, framerate: X_FPS, avc: { format: "avc" } });
      let n = 0;
      return {
        kind: "mp4",
        hasAudio: withAudio,
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
          if (withAudio && audio) {
            const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m ?? undefined), error: (e) => { err = e; } });
            aenc.configure({ codec: "mp4a.40.2", sampleRate: audio.sampleRate, numberOfChannels: 2, bitrate: 128_000 });
            const L = audio.getChannelData(0), R = audio.getChannelData(audio.numberOfChannels > 1 ? 1 : 0);
            const end = Math.min(audio.length, Math.ceil((n / X_FPS) * audio.sampleRate)), CH = 4096;
            for (let i = 0; i < end; i += CH) {
              const len = Math.min(CH, end - i), data = new Float32Array(len * 2);
              data.set(L.subarray(i, i + len), 0); data.set(R.subarray(i, i + len), len);
              const ad = new AudioData({ format: "f32-planar", sampleRate: audio.sampleRate, numberOfFrames: len, numberOfChannels: 2, timestamp: Math.round((i / audio.sampleRate) * 1e6), data });
              aenc.encode(ad); ad.close();
            }
            await aenc.flush(); aenc.close();
            if (err) throw err;
          }
          muxer.finalize();
          return new Blob([target.buffer], { type: "video/mp4" });
        },
      };
    }
  }
  const type = ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  const stream = canvas.captureStream(X_FPS);
  let stopAudio = () => {};
  if (audio) {
    const dest = sharedCtx().createMediaStreamDestination();
    for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
    stopAudio = playSoundtrack(audio, 0, dest);
  }
  const rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 6_000_000 } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start(500);
  return {
    kind: type.includes("mp4") ? "mp4" : "webm",
    hasAudio: !!audio,
    addFrame() {},
    finish: () => new Promise((res) => { rec.onstop = () => { stopAudio(); res(new Blob(chunks, { type: type || "video/webm" })); }; rec.stop(); }),
  };
}

export function xIntentUrl(title: string) {
  const text = `${title} — a Toon Studio episode on real BITMAP land 🟧\n\n#Bitmap #Ordinals #Bitcoin`;
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent("https://bitmapwin.app/toon")}`;
}
